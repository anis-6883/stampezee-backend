import bcrypt from "bcrypt";
import { Response } from "express";
import fs from "fs";
import _ from "lodash";
import { IApiRequest, IUser } from "types";
import Branch from "../../features/manage-branch/model";
import { apiResponse, asyncHandler, exclude, validateBody } from "../../helpers";
import SubAdmin from "../user/sub-admin/model";
import { subAdminSchema } from "./validation";

/**
 * Create A Sub Admin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const createSubAdmin = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = validateBody(subAdminSchema, req.body);
  if (!_.isEmpty(result)) return apiResponse(res, 400, false, "Invalid Request!", result);

  console.log("req.body", req.body);
  console.log("req.files", req.file);

  fs.unlinkSync(req.file.path);

  const branch = await Branch.findOne({ _id: req.body.branchId, retailerId: req.user._id });
  if (!branch) return apiResponse(res, 400, false, "Branch not found!");

  const existingSubAdmin: IUser = await SubAdmin.findOne({ email: req.body.email });
  if (existingSubAdmin) return apiResponse(res, 400, false, "This sub admin already exists!");

  const { branchId, firstName, lastName, email, phone, country, dialCode, password } = req.body;
  const hashPassword = await bcrypt.hash(password, 10);

  const subAdmin: any = await SubAdmin.create({
    branchId,
    retailerId: req.user._id,
    firstName,
    lastName,
    email,
    phone,
    country,
    dialCode,
    password: hashPassword,
  });

  // Remove Sensitive Data
  const data = exclude(subAdmin._doc, ["password", "createdAt", "updatedAt"]);

  // Upload Image (To Do)
  // Send Mail to Sub Admin (To Do)

  return apiResponse(res, 201, true, "Sub Admin created successfully!", data);
});

/**
 * Get All Single Sub Admin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllSubAdmins = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10 } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const [docs, total] = await Promise.all([
    SubAdmin.find({ retailerID: req.user._id }).limit(Number(limit)).skip(skip).sort({ createdAt: "asc" }),
    SubAdmin.find({ retailerID: req.user._id }).countDocuments(),
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

  return apiResponse(res, 201, true, "Sub Admins fetched successfully!", data);
});

/**
 * Get A Single SubAdmin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getSingleSubAdmin = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const subAdmin = await SubAdmin.findOne({ _id: id });
  if (!SubAdmin) return apiResponse(res, 404, false, "SubAdmin not found!");

  return apiResponse(res, 201, true, "SubAdmin fetched successfully!", subAdmin);
});

/**
 * Update A Single SubAdmin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateSubAdmin = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = validateBody(subAdminSchema, req.body);
  if (!_.isEmpty(result)) return apiResponse(res, 400, false, "Invalid Request!", result);

  const { id } = req.params;
  const { name, address, longitude, latitude, status } = req.body;

  const subAdmin = await SubAdmin.findOneAndUpdate(
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
  if (!SubAdmin) return apiResponse(res, 404, false, "SubAdmin not found!");

  return apiResponse(res, 200, true, "SubAdmin updated successfully!", subAdmin);
});

/**
 * Delete A Single SubAdmin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const deleteSubAdmin = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const subAdmin = await SubAdmin.findOneAndDelete({ _id: id });
  if (!SubAdmin) return apiResponse(res, 404, false, "SubAdmin not found!");

  return apiResponse(res, 200, true, "SubAdmin deleted successfully!");
});
