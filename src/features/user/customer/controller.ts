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
import CollectStamp from "../../../models/collect-stamp";
import Customer from "../../../models/customer";
import OrderStamp from "../../../models/order-stamp";
import SubAdmin from "../../../models/sub-admin";
import { IApiRequest } from "../../../types";
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

  const existingCustomer = await Customer.findOne({
    email: customerBody.email,
  });

  if (existingCustomer && existingCustomer.isVerified && provider === "email") {
    return apiResponse(res, 401, false, "Please log in using the email and password you registered with!");
  }

  if (existingCustomer && existingCustomer.isVerified && provider !== existingCustomer.provider) {
    const providerMessages: Record<string, string> = {
      apple: "Your account was registered using Apple. Please log in with Apple!",
      google: "Your account was registered using Google. Please log in with Google!",
      default: "Please log in using the email and password you registered with!",
    };

    const message = providerMessages[existingCustomer.provider] || providerMessages["default"];

    return apiResponse(res, 401, false, message);
  }

  if (provider !== "email") {
    const token = generateSignature({ email: customerBody.email, role: ROLE.CUSTOMER }, "30 days");

    customerBody.provider = provider;
    customerBody.isVerified = true;
    customerBody.verifiedAt = moment();
    customerBody.token = token;
    customerBody.password = await bcrypt.hash("12345678", 10);

    if (existingCustomer) {
      const customer = await Customer.findByIdAndUpdate(
        existingCustomer._id,
        {
          token,
        },
        {
          new: true,
        }
      );

      const data = exclude(customer._doc, ["password", "otp", "otpExpiry"]);

      apiResponse(res, 201, true, "Login successfully!", data);
    } else {
      const customer: any = await Customer.create(customerBody);
      const data = exclude(customer._doc, ["password", "otp", "otpExpiry"]);
      return apiResponse(res, 201, true, "Login successfully!", data);
    }
  } else {
    customerBody.provider = provider;
    customerBody.password = await bcrypt.hash(customerBody.password, 10);
    customerBody.otp = getRandomInteger(100000, 999999);
    customerBody.otpExpiry = new Date(Date.now() + 2 * 60 * 1000); // 2 min

    const token = generateSignature({ email: customerBody.email, role: ROLE.CUSTOMER, ott: true }, "15m"); // 15 min

    sendVerificationEmail(customerBody.email, customerBody.otp);

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

  return apiResponse(res, 200, true, "Otp verified & Login successfully!", {
    token,
    ...customer._doc,
    role: ROLE.CUSTOMER,
  });
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

  sendVerificationEmail(req.user.email, otp);

  return apiResponse(res, 200, true, "Otp resend successfully!");
});

