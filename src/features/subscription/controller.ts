import { Response } from "express";
import { deleteFileFromS3Bucket, uploadFileToS3Bucket } from "../../configs/s3Bucket";
import { apiResponse, asyncHandler, fileValidation, makePaginate } from "../../helpers";
import Subscription from "../../models/subscription";
import { IApiRequest } from "../../types";
import { updateRetailerFreePlan } from "./service";
import { subscriptionSchema, subscriptionStatusSchema, updateSubscriptionSchema } from "./validation";

/**
 * Create A Subscription
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const createSubscription = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await subscriptionSchema.validateAsync(req.body, {
    abortEarly: false,
  });
  if (result?.allowTotalScan == "null") {
    result.allowTotalScan = null;
  }

  if (result?.allowTotalUser == "null") {
    result.allowTotalUser = null;
  }

  result.superAdminId = req.user._id;

  const existingSubscription = await Subscription.findOne({ slug: result.slug });
  if (existingSubscription) return apiResponse(res, 400, false, "This subscription already exists!");

  let imageKey = null;

  // File Validation
  if (req.file) {
    const { status, message } = fileValidation(req.file, undefined, ["image/jpeg", "image/png", "image/jpg"]);
    if (!status) {
      return apiResponse(res, 400, false, "Invalid Request!", { image: message });
    }
  }

  // Upload File to S3 Bucket
  if (req.file) {
    const { status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "subscription");
    if (status) {
      imageKey = key;
    }
  }

  const subscription = await Subscription.create({
    ...result,
    image: imageKey,
  });

  return apiResponse(res, 201, true, "Subscription created successfully!", subscription);
});

/**
 * Get All Subscriptions
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllSubscriptions = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10 } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const [docs, total] = await Promise.all([
    Subscription.find({ softDeleted: false }).limit(Number(limit)).skip(skip).sort({ createdAt: "asc" }),
    Subscription.countDocuments({ softDeleted: false }),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Subscriptions fetched successfully!", data);
});

/**
 * Get A Single Subscription
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getSingleSubscription = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const subscription = await Subscription.findOne({ _id: id });
  if (!subscription) return apiResponse(res, 404, false, "Subscription not found!");

  return apiResponse(res, 200, true, "Subscription fetched successfully!", subscription);
});

/**
 * Update A Single Subscription
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateSubscription = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await updateSubscriptionSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  if (result?.allowTotalScan == "null") result.allowTotalScan = null;
  if (result?.allowTotalUser == "null") result.allowTotalUser = null;

  const { id } = req.params;
  const { softDeleted, image, slug, ...updatedBody } = result;

  const subscription = await Subscription.findOne({ slug, _id: { $ne: id } });
  if (subscription) return apiResponse(res, 400, false, "Slug must be unique!");

  // File Validation
  if (req.file) {
    const { status, message } = fileValidation(req.file, undefined, ["image/jpeg", "image/png", "image/jpg"]);
    if (!status) return apiResponse(res, 400, false, "Invalid Request!", { image: message });
  }

  // Upload File to S3 Bucket
  if (req.file) {
    const { status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "subscription");
    if (status) updatedBody.image = key;

    // Delete Existing Image if have
    const prevImage = await Subscription.findById(id, { image: 1 });
    deleteFileFromS3Bucket(prevImage?.image);
  }

  if (!updatedBody?.isUnlimited) updatedBody.unlimitedFieldName = null;

  const updatedData = await Subscription.findOneAndUpdate({ _id: id }, updatedBody, { new: true });
  if (!updatedData) return apiResponse(res, 404, false, "Subscription not found!");

  if (updatedData?.slug === "trial") updateRetailerFreePlan(updatedData);

  return apiResponse(res, 200, true, "Subscription updated successfully!", updatedData);
});

/**
 * Update Status A Subscription
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateSubscriptionStatus = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await subscriptionStatusSchema.validateAsync(req.body, {
    abortEarly: false,
  });
  const { id } = req.params;
  const { status } = result;

  const subscription = await Subscription.findOneAndUpdate(
    { _id: id },
    {
      status,
    },
    {
      new: true,
    }
  );

  if (!subscription) return apiResponse(res, 404, false, "Subscription not found!");

  return apiResponse(res, 200, true, "Subscription status updated successfully!");
});

/**
 * Soft Delete A Subscription
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const softDeleteSubscription = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const subscription = await Subscription.findOneAndUpdate(
    { _id: id },
    {
      softDeleted: true,
    }
  );

  if (!subscription) return apiResponse(res, 404, false, "Subscription not found!");

  return apiResponse(res, 200, true, "Subscription deleted successfully!");
});

/**
 * Get All Deleted Subscription
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllDeletedSubscription = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10 } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const [docs, total] = await Promise.all([
    Subscription.find({ softDeleted: true }).limit(Number(limit)).skip(skip).sort({ createdAt: "desc" }),
    Subscription.find({ softDeleted: true }).countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Deleted subscriptions fetched successfully!", data);
});

/**
 * Confirm Delete A Single Subscription
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const confirmDeleteSubscription = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  // Delete Existing Image if have
  const prevImage = await Subscription.findById(id, { image: 1 });
  deleteFileFromS3Bucket(prevImage?.image);

  const subscription = await Subscription.findOneAndDelete({ _id: id });
  if (!subscription) return apiResponse(res, 404, false, "Subscription not found!");

  return apiResponse(res, 200, true, "Subscription deleted successfully!");
});
