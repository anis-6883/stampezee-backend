import { Response } from "express";
import { apiResponse, asyncHandler, makePaginate } from "../../helpers";
import { getUTC } from "../../helpers/moment";
import Coupon from "../../models/coupon";
import Retailer from "../../models/retailer";
import Settings from "../../models/settings";
import Subscription from "../../models/subscription";
import { IApiRequest } from "../../types";
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

  const [existingCoupon, subscriptions] = await Promise.all([
    Coupon.findOne({
      code: createBody.code,
      startedAt: { $lte: createBody.expiredAt },
      expiredAt: { $gte: createBody.startedAt },
      softDeleted: false,
    }),
    Subscription.find({ _id: { $in: createBody?.applicablePackages || [] }, slug: { $ne: "trial" } }),
  ]);

  if (existingCoupon) return apiResponse(res, 400, false, "Coupon already exists within date range!");
  if (subscriptions.length === 0) return apiResponse(res, 400, false, "Provided invalid packages!");

  if (createBody.discountType === "flat") {
    let greaterValue = "";

    for (const subscription of subscriptions) {
      if (createBody.discount >= subscription.price / 2) {
        greaterValue = Number(subscription.price / 2).toFixed(2);
        break;
      }
    }

    if (greaterValue) {
      return apiResponse(res, 400, false, `Discount must be less than ${greaterValue} CAD of the package price!`);
    }
  }

  const settings = await Settings.findOne(null, { "general.timezone": 1 });
  if (!settings?.general?.timezone) return apiResponse(res, 400, false, "Setup TimeZone First!");

  const systemTime = getUTC(createBody.startedAt, settings.general.timezone.label, true);
  const expireTime = getUTC(createBody.expiredAt, settings.general.timezone.label, false, true);

  createBody.startedAt = systemTime;
  createBody.expiredAt = expireTime;

  const coupon = await Coupon.create(createBody);

  // @TODO: Send Coupon Email for Specific Retailer/s

  return apiResponse(res, 201, true, "Coupon created successfully!", coupon);
});

/**
 * Get All Retailers & Packages with Short Info
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllRetailersAndPlans = asyncHandler(async (req: IApiRequest, res: Response) => {
  const [retailers, subscriptions] = await Promise.all([
    Retailer.find({ isVerified: true, softDeleted: false, status: true }, { storeName: 1, image: 1 }),
    Subscription.find({ slug: { $ne: "trial" } }, { title: 1 }).sort({ createdAt: "asc" }),
  ]);

  return apiResponse(res, 200, true, "All retailer & plans short info fetched successfully!", {
    retailers,
    subscriptions,
  });
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
    Coupon.aggregate([
      {
        $match: query,
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: Number(limit),
      },
    ]),
    Coupon.countDocuments(query),
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

  const [existingCoupon, subscriptions] = await Promise.all([
    Coupon.findOne({
      _id: { $ne: id },
      code: updatedBody.code,
      startedAt: { $lte: updatedBody.expiredAt },
      expiredAt: { $gte: updatedBody.startedAt },
      softDeleted: false,
    }),
    Subscription.find({ _id: { $in: updatedBody?.applicablePackages || [] }, slug: { $ne: "trial" } }),
  ]);

  if (existingCoupon) return apiResponse(res, 400, false, "Coupon already exists within date range!");
  if (subscriptions.length === 0) return apiResponse(res, 400, false, "Provided invalid packages!");

  if (updatedBody.discountType === "flat") {
    let greaterValue = "";

    for (const subscription of subscriptions) {
      if (updatedBody.discount >= subscription.price / 2) {
        greaterValue = Number(subscription.price / 2).toFixed(2);
        break;
      }
    }

    if (greaterValue) {
      return apiResponse(res, 400, false, `Discount must be less than ${greaterValue} CAD of the package price!`);
    }
  }

  const settings = await Settings.findOne(null, { "general.timezone": 1 });
  if (!settings?.general?.timezone) return apiResponse(res, 400, false, "Setup TimeZone First!");

  const systemTime = getUTC(updatedBody.startedAt, settings.general.timezone.label, true);
  const expireTime = getUTC(updatedBody.expiredAt, settings.general.timezone.label, false, true);

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
