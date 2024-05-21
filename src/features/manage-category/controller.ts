import bcrypt from "bcrypt";
import { Response } from "express";
import { IApiRequest } from "types";
import { deleteFileFromS3Bucket, uploadFileToS3Bucket } from "../../configs/s3Bucket";
import Branch from "../../features/manage-branch/model";
import { apiResponse, asyncHandler, exclude } from "../../helpers";
import Category from "./model";
import { categorySchema } from "./validation";

/**
 * Create A Category
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const createCategory = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await categorySchema.validateAsync(req.body);

  const { softDeleted, retailerId, password, ...createBody } = result;
  createBody.retailerId = req.user._id;

  const [branch, existingCategory] = await Promise.all([
    Branch.findOne({ _id: createBody.branchId, retailerId: createBody.retailerId }),
    Category.findOne({ email: createBody.email }),
  ]);

  if (!branch) return apiResponse(res, 400, false, "Branch not found!");
  if (existingCategory) return apiResponse(res, 400, false, "This sub admin already exists!");

  let imageKey = null;

  // Upload File to S3 Bucket
  if (req.file) {
    const { status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "users");
    if (status) {
      imageKey = key;
    }
  }

  createBody.password = await bcrypt.hash(password, 10);

  const category: any = await Category.create({
    ...createBody,
    image: imageKey,
  });

  // Remove Sensitive Data
  const data = exclude(category._doc, ["password", "createdAt", "updatedAt"]);

  return apiResponse(res, 201, true, "Sub Admin created successfully!", data);
});

/**
 * Get All Sub Admins
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllCategories = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10 } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const [docs, total] = await Promise.all([
    Category.find({ retailerId: req.user._id, softDeleted: { $eq: false } }, { password: 0 })
      .limit(Number(limit))
      .skip(skip)
      .sort({ createdAt: "asc" }),
    Category.find({ retailerId: req.user._id, softDeleted: { $eq: false } }).countDocuments(),
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

  return apiResponse(res, 200, true, "Sub Admins fetched successfully!", data);
});

/**
 * Get A Single Category
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getSingleCategory = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const category = await Category.findOne({ _id: id }, { password: 0 });
  if (!Category) return apiResponse(res, 404, false, "Sub Admin not found!");

  return apiResponse(res, 201, true, "Sub Admin fetched successfully!", category);
});

/**
 * Update A Single Sub Admin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateCategory = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await categorySchema.validateAsync(req.body);

  const { id } = req.params;
  const { softDeleted, retailerId, password, ...updatedBody } = result;

  const [branch, existingCategory] = await Promise.all([
    Branch.findOne({ _id: updatedBody.branchId, retailerId: req.user._id }),
    Category.findOne({ email: updatedBody.email, _id: { $ne: id } }),
  ]);

  if (!branch) return apiResponse(res, 400, false, "Branch not found!");
  if (existingCategory) return apiResponse(res, 400, false, "This sub admin already exists!");

  // Upload File to S3 Bucket
  if (req.file) {
    const { status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "users");
    if (status) {
      updatedBody.image = key;
    }
    // Delete Existing Image if have
    const prevImage = await Category.findById(id, { image: 1 });
    deleteFileFromS3Bucket(prevImage?.image);
  }

  const category: any = await Category.findOneAndUpdate({ _id: id }, updatedBody, { new: true });

  if (!category) {
    return apiResponse(res, 404, false, "Sub Admin not found!");
  }

  // Remove Sensitive Data
  const data = exclude(category._doc, ["password", "createdAt", "updatedAt"]);

  return apiResponse(res, 200, true, "Sub Admin updated successfully!", data);
});

/**
 * Soft Delete A Sub Admin
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

  if (!category) return apiResponse(res, 404, false, "Sub Admin not found!");

  return apiResponse(res, 200, true, "Sub Admin deleted successfully!");
});

/**
 * Get All Deleted Sub Admins
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllDeletedCategories = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10 } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const [docs, total] = await Promise.all([
    Category.find({ retailerId: req.user._id, softDeleted: { $eq: true } }, { password: 0 })
      .limit(Number(limit))
      .skip(skip)
      .sort({ createdAt: "asc" }),
    Category.find({ retailerId: req.user._id, softDeleted: { $eq: true } }).countDocuments(),
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

  return apiResponse(res, 201, true, "Deleted Branches fetched successfully!", data);
});

/**
 * Confirm Delete A Single Sub Admin
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
  if (!category) return apiResponse(res, 404, false, "Sub Admin not found!");

  return apiResponse(res, 200, true, "Sub Admin deleted successfully!");
});
