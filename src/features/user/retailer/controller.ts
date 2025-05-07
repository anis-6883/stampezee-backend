import bcrypt from "bcrypt";
import { Request, Response } from "express";
import moment from "moment";
import { PACKAGES, ROLE } from "../../../configs/constants";
import { deleteFileFromS3Bucket, uploadFileToS3Bucket } from "../../../configs/s3Bucket";
import {
  apiResponse,
  asyncHandler,
  exclude,
  generateSignature,
  getRandomInteger,
  getSlugCountMap,
} from "../../../helpers";
import Branch from "../../../models/branch";
import EnrollSubscription from "../../../models/enroll-subscription";
import Enrollment from "../../../models/enrollment";
import Retailer from "../../../models/retailer";
import Subscription from "../../../models/subscription";
import { IApiRequest } from "../../../types";
import { sendInvoiceToEmail } from "../../enroll-subscription/service";
import { retailerSchemaUpdate } from "../../retailer/validation";
import { sendVerificationEmail } from "../service";
import OrderStamp from "../../../models/order-stamp";
import {
  forgetPasswordSchema,
  loginSchema,
  retailerChangeForgetPasswordSchema,
  retailerChangePasswordSchema,
  retailerRegisterSchema,
  verifyOtpOnRegSchema,
  verifyOtpSchema,
} from "../validation";

const ALARM_EXPIRE_TIME = 60 * 60 * 24 * 29 * 1000; // 29 Days

