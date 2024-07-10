import { Response } from "express";
import { apiResponse, asyncHandler, getUTC, makePaginate } from "../../helpers";
import { IApiRequest } from "../../types";
import Settings from "../settings/model";
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

  createBody.createdBy = req.user._id;

  const existingCoupon = await Coupon.findOne({
    code: createBody.code,
    startedAt: { $lte: createBody.expiredAt },
    expiredAt: { $gte: createBody.startedAt },
    softDeleted: false,
  });

  if (existingCoupon) throw "Coupon already exists within date range!";

  const settings = await Settings.findOne(null, { "general.timezone": 1 });

  if (!settings?.general?.timezone) {
    throw "Setup TimeZone First!";
  }

  const systemTime = getUTC(createBody.startedAt, settings.general.timezone.value);
  const expireTime = getUTC(createBody.expiredAt, settings.general.timezone.value);

  createBody.startedAt = systemTime;
  createBody.expiredAt = expireTime;

  const coupon = await Coupon.create(createBody);

  return apiResponse(res, 201, true, "Coupon created successfully!", coupon);
});

/**
 * Get All Coupons
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllCoupons = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = { softDeleted: false };

  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); //case insensitive search. For sensitive remove i
    const orQuery = [{ title: regex }, { code: regex }];
    query.$or = orQuery;
  }

  const [docs, total] = await Promise.all([
    Coupon.find(query).limit(Number(limit)).skip(skip).sort({ createdAt: "desc" }),
    Coupon.find(query).countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Coupons fetched successfully!", data);
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
  const { softDeleted, ...updatedBody } = result;

  const coupon = await Coupon.findOne({ _id: id });
  if (!coupon) return apiResponse(res, 404, false, "Coupon not found!");

  const existingCoupon = await Coupon.findOne({
    _id: { $ne: id },
    code: updatedBody.code,
    startedAt: { $lte: updatedBody.expiredAt },
    expiredAt: { $gte: updatedBody.startedAt },
    softDeleted: false,
  });

  if (existingCoupon) throw "Coupon already exists within date range!";

  const settings = await Settings.findOne(null, { "general.timezone": 1 });

  if (!settings?.general?.timezone) {
    throw "Setup TimeZone First!";
  }

  const systemTime = getUTC(updatedBody.startedAt, settings.general.timezone.value);
  const expireTime = getUTC(updatedBody.expiredAt, settings.general.timezone.value);

  updatedBody.startedAt = systemTime;
  updatedBody.expiredAt = expireTime;

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
      status: false,
      softDeleted: true,
      deletedBy: req.user._id,
    }
  );

  if (!coupon) return apiResponse(res, 404, false, "Coupon not found!");

  return apiResponse(res, 200, true, "Coupon deleted successfully!");
});

/**
 * Get All Deleted Coupons
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllDeletedCoupons = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = { softDeleted: true };

  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); //case insensitive search. For sensitive remove i
    const orQuery = [{ title: regex }, { code: regex }];
    query.$or = orQuery;
  }

  const [docs, total] = await Promise.all([
    Coupon.find(query).limit(Number(limit)).skip(skip).sort({ createdAt: "desc" }),
    Coupon.find(query).countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Deleted coupons fetched successfully!", data);
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
