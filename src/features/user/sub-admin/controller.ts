import bcrypt from "bcrypt";
import { Request, Response } from "express";
import { ROLE } from "../../../configs/constants";
import {
  apiResponse,
  asyncHandler,
  exclude,
  formatErrorMsg,
  generateSignature,
  getRandomInteger,
} from "../../../helpers";
import { IApiRequest } from "../../../types";
import { sendVerificationEmail } from "../service";
import { forgetPasswordSchema, loginSchema, subAdminChangeForgetPasswordSchema, verifyOtpSchema } from "../validation";
import SubAdmin from "./model";

/**
 * Sub Admin Login
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const subAdminLogin = asyncHandler(async (req: Request, res: Response) => {
  const result = loginSchema.validate(req.body);
  if (result.error) return apiResponse(res, 400, false, formatErrorMsg(result));

  const { email, password } = result.value;

  const subAdmin = await SubAdmin.aggregate([
    { $match: { email: email, status: true, softDeleted: false } },
    {
      $lookup: {
        from: "retailers",
        localField: "retailerId",
        foreignField: "_id",
        as: "retailer",
      },
    },
    {
      $lookup: {
        from: "branches",
        localField: "branchId",
        foreignField: "_id",
        as: "branch",
      },
    },
    {
      $unwind: "$retailer",
    },
    {
      $unwind: "$branch",
    },
    {
      $project: {
        _id: 1,
        firstName: 1,
        lastName: 1,
        fullName: 1,
        email: 1,
        image: 1,
        password: 1,
        "retailer._id": 1,
        "retailer.storeName": 1,
        "retailer.image": 1,
        "retailer.businessCurrency": 1,
        "branch._id": 1,
        "branch.name": 1,
        "branch.address": "$branch.address.name",
      },
    },
  ]);

  if (!subAdmin[0]) {
    return apiResponse(res, 401, false, "Invalid Credentials!");
  }

  const isPasswordValid = await bcrypt.compare(password, subAdmin[0].password);
  if (!isPasswordValid) return apiResponse(res, 401, false, "Invalid Credentials!");

  const token = generateSignature({ email: subAdmin[0].email, role: ROLE.SUB_ADMIN }, "30 days");

  await SubAdmin.updateOne({ _id: subAdmin[0]._id }, { token });

  // Remove Sensitive Data
  const data = exclude(subAdmin[0], ["password", "token"]);

  return apiResponse(res, 200, true, "Sub Admin Login Successfully!", { token, ...data });
});

/**
 * Sub Admin Profile
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const subAdminProfile = asyncHandler(async (req: IApiRequest, res: Response) => {
  const subAdmin = await SubAdmin.aggregate([
    { $match: { email: req.user.email, status: true, softDeleted: false } },
    {
      $lookup: {
        from: "retailers",
        localField: "retailerId",
        foreignField: "_id",
        as: "retailer",
      },
    },
    {
      $lookup: {
        from: "branches",
        localField: "branchId",
        foreignField: "_id",
        as: "branch",
      },
    },
    {
      $unwind: "$retailer",
    },
    {
      $unwind: "$branch",
    },
    {
      $project: {
        _id: 1,
        firstName: 1,
        lastName: 1,
        fullName: 1,
        email: 1,
        image: 1,
        password: 1,
        "retailer._id": 1,
        "retailer.storeName": 1,
        "retailer.image": 1,
        "retailer.businessCurrency": 1,
        "branch._id": 1,
        "branch.name": 1,
        "branch.address": "$branch.address.name",
      },
    },
  ]);

  // Remove Sensitive Data
  const data = exclude(subAdmin[0], ["password"]);

  return apiResponse(res, 200, true, "Sub Admin Profile", data);
});

/**
 * Sub Admin Forget Password
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const subAdminForgetPassword = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = forgetPasswordSchema.validate(req.body);
  if (result.error) return apiResponse(res, 400, false, formatErrorMsg(result));

  const subAdmin = await SubAdmin.findOne({
    email: result.value.email,
    status: true,
  });

  if (!subAdmin) {
    return apiResponse(res, 404, false, "Sub Admin not found!");
  }

  const otp = getRandomInteger(100000, 999999);
  const otpExpiry = new Date(Date.now() + 2 * 60 * 1000); // 2 min

  await SubAdmin.findByIdAndUpdate(subAdmin._id, { otp, otpExpiry });

  const token = generateSignature({ email: subAdmin.email, role: ROLE.SUB_ADMIN, ott: true }, "15m"); // 15 min

  // Send Otp to Email
  sendVerificationEmail(subAdmin.email, otp, "mobile");

  return apiResponse(res, 200, true, "Otp sent successfully!", { token });
});

/**
 * SubAdmin Forget Password Otp Verify
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const subAdminForgetPasswordOtpVerify = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = verifyOtpSchema.validate(req.body);
  if (result.error) return apiResponse(res, 400, false, formatErrorMsg(result));

  const isVerified = req.user.otp === Number(result.value.otp) && req.user.otpExpiry > new Date();
  if (!isVerified) throw "Invalid Otp!";

  await SubAdmin.updateOne({ email: req.user.email }, { otp: null, otpExpiry: null });

  return apiResponse(res, 200, true, "Otp verified successfully!");
});

/**
 * SubAdmin Forget Password Resend Otp
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const subAdminForgetPasswordResendOtp = asyncHandler(async (req: IApiRequest, res: Response) => {
  const otp = getRandomInteger(100000, 999999);
  const otpExpiry = new Date(Date.now() + 2 * 60 * 1000); // 2 min

  if (req.user.otpExpiry > new Date()) {
    return apiResponse(res, 400, false, "Wait 2 minutes to resend OTP!");
  }

  await SubAdmin.updateOne({ email: req.user.email }, { otp, otpExpiry });

  sendVerificationEmail(req.user.email, otp);

  return apiResponse(res, 200, true, "Otp resend successfully!");
});

/**
 * SubAdmin Changed Forget Password
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const subAdminChangeForgetPassword = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = subAdminChangeForgetPasswordSchema.validate(req.body);
  if (result.error) return apiResponse(res, 400, false, formatErrorMsg(result));

  const subAdmin = await SubAdmin.findById(req.user._id);

  const isSame = await bcrypt.compare(result.value.password, subAdmin.password);
  if (isSame) throw "New password cannot be same as old password!";

  const hashedPassword = await bcrypt.hash(result.value.password, 10);
  await SubAdmin.updateOne({ email: req.user.email }, { password: hashedPassword });

  return apiResponse(res, 200, true, "Password changed successfully!");
});