/**
 * Retailer Registration & Send OTP
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
    return apiResponse(res, 400, false, "This email already registered!");
  }

  existingRetailer
    ? await Retailer.findOneAndUpdate(
        { email: retailerBody.email },
        { otp: retailerBody.otp, otpExpiry: retailerBody.otpExpiry }
      )
    : await Retailer.create({
        ...retailerBody,
        fullName: retailerBody?.lastName
          ? `${retailerBody.firstName} ${retailerBody.lastName}`
          : retailerBody.firstName,
      });

  const tempToken = generateSignature({ email: retailerBody.email, role: ROLE.RETAILER, ott: true }, 600); //15 minute // 15 min

  sendVerificationEmail(retailerBody.email, retailerBody.otp);

  return apiResponse(res, 201, true, "OTP send successfully!", {
    temp: tempToken,
  });
});

/**
 * Retailer OTP Verify & Login
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const retailerOtpVerify = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await verifyOtpOnRegSchema.validateAsync(req.body);

  const isVerified = req.user.otp === Number(result.otp) && req.user.otpExpiry > new Date();
  if (!isVerified) return apiResponse(res, 400, false, "Invalid OTP!");

  const retailer = await Retailer.findOneAndUpdate(
    { email: req.user.email },
    {
      takeFreeTrial: result.selectFreeTrial,
      isVerified: true,
      verifiedAt: new Date(),
      otp: null,
      otpExpiry: null,
    },
    { new: true }
  );

  if (result.selectFreeTrial) {
    const freeTrial = await Subscription.findOne({ slug: "trial" });
    if (!freeTrial) return apiResponse(res, 400, false, "Free trial package not found!");

    const enrollment: any = await Enrollment.create({
      retailerId: retailer._id,
      planExists: PACKAGES.TRIAL,
      paymentStatus: "trial",
      validityFrom: moment(),
      validityTo: moment().add(freeTrial.duration, "days"),
      enrollStatus: "trial",
    });

    const enrollSubscription = await EnrollSubscription.create({
      enrollmentId: enrollment?._id,
      planSnapshot: freeTrial,
      status: true,
    });

    await Branch.create({
      name: retailer.storeName,
      address: {
        loc: { type: "Point", coordinates: [retailer.longitude, retailer.latitude] },
        name: retailer.address,
      },
      retailerId: retailer._id,
      enrollSubscriptionId: enrollSubscription._id,
      source: "subscription",
    });

    const customerInfo = {
      name: req?.user.firstName + req?.user?.lastName,
      phone: `${req?.user?.dialCode}-${req?.user?.phone}`,
      address: `${req?.user?.address}`,
    };

    let subTotal = 0;
    const purchasedItems = [
      {
        title: "Free Trial",
        quantity: 1,
        unitPrice: `0.00 CAD`,
        total: `0.00 CAD`,
      },
    ];

    const invoiceMetadata = {
      invoiceNo: "INV-" + req?.user?._id.toHexString()?.slice(-8).toUpperCase(),
      subtotal: `${Number(subTotal).toFixed(2)} CAD`,
      total: `0.00 CAD`,
    };
    const paymentInfo = {
      bankName: "Fauget Bank",
      accountName: "Juliana Silva",
      accountNo: "123-456-7890",
      date: enrollment.createdAt,
    };

    await sendInvoiceToEmail({
      email: req?.user?.email,
      customerInfo,
      purchasedItems,
      invoiceMetadata,
      paymentInfo,
    });
  }

  const accessToken = generateSignature({ email: req.user.email, role: ROLE.RETAILER }, 2592000); // 30 Day expiry 30*24*60*60;
  const refreshToken = generateSignature({ email: req.user.email, role: ROLE.RETAILER }, 5184000); // 60 Day expiry 60*24*60*60;

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

  return apiResponse(res, 200, true, "OTP verified & Login successfully!", {
    ...data,
    accessToken,
    refreshToken,
    expiresIn: new Date().setTime(new Date().getTime() + ALARM_EXPIRE_TIME),
    role: ROLE.RETAILER,
  });
});

/**
 * Retailer Resend OTP
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const retailerResendOtp = asyncHandler(async (req: IApiRequest, res: Response) => {
  const otp = getRandomInteger(100000, 999999);
  const otpExpiry = new Date(Date.now() + 2 * 60 * 1000); // 10 min

  if (req.user.isVerified) {
    return apiResponse(res, 400, false, "This retailer already verified!");
  }

  if (req.user.otpExpiry > new Date()) {
    return apiResponse(res, 400, false, "Wait 2 minutes to resend OTP!");
  }

  await Retailer.updateOne({ email: req.user.email }, { otp, otpExpiry });

  sendVerificationEmail(req.user.email, otp);

  return apiResponse(res, 200, true, "OTP resend successfully!");
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

  // Check Subscription & Addon Enrollment
  const [planEnrollment, addonEnrollments] = await Promise.all([
    Enrollment.aggregate([
      {
        $match: {
          retailerId: retailer._id,
          planExists: { $ne: null },
          paymentStatus: { $in: ["completed", "trial"] },
          validityTo: { $gt: new Date() },
          status: true,
        },
      },
      {
        $lookup: {
          from: "enroll_subscriptions",
          localField: "_id",
          foreignField: "enrollmentId",
          as: "enrollSubscription",
          pipeline: [
            {
              $match: {
                "planSnapshot.type": "subscription",
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$enrollSubscription",
          preserveNullAndEmptyArrays: true,
        },
      },
    ]),
    Enrollment.aggregate([
      {
        $match: {
          retailerId: retailer._id,
          paymentStatus: "completed",
          validityTo: { $gt: new Date() },
        },
      },
      {
        $lookup: {
          from: "enroll_subscriptions",
          localField: "_id",
          foreignField: "enrollmentId",
          as: "enrollSubscriptions",
          pipeline: [
            {
              $match: {
                $or: [
                  { status: true, deletedByRetailerAt: null },
                  { status: false, validAtAfterCancel: { $gt: new Date() } },
                ],
              },
            },
            {
              $project: {
                slug: "$planSnapshot.slug",
              },
            },
          ],
        },
      },
      {
        $addFields: {
          slugs: {
            $map: {
              input: "$enrollSubscriptions",
              as: "subscription",
              in: "$$subscription.slug",
            },
          },
        },
      },
      {
        $project: {
          slugs: 1,
        },
      },
    ]),
  ]);

  const slugMap = getSlugCountMap(addonEnrollments);
  const activeAddonSlugs = [];
  const { BRANCH, STAMP, CUSTOM_STAMP_IMAGE, PUSH_NOTIFICATION_USER, PUSH_NOTIFICATION_LOCATION } = PACKAGES;

  for (const slug of [BRANCH, STAMP, CUSTOM_STAMP_IMAGE, PUSH_NOTIFICATION_USER, PUSH_NOTIFICATION_LOCATION]) {
    if (Object.keys(slugMap).includes(slug)) activeAddonSlugs.push(slug);
  }

  const accessToken = generateSignature({ email: retailer.email, role: ROLE.RETAILER }, 2592000); // 30 Day expiry 30*24*60*60;
  const refreshToken = generateSignature({ email: retailer.email, role: ROLE.RETAILER }, 5184000); // 60 Day expiry 60*24*60*60;

  // Remove Sensitive Data
  const data = exclude(retailer._doc, ["password", "otp", "otpExpiry", "createdAt", "updatedAt", "softDeleted"]);

  const { enrollSubscription, planExists, currency, validityFrom, validityTo } = planEnrollment[0] ?? {};

  data.role = ROLE.RETAILER;
  data.accessToken = accessToken;
  data.refreshToken = refreshToken;

  data.plan = planExists ?? null;
  data.planPaymentCurrency = currency ?? null;
  data.planPayment = enrollSubscription?.planCurrentPrice
    ? Number((planEnrollment[0]?.enrollSubscription?.planCurrentPrice).toFixed(2))
    : null;
  data.planStartAt = validityFrom ?? null;
  data.planValidAt = validityTo ?? null;
  data.activeAddonSlugs = activeAddonSlugs;

  data.totalBranch = (enrollSubscription?.planSnapshot?.allowTotalBranch ?? 0) + (slugMap[BRANCH] ?? 0);
  data.totalStamp = (enrollSubscription?.planSnapshot?.allowTotalStamp ?? 0) + (slugMap[STAMP] ?? 0);

  data.totalCustomStampImage = slugMap[CUSTOM_STAMP_IMAGE] ?? 0;
  data.totalRegularNotification = slugMap[PUSH_NOTIFICATION_USER] ?? 0;
  data.totalLocationNotification = slugMap[PUSH_NOTIFICATION_LOCATION] ?? 0;
  data.expiresIn = new Date().setTime(new Date().getTime() + ALARM_EXPIRE_TIME);

  return apiResponse(res, 200, true, "Retailer Login Successfully!", data);
});

/**
 * Retailer Logout
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const retailerLogout = asyncHandler(async (_req: Request, res: Response) => {});

/**
 * Retailer Profile
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const retailerProfile = asyncHandler(async (req: IApiRequest, res: Response) => {
  // Remove Sensitive Data
  const data = exclude(req.user, ["password", "otp", "otpExpiry", "createdAt", "updatedAt", "softDeleted"]);

  // Check Subscription & Addon Enrollment
  const [planEnrollment, addonEnrollments] = await Promise.all([
    Enrollment.aggregate([
      {
        $match: {
          retailerId: req.user._id,
          planExists: { $ne: null },
          paymentStatus: { $in: ["completed", "trial"] },
          validityTo: { $gt: new Date() },
          status: true,
        },
      },
      {
        $lookup: {
          from: "enroll_subscriptions",
          localField: "_id",
          foreignField: "enrollmentId",
          as: "enrollSubscription",
          pipeline: [
            {
              $match: {
                "planSnapshot.type": "subscription",
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$enrollSubscription",
          preserveNullAndEmptyArrays: true,
        },
      },
    ]),
    Enrollment.aggregate([
      {
        $match: {
          retailerId: req.user._id,
          paymentStatus: "completed",
          validityTo: { $gt: new Date() },
        },
      },
      {
        $lookup: {
          from: "enroll_subscriptions",
          localField: "_id",
          foreignField: "enrollmentId",
          as: "enrollSubscriptions",
          pipeline: [
            {
              $match: {
                $or: [
                  { status: true, deletedByRetailerAt: null },
                  { status: false, validAtAfterCancel: { $gt: new Date() } },
                ],
              },
            },
            {
              $project: {
                slug: "$planSnapshot.slug",
              },
            },
          ],
        },
      },
      {
        $addFields: {
          slugs: {
            $map: {
              input: "$enrollSubscriptions",
              as: "subscription",
              in: "$$subscription.slug",
            },
          },
        },
      },
      {
        $project: {
          slugs: 1,
        },
      },
    ]),
  ]);

  const slugMap = getSlugCountMap(addonEnrollments);
  const activeAddonSlugs = [];
  const { BRANCH, STAMP, CUSTOM_STAMP_IMAGE, PUSH_NOTIFICATION_USER, PUSH_NOTIFICATION_LOCATION } = PACKAGES;

  for (const slug of [BRANCH, STAMP, CUSTOM_STAMP_IMAGE, PUSH_NOTIFICATION_USER, PUSH_NOTIFICATION_LOCATION]) {
    if (Object.keys(slugMap).includes(slug)) activeAddonSlugs.push(slug);
  }

  const { enrollSubscription, planExists, currency, validityFrom, validityTo } = planEnrollment[0] ?? {};
  data.isLimitExceeded = false;
  data.allowTotalScan = null;
  data.allowTotalUser = null;
  if (planExists == "trial") {
    const [[freeTrialRetailers], subscription] = await Promise.all([
      OrderStamp.aggregate([
        {
          $match: {
            $expr: { $eq: ["$retailerId", req?.user?._id] },
          },
        },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            customerIds: { $addToSet: "$customerId" },
          },
        },
        {
          $project: {
            _id: 0,
            totalOrders: 1,
            uniqueCustomers: { $size: "$customerIds" },
          },
        },
      ]),
      Subscription.findOne({ slug: "trial" }).select("allowTotalUser allowTotalScan"),
    ]);
    if (freeTrialRetailers && subscription && (subscription.allowTotalScan || subscription.allowTotalUser)) {
      const { allowTotalScan, allowTotalUser } = subscription;
      const { totalOrders, uniqueCustomers } = freeTrialRetailers;

      const scanLimitReached = allowTotalScan && totalOrders >= allowTotalScan;
      const userLimitReached = allowTotalUser && uniqueCustomers >= allowTotalUser;

      if (scanLimitReached || userLimitReached) {
        data.isLimitExceeded = true;
        data.allowTotalScan = allowTotalScan;
        data.allowTotalUser = allowTotalUser;
      }
    }
  }
  data.role = ROLE.RETAILER;
  data.plan = planExists ?? null;
  data.planPaymentCurrency = currency ?? null;
  data.planPayment = enrollSubscription?.planCurrentPrice
    ? Number((planEnrollment[0]?.enrollSubscription?.planCurrentPrice).toFixed(2))
    : null;
  data.planStartAt = validityFrom ?? null;
  data.planValidAt = validityTo ?? null;
  data.activeAddonSlugs = activeAddonSlugs;

  data.totalBranch = (enrollSubscription?.planSnapshot?.allowTotalBranch ?? 0) + (slugMap[BRANCH] ?? 0);
  data.totalStamp = (enrollSubscription?.planSnapshot?.allowTotalStamp ?? 0) + (slugMap[STAMP] ?? 0);

  data.totalCustomStampImage = slugMap[CUSTOM_STAMP_IMAGE] ?? 0;
  data.totalRegularNotification = slugMap[PUSH_NOTIFICATION_USER] ?? 0;
  data.totalLocationNotification = slugMap[PUSH_NOTIFICATION_LOCATION] ?? 0;

  return apiResponse(res, 200, true, "Retailer profile fetched successfully!", data);
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

  if (updatedBody?.deleteImageOnUpdate) {
    const prevImage = await Retailer.findById(req.user._id, { image: 1 });
    deleteFileFromS3Bucket(prevImage?.image);

    updatedBody.image = null;
  }

  const retailer: any = await Retailer.findOneAndUpdate({ _id: req.user._id }, updatedBody, {
    new: true,
    projection: { password: 0, createdAt: 0, updatedAt: 0 },
  });

  if (!retailer) {
    return apiResponse(res, 404, false, "Retailer not found!");
  }

  return apiResponse(res, 200, true, "Retailer profile updated successfully!", retailer);
});

/**
 * Retailer Forget Password
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const retailerForgetPassword = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await forgetPasswordSchema.validateAsync(req.body, { abortEarly: false });

  const retailer = await Retailer.findOne({ email: result.email, status: true, softDeleted: false, isVerified: true });

  if (!retailer) {
    return apiResponse(res, 404, false, "Retailer not found!");
  }

  const otp = getRandomInteger(100000, 999999);
  const otpExpiry = new Date(Date.now() + 2 * 60 * 1000); // 10 min

  await Retailer.findByIdAndUpdate(retailer._id, { otp, otpExpiry });

  const tempToken = generateSignature({ email: retailer.email, role: ROLE.RETAILER, ott: true }, 600); //15 minute // 15 min

  // Send OTP to Email
  sendVerificationEmail(retailer.email, otp);

  return apiResponse(res, 200, true, "OTP sent successfully!", { temp: tempToken });
});

/**
 * Retailer Forget Password Resend OTP
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const retailerForgetPasswordResendOtp = asyncHandler(async (req: IApiRequest, res: Response) => {
  const otp = getRandomInteger(100000, 999999);
  const otpExpiry = new Date(Date.now() + 2 * 60 * 1000); // 10 min

  if (req.user.otpExpiry > new Date()) {
    return apiResponse(res, 400, false, "Wait 2 minutes to resend OTP!");
  }

  await Retailer.updateOne({ email: req.user.email }, { otp, otpExpiry });

  sendVerificationEmail(req.user.email, otp);

  return apiResponse(res, 200, true, "OTP resend successfully!");
});

/**
 * Retailer Forget Password OTP Verify
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const retailerForgetPasswordOtpVerify = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await verifyOtpSchema.validateAsync(req.body);

  const isVerified = req.user.otp === Number(result.otp) && req.user.otpExpiry > new Date();
  if (!isVerified) return apiResponse(res, 400, false, "Invalid OTP!");

  await Retailer.updateOne({ email: req.user.email }, { otp: null, otpExpiry: null });

  return apiResponse(res, 200, true, "OTP verified successfully!");
});

/**
 * Retailer Changed Forget Password
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const retailerChangeForgetPassword = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await retailerChangeForgetPasswordSchema.validateAsync(req.body);

  const hashedPassword = await bcrypt.hash(result.password, 10);

  await Retailer.updateOne({ email: req.user.email }, { password: hashedPassword });

  return apiResponse(res, 200, true, "Password changed successfully!");
});

/**
 * Retailer Changed Password
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const retailerChangePassword = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await retailerChangePasswordSchema.validateAsync(req.body);

  const retailer = await Retailer.findById(req.user._id);

  const isPasswordValid = await bcrypt.compare(result.oldPassword, retailer.password);
  if (!isPasswordValid) return apiResponse(res, 400, false, "Old password is incorrect!");

  const isSame = await bcrypt.compare(result.newPassword, retailer.password);
  if (isSame) return apiResponse(res, 400, false, "New password cannot be same as old password!");

  const hashedPassword = await bcrypt.hash(result.newPassword, 10);

  await Retailer.updateOne({ email: req.user.email }, { password: hashedPassword });

  return apiResponse(res, 200, true, "Password changed successfully!");
});
