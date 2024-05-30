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
import { IApiRequest, IUser } from "../../../types";
import { sendVerificationEmail } from "../service";
import { customerRegisterSchema, locationTokenSchema, loginSchema, verifyOtpSchema } from "../validation";
import Customer from "./model";

/**
 * Customer Registration & Send Otp
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const customerRegistration = asyncHandler(async (req: Request, res: Response) => {
  const result = customerRegisterSchema.validate(req.body);
  if (result.error) return apiResponse(res, 400, false, formatErrorMsg(result));

  const { otp, otpExpiry, isVerified, verifiedAt, image, ref, ...customerBody } = req.body;

  customerBody.password = await bcrypt.hash(customerBody.password, 10);
  customerBody.otp = getRandomInteger(100000, 999999);
  customerBody.otpExpiry = new Date(Date.now() + 2 * 60 * 1000); // 2 min

  const existingCustomer: IUser = await Customer.findOne({ email: customerBody.email });

  if (existingCustomer && existingCustomer.isVerified) {
    return apiResponse(res, 400, false, "This customer already exists!");
  }

  if (existingCustomer) {
    await Customer.updateOne(
      { email: customerBody.email },
      { $set: { otp: customerBody.otp, otpExpiry: customerBody.otpExpiry } }
    );
  } else {
    await Customer.create(customerBody);
  }

  const token = generateSignature({ email: customerBody.email, role: ROLE.CUSTOMER }, "15m"); // 15 min

  sendVerificationEmail(customerBody.email, customerBody.otp, "mobile");

  return apiResponse(res, 201, true, "Otp send successfully!", { token });
});

/**
 * Customer Otp Verify & Login
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const customerOtpVerify = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = verifyOtpSchema.validate(req.body);
  if (result.error) return apiResponse(res, 400, false, formatErrorMsg(result));

  if (req.user.isVerified) {
    return apiResponse(res, 400, false, "This customer already verified!");
  }

  const isVerified = req.user.otp === Number(req.body.otp) && req.user.otpExpiry > new Date();
  if (!isVerified) return apiResponse(res, 400, false, "Invalid Otp!");

  await Customer.updateOne(
    { email: req.user.email },
    { $set: { isVerified: true, verifiedAt: new Date(), otp: null, otpExpiry: null } }
  );

  const token = generateSignature({ email: req.user.email, role: ROLE.CUSTOMER }, "30 days");

  return apiResponse(res, 200, true, "Otp verified successfully!", { token });
});

/**
 * Customer Resend Otp
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const customerResendOtp = asyncHandler(async (req: IApiRequest, res: Response) => {
  const otp = getRandomInteger(100000, 999999);
  const otpExpiry = new Date(Date.now() + 2 * 60 * 1000); // 2 min

  if (req.user.isVerified) {
    return apiResponse(res, 400, false, "This customer already verified!");
  }

  if (req.user.otpExpiry > new Date()) {
    return apiResponse(res, 400, false, "Please, wait for 2 minutes before resend otp!");
  }

  await Customer.updateOne({ email: req.user.email }, { $set: { otp, otpExpiry } });

  sendVerificationEmail(req.user.email, otp, "mobile");

  return apiResponse(res, 200, true, "Otp resend successfully!");
});

/**
 * Customer Login
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const customerLogin = asyncHandler(async (req: Request, res: Response) => {
  const result = loginSchema.validate(req.body);
  if (result.error) return apiResponse(res, 400, false, formatErrorMsg(result));

  const customer: any = await Customer.findOne({ email: req.body.email });
  if (!customer) return apiResponse(res, 401, false, "Please, complete your registration first!");

  if (!customer.isVerified) {
    await Customer.deleteOne({ email: req.body.email });
    return apiResponse(res, 401, false, "Please, complete your registration first!");
  }

  const isPasswordValid = await bcrypt.compare(req.body.password, customer.password);
  if (!isPasswordValid) return apiResponse(res, 401, false, "Invalid Credentials!");

  const token = generateSignature({ email: customer.email, role: ROLE.CUSTOMER }, "30 days");

  // Remove Sensitive Data
  const data = exclude(customer._doc, [
    "password",
    "otp",
    "otpExpiry",
    "isVerified",
    "verifiedAt",
    "createdAt",
    "updatedAt",
  ]);

  return apiResponse(res, 200, true, "Customer Login Successfully!", { token, ...data });
});

/**
 * Customer Profile
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const customerProfile = asyncHandler(async (req: IApiRequest, res: Response) => {
  if (!req.user) return apiResponse(res, 401, false, "Unauthorized Request!");

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

  return apiResponse(res, 200, true, "Customer Profile", data);
});

/**
 * Update Customer Location & Device Token
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateLocationDeviceToken = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result: any = locationTokenSchema.validate(req.body);
  if (result.error) return apiResponse(res, 400, false, formatErrorMsg(result));

  const id = req.user._id;
  const { deviceToken, address, longitude, latitude } = result.value;

  const finalQuery: any = {};

  if (deviceToken) finalQuery.deviceToken = deviceToken;
  if (address)
    finalQuery.address = {
      loc: { type: "Point", coordinates: [longitude, latitude] },
      name: address,
    };

  await Customer.findOneAndUpdate({ _id: id }, finalQuery, { new: true });

  return apiResponse(res, 200, true, "Customer location & token updated successfully!");
});
