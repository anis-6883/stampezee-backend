import { Response } from "express";
import { IApiRequest } from "types";
import Branch from "../../features/manage-branch/model";
import StampImage from "../../features/manage-stamp-image/model";
import { apiResponse, asyncHandler, makePaginate } from "../../helpers";
import Stamp from "./model";
import { stampSchema } from "./validation";

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

  const { softDeleted, branchId, stampImageId, ...createBody } = result;

  const [branch, stampImage] = await Promise.all([
    Branch.findOne({ _id: branchId, retailerId: req.user._id }),
    StampImage.findOne({ _id: stampImageId }),
  ]);

  if (!branch) return apiResponse(res, 404, false, "Branch not found!");
  if (!stampImage) return apiResponse(res, 404, false, "Stamp Image not found!");

  createBody.retailerId = req.user._id;
  createBody.branchId = branchId;
  createBody.stampImageId = stampImageId;

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
    Stamp.find({ retailerId: req.user._id, softDeleted: { $eq: false } })
      .limit(Number(limit))
      .skip(skip)
      .sort({ createdAt: "asc" }),
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
 * Update A Single Stamp
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateStamp = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await stampSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { id } = req.params;
  const { softDeleted, branchId, stampImageId, ...updatedBody } = result;

  const [branch, stampImage] = await Promise.all([
    Branch.findOne({ _id: branchId, retailerId: req.user._id }),
    StampImage.findOne({ _id: stampImageId }),
  ]);

  if (!branch) return apiResponse(res, 404, false, "Branch not found!");
  if (!stampImage) return apiResponse(res, 404, false, "Stamp Image not found!");

  const stamp = await Stamp.findOne({ _id: id });
  if (!stamp) return apiResponse(res, 404, false, "Stamp not found!");

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

  if (!stamp) return apiResponse(res, 404, false, "Stamp not found!");

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
  if (!stamp) return apiResponse(res, 404, false, "Stamp not found!");

  return apiResponse(res, 200, true, "Stamp deleted successfully!");
});
