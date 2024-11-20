import { Response } from "express";
import { PACKAGES, ROLE } from "../../configs/constants";
import { apiResponse, asyncHandler, getUTC, makePaginate } from "../../helpers";
import Branch from "../../models/branch";
import Category from "../../models/category";
import { IEnrollSubscription } from "../../models/enroll-subscription";
import Enrollment from "../../models/enrollment";
import Settings from "../../models/settings";
import Sorting from "../../models/sorting";
import Stamp, { IStamp } from "../../models/stamp";
import StampImage from "../../models/stamp-image";
import { IApiRequest } from "../../types";
import { stampSchema, stampStatusSchema, updateStampSchema } from "./validation";

/**
 * Create A Stamp
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const createStamp = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await stampSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { softDeleted, branchId, categoryId, stampImageId, ...createBody } = result;

  // Check Subscription & Addon Enrollment
  const [enrollments, retailerTotalStamp = [], branch, stampImage, category] = await Promise.all([
    Enrollment.aggregate([
      {
        $match: {
          retailerId: req.user._id,
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
                status: true,
              },
            },
          ],
        },
      },
      {
        $unwind: "$enrollSubscription",
      },
      {
        $match: {
          $or: [
            { "enrollSubscription.planSnapshot.type": "subscription" },
            { "enrollSubscription.planSnapshot.slug": PACKAGES.STAMP },
            { "enrollSubscription.planSnapshot.slug": PACKAGES.TRIAL },
          ],
        },
      },
      {
        $replaceRoot: { newRoot: "$enrollSubscription" }, // Replace root with enrollSubscription
      },
    ]),
    Stamp.find({ retailerId: req.user._id, softDeleted: false }),
    Branch.findOne({ _id: branchId, retailerId: req.user._id }),
    StampImage.findById(stampImageId),
    Category.findById(categoryId),
  ]);

  if (!branch) throw "Branch not found!";
  if (!stampImage) throw "Stamp Image not found!";
  if (!category) throw "Category not found!";
  if (enrollments.length === 0) throw "No one is allowed to create a stamp without a plan!";

  const subscription: IEnrollSubscription = enrollments.find((enrollment: IEnrollSubscription) => {
    return enrollment.planSnapshot.type === "subscription";
  });

  const addons = enrollments
    .filter((enrollment: IEnrollSubscription) => {
      return enrollment.planSnapshot.type === "addon";
    })
    .map((enrollment: IEnrollSubscription) => enrollment._id);

  const allowTotalStamp = subscription?.planSnapshot?.allowTotalStamp + addons.length;
  if (retailerTotalStamp.length >= allowTotalStamp) throw "Your stamp limit is over. Take new Add-on!";

  const subscriptionStampSlot = retailerTotalStamp.filter((stamp: IStamp) => stamp.source === "subscription").length;
  const source = subscriptionStampSlot < subscription?.planSnapshot?.allowTotalStamp ? "subscription" : "addon";

  const retailerAddonIds = retailerTotalStamp
    .filter((stamp: IStamp) => stamp.source === "addon")
    .map((stamp: IStamp) => stamp.enrollSubscriptionId.toString());

  const addonIds = addons.map((enrollSubscription: IEnrollSubscription) => enrollSubscription._id.toString());
  const unUsedIds = addonIds.filter((id: string) => !retailerAddonIds.includes(id));

  createBody.source = source;
  createBody.enrollSubscriptionId = source === "subscription" ? subscription?._id : unUsedIds[0];

  if (!createBody.hasValidity) {
    createBody.startedAt = new Date("2020-01-01");
    createBody.expiredAt = new Date("3030-01-01");
  }

  createBody.retailerId = req.user._id;
  createBody.branchId = branchId;
  createBody.stampImageId = stampImageId;
  createBody.categoryId = categoryId;

  const settings = await Settings.findOne(null, { "general.timezone": 1 });
  if (!settings?.general?.timezone) throw "Setup TimeZone First!";

  const systemTime = getUTC(createBody.startedAt, Number(settings.general.timezone.value));
  const expireTime = getUTC(createBody.expiredAt, Number(settings.general.timezone.value), true);

  createBody.startedAt = systemTime;
  createBody.expiredAt = expireTime;

  const stamp = await Stamp.create(createBody);

  return apiResponse(res, 201, true, "Stamp created successfully!", stamp);
});

/**
 * Get All Stamps
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllStamps = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = { retailerId: req.user._id, softDeleted: false };
  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); //case insensitive search. For sensitive remove i
    query.title = regex;
  }

  const [docs, total] = await Promise.all([
    Stamp.aggregate([
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
      {
        $lookup: {
          from: "branches",
          localField: "branchId",
          foreignField: "_id",
          as: "branch",
          pipeline: [
            {
              $project: {
                name: 1,
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "categoryId",
          foreignField: "_id",
          as: "category",
          pipeline: [
            {
              $project: {
                name: 1,
                image: 1,
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "stamp_images",
          localField: "stampImageId",
          foreignField: "_id",
          as: "stampImage",
          pipeline: [
            {
              $project: {
                title: 1,
                image: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$branch",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $unwind: {
          path: "$category",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $unwind: {
          path: "$stampImage",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          branchId: 0,
          categoryId: 0,
          stampImageId: 0,
        },
      },
    ]),
    Stamp.countDocuments(query),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Stamps fetched successfully!", data);
});

/**
 * Get A Single Stamp
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getSingleStamp = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const stamp = await Stamp.findOne({ _id: id });
  if (!stamp) return apiResponse(res, 404, false, "Stamp not found!");

  return apiResponse(res, 200, true, "Stamp fetched successfully!", stamp);
});

/**
 * Get Stamp Categories Branches Stamp Image
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getBranchCategoryImageList = asyncHandler(async (req: IApiRequest, res: Response) => {
  const [categories, branches, defaultImages, customImages] = await Promise.all([
    Category.find({ softDeleted: false, status: true }, { name: 1, image: 1 }).sort({
      createdAt: "desc",
    }),
    Branch.find(
      { retailerId: req.user._id, softDeleted: false, status: true, disabledBySystem: false },
      { name: 1 }
    ).sort({
      createdAt: "desc",
    }),
    StampImage.find({ softDeleted: false, status: true, ref: ROLE.SUPER_ADMIN }, { image: 1, title: 1, ref: 1 }).sort({
      createdAt: "desc",
    }),
    StampImage.aggregate([
      {
        $match: {
          softDeleted: false,
          status: true,
          userId: req.user._id,
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $lookup: {
          from: "enroll_subscriptions",
          localField: "enrollSubscriptionId",
          foreignField: "_id",
          as: "enrollSubscription",
          pipeline: [
            {
              $lookup: {
                from: "enrollments",
                localField: "enrollmentId",
                foreignField: "_id",
                as: "enrollment",
              },
            },
            {
              $unwind: "$enrollment",
            },
            {
              $project: {
                validityFrom: "$enrollment.validityFrom",
                validityTo: "$enrollment.validityTo",
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
      {
        $match: {
          "enrollSubscription.validityFrom": { $lte: new Date() },
          "enrollSubscription.validityTo": { $gte: new Date() },
        },
      },
      {
        $project: { image: 1, title: 1, ref: 1 },
      },
    ]),
  ]);

  const sorting = await Sorting.findOne({ title: "default_stamp_image" });
  const sortedIds = sorting ? sorting.sortedData : [];

  const stampImageMap = new Map(defaultImages.map((stampImage) => [stampImage._id.toString(), stampImage]));
  const sortedStampImages = sortedIds.map((id: string) => stampImageMap.get(id)).filter(Boolean);

  const data = {
    categories,
    branches,
    defaultImages: sortedStampImages,
    customImages,
  };

  return apiResponse(res, 200, true, "Branches, Categories, Stamp Images fetched successfully!", data);
});

/**
 * Update A Single Stamp
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateStamp = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await updateStampSchema.validateAsync(req.body, {
    abortEarly: false,
    allowUnknown: true,
  });

  const { id } = req.params;
  const { branchId, categoryId, stampImageId, softDeleted, ...updatedBody } = result;

  const stamp = await Stamp.findOne({ _id: id });
  if (!stamp) throw "Stamp not found!";
  if (stamp.isPublished) throw "The published stamp cannot be edited!";

  if (branchId) {
    const branch = await Branch.findOne({ _id: branchId, retailerId: req.user._id });
    if (!branch) throw "Branch not found!";
  }

  if (categoryId) {
    const category = await Category.findOne({ _id: categoryId });
    if (!category) throw "Category not found!";
  }

  if (stampImageId) {
    const stampImage = await StampImage.findOne({ _id: stampImageId });
    if (!stampImage) throw "Stamp image not found!";
  }

  if (!updatedBody?.hasValidity) {
    updatedBody.startedAt = new Date();
    updatedBody.expiredAt = new Date("3070-01-01");
  }

  updatedBody.branchId = branchId;
  updatedBody.stampImageId = stampImageId;
  updatedBody.categoryId = categoryId;

  const settings = await Settings.findOne(null, { "general.timezone": 1 });
  if (!settings?.general?.timezone) throw "Setup TimeZone First!";

  const systemTime = getUTC(updatedBody.startedAt, Number(settings.general.timezone.value));
  const expireTime = getUTC(updatedBody.expiredAt, Number(settings.general.timezone.value), true);

  updatedBody.startedAt = systemTime;
  updatedBody.expiredAt = expireTime;

  const updatedData: any = await Stamp.findOneAndUpdate({ _id: id }, updatedBody, { new: true });

  return apiResponse(res, 200, true, "Stamp updated successfully!", updatedData);
});

/**
 * Update Stamp Status
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateStampStatus = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await stampStatusSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { id } = req.params;
  const { status } = result;

  const stamp = await Stamp.findOneAndUpdate(
    { _id: id },
    {
      status,
    },
    {
      new: true,
    }
  );

  if (!stamp) return apiResponse(res, 404, false, "Stamp not found!");

  return apiResponse(res, 200, true, "Stamp status updated successfully!");
});

/**
 * Publish A Single Stamp
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const publishStamp = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const stamp = await Stamp.findOne({ _id: id });
  if (!stamp) throw "Stamp not found!";

  if (stamp.isPublished) throw "The stamp is already published";

  const updatedData = await Stamp.findOneAndUpdate({ _id: id }, { isPublished: true }, { new: true });

  return apiResponse(res, 200, true, "Stamp published successfully!", updatedData);
});

/**
 * Soft Delete A Stamp
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const softDeleteStamp = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const stamp = await Stamp.findOneAndUpdate(
    { _id: id, retailerId: req.user._id },
    {
      softDeleted: true,
    }
  );

  if (!stamp) throw "Stamp not found!";

  return apiResponse(res, 200, true, "Stamp deleted successfully!");
});

/**
 * Get All Deleted Stamps
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllDeletedStamps = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10 } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const [docs, total] = await Promise.all([
    Stamp.find({ retailerId: req.user._id, softDeleted: { $eq: true } })
      .limit(Number(limit))
      .skip(skip)
      .sort({ createdAt: "asc" }),
    Stamp.find({ retailerId: req.user._id, softDeleted: { $eq: true } }).countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Deleted stamps fetched successfully!", data);
});

/**
 * Confirm Delete A Single Stamp
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const confirmDeleteStamp = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const stamp = await Stamp.findOneAndDelete({ _id: id });
  if (!stamp) throw "Stamp not found!";

  return apiResponse(res, 200, true, "Stamp deleted successfully!");
});
