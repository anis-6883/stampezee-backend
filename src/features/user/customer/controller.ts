import bcrypt from "bcrypt";
import { Request, Response } from "express";
import moment from "moment";
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
import CollectStamp from "../../mobile/customer/search/model";
import OrderStamp from "../../mobile/sub-admin/home/model";
import { sendVerificationEmail } from "../service";
import {
  customerChangeForgetPasswordSchema,
  customerLoginSchema,
  customerRegisterSchema,
  customerUpdateProfile,
  forgetPasswordSchema,
  locationTokenSchema,
  verifyOtpSchema,
} from "../validation";
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

  const { otp, otpExpiry, isVerified, verifiedAt, image, ref, provider, ...customerBody } = result.value;

  const existingCustomer: IUser = await Customer.findOne({
    email: customerBody.email,
  });

  if (existingCustomer && existingCustomer.isVerified && provider === "email") {
    let message;
    switch (existingCustomer.provider) {
      case "apple":
        message = "Your account was registered using Apple. Please log in with Apple!";
        break;
      case "google":
        message = "Your account was registered using Google. Please log in with Google!";
        break;
      default:
        message = "Please log in using the email and password you registered with!";
        break;
    }
    return apiResponse(res, 401, false, message);
  }

  if (provider !== "email") {
    const token = generateSignature({ email: customerBody.email, role: ROLE.CUSTOMER }, "30 days");

    customerBody.provider = provider;
    customerBody.isVerified = true;
    customerBody.verifiedAt = moment();
    customerBody.token = token;
    customerBody.password = await bcrypt.hash("123456", 10);

    const customer: any = existingCustomer ?? (await Customer.create(customerBody));

    return apiResponse(res, 201, true, "Login successfully!", { token, ...customer._doc });
  } else {
    customerBody.provider = provider;
    customerBody.password = await bcrypt.hash(customerBody.password, 10);
    customerBody.otp = getRandomInteger(100000, 999999);
    customerBody.otpExpiry = new Date(Date.now() + 2 * 60 * 1000); // 2 min

    const token = generateSignature({ email: customerBody.email, role: ROLE.CUSTOMER, ott: true }, "15m"); // 15 min

    sendVerificationEmail(customerBody.email, customerBody.otp, "mobile");

    if (existingCustomer) {
      await Customer.updateOne(
        { email: customerBody.email },
        { $set: { otp: customerBody.otp, otpExpiry: customerBody.otpExpiry, token } }
      );
    } else {
      customerBody.token = token;
      await Customer.create(customerBody);
    }

    return apiResponse(res, 201, true, "Otp send successfully!", { token });
  }
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

  const isVerified = req.user.otp === Number(result.value.otp) && req.user.otpExpiry > new Date();
  if (!isVerified) return apiResponse(res, 400, false, "Invalid Otp!");

  const token = generateSignature({ email: req.user.email, role: ROLE.CUSTOMER }, "30 days");

  const customer: any = await Customer.findOneAndUpdate(
    { email: req.user.email },
    { isVerified: true, token, verifiedAt: new Date(), otp: null, otpExpiry: null },
    {
      new: true,
      projection: { password: 0, createdAt: 0, updatedAt: 0, otp: 0, otpExpiry: 0 },
    }
  );

  return apiResponse(res, 200, true, "Otp verified & Login successfully!", { token, ...customer._doc });
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
  const result = customerLoginSchema.validate(req.body);
  if (result.error) return apiResponse(res, 400, false, formatErrorMsg(result));

  const { email, password } = result.value;

  const customer: any = await Customer.findOne({ email });
  if (!customer) return apiResponse(res, 401, false, "Please, complete your registration first!");

  if (!customer.isVerified) {
    await Customer.deleteOne({ email });
    return apiResponse(res, 401, false, "Please, complete your registration first!");
  }

  if (!customer.status) return apiResponse(res, 401, false, "Your account has been blocked by admin!");

  // Switch Account Login Try
  if (customer.provider != "email") {
    let message;
    switch (customer.provider) {
      case "apple":
        message = "Your account was registered using Apple. Please log in with Apple!";
        break;
      case "google":
        message = "Your account was registered using Google. Please log in with Google!";
        break;
      default:
        message = "Please log in using the email and password you registered with!";
        break;
    }
    return apiResponse(res, 401, false, message);
  }

  const isPasswordValid = await bcrypt.compare(password, customer.password);
  if (!isPasswordValid) return apiResponse(res, 401, false, "Invalid Credentials!");

  const token = generateSignature({ email: customer.email, role: ROLE.CUSTOMER }, "30 days");
  await Customer.updateMany({ email: customer.email }, { token, deletionRequest: false });

  // Remove Sensitive Data
  const data = exclude(customer._doc, [
    "password",
    "otp",
    "otpExpiry",
    "isVerified",
    "verifiedAt",
    "createdAt",
    "updatedAt",
    "token",
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

  [data.totalStamps, data.totalReward] = await Promise.all([
    CollectStamp.countDocuments({ customerId: req?.user?._id }),
    OrderStamp.countDocuments({ customerId: req?.user?._id, rewardCollected: true }),
  ]);

  return apiResponse(res, 200, true, "Customer Profile", data);
});

