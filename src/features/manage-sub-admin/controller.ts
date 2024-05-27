import bcrypt from "bcrypt";
import { Response } from "express";
import { IApiRequest } from "types";
import { deleteFileFromS3Bucket, uploadFileToS3Bucket } from "../../configs/s3Bucket";
import Branch from "../../features/manage-branch/model";
import { apiResponse, asyncHandler, exclude, makePaginate } from "../../helpers";
import SubAdmin from "../user/sub-admin/model";
import { subAdminSchema, subAdminSchema2 } from "./validation";

/**
 * Create A Sub Admin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const createSubAdmin = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await subAdminSchema.validateAsync(req.body);

  const { softDeleted, retailerId, password, ...createBody } = result;
  createBody.retailerId = req.user._id;

  const [branch, existingSubAdmin] = await Promise.all([
    Branch.findOne({ _id: createBody.branchId, retailerId: createBody.retailerId }),
    SubAdmin.findOne({ email: createBody.email }),
  ]);

  if (!branch) return apiResponse(res, 400, false, "Branch not found!");
  if (existingSubAdmin) return apiResponse(res, 400, false, "This sub admin already exists!");

  let imageKey = null;

  // Upload File to S3 Bucket
  if (req.file) {
    const { status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "users");
    if (status) {
      imageKey = key;
    }
  }

  createBody.password = await bcrypt.hash(password, 10);

  const subAdmin: any = await SubAdmin.create({
    ...createBody,
    image: imageKey,
  });

  // Remove Sensitive Data
  const data = exclude(subAdmin._doc, ["password", "createdAt", "updatedAt"]);

  return apiResponse(res, 201, true, "Sub Admin created successfully!", data);
});

/**
 * Get All Sub Admins
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllSubAdmins = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10 } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const [docs, total] = await Promise.all([
    SubAdmin.find({ retailerId: req.user._id, softDeleted: { $eq: false } }, { password: 0 })
      .limit(Number(limit))
      .skip(skip)
      .sort({ createdAt: "asc" }),
    SubAdmin.find({ retailerId: req.user._id, softDeleted: { $eq: false } }).countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Sub Admins fetched successfully!", data);
});

/**
 * Get A Single SubAdmin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getSingleSubAdmin = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const subAdmin = await SubAdmin.findOne({ _id: id }, { password: 0 });
  if (!SubAdmin) return apiResponse(res, 404, false, "Sub Admin not found!");

  return apiResponse(res, 201, true, "Sub Admin fetched successfully!", subAdmin);
});

/**
 * Update A Single Sub Admin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateSubAdmin = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await subAdminSchema2.validateAsync(req.body);

  const { id } = req.params;
  const { softDeleted, retailerId, password, ...updatedBody } = result;

  const [branch, existingSubAdmin] = await Promise.all([
    Branch.findOne({ _id: updatedBody.branchId, retailerId: req.user._id }),
    SubAdmin.findOne({ email: updatedBody.email, _id: { $ne: id } }),
  ]);

  if (!branch) return apiResponse(res, 400, false, "Branch not found!");
  if (existingSubAdmin) return apiResponse(res, 400, false, "This sub admin already exists!");

  // Upload File to S3 Bucket
  if (req.file) {
    const { status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "users");
    if (status) {
      updatedBody.image = key;
    }
    // Delete Existing Image if have
    const prevImage = await SubAdmin.findById(id, { image: 1 });
    deleteFileFromS3Bucket(prevImage?.image);
  }

  const subAdmin: any = await SubAdmin.findOneAndUpdate({ _id: id }, updatedBody, { new: true });

  if (!subAdmin) {
    return apiResponse(res, 404, false, "Sub Admin not found!");
  }

  // Remove Sensitive Data
  const data = exclude(subAdmin._doc, ["password", "createdAt", "updatedAt"]);

  return apiResponse(res, 200, true, "Sub Admin updated successfully!", data);
});

/**
 * Soft Delete A Sub Admin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const softDeleteSubAdmin = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const subAdmin = await SubAdmin.findOneAndUpdate(
    { _id: id },
    {
      softDeleted: true,
    }
  );

  if (!subAdmin) return apiResponse(res, 404, false, "Sub Admin not found!");

  return apiResponse(res, 200, true, "Sub Admin deleted successfully!");
});

/**
 * Get All Deleted Sub Admins
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllDeletedSubAdmins = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10 } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const [docs, total] = await Promise.all([
    SubAdmin.find({ retailerId: req.user._id, softDeleted: { $eq: true } }, { password: 0 })
      .limit(Number(limit))
      .skip(skip)
      .sort({ createdAt: "asc" }),
    SubAdmin.find({ retailerId: req.user._id, softDeleted: { $eq: true } }).countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 201, true, "Deleted Branches fetched successfully!", data);
});

/**
 * Confirm Delete A Single Sub Admin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const confirmDeleteSubAdmin = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  // Delete Existing Image if have
  const prevImage = await SubAdmin.findById(id, { image: 1 });
  deleteFileFromS3Bucket(prevImage?.image);

  const subAdmin = await SubAdmin.findOneAndDelete({ _id: id });
  if (!subAdmin) return apiResponse(res, 404, false, "Sub Admin not found!");

  return apiResponse(res, 200, true, "Sub Admin deleted successfully!");
});
