import { Response } from "express";
import { IApiRequest } from "types";
import { ROLE } from "../../configs/constants";
import { deleteFileFromS3Bucket, uploadFileToS3Bucket } from "../../configs/s3Bucket";
import { apiResponse, asyncHandler, fileValidation, makePaginate } from "../../helpers";
import Sorting from "../sorting/model";
import StampImage from "./model";
import { stampImageSchema, stampImageUpdateSchema } from "./validation";

/**
 * Create A Stamp Image
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const createStampImage = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await stampImageSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { softDeleted, ...createBody } = result;
  createBody.userId = req.user._id;
  createBody.ref = req.role;

  let imageKey = null;

  if (!req?.file) {
    return apiResponse(res, 400, false, "Invalid Request!", { image: "image file is required!" });
  }

  // File Validation
  const { status, message } = fileValidation(req.file, undefined, ["image/jpeg", "image/png", "image/jpg"]);
  if (!status) {
    return apiResponse(res, 400, false, "Invalid Request!", { image: message });
  }

  // Upload File to S3 Bucket
  const { status: s3Status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "stamp_image");
  if (s3Status) {
    imageKey = key;
  }

  const stampImage: any = await StampImage.create({
    ...createBody,
    image: imageKey,
  });

  if (req.role === ROLE.SUPER_ADMIN) {
    await Sorting.updateOne(
      { title: "default_stamp_image" },
      { $push: { sortedData: stampImage._id.toString() } },
      { upsert: true }
    );
  }

  return apiResponse(res, 201, true, "Stamp image created successfully!", stampImage);
});

/**
 * Get All Stamp Images
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllStampImages = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  let docs: any[] = [];
  let total: number = 0;

  const commonQuery: any = { softDeleted: { $eq: false } };
  let roleSpecificQuery = {};

  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); //case insensitive search. For sensitive remove i
    commonQuery.title = regex;
  }

  if (req.role === ROLE.SUPER_ADMIN) {
    roleSpecificQuery = { ref: ROLE.SUPER_ADMIN };
  } else if (req.role === ROLE.RETAILER) {
    roleSpecificQuery = { userId: req.user._id, ref: ROLE.RETAILER };
  }

  if (Object.keys(roleSpecificQuery).length > 0) {
    const finalQuery = { ...commonQuery, ...roleSpecificQuery };

    [docs, total] = await Promise.all([
      StampImage.find(finalQuery).limit(Number(limit)).skip(skip).sort({ createdAt: "desc" }),
      StampImage.countDocuments(finalQuery),
    ]);
  }

  if (req.role === ROLE.SUPER_ADMIN) {
    const sorting = await Sorting.findOne({ title: "default_stamp_image" });
    const sortedIds = sorting ? sorting.sortedData : [];

    const stampImageMap = new Map(docs.map((stampImage) => [stampImage._id.toString(), stampImage]));
    docs = sortedIds.map((id) => stampImageMap.get(id)).filter(Boolean);
  }

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Stamp images fetched successfully!", data);
});

/**
 * Get A Single Stamp Image
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getSingleStampImage = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const stampImage = await StampImage.findOne({ _id: id });
  if (!stampImage) return apiResponse(res, 404, false, "Stamp image not found!");

  return apiResponse(res, 200, true, "Stamp image fetched successfully!", stampImage);
});

/**
 * Update A Single Stamp Image
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateStampImage = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await stampImageUpdateSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { id } = req.params;
  const { softDeleted, image, ...updatedBody } = result;

  const stampImage = await StampImage.findOne({ _id: id, userId: req.user._id });
  if (!stampImage) return apiResponse(res, 404, false, "Stamp image not found!");

  // File Validation
  if (req.file) {
    const { status, message } = fileValidation(req.file, undefined, ["image/jpeg", "image/png", "image/jpg"]);
    if (!status) {
      return apiResponse(res, 400, false, "Invalid Request!", { image: message });
    }
  }

  // Upload File to S3 Bucket
  if (req.file) {
    const { status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "stamp_image");
    if (status) {
      updatedBody.image = key;
    }

    // Delete Existing Image if have
    const prevImage = await StampImage.findById(id, { image: 1 });
    deleteFileFromS3Bucket(prevImage?.image);
  }

  const updatedData: any = await StampImage.findOneAndUpdate({ _id: id }, updatedBody, { new: true });

  return apiResponse(res, 200, true, "Stamp image updated successfully!", updatedData);
});

/**
 * Update Status A Stamp Image
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateStampImageStatus = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req?.body;

  const stampImage = await StampImage.findOneAndUpdate(
    { _id: id, userId: req?.user?._id },
    {
      status,
    },
    {
      new: true,
    }
  );

  if (!stampImage) return apiResponse(res, 404, false, "Stamp image not found!");

  return apiResponse(res, 200, true, "Stamp image status updated successfully!");
});

/**
 * Soft Delete A Stamp Image
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const softDeleteStampImage = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;
  let stampImage = null;

  if (req.role === ROLE.SUPER_ADMIN) {
    stampImage = await StampImage.findOneAndUpdate(
      { _id: id },
      {
        softDeleted: true,
      }
    );
  }

  if (req.role === ROLE.RETAILER) {
    stampImage = await StampImage.findOneAndUpdate(
      { _id: id, userId: req.user._id, ref: ROLE.RETAILER },
      {
        softDeleted: true,
      }
    );
  }

  if (!stampImage) return apiResponse(res, 404, false, "Stamp image not found!");

  if (req.role === ROLE.SUPER_ADMIN) {
    await Sorting.updateOne({ title: "default_stamp_image" }, { $pull: { sortedData: id } });
  }

  return apiResponse(res, 200, true, "Stamp image deleted successfully!");
});

/**
 * Get All Deleted Stamp Images
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllDeletedStampImages = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10 } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  let docs: any[] = [];
  let total: number = 0;

  const commonQuery = { softDeleted: { $eq: true } };
  let roleSpecificQuery = {};

  if (req.role === ROLE.SUPER_ADMIN) {
    roleSpecificQuery = { ref: ROLE.SUPER_ADMIN };
  } else if (req.role === ROLE.RETAILER) {
    roleSpecificQuery = { userId: req.user._id, ref: ROLE.RETAILER };
  }

  if (Object.keys(roleSpecificQuery).length > 0) {
    const finalQuery = { ...commonQuery, ...roleSpecificQuery };

    [docs, total] = await Promise.all([
      StampImage.find(finalQuery).limit(Number(limit)).skip(skip).sort({ createdAt: "desc" }),
      StampImage.countDocuments(finalQuery),
    ]);
  }

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Deleted stamp images fetched successfully!", data);
});

/**
 * Confirm Delete A Single Stamp Image
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const confirmDeleteStampImage = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  // Delete Existing Image if have
  const prevImage = await StampImage.findById(id, { image: 1 });
  deleteFileFromS3Bucket(prevImage?.image);

  const stampImage = await StampImage.findOneAndDelete({ _id: id });
  if (!stampImage) return apiResponse(res, 404, false, "Stamp image not found!");

  return apiResponse(res, 200, true, "Stamp image deleted successfully!");
});
