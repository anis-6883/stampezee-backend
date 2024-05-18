import { Request, Response } from "express";
import _ from "lodash";
import { IApiRequest } from "types";
import { apiResponse, asyncHandler, validateBody } from "../../helpers";
import Branch from "./model";
import { branchSchema } from "./validation";

/**
 * Create A Branch
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const createBranch = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = validateBody(branchSchema, req.body);
  if (!_.isEmpty(result)) return apiResponse(res, 400, false, "Invalid Request!", result);

  const { name, address, longitude, latitude, status } = req.body;

  await Branch.create({
    name,
    address: {
      loc: { type: "Point", coordinates: [longitude, latitude] },
      name: address,
    },
    status,
    retailerID: req.user._id,
  });

  return apiResponse(res, 201, true, "Branch created successfully!");
});

/**
 * Get All Single Branches
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllBranches = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10 } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const [docs, total] = await Promise.all([
    Branch.find({ retailerID: req.user._id }).limit(Number(limit)).skip(skip).sort({ createdAt: "asc" }),
    Branch.find({ retailerID: req.user._id }).countDocuments(),
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

  return apiResponse(res, 201, true, "Branches fetched successfully!", data);
});

/**
 * Get A Single Branch
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getSingleBranch = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const branch = await Branch.findOne({ _id: id });
  if (!branch) return apiResponse(res, 404, false, "Branch not found!");

  return apiResponse(res, 201, true, "Branch fetched successfully!", branch);
});

/**
 * Update A Single Branch
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateBranch = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = validateBody(branchSchema, req.body);
  if (!_.isEmpty(result)) return apiResponse(res, 400, false, "Invalid Request!", result);

  const { id } = req.params;
  const { name, address, longitude, latitude, status } = req.body;

  const branch = await Branch.findOneAndUpdate(
    { _id: id },
    {
      $set: {
        name,
        address: {
          loc: { type: "Point", coordinates: [longitude, latitude] },
          name: address,
        },
        status,
      },
    },
    {
      new: true,
    }
  );
  if (!branch) return apiResponse(res, 404, false, "Branch not found!");

  return apiResponse(res, 200, true, "Branch updated successfully!", branch);
});

/**
 * Delete A Single Branch
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const deleteBranch = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const branch = await Branch.findOneAndDelete({ _id: id });
  if (!branch) return apiResponse(res, 404, false, "Branch not found!");

  return apiResponse(res, 200, true, "Branch deleted successfully!");
});
