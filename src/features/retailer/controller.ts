import bcrypt from "bcrypt";
import { Response } from "express";
import { deleteFileFromS3Bucket, uploadFileToS3Bucket } from "../../configs/s3Bucket";
import { apiResponse, asyncHandler, exclude, makePaginate } from "../../helpers";
import { IApiRequest } from "../../types";
import Retailer from "../user/retailer/model";
import { retailerSchema, retailerSchemaUpdate, retailerStatusSchema } from "./validation";

/**
 * Create A Retailer
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const createRetailer = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await retailerSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { softDeleted, password, ...createBody } = result;

  const existingRetailer = await Retailer.findOne({ email: createBody.email });
  if (existingRetailer) return apiResponse(res, 400, false, "This retailer already exists!");

  let imageKey = null;

  // Upload File to S3 Bucket
  if (req.file) {
    const { status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "brands");
    if (status) {
      imageKey = key;
    }
  }

  createBody.password = await bcrypt.hash(password, 10);

  const retailer: any = await Retailer.create({
    ...createBody,
    fullName: createBody?.lastName ? `${createBody.firstName} ${createBody.lastName}` : createBody.firstName,
    image: imageKey,
    isVerified: true,
    verifiedAt: Date.now(),
    ref: req.role,
  });

  // Remove Sensitive Data
  const data = exclude(retailer._doc, ["password", "createdAt", "updatedAt"]);

  return apiResponse(res, 201, true, "Retailer created successfully!", data);
});

/**
 * Get All Retailers
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllRetailers = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = { softDeleted: false };

  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); //case insensitive search. For sensitive remove i
    const orQuery = [{ fullName: regex }, { email: regex }, { storeName: regex }];
    query.$or = orQuery;
  }

  const [docs, total] = await Promise.all([
    Retailer.find(query, { password: 0 }).limit(Number(limit)).skip(skip).sort({ createdAt: "desc" }),
    Retailer.find(query).countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Retailers fetched successfully!", data);
});

/**
 * Get A Single Retailer
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getSingleRetailer = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const retailer = await Retailer.findOne({ _id: id }, { password: 0 });
  if (!Retailer) return apiResponse(res, 404, false, "Retailer not found!");

  return apiResponse(res, 201, true, "Retailer fetched successfully!", retailer);
});

/**
 * Update A Single Retailer
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateRetailer = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await retailerSchemaUpdate.validateAsync(req.body, { abortEarly: false });

  const { id } = req.params;
  const { softDeleted, password, ...updatedBody } = result;

  const existingRetailer = await Retailer.findOne({ email: updatedBody.email, _id: { $ne: id } });
  if (existingRetailer) return apiResponse(res, 400, false, "This retailer already exists!");

  // Upload File to S3 Bucket
  if (req.file) {
    const { status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "brands");
    if (status) {
      updatedBody.image = key;
    }
    // Delete Existing Image if have
    const prevImage = await Retailer.findById(id, { image: 1 });
    deleteFileFromS3Bucket(prevImage?.image);
  }

  if (updatedBody.firstName || updatedBody.lastName) {
    const retailer = await Retailer.findById(id, { firstName: 1, lastName: 1 });

    if (updatedBody.firstName && updatedBody.lastName) {
      updatedBody.fullName = `${updatedBody.firstName} ${updatedBody.lastName}`;
    } else if (updatedBody.firstName) {
      updatedBody.fullName = `${updatedBody.firstName} ${retailer.lastName || ""}`.trim();
    } else if (updatedBody.lastName) {
      updatedBody.fullName = `${retailer.firstName || ""} ${updatedBody.lastName}`.trim();
    }
  }

  const retailer: any = await Retailer.findOneAndUpdate({ _id: id }, updatedBody, {
    new: true,
    projection: { password: 0, createdAt: 0, updatedAt: 0 },
  });

  if (!retailer) {
    return apiResponse(res, 404, false, "Retailer not found!");
  }

  return apiResponse(res, 200, true, "Retailer updated successfully!", retailer);
});

/**
 * Update Status A Retailer
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateRetailerStatus = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await retailerStatusSchema.validateAsync(req.body, {
    abortEarly: false,
  });
  const { id } = req.params;
  const { status } = result;

  const retailer = await Retailer.findOneAndUpdate(
    { _id: id },
    {
      status,
    },
    {
      new: true,
    }
  );

  if (!retailer) return apiResponse(res, 404, false, "Retailer not found!");

  return apiResponse(res, 200, true, "Retailer status updated successfully!");
});

/**
 * Soft Delete A Retailer
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const softDeleteRetailer = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const retailer = await Retailer.findById(id);
  if (!retailer) return apiResponse(res, 404, false, "Retailer not found!");

  await Retailer.findByIdAndUpdate(id, {
    email: `deleted-${new Date().toISOString()}-${retailer.email}`,
    softDeleted: true,
    status: false,
  });

  return apiResponse(res, 200, true, "Retailer deleted successfully!");
});

/**
 * Get All Deleted Retailers
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllDeletedRetailers = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = { softDeleted: true };

  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); //case insensitive search. For sensitive remove i
    const orQuery = [{ fullName: regex }, { email: regex }, { storeName: regex }];
    query.$or = orQuery;
  }

  const [docs, total] = await Promise.all([
    Retailer.find(query, { password: 0 }).limit(Number(limit)).skip(skip).sort({ createdAt: "desc" }),
    Retailer.find(query).countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Deleted Retailers fetched successfully!", data);
});

/**
 * Confirm Delete A Single Retailer
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const confirmDeleteRetailer = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  // Delete Existing Image if have
  const prevImage = await Retailer.findById(id, { image: 1 });
  deleteFileFromS3Bucket(prevImage?.image);

  const retailer = await Retailer.findOneAndDelete({ _id: id });
  if (!retailer) return apiResponse(res, 404, false, "Retailer not found!");

  return apiResponse(res, 200, true, "Retailer deleted successfully!");
});
