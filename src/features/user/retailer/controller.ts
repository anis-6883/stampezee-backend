import bcrypt from "bcrypt";
import { Request, Response } from "express";
import _ from "lodash";
import { COOKIE_KEY, REFRESH_TOKEN_KEY } from "../../../configs/constants";
import { apiResponse, asyncHandler, generateSignature, getRandomInteger, validateBody } from "../../../helpers";
import { IApiRequest } from "../../../types";
import { sendVerificationEmail } from "../service";
import { loginSchema, retailerRegisterSchema, verifyOtpSchema } from "../validation";
import Retailer from "./model";

/**
 * Retailer Registration & Send Otp
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const retailerRegistration = asyncHandler(async (req: Request, res: Response) => {
  const result = validateBody(retailerRegisterSchema, req.body);
  if (!_.isEmpty(result)) return apiResponse(res, 400, false, "Invalid Request!", result);

  const { otp, otpExpiry, isVerified, verifiedAt, image, ref, ...retailerBody } = req.body;

  retailerBody.password = await bcrypt.hash(retailerBody.password, 10);
  retailerBody.otp = getRandomInteger(100000, 999999);
  retailerBody.otpExpiry = new Date(Date.now() + 2 * 60 * 1000); // 2 min

  const existingAdmin = await Retailer.findOne({ email: retailerBody.email });

  if (existingAdmin && existingAdmin.isVerified) {
    return apiResponse(res, 400, false, "This retailer already exists!");
  }

  if (existingAdmin) {
    await Retailer.updateOne(
      { email: retailerBody.email },
      { $set: { otp: retailerBody.otp, otpExpiry: retailerBody.otpExpiry } }
    );
  } else {
    await Retailer.create(retailerBody);
  }

  const tempToken = generateSignature({ email: retailerBody.email, role: "retailer" }, "15m"); // 15 min

  res.cookie("temp", tempToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "development" ? false : true,
    sameSite: process.env.NODE_ENV === "development" ? "lax" : "none",
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  sendVerificationEmail(retailerBody.email, retailerBody.otp);

  return apiResponse(res, 201, true, "Otp send successfully!");
});

/**
 * Retailer Otp Verify & Login
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const retailerOtpVerify = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = validateBody(verifyOtpSchema, req.body);
  if (!_.isEmpty(result)) return apiResponse(res, 400, false, "Invalid Request!", result);

  const isVerified = req.user.otp === Number(req.body.otp) && req.user.otpExpiry > new Date();
  if (!isVerified) return apiResponse(res, 400, false, "Invalid Otp!");

  await Retailer.updateOne(
    { email: req.user.email },
    { $set: { isVerified: true, verifiedAt: new Date(), otp: null, otpExpiry: null } }
  );

  const accessToken = generateSignature({ email: req.user.email, role: "retailer" }, "1d");
  const refreshToken = generateSignature({ email: req.user.email, role: "retailer" }, "7d");

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

  // Clear Temporary Token
  res.clearCookie("temp", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "development" ? false : true,
    sameSite: process.env.NODE_ENV === "development" ? "lax" : "none",
    expires: new Date(Date.now()),
  });

  return apiResponse(res, 200, true, "Otp verified successfully!");
});

/**
 * Retailer Resend Otp
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const retailerResendOtp = asyncHandler(async (req: IApiRequest, res: Response) => {
  const otp = getRandomInteger(100000, 999999);
  const otpExpiry = new Date(Date.now() + 2 * 60 * 1000); // 2 min

  if (req.user.otpExpiry > new Date()) {
    return apiResponse(res, 400, false, "Please, wait for 2 minutes before resend otp!");
  }

  await Retailer.updateOne({ email: req.user.email }, { $set: { otp, otpExpiry } });

  sendVerificationEmail(req.user.email, otp);

  return apiResponse(res, 200, true, "Otp resend successfully!");
});

/**
 * Retailer Login
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const retailerLogin = asyncHandler(async (req: Request, res: Response) => {
  const result = validateBody(loginSchema, req.body);
  if (!_.isEmpty(result)) return apiResponse(res, 400, false, "Invalid Request!", result);

  const retailer: any = await Retailer.findOne({ email: req.body.email });
  if (!retailer) return apiResponse(res, 401, false, "Please, complete your registration first!");

  if (!retailer.isVerified) {
    await Retailer.deleteOne({ email: req.body.email });
    return apiResponse(res, 401, false, "Please, complete your registration first!");
  }

  const isPasswordValid = await bcrypt.compare(req.body.password, retailer.password);
  if (!isPasswordValid) return apiResponse(res, 401, false, "Invalid Credentials!");

  const accessToken = generateSignature({ email: retailer.email, role: "retailer" }, "1d");
  const refreshToken = generateSignature({ email: retailer.email, role: "retailer" }, "7d");

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
  delete retailer._doc.otp;
  delete retailer._doc.otpExpiry;
  delete retailer._doc.isVerified;
  delete retailer._doc.verifiedAt;
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
