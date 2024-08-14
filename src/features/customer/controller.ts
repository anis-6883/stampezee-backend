import bcrypt from "bcrypt";
import { Response } from "express";
import { apiResponse, asyncHandler, makePaginate } from "../../helpers";
import { IApiRequest, IUser } from "../../types";
import CollectStamp from "../mobile/customer/search/model";
import Customer from "../user/customer/model";
import { sendRegistrationMail } from "./service";
import { customerSchema, customerStatusSchema, updateCustomerSchema } from "./validation";

/**
 * Get All Customers
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllCustomers = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = {};

  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); // case insensitive search. For sensitive remove i
    const orQuery = [{ fullName: regex }, { email: regex }];
    query.$or = orQuery;
  }

  const [docs, total] = await Promise.all([
    Customer.find(query, { password: 0, otp: 0, otpExpiry: 0, token: 0 })
      .limit(Number(limit))
      .skip(skip)
      .sort({ createdAt: "desc" }),
    Customer.find(query).countDocuments(),
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

  const [docs, total] = await Promise.all([
    CollectStamp.aggregate([
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
      {
        $match: {
          "branch.retailerId": req.user._id,
        },
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
    ]),
    CollectStamp.aggregate([
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
      {
        $match: {
          "branch.retailerId": req.user._id,
        },
      },
    ]),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total.length);

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

  const { otp, otpExpiry, isVerified, verifiedAt, image, ref, password, ...createBody } = result;

  createBody.password = await bcrypt.hash(password, 10);
  createBody.isVerified = true;
  createBody.verifiedAt = new Date();
  createBody.ref = "super_admin";

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
