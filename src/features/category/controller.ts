import { Response } from "express";
import { deleteFileFromS3Bucket, uploadFileToS3Bucket } from "../../configs/s3Bucket";
import { apiResponse, asyncHandler, fileValidation, makePaginate } from "../../helpers";
import { IApiRequest } from "../../types";
import Sorting from "../sorting/model";
import Category from "./model";
import { categorySchema, categoryStatusSchema, updateCategorySchema } from "./validation";

/**
 * Create A Category
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const createCategory = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await categorySchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { softDeleted, ...createBody } = result;

  createBody.superAdminId = req.user._id;

  const existingCategory = await Category.findOne({ name: createBody.name });
  if (existingCategory) return apiResponse(res, 400, false, "This category already exists!");

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
    const { status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "category");
    if (status) {
      imageKey = key;
    }
  }

  const category: any = await Category.create({
    ...createBody,
    image: imageKey,
  });

  await Sorting.updateOne({ title: "category" }, { $push: { sortedData: category._id.toString() } }, { upsert: true });

  return apiResponse(res, 201, true, "Category created successfully!", category);
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
    Category.find(query).limit(Number(limit)).skip(skip),
    Category.find(query).countDocuments(),
  ]);

  const sorting = await Sorting.findOne({ title: "category" });
  const sortedIds = sorting ? sorting.sortedData : [];

  const categoryMap = new Map(docs.map((category) => [category._id.toString(), category]));
  const sortedList = sortedIds.map((id) => categoryMap.get(id)).filter(Boolean);

  const data = makePaginate(sortedList, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Categories fetched successfully!", data);
});

/**
 * Get A Single Category
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getSingleCategory = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const category = await Category.findOne({ _id: id });
  if (!category) return apiResponse(res, 404, false, "Category not found!");

  return apiResponse(res, 200, true, "Category fetched successfully!", category);
});

/**
 * Update A Single Category
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateCategory = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await updateCategorySchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { id } = req.params;
  const { softDeleted, image, ...updatedBody } = result;

  const category = await Category.findOne({ _id: id });
  if (!category) return apiResponse(res, 404, false, "Category not found!");

  const existingCategory = await Category.findOne({ name: updatedBody.name, _id: { $ne: id } });
  if (existingCategory) return apiResponse(res, 400, false, "This category name already exists!");

  // File Validation
  if (req.file) {
    const { status, message } = fileValidation(req.file, undefined, ["image/jpeg", "image/png", "image/jpg"]);
    if (!status) {
      return apiResponse(res, 400, false, "Invalid Request!", { image: message });
    }
  }

  // Upload File to S3 Bucket
  if (req.file) {
    const { status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "category");
    if (status) {
      updatedBody.image = key;
    }
    // Delete Existing Image if have
    const prevImage = await Category.findById(id, { image: 1 });
    deleteFileFromS3Bucket(prevImage?.image);
  }

  const updatedData: any = await Category.findOneAndUpdate({ _id: id }, updatedBody, { new: true });

  return apiResponse(res, 200, true, "Category updated successfully!", updatedData);
});

/**
 * Update Status A Single Category
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateCategoryStatus = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await categoryStatusSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { id } = req.params;
  const { status } = result;

  const category = await Category.findOneAndUpdate(
    { _id: id },
    {
      status,
    },
    {
      new: true,
    }
  );

  if (!category) return apiResponse(res, 404, false, "Category not found!");

  return apiResponse(res, 200, true, "Category status updated successfully!");
});

/**
 * Soft Delete A Category
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const softDeleteCategory = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const category = await Category.findOneAndUpdate(
    { _id: id },
    {
      softDeleted: true,
    }
  );

  if (!category) return apiResponse(res, 404, false, "Category not found!");

  await Sorting.updateOne({ title: "category" }, { $pull: { sortedData: id } });

  return apiResponse(res, 200, true, "Category deleted successfully!");
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
    Category.find(query).limit(Number(limit)).skip(skip).sort({ createdAt: "desc" }),
    Category.find(query).countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Deleted categories fetched successfully!", data);
});

/**
 * Confirm Delete A Single Category
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const confirmDeleteCategory = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  // Delete Existing Image if have
  const prevImage = await Category.findById(id, { image: 1 });
  deleteFileFromS3Bucket(prevImage?.image);

  const category = await Category.findOneAndDelete({ _id: id });
  if (!category) return apiResponse(res, 404, false, "Category not found!");

  return apiResponse(res, 200, true, "Category deleted successfully!");
});
