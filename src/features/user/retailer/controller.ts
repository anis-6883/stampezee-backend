import bcrypt from "bcrypt";
import { Request, Response } from "express";
import { COOKIE_KEY, REFRESH_TOKEN_KEY, ROLE } from "../../../configs/constants";
import { deleteFileFromS3Bucket, uploadFileToS3Bucket } from "../../../configs/s3Bucket";
import { apiResponse, asyncHandler, exclude, generateSignature, getRandomInteger } from "../../../helpers";
import { IApiRequest } from "../../../types";
import { retailerSchemaUpdate } from "../../retailer/validation";
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
  const result = await retailerRegisterSchema.validateAsync(req.body);

  const { otp, otpExpiry, isVerified, verifiedAt, image, ref, ...retailerBody } = result;

  retailerBody.password = await bcrypt.hash(retailerBody.password, 10);
  retailerBody.otp = getRandomInteger(100000, 999999);
  retailerBody.otpExpiry = new Date(Date.now() + 2 * 60 * 1000); // 2 min

  const existingRetailer = await Retailer.findOne({ email: retailerBody.email });

  if (existingRetailer && existingRetailer.isVerified) {
    return apiResponse(res, 400, false, "Your email already exists!");
  }

  if (existingRetailer) {
    await Retailer.updateOne(
      { email: retailerBody.email },
      { otp: retailerBody.otp, otpExpiry: retailerBody.otpExpiry }
    );
  } else {
    await Retailer.create({
      ...retailerBody,
      fullName: retailerBody?.lastName ? `${retailerBody.firstName} ${retailerBody.lastName}` : retailerBody.firstName,
    });
  }

  const tempToken = generateSignature({ email: retailerBody.email, role: ROLE.RETAILER }, "15m"); // 15 min

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
  const result = await verifyOtpSchema.validateAsync(req.body);

  const isVerified = req.user.otp === Number(result.otp) && req.user.otpExpiry > new Date();
  if (!isVerified) return apiResponse(res, 400, false, "Invalid Otp!");

  await Retailer.updateOne(
    { email: req.user.email },
    { isVerified: true, verifiedAt: new Date(), otp: null, otpExpiry: null }
  );

  const accessToken = generateSignature({ email: req.user.email, role: ROLE.RETAILER }, "1d");
  const refreshToken = generateSignature({ email: req.user.email, role: ROLE.RETAILER }, "7d");

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

  // Remove Sensitive Data
  const data = exclude(req.user, [
    "password",
    "otp",
    "otpExpiry",
    "isVerified",
    "verifiedAt",
    "createdAt",
    "updatedAt",
  ]);

  return apiResponse(res, 200, true, "Otp verified successfully!", { ...data, role: ROLE.RETAILER });
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

  if (req.user.isVerified) {
    return apiResponse(res, 400, false, "This retailer already verified!");
  }

  if (req.user.otpExpiry > new Date()) {
    return apiResponse(res, 400, false, "Wait 2 minutes to resend OTP!");
  }

  await Retailer.updateOne({ email: req.user.email }, { otp, otpExpiry });

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
  const result = await loginSchema.validateAsync(req.body);

  const retailer: any = await Retailer.findOne({ email: result.email });
  if (!retailer) return apiResponse(res, 401, false, "Please, complete your registration first!");

  if (!retailer.status) return apiResponse(res, 401, false, "Your account has been blocked by admin!");

  if (!retailer.isVerified && retailer.ref === "self") {
    await Retailer.deleteOne({ email: result.email });
    return apiResponse(res, 401, false, "Please, complete your registration first!");
  }

  const isPasswordValid = await bcrypt.compare(result.password, retailer.password);
  if (!isPasswordValid) return apiResponse(res, 401, false, "Invalid Credentials!");

  const accessToken = generateSignature({ email: retailer.email, role: ROLE.RETAILER }, "1d");
  const refreshToken = generateSignature({ email: retailer.email, role: ROLE.RETAILER }, "7d");

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

  // Remove Sensitive Data
  const data = exclude(retailer._doc, ["password", "otp", "otpExpiry"]);

  return apiResponse(res, 200, true, "Retailer Login Successfully!", { ...data, role: ROLE.RETAILER });
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

/**
 * Retailer Profile
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const retailerProfile = asyncHandler(async (req: IApiRequest, res: Response) => {
  // Remove Sensitive Data
  const data = exclude(req.user, ["password", "otp", "otpExpiry"]);

  return apiResponse(res, 200, true, "Retailer Profile", { ...data, role: ROLE.RETAILER });
});

/**
 * Update Retailer Profile
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateRetailerProfile = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await retailerSchemaUpdate.validateAsync(req.body, { abortEarly: false });
  const { softDeleted, password, ...updatedBody } = result;

  const existingRetailer = await Retailer.findOne({ email: updatedBody.email, _id: { $ne: req.user._id } });
  if (existingRetailer) return apiResponse(res, 400, false, "This retailer already exists!");

  // Upload File to S3 Bucket
  if (req.file) {
    const { status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "users");
    if (status) {
      updatedBody.image = key;
    }
    // Delete Existing Image if have
    const prevImage = await Retailer.findById(req.user._id, { image: 1 });
    deleteFileFromS3Bucket(prevImage?.image);
  }

  const retailer: any = await Retailer.findOneAndUpdate({ _id: req.user._id }, updatedBody, {
    new: true,
    projection: { password: 0, createdAt: 0, updatedAt: 0 },
  });

  if (!retailer) {
    return apiResponse(res, 404, false, "Retailer not found!");
  }

  const accessToken = generateSignature({ email: retailer.email, role: ROLE.RETAILER }, "1d");
  const refreshToken = generateSignature({ email: retailer.email, role: ROLE.RETAILER }, "7d");

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

  return apiResponse(res, 200, true, "Retailer profile updated successfully!", retailer);
});
