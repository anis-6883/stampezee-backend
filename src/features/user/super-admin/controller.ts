import bcrypt from "bcrypt";
import { Request, Response } from "express";
import { ROLE } from "../../../configs/constants";
import { deleteFileFromS3Bucket, uploadFileToS3Bucket } from "../../../configs/s3Bucket";
import { apiResponse, asyncHandler, exclude, generateSignature } from "../../../helpers";
import SuperAdmin from "../../../models/super-admin";
import { IApiRequest } from "../../../types";
import {
  loginSchema,
  superAdminChangePasswordSchema,
  superAdminRegisterSchema,
  superAdminRegisterSchema2,
} from "../validation";

const ALARM_EXPIRE_TIME = 60 * 60 * 24 * 29 * 1000; // 29 Days

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

  const accessToken = generateSignature({ email: superAdmin.email, role: ROLE.SUPER_ADMIN }, 30 * 24 * 60 * 60); // 30 Days Expiry
  const refreshToken = generateSignature({ email: superAdmin.email, role: ROLE.SUPER_ADMIN }, 60 * 24 * 60 * 60); // 60 Days Expiry

  // Remove Sensitive Data
  const data = exclude(superAdmin._doc, ["password", "createdAt", "updatedAt"]);

  return apiResponse(res, 200, true, "Super Admin Login Successfully!", {
    ...data,
    accessToken,
    refreshToken,
    expiresIn: new Date().setTime(new Date().getTime() + ALARM_EXPIRE_TIME),
    role: ROLE.SUPER_ADMIN,
  });
});

/**
 * Super Admin Profile
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const superAdminProfile = asyncHandler(async (req: IApiRequest, res: Response) => {
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
export const updateSuperAdminProfile = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await superAdminRegisterSchema2.validateAsync(req.body, { abortEarly: false });
  const { softDeleted, ...updatedBody } = result;

  // const existingSuperAdmin = await SuperAdmin.findOne({ email: updatedBody.email, _id: { $ne: req.user._id } });
  // if (existingSuperAdmin) return apiResponse(res, 400, false, "This email already exists!");

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

  return apiResponse(res, 200, true, "Super Admin updated successfully!", superAdmin);
});

/**
 * SuperAdmin Changed Password
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const superAdminChangePassword = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await superAdminChangePasswordSchema.validateAsync(req.body);

  const superAdmin = await SuperAdmin.findById(req.user._id);

  const isPasswordValid = await bcrypt.compare(result.oldPassword, superAdmin.password);
  if (!isPasswordValid) return apiResponse(res, 400, false, "Old password is incorrect!");

  const isSame = await bcrypt.compare(result.newPassword, superAdmin.password);
  if (isSame) return apiResponse(res, 400, false, "New password cannot be same as old password!");

  const hashedPassword = await bcrypt.hash(result.newPassword, 10);

  await SuperAdmin.updateOne({ email: req.user.email }, { password: hashedPassword });

  return apiResponse(res, 200, true, "Password changed successfully!");
});
