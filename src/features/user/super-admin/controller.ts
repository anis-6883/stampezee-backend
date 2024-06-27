import bcrypt from "bcrypt";
import { Request, Response } from "express";
import { COOKIE_KEY, REFRESH_TOKEN_KEY, ROLE } from "../../../configs/constants";
import { deleteFileFromS3Bucket, uploadFileToS3Bucket } from "../../../configs/s3Bucket";
import { apiResponse, asyncHandler, exclude, generateSignature } from "../../../helpers";
import { loginSchema, superAdminRegisterSchema, superAdminRegisterSchema2 } from "../validation";
import SuperAdmin from "./model";

/**
 * Super Admin Registration
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const superAdminRegistration = asyncHandler(async (req: Request, res: Response) => {
  const result = await superAdminRegisterSchema.validateAsync(req.body);

  const existingAdmin = await SuperAdmin.findOne({ email: result.email });
  if (existingAdmin) return apiResponse(res, 400, false, "This Super Admin already exists!");

  result.password = await bcrypt.hash(result.password, 10);

  const superAdmin: any = await SuperAdmin.create(result);

  // Remove Sensitive Data
  const data = exclude(superAdmin._doc, ["password", "createdAt", "updatedAt"]);

  return apiResponse(res, 201, true, "Super Admin registration successfully!", data);
});

/**
 * Super Admin Login
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const superAdminLogin = asyncHandler(async (req: Request, res: Response) => {
  const result = await loginSchema.validateAsync(req.body);

  const superAdmin: any = await SuperAdmin.findOne({ email: result.email });
  if (!superAdmin) return apiResponse(res, 401, false, "Invalid Credentials!");

  const isPasswordValid = await bcrypt.compare(result.password, superAdmin.password);
  if (!isPasswordValid) return apiResponse(res, 401, false, "Invalid Credentials!");

  const accessToken = generateSignature({ email: superAdmin.email, role: ROLE.SUPER_ADMIN }, "1d");
  const refreshToken = generateSignature({ email: superAdmin.email, role: ROLE.SUPER_ADMIN }, "7d");

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
  const data = exclude(superAdmin._doc, ["password", "createdAt", "updatedAt"]);

  return apiResponse(res, 200, true, "Super Admin Login Successfully!", { ...data, role: ROLE.SUPER_ADMIN });
});

/**
 * Super Admin Logout
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const superAdminLogout = asyncHandler(async (_req: Request, res: Response) => {
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

  return apiResponse(res, 200, true, "Super Admin Logout Successfully!");
});

/**
 * Super Admin Profile
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const superAdminProfile = asyncHandler(async (req: any, res: Response) => {
  if (!req.user) return apiResponse(res, 401, false, "Unauthorized Request!");

  // Remove Sensitive Data
  const data = exclude(req.user, ["password", "createdAt", "updatedAt"]);

  return apiResponse(res, 200, true, "Super Admin Profile", { ...data, role: ROLE.SUPER_ADMIN });
});

/**
 * Update Super Admin Profile
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateSuperAdminProfile = asyncHandler(async (req: any, res: Response) => {
  const result = await superAdminRegisterSchema2.validateAsync(req.body, { abortEarly: false });
  const { softDeleted, ...updatedBody } = result;

  const existingSuperAdmin = await SuperAdmin.findOne({ email: updatedBody.email, _id: { $ne: req.user._id } });
  if (existingSuperAdmin) return apiResponse(res, 400, false, "This email already exists!");

  // Upload File to S3 Bucket
  if (req.file) {
    const { status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "users");
    if (status) {
      updatedBody.image = key;
    }
    // Delete Existing Image if have
    const prevImage = await SuperAdmin.findById(req.user._id, { image: 1 });
    deleteFileFromS3Bucket(prevImage?.image);
  }

  const superAdmin: any = await SuperAdmin.findOneAndUpdate({ _id: req.user._id }, updatedBody, {
    new: true,
    projection: { password: 0, createdAt: 0, updatedAt: 0 },
  });

  if (!superAdmin) {
    return apiResponse(res, 404, false, "Super Admin not found!");
  }

  const accessToken = generateSignature({ email: superAdmin.email, role: ROLE.SUPER_ADMIN }, "1d");
  const refreshToken = generateSignature({ email: superAdmin.email, role: ROLE.SUPER_ADMIN }, "7d");

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

  return apiResponse(res, 200, true, "Super Admin updated successfully!", superAdmin);
});
