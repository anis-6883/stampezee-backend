import { Response } from "express";
import { IApiRequest } from "types";
import { deleteFileFromS3Bucket, uploadFileToS3Bucket } from "../../configs/s3Bucket";
import Sorting from "../../features/sorting/model";
import { apiResponse, asyncHandler, fileValidation } from "../../helpers";
import StampImage from "./model";
import { stampImageSchema } from "./validation";

/**
 * Create A Stamp Image
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const createStampImage = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await stampImageSchema.validateAsync(req.body, {
    allowUnknown: true,
    abortEarly: false,
  });

  const { softDeleted, ...createBody } = result;
  createBody.userId = req.user._id;
  createBody.ref = req.role;

  let imageKey = null;

  if (!req.file) {
    return apiResponse(res, 400, false, "Invalid Request!", { image: "image file is required!" });
  }

  // File Validation
  const { status, message } = fileValidation(req.file, undefined, ["image/jpeg", "image/png", "image/jpg"]);
  if (!status) {
    return apiResponse(res, 400, false, "Invalid Request!", { image: message });
  }

  // Upload File to S3 Bucket
  if (req.file) {
    const { status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "stamp-image");
    if (status) {
      imageKey = key;
    }
  }

  const stampImage: any = await StampImage.create({
    ...createBody,
    image: imageKey,
  });

  await Sorting.updateOne(
    { title: "stamp-image" },
    { $push: { sortedData: stampImage._id.toString() } },
    { upsert: true }
  );

  return apiResponse(res, 201, true, "Stamp image created successfully!", stampImage);
});

/**
 * Get All Stamp Images
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllStampImages = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10 } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const [docs, total] = await Promise.all([
    StampImage.find({ softDeleted: { $eq: false } })
      .limit(Number(limit))
      .skip(skip)
      .sort({ createdAt: "asc" }),
    StampImage.find({ softDeleted: { $eq: false } }).countDocuments(),
  ]);

  const hasNext = total > skip + Number(limit);
  const hasPrev = Number(page) > 1;

  const sorting = await Sorting.findOne({ title: "stamp-image" });
  const sortedIds = sorting ? sorting.sortedData : [];

  const stampImageMap = new Map(docs.map((stampImage) => [stampImage._id.toString(), stampImage]));
  const sortedList = sortedIds.map((id) => stampImageMap.get(id)).filter(Boolean);

  const data = {
    docs: sortedList,
    page: +page,
    limit: +limit,
    totalPage: Math.ceil(total / Number(limit)),
    totalDocs: total,
    hasNext,
    hasPrev,
  };

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
  const result = await stampImageSchema.validateAsync(req.body, {
    allowUnknown: true,
    abortEarly: false,
  });

  const { id } = req.params;
  const { softDeleted, image, ...updatedBody } = result;

  const stampImage = await StampImage.findOne({ _id: id });
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
    const { status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "stamp-image");
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
 * Soft Delete A Stamp Image
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const softDeleteStampImage = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const stampImage = await StampImage.findOneAndUpdate(
    { _id: id },
    {
      softDeleted: true,
    }
  );

  if (!stampImage) return apiResponse(res, 404, false, "Stamp image not found!");

  await Sorting.updateOne({ title: "stamp-image" }, { $pull: { sortedData: id } });

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

  const [docs, total] = await Promise.all([
    StampImage.find({ softDeleted: { $eq: true } })
      .limit(Number(limit))
      .skip(skip)
      .sort({ createdAt: "asc" }),
    StampImage.find({ softDeleted: { $eq: true } }).countDocuments(),
  ]);

  const hasNext = total > skip + Number(limit);
  const hasPrev = Number(page) > 1;

  const data = {
    docs,
    page: +page,
    limit: +limit,
    totalPage: Math.ceil(total / Number(limit)),
    totalDocs: total,
    hasNext,
    hasPrev,
  };

  return apiResponse(res, 200, true, "Deleted stamp images fetched successfully!", data);
});

/**
 * Confirm Delete A Single StampImage
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
