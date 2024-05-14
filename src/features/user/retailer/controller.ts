import bcrypt from "bcrypt";
import { Request, Response } from "express";
import _ from "lodash";
import { COOKIE_KEY, REFRESH_TOKEN_KEY } from "../../../configs/constants";
import { apiResponse, asyncHandler, generateSignature, getRandomInteger, validateBody } from "../../../helpers";
import { sendVerificationEmail } from "../service";
import { loginSchema, retailerRegisterSchema } from "../validation";
import Retailer from "./model";

/**
 * Retailer Registration
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const retailerRegistration = asyncHandler(async (req: Request, res: Response) => {
  const result = validateBody(retailerRegisterSchema, req.body);
  if (!_.isEmpty(result)) return apiResponse(res, 400, false, "Invalid Request!", result);

  const existingAdmin = await Retailer.findOne({ email: req.body.email });
  if (existingAdmin) return apiResponse(res, 400, false, "This retailer already exists!");

  const { storeName, firstName, lastName, email, phone, country, city, province, postalCode, address } = req.body;

  const password = await bcrypt.hash(req.body.password, 10);
  const otp = getRandomInteger(100000, 999999);

  await Retailer.create({
    storeName,
    firstName,
    lastName,
    email,
    password,
    phone,
    country,
    city,
    province,
    postalCode,
    address,
    otp,
    otpExpiry: new Date(new Date().getTime() + 2 * 60 * 1000),
  });

  sendVerificationEmail(req.body.email, otp);

  return apiResponse(res, 201, true, "Otp send successfully!");
});

/**
 * Retailer Login
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const retailerLogin = asyncHandler(async (req: Request, res: Response) => {
  const result = validateBody(loginSchema, req.body);
  if (!result) return apiResponse(res, 400, false, "Invalid Request!");

  const retailer: any = await Retailer.findOne({ email: req.body.email });
  if (!retailer) return apiResponse(res, 401, false, "Invalid Credentials!");

  const isPasswordValid = await bcrypt.compare(req.body.password, retailer.password);
  if (!isPasswordValid) return apiResponse(res, 401, false, "Invalid Credentials!");

  const accessToken = generateSignature({ email: retailer.email }, "1d");
  const refreshToken = generateSignature({ email: retailer.email }, "7d");

  res.cookie(COOKIE_KEY, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "development" ? false : true,
    sameSite: process.env.NODE_ENV === "development" ? "lax" : "none",
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  res.cookie(REFRESH_TOKEN_KEY, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "development" ? false : true,
    sameSite: process.env.NODE_ENV === "development" ? "lax" : "none",
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  // Remove Field
  delete retailer._doc.password;
  delete retailer._doc.createdAt;
  delete retailer._doc.updatedAt;

  return apiResponse(res, 200, true, "Retailer Login Successfully!", retailer);
});

/**
 * Retailer Logout
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const retailerLogout = asyncHandler(async (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_KEY, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "development" ? false : true,
    sameSite: process.env.NODE_ENV === "development" ? "lax" : "none",
    expires: new Date(Date.now()),
  });

  res.clearCookie(REFRESH_TOKEN_KEY, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "development" ? false : true,
    sameSite: process.env.NODE_ENV === "development" ? "lax" : "none",
    expires: new Date(Date.now()),
  });

  return apiResponse(res, 200, true, "Retailer Logout Successfully!");
});
