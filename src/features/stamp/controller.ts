import { Response } from "express";
import { ROLE } from "../../configs/constants";
import { apiResponse, asyncHandler, getUTC, makePaginate } from "../../helpers";
import { IApiRequest } from "../../types";
import Branch from "../branch/model";
import Category from "../category/model";
import Settings from "../settings/model";
import Sorting from "../sorting/model";
import StampImage from "../stamp-image/model";
import Stamp from "./model";
import { stampSchema, updateStampSchema } from "./validation";

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

  const [branch, stampImage, category] = await Promise.all([
    Branch.findOne({ _id: branchId, retailerId: req.user._id }),
    StampImage.findOne({ _id: stampImageId }),
    Category.findOne({ _id: categoryId }),
  ]);

  if (!branch) return apiResponse(res, 404, false, "Branch not found!");
  if (!stampImage) return apiResponse(res, 404, false, "Stamp Image not found!");
  if (!category) return apiResponse(res, 404, false, "Category not found!");

  createBody.retailerId = req.user._id;
  createBody.branchId = branchId;
  createBody.stampImageId = stampImageId;
  createBody.categoryId = categoryId;

  const settings = await Settings.findOne(null, { "general.timezone": 1 });

  if (!settings?.general?.timezone) {
    throw "Setup TimeZone First!";
  }

  const systemTime = getUTC(createBody.startedAt, settings.general.timezone.value);
  const expireTime = getUTC(createBody.expiredAt, settings.general.timezone.value, true);

  createBody.startedAt = systemTime;
  createBody.expiredAt = expireTime;

  const stamp: any = await Stamp.create(createBody);

  return apiResponse(res, 201, true, "Stamp created successfully!", stamp);
});

/**
 * Get All Stamps
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllStamps = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10 } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const [docs, total] = await Promise.all([
    Stamp.aggregate([
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
        $match: { retailerId: req.user._id, softDeleted: { $eq: false } },
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
          from: "stampimages",
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
    Stamp.find({ retailerId: req.user._id, softDeleted: { $eq: false } }).countDocuments(),
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
    Branch.find({ retailerId: req.user._id, softDeleted: false, status: true }, { name: 1 }).sort({
      createdAt: "desc",
    }),
    StampImage.find({ softDeleted: false, status: true, ref: ROLE.SUPER_ADMIN }, { image: 1, title: 1, ref: 1 }).sort({
      createdAt: "desc",
    }),
    StampImage.find({ softDeleted: false, status: true, userId: req.user._id }, { image: 1, title: 1, ref: 1 }).sort({
      createdAt: "desc",
    }),
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

  updatedBody.branchId = branchId;
  updatedBody.stampImageId = stampImageId;
  updatedBody.categoryId = categoryId;

  const settings = await Settings.findOne(null, { "general.timezone": 1 });

  if (!settings?.general?.timezone) {
    throw "Setup TimeZone First!";
  }

  const systemTime = getUTC(updatedBody.startedAt, settings.general.timezone.value);
  const expireTime = getUTC(updatedBody.expiredAt, settings.general.timezone.value, true);

  updatedBody.startedAt = systemTime;
  updatedBody.expiredAt = expireTime;

  const updatedData: any = await Stamp.findOneAndUpdate({ _id: id }, updatedBody, { new: true });

  return apiResponse(res, 200, true, "Stamp updated successfully!", updatedData);
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
