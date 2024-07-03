import { Response } from "express";
import { uploadFileToS3Bucket } from "../../configs/s3Bucket";
import { apiResponse, asyncHandler, fileValidation, makePaginate } from "../../helpers";
import { IApiRequest } from "../../types";
import Sorting from "../sorting/model";
import Coupon from "./model";
import { couponSchema, couponStatusSchema, updateCouponSchema } from "./validation";

/**
 * Create A Coupon
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const createCoupon = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await couponSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { softDeleted, ...createBody } = result;

  createBody.superAdminId = req.user._id;

  const existingCoupon = await Coupon.findOne({ name: createBody.name });
  if (existingCoupon) return apiResponse(res, 400, false, "This coupon already exists!");

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
    const { status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "coupon");
    if (status) {
      imageKey = key;
    }
  }

  const coupon: any = await Coupon.create({
    ...createBody,
    image: imageKey,
  });

  await Sorting.updateOne({ title: "coupon" }, { $push: { sortedData: coupon._id.toString() } }, { upsert: true });

  return apiResponse(res, 201, true, "Coupon created successfully!", coupon);
});

/**
 * Get All Categories
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllCategories = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = { softDeleted: false };

  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); //case insensitive search. For sensitive remove i
    query.name = regex;
  }

  const [docs, total] = await Promise.all([
    Coupon.find(query).limit(Number(limit)).skip(skip),
    Coupon.find(query).countDocuments(),
  ]);

  const sorting = await Sorting.findOne({ title: "coupon" });
  const sortedIds = sorting ? sorting.sortedData : [];

  const couponMap = new Map(docs.map((coupon) => [coupon._id.toString(), coupon]));
  const sortedList = sortedIds.map((id) => couponMap.get(id)).filter(Boolean);

  const data = makePaginate(sortedList, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Categories fetched successfully!", data);
});

/**
 * Get A Single Coupon
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getSingleCoupon = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const coupon = await Coupon.findOne({ _id: id });
  if (!coupon) return apiResponse(res, 404, false, "Coupon not found!");

  return apiResponse(res, 200, true, "Coupon fetched successfully!", coupon);
});

/**
 * Update A Single Coupon
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateCoupon = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await updateCouponSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { id } = req.params;
  const { softDeleted, image, ...updatedBody } = result;

  const coupon = await Coupon.findOne({ _id: id });
  if (!coupon) return apiResponse(res, 404, false, "Coupon not found!");

  const existingCoupon = await Coupon.findOne({ name: updatedBody.name, _id: { $ne: id } });
  if (existingCoupon) return apiResponse(res, 400, false, "This coupon name already exists!");

  const updatedData: any = await Coupon.findOneAndUpdate({ _id: id }, updatedBody, { new: true });

  return apiResponse(res, 200, true, "Coupon updated successfully!", updatedData);
});

/**
 * Update Status A Single Coupon
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateCouponStatus = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await couponStatusSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { id } = req.params;
  const { status } = result;

  const coupon = await Coupon.findOneAndUpdate(
    { _id: id },
    {
      status,
    },
    {
      new: true,
    }
  );

  if (!coupon) return apiResponse(res, 404, false, "Coupon not found!");

  return apiResponse(res, 200, true, "Coupon status updated successfully!");
});

/**
 * Soft Delete A Coupon
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const softDeleteCoupon = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const coupon = await Coupon.findOneAndUpdate(
    { _id: id },
    {
      softDeleted: true,
    }
  );

  if (!coupon) return apiResponse(res, 404, false, "Coupon not found!");

  await Sorting.updateOne({ title: "coupon" }, { $pull: { sortedData: id } });

  return apiResponse(res, 200, true, "Coupon deleted successfully!");
});

/**
 * Get All Deleted Categories
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllDeletedCategories = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = { softDeleted: true };

  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); //case insensitive search. For sensitive remove i
    query.name = regex;
  }

  const [docs, total] = await Promise.all([
    Coupon.find(query).limit(Number(limit)).skip(skip).sort({ createdAt: "desc" }),
    Coupon.find(query).countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Deleted categories fetched successfully!", data);
});

/**
 * Confirm Delete A Single Coupon
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const confirmDeleteCoupon = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const coupon = await Coupon.findOneAndDelete({ _id: id });
  if (!coupon) return apiResponse(res, 404, false, "Coupon not found!");

  return apiResponse(res, 200, true, "Coupon deleted successfully!");
});