/**
 * Update Customer Profile
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateCustomerProfile = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = customerUpdateProfile.validate(req.body);
  if (result.error) return apiResponse(res, 400, false, formatErrorMsg(result));

  const { softDeleted, password, ...updatedBody } = result.value;

  const customer: any = await Customer.findOneAndUpdate({ _id: req.user._id }, updatedBody, {
    new: true,
    projection: { password: 0, createdAt: 0, updatedAt: 0, otp: 0, otpExpiry: 0 },
  });

  if (!customer) {
    return apiResponse(res, 404, false, "Customer not found!");
  }

  return apiResponse(res, 200, true, "Customer profile updated successfully!", customer);
});

/**
 * Customer Forget Password
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const customerForgetPassword = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = forgetPasswordSchema.validate(req.body);
  if (result.error) return apiResponse(res, 400, false, formatErrorMsg(result));

  const customer = await Customer.findOne({
    email: result.value.email,
    status: true,
    isVerified: true,
  });

  if (!customer) {
    return apiResponse(res, 404, false, "Customer not found!");
  }

  const otp = getRandomInteger(100000, 999999);
  const otpExpiry = new Date(Date.now() + 2 * 60 * 1000); // 2 min

  await Customer.findByIdAndUpdate(customer._id, { otp, otpExpiry });

  const token = generateSignature({ email: customer.email, role: ROLE.CUSTOMER, ott: true }, "15m"); // 15 min

  // Send Otp to Email
  sendVerificationEmail(customer.email, otp, "mobile");

  return apiResponse(res, 200, true, "Otp sent successfully!", { token });
});

/**
 * Customer Forget Password Otp Verify
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const customerForgetPasswordOtpVerify = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = verifyOtpSchema.validate(req.body);
  if (result.error) return apiResponse(res, 400, false, formatErrorMsg(result));

  const isVerified = req.user.otp === Number(result.value.otp) && req.user.otpExpiry > new Date();
  if (!isVerified) return apiResponse(res, 400, false, "Invalid Otp!");

  await Customer.updateOne({ email: req.user.email }, { otp: null, otpExpiry: null });

  return apiResponse(res, 200, true, "Otp verified successfully!");
});

/**
 * Customer Forget Password Resend Otp
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const customerForgetPasswordResendOtp = asyncHandler(async (req: IApiRequest, res: Response) => {
  const otp = getRandomInteger(100000, 999999);
  const otpExpiry = new Date(Date.now() + 2 * 60 * 1000); // 2 min

  if (req.user.otpExpiry > new Date()) {
    return apiResponse(res, 400, false, "Wait 2 minutes to resend OTP!");
  }

  await Customer.updateOne({ email: req.user.email }, { otp, otpExpiry });

  sendVerificationEmail(req.user.email, otp);

  return apiResponse(res, 200, true, "Otp resend successfully!");
});

/**
 * Customer Changed Forget Password
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const customerChangeForgetPassword = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = customerChangeForgetPasswordSchema.validate(req.body);
  if (result.error) return apiResponse(res, 400, false, formatErrorMsg(result));

  const customer = await Customer.findById(req.user._id);

  const isSame = await bcrypt.compare(result.value.password, customer.password);
  if (isSame) throw "New password cannot be same as old password!";

  const hashedPassword = await bcrypt.hash(result.value.password, 10);
  await Customer.updateOne({ email: req.user.email }, { password: hashedPassword });

  return apiResponse(res, 200, true, "Password changed successfully!");
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

/**
 * Request delete account for Customer
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const deleteAccount = asyncHandler(async (req: IApiRequest, res: Response) => {
  const userResponse = await Customer.findOneAndUpdate(
    { _id: req?.user?._id },
    { token: null, deletionRequest: true, deviceToken: null }
  ).select("_id");
  if (userResponse) {
    return apiResponse(res, 200, true, "Customer has been deleted successfully");
  } else {
    throw "Something went wrong.";
  }
});
