import bcrypt from "bcrypt";
import { Response } from "express";
import mongoose from "mongoose";
import { apiResponse, asyncHandler, makePaginate } from "../../helpers";
import { IApiRequest, IUser } from "../../types";
import Branch from "../branch/model";
import CollectStamp from "../mobile/customer/search/model";
import OrderStamp from "../mobile/sub-admin/home/model";
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
          totalScan: { $size: "$orderStamps" },
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
          orderStamps: 0,
        },
      },
    ]),
    Customer.countDocuments(query),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Customers fetched successfully!", data);
});

/**
 * Get single customer for Both (SuperAdmin & Retailer)
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getSingleCustomer = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const customer = await Customer.aggregate([
    {
      $match: { _id: mongoose.Types.ObjectId.createFromHexString(id) },
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
        totalScan: { $size: "$orderStamps" },
        totalPurchased: { $sum: "$orderStamps.amount" },
        totalRewardCollect: {
          $size: {
            $filter: {
              input: "$orderStamps",
              as: "orderStamp",
              cond: { $eq: ["$$orderStamp.rewardCollected", true] },
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
        orderStamps: 0,
      },
    },
  ]);

  if (customer.length <= 0) return apiResponse(res, 404, false, "Customer not found!");

  return apiResponse(res, 200, true, "Customer fetched successfully!", customer[0]);
});

/**
 * Get single customer scan list for Both (SuperAdmin & Retailer)
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getSingleCustomerScanList = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;
  const { page = 1, limit = 10, search }: any = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = {};

  if (search) {
    query["retailer.storeName"] = { $regex: search, $options: "i" };
  }

  const [scans, total] = await Promise.all([
    OrderStamp.aggregate([
      {
        $match: {
          customerId: mongoose.Types.ObjectId.createFromHexString(id),
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
      {
        $lookup: {
          from: "collectstamps",
          localField: "collectStampId",
          foreignField: "_id",
          as: "collectstamp",
          pipeline: [
            {
              $lookup: {
                from: "stamps",
                localField: "stampId",
                foreignField: "_id",
                as: "stamp",
                pipeline: [
                  {
                    $lookup: {
                      from: "categories",
                      localField: "categoryId",
                      foreignField: "_id",
                      as: "category",
                      pipeline: [
                        {
                          $project: {
                            name: 1,
                          },
                        },
                      ],
                    },
                  },
                  {
                    $unwind: "$category",
                  },
                  {
                    $project: {
                      title: 1,
                      description: 1,
                      rules: 1,
                      noOfStampsToCollect: 1,
                      minPurchaseAmount: 1,
                      rewardType: 1,
                      promotionReward: 1,
                      discountReward: 1,
                      category: "$category.name",
                    },
                  },
                ],
              },
            },
            {
              $unwind: "$stamp",
            },
            {
              $lookup: {
                from: "branches",
                localField: "branchId",
                foreignField: "_id",
                as: "branch",
                pipeline: [
                  {
                    $project: {
                      _id: 0,
                      name: 1,
                      address: "$address.name",
                    },
                  },
                ],
              },
            },
            {
              $unwind: "$branch",
            },
          ],
        },
      },
      {
        $unwind: "$collectstamp",
      },
      {
        $lookup: {
          from: "subadmins",
          localField: "subAdminId",
          foreignField: "_id",
          as: "subAdmin",
          pipeline: [
            {
              $project: {
                _id: 0,
                fullName: 1,
                email: 1,
                image: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: "$subAdmin",
      },
      {
        $lookup: {
          from: "retailers",
          localField: "retailerId",
          foreignField: "_id",
          as: "retailer",
          pipeline: [
            {
              $project: {
                _id: 1,
                storeName: 1,
                fullName: 1,
                email: 1,
                image: 1,
                dialCode: 1,
                phone: 1,
                country: 1,
                city: 1,
                address: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: "$retailer",
      },
      {
        $match: query,
      },
      {
        $project: {
          "scan.time": "$createdAt",
          "scan.rewardCollected": "$rewardCollected",
          "scan.stampNumber": "$number",
          "scan.amount": "$amount",
          "scan.invoice": "$invoice",
          branch: "$collectstamp.branch",
          offer: "$collectstamp.stamp",
          subAdmin: 1,
          customer: 1,
          retailer: 1,
        },
      },
    ]),
    OrderStamp.countDocuments({ customerId: mongoose.Types.ObjectId.createFromHexString(id) }),
  ]);

  const data = makePaginate(scans, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Customer fetched successfully!", data);
});

/**
 * Get All Customers for Retailer
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllRetailerCustomers = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = { softDeleted: false };

  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); // case insensitive search. For sensitive remove i
    const orQuery = [{ fullName: regex }, { email: regex }];
    query.$or = orQuery;
  }

  const branchIds = (await Branch.find({ retailerId: req?.user?._id })).map((branch) => branch._id);

  const collectStamp = (
    await CollectStamp.aggregate([
      {
        $group: {
          _id: "$branchId", // Group by branchId
          uniqueCustomers: { $addToSet: "$customerId" }, // Collect unique customerId values in a set
        },
      },
      {
        $match: {
          _id: { $in: branchIds },
        },
      },
      {
        $group: {
          _id: null, // Group everything into a single document
          allUniqueCustomers: { $addToSet: "$uniqueCustomers" }, // Collect all unique customer arrays
        },
      },
      {
        $project: {
          _id: 0, // Remove the _id field
          customerIds: {
            $reduce: {
              input: "$allUniqueCustomers", // Flatten the array of arrays
              initialValue: [],
              in: { $setUnion: ["$$value", "$$this"] }, // Merge unique customer arrays
            },
          },
        },
      },
    ])
  )[0];

  query._id = { $in: collectStamp.customerIds };

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
          totalScan: { $size: "$orderStamps" },
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
          orderStamps: 0,
        },
      },
    ]),
    Customer.countDocuments(query),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Customers fetched successfully!", data);
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
  createBody.provider = "email";

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
