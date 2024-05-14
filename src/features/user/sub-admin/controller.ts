import bcrypt from "bcrypt";
import { Request, Response } from "express";
import _ from "lodash";
import { COOKIE_KEY, REFRESH_TOKEN_KEY } from "../../../configs/constants";
import { apiResponse, asyncHandler, generateSignature, validateBody } from "../../../helpers";
import { adminRegisterSchema, loginSchema } from "../validation";
import Admin from "./model";

/**
 * Admin Registration
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const adminRegistration = asyncHandler(async (req: Request, res: Response) => {
  const result = validateBody(adminRegisterSchema, req.body);
  if (!_.isEmpty(result)) return apiResponse(res, 400, false, "Invalid Request!", result);

  const existingAdmin = await Admin.findOne({ email: req.body.email });
  if (existingAdmin) return apiResponse(res, 400, false, "This admin already exists!");

  req.body.password = await bcrypt.hash(req.body.password, 10);

  const admin: any = await Admin.create(req.body);

  // Remove Field
  delete admin._doc.password;
  delete admin._doc.updatedAt;

  return apiResponse(res, 201, true, "Admin registration successfully!", admin);
});

/**
 * Admin Login
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const adminLogin = asyncHandler(async (req: Request, res: Response) => {
  const result = validateBody(loginSchema, req.body);
  if (!result) return apiResponse(res, 400, false, "Invalid Request!");

  const admin: any = await Admin.findOne({ email: req.body.email });
  if (!admin) return apiResponse(res, 401, false, "Invalid Credentials!");

  const isPasswordValid = await bcrypt.compare(req.body.password, admin.password);
  if (!isPasswordValid) return apiResponse(res, 401, false, "Invalid Credentials!");

  const accessToken = generateSignature({ email: admin.email }, "1d");
  const refreshToken = generateSignature({ email: admin.email }, "7d");

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
  delete admin._doc.password;
  delete admin._doc.createdAt;
  delete admin._doc.updatedAt;

  return apiResponse(res, 200, true, "Admin Login Successfully!", admin);
});

/**
 * Admin Logout
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const adminLogout = asyncHandler(async (_req: Request, res: Response) => {
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

  return apiResponse(res, 200, true, "Admin Logout Successfully!");
});
