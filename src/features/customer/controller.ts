import bcrypt from "bcrypt";
import { Response } from "express";
import { apiResponse, asyncHandler, makePaginate } from "../../helpers";
import { IApiRequest, IUser } from "../../types";
import Branch from "../branch/model";
import CollectStamp from "../mobile/customer/search/model";
import Customer from "../user/customer/model";
import { sendRegistrationMail } from "./service";
import { customerSchema, customerStatusSchema, updateCustomerSchema } from "./validation";

/**
 * Get All Customers for Super Admin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllCustomers = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = { softDeleted: false };

  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); // case insensitive search. For sensitive remove i
    const orQuery = [{ fullName: regex }, { email: regex }];
    query.$or = orQuery;
  }

  const [docs, total] = await Promise.all([
    Customer.aggregate([
      {
        $match: query,
      },
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
        $lookup: {
          from: "collectstamps",
          localField: "_id",
          foreignField: "customerId",
          as: "collectStamps",
        },
      },
      {
        $lookup: {
          from: "orderstamps",
          localField: "_id",
          foreignField: "customerId",
          as: "orderStamps",
        },
      },
      {
        $addFields: {
          totalCollectStamp: { $size: "$collectStamps" },
        },
      },
      {
        $addFields: {
          totalScan: { $size: "$orderStamps" },
        },
      },
      {
        $addFields: {
          totalRewardCollect: {
            $size: {
              $filter: {
                input: "$orderStamps", // Filter on the orderStamps array
                as: "orderStamp", // Alias for each element in the array
                cond: { $eq: ["$$orderStamp.rewardCollected", true] }, // Condition: rewardCollected should be true
              },
            },
          },
        },
      },
      {
        $project: {
          password: 0,
          otp: 0,
          otpExpiry: 0,
          token: 0,
          collectStamps: 0,
        },
      },
    ]),
    Customer.countDocuments(query),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Customers fetched successfully!", data);
});

/**
 * Get All Retailer Customers
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllRetailerCustomers = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10 } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const branchIds = (await Branch.find({ retailerId: req.user._id }, { _id: 1 })).map((branch) => branch._id);
  const query = { branchId: { $in: branchIds } };

  const [docs, total] = await Promise.all([
    CollectStamp.aggregate([
      {
        $match: query,
      },
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
        $lookup: {
          from: "branches",
          localField: "branchId",
          foreignField: "_id",
          as: "branch",
        },
      },
      {
        $lookup: {
          from: "customers",
          localField: "customerId",
          foreignField: "_id",
          as: "customer",
        },
      },
      {
        $unwind: "$customer",
      },
      {
        $unwind: "$branch",
      },
    ]),
    CollectStamp.countDocuments(query),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Retailer Customers fetched successfully!", data);
});

/**
 * Create A Customer By Super Admin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const createCustomerBySuperAdmin = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await customerSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { otp, otpExpiry, isVerified, verifiedAt, image, ref, password, address, ...createBody } = result;

  createBody.password = await bcrypt.hash(password, 10);
  createBody.isVerified = true;
  createBody.verifiedAt = new Date();
  createBody.ref = "super_admin";
  createBody["address.name"] = address;

  const existingCustomer: IUser = await Customer.findOne({
    email: createBody.email,
  });

  if (existingCustomer && existingCustomer.isVerified) throw "This customer already exists!";

  await Customer.create(createBody);

  await sendRegistrationMail(createBody.email, createBody.fullName, password);

  return apiResponse(res, 200, true, "Customer created successfully & sent mail!");
});

/**
 * Update A Customer By Super Admin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateCustomerBySuperAdmin = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await updateCustomerSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { id } = req.params;
  const { otp, otpExpiry, isVerified, verifiedAt, image, ref, password, ...updateBody } = result;

  const existingCustomer: IUser = await Customer.findOne({
    email: updateBody.email,
    _id: { $ne: id },
  });

  if (existingCustomer) throw "This customer already exists!";

  const customer = await Customer.findOneAndUpdate({ _id: id }, updateBody);
  if (!customer) return apiResponse(res, 404, false, "Customer not found!");

  return apiResponse(res, 200, true, "Customer updated successfully!");
});

/**
 * Update Status A Customer by Super Admin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateCustomerStatusBySuperAdmin = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await customerStatusSchema.validateAsync(req.body, {
    abortEarly: false,
  });
  const { id } = req.params;
  const { status } = result;

  const customer = await Customer.findOneAndUpdate(
    { _id: id },
    {
      status,
    },
    {
      new: true,
    }
  );

  if (!customer) return apiResponse(res, 404, false, "Customer not found!");

  return apiResponse(res, 200, true, "Customer status updated successfully!");
});

/**
 * Soft Delete A Customer By Super Admin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const softDeleteCustomerBySuperAdmin = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const customer = await Customer.findById(id);
  if (!customer) return apiResponse(res, 404, false, "Customer not found!");

  await Customer.findByIdAndUpdate(id, {
    email: `deleted-${new Date().toISOString()}-${customer.email}`,
    softDeleted: true,
    status: false,
  });

  return apiResponse(res, 200, true, "Customer deleted successfully!");
});