/**
 * Customer & Sub Admin Login
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const customerAndSubAdminLogin = asyncHandler(async (req: Request, res: Response) => {
  const result = customerLoginSchema.validate(req.body);
  if (result.error) return apiResponse(res, 400, false, formatErrorMsg(result));

  const { email, password, provider } = result.value;

  const customer = await Customer.findOne({ email });
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

  if (!customer && !subAdmin[0]) return apiResponse(res, 401, false, "Please, complete your registration first!");

  // Customer Exist Logic
  if (customer) {
    if (!customer.isVerified) {
      await Customer.deleteOne({ email });
      return apiResponse(res, 401, false, "Please, complete your registration first!");
    }

    if (!customer.status) return apiResponse(res, 401, false, "Your account has been blocked by admin!");

    // Switch Account Login Try
    if (customer.provider !== provider) {
      const providerMessages: any = {
        apple: "Your account was registered using Apple. Please log in with Apple!",
        google: "Your account was registered using Google. Please log in with Google!",
        default: "Please log in using the email and password you registered with!",
      };
      return apiResponse(res, 401, false, providerMessages[customer.provider] || providerMessages.default);
    }

    if (provider === "email") {
      const isPasswordValid = await bcrypt.compare(password, customer.password);
      if (!isPasswordValid) return apiResponse(res, 401, false, "Provided incorrect password!");
    }

    const token = generateSignature({ email: customer.email, role: ROLE.CUSTOMER }, "30 days");
    await Customer.updateOne({ email: customer.email }, { token, deletionRequest: false });

    // Remove Sensitive Data
    const data = exclude(customer._doc, ["password", "otp", "otpExpiry", "softDeleted", "deletionRequest"]);

    return apiResponse(res, 200, true, "Customer login successfully!", { ...data, token, role: ROLE.CUSTOMER });
  }

  // Sub-admin Exist Logic
  if (subAdmin[0]) {
    const isPasswordValid = await bcrypt.compare(password, subAdmin[0].password);
    if (!isPasswordValid) return apiResponse(res, 401, false, "Provided incorrect password!");

    const token = generateSignature({ email: subAdmin[0].email, role: ROLE.SUB_ADMIN }, "30 days");
    await SubAdmin.updateOne({ email: subAdmin[0].email }, { token });

    // Remove Sensitive Data
    const data = exclude(subAdmin[0], ["password"]);

    return apiResponse(res, 200, true, "Sub admin login successfully!", { ...data, token, role: ROLE.SUB_ADMIN });
  }

  return apiResponse(res, 401, false, "Please, complete your registration first!");
});

/**
 * Fetch Customer & Sub-admin Profile
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const customerAndSubAdminProfile = asyncHandler(async (req: IApiRequest, res: Response) => {
  if (!req.user) return apiResponse(res, 401, false, "Unauthorized Request!");

  if (req.role === ROLE.CUSTOMER) {
    const data = exclude(req.user, ["password", "otp", "otpExpiry"]); // Remove Sensitive Data

    [data.totalStamps, data.totalReward] = await Promise.all([
      CollectStamp.countDocuments({ customerId: req?.user?._id }),
      OrderStamp.countDocuments({ customerId: req?.user?._id, rewardCollected: true }),
    ]);

    return apiResponse(res, 200, true, "Fetched Customer Profile!", { ...data, role: ROLE.CUSTOMER });
  }

  if (req.role === ROLE.SUB_ADMIN) {
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

    const data = exclude(subAdmin[0], ["password"]); // Remove Sensitive Data

    return apiResponse(res, 200, true, "Fetched Sub Admin Profile! ", { ...data, role: ROLE.SUB_ADMIN });
  }

  return apiResponse(res, 500, false, "Something went wrong!");
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
 * Forget Password for Customer & Sub-admin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const forgetPassword = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = forgetPasswordSchema.validate(req.body);
  if (result.error) return apiResponse(res, 400, false, formatErrorMsg(result));

  const [customer, subAdmin] = await Promise.all([
    Customer.findOne({ email: result.value.email, status: true, isVerified: true }),
    SubAdmin.findOne({ email: result.value.email, status: true, softDeleted: false }),
  ]);

  if (!customer && !subAdmin) return apiResponse(res, 404, false, "User not found!");

  if (customer) {
    const otp = getRandomInteger(100000, 999999);
    const otpExpiry = new Date(Date.now() + 2 * 60 * 1000); // 2 min

    await Customer.findByIdAndUpdate(customer._id, { otp, otpExpiry });

    const token = generateSignature({ email: customer.email, role: ROLE.CUSTOMER, ott: true }, "15m"); // 15 min

    // Send Otp to Email
    sendVerificationEmail(customer.email, otp);

    return apiResponse(res, 200, true, "Otp sent successfully!", { token });
  }

  if (subAdmin) {
    const otp = getRandomInteger(100000, 999999);
    const otpExpiry = new Date(Date.now() + 2 * 60 * 1000); // 2 min

    await SubAdmin.findByIdAndUpdate(subAdmin._id, { otp, otpExpiry });

    const token = generateSignature({ email: subAdmin.email, role: ROLE.SUB_ADMIN, ott: true }, "15m"); // 15 min

    // Send Otp to Email
    sendVerificationEmail(subAdmin.email, otp);

    return apiResponse(res, 200, true, "Otp sent successfully!", { token });
  }

  return apiResponse(res, 500, true, "Something went wrong!");
});

/**
 * Customer & Sub-Admin Forget Password Otp Verify
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const customerAndSubAdminForgetPasswordOtpVerify = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = verifyOtpSchema.validate(req.body);
  if (result.error) return apiResponse(res, 400, false, formatErrorMsg(result));

  const isVerified = req.user.otp === Number(result.value.otp) && req.user.otpExpiry > new Date();
  if (!isVerified) return apiResponse(res, 400, false, "Invalid Otp!");

  if (req.role === ROLE.CUSTOMER) await Customer.updateOne({ email: req.user.email }, { otp: null, otpExpiry: null });
  if (req.role === ROLE.SUB_ADMIN) await SubAdmin.updateOne({ email: req.user.email }, { otp: null, otpExpiry: null });

  return apiResponse(res, 200, true, "Otp verified successfully!");
});

/**
 * Customer & Sub-Admin Forget Password Resend Otp
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const customerForgetPasswordResendOtp = asyncHandler(async (req: IApiRequest, res: Response) => {
  const otp = getRandomInteger(100000, 999999);
  const otpExpiry = new Date(Date.now() + 2 * 60 * 1000); // 2 min

  if (req.user.otpExpiry > new Date()) return apiResponse(res, 400, false, "Wait 2 minutes to resend OTP!");
  if (req.role === ROLE.CUSTOMER) await Customer.updateOne({ email: req.user.email }, { otp, otpExpiry });
  if (req.role === ROLE.SUB_ADMIN) await SubAdmin.updateOne({ email: req.user.email }, { otp, otpExpiry });

  sendVerificationEmail(req.user.email, otp);

  return apiResponse(res, 200, true, "Otp resend successfully!");
});

/**
 * Customer & Sub-admin Changed Forget Password
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const customerAndSubAdminChangeForgetPassword = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { error, value } = customerChangeForgetPasswordSchema.validate(req.body);
  if (error) return apiResponse(res, 400, false, formatErrorMsg(error));

  const userModel: any = req.role === ROLE.CUSTOMER ? Customer : req.role === ROLE.SUB_ADMIN ? SubAdmin : null;
  if (!userModel) return apiResponse(res, 400, false, "Invalid user role!");

  const user = await userModel.findById(req.user._id);
  if (!user) return apiResponse(res, 404, false, "User not found!");

  const isSamePassword = await bcrypt.compare(value.password, user.password);
  if (isSamePassword) return apiResponse(res, 400, false, "New password cannot be same as old password!");

  const hashedPassword = await bcrypt.hash(value.password, 10);
  await userModel.updateOne({ email: req.user.email }, { password: hashedPassword });

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
  const { deviceToken, address, longitude, latitude, country } = result.value;

  const finalQuery: any = {};

  if (deviceToken) finalQuery.deviceToken = deviceToken;
  if (country) finalQuery.country = country;

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
