import bcrypt from "bcrypt";
import { Response } from "express";
import moment from "moment-timezone";
import mongoose from "mongoose";
import { ROLE } from "../../configs/constants";
import { apiResponse, asyncHandler, makePaginate } from "../../helpers";
import Branch from "../../models/branch";
import CollectStamp from "../../models/collect-stamp";
import CurrencyExchange from "../../models/currency-exchange";
import Customer from "../../models/customer";
import OrderStamp from "../../models/order-stamp";
import Settings from "../../models/settings";
import { IApiRequest, IUser, Object } from "../../types";
import { sendRegistrationMail } from "./service";
import { customerSchema, customerStatusSchema, updateCustomerSchema } from "./validation";

/**
 * Get All Customers for Super Admin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllCustomers = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search, start = undefined, end = undefined } = req.query;

  const skip: number = (Number(page) - 1) * Number(limit);
  const settings = await Settings.findOne();
  const timezone = settings.general.timezone.label;

  let startDate, endDate;

  // Handle date logic
  if (start) {
    startDate = moment.tz(start, timezone).startOf("day").toDate();
    endDate = end ? moment.tz(end, timezone).endOf("day").toDate() : moment.tz(start, timezone).endOf("day").toDate(); // treat start as end
  }

  const dateFilter: Object = {};
  if (startDate) dateFilter.$gte = startDate;
  if (endDate) dateFilter.$lte = endDate;

  const query: any = { softDeleted: false, isVerified: true };
  if (start || end) query.createdAt = dateFilter;

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
          from: "collect_stamps",
          localField: "_id",
          foreignField: "customerId",
          as: "collectStamps",
        },
      },
      {
        $lookup: {
          from: "order_stamps",
          localField: "_id",
          foreignField: "customerId",
          as: "orderStamps",
        },
      },
      {
        $addFields: {
          totalStampsCollected: { $size: "$collectStamps" },
          totalActiveStampsCollected: {
            $size: {
              $filter: {
                input: "$collectStamps",
                as: "collectStamp",
                cond: { $eq: ["$$collectStamp.softDeleted", false] },
              },
            },
          },
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
  const query: Object = {};
  let currencyExchangeRate = 1;

  if (req.role === ROLE.RETAILER) {
    const branches = await Branch.find({ retailerId: req.user._id }).select("_id");
    const branchIds = branches.map((branch) => branch._id);
    query.branchId = { $in: branchIds };

    const currencyExchange = await CurrencyExchange.findOne({ currency: req.user?.businessCurrency });
    currencyExchangeRate = currencyExchange?.exchangeRate ?? 1;
  }

  const customer = await Customer.aggregate([
    {
      $match: { _id: mongoose.Types.ObjectId.createFromHexString(id) },
    },
    {
      $lookup: {
        from: "collect_stamps",
        localField: "_id",
        foreignField: "customerId",
        as: "collectStamps",
        pipeline: [
          {
            $match: query,
          },
        ],
      },
    },
    {
      $lookup: {
        from: "order_stamps",
        localField: "_id",
        foreignField: "customerId",
        as: "orderStamps",
        pipeline: [
          {
            $match: { ...(req.role === ROLE.RETAILER && { retailerId: req.user._id }) },
          },
        ],
      },
    },
    {
      $addFields: {
        totalStampsCollected: { $size: "$collectStamps" },
        totalActiveStampsCollected: {
          $size: {
            $filter: {
              input: "$collectStamps",
              as: "collectStamp",
              cond: { $eq: ["$$collectStamp.softDeleted", false] },
            },
          },
        },
        totalScan: { $size: "$orderStamps" },
        totalPurchased: {
          $sum: {
            $map: {
              input: "$orderStamps",
              as: "order",
              in: {
                $cond: {
                  if: {
                    $and: [{ $ne: ["$$order.exchangeRate", 0] }, { $ne: ["$$order.exchangeRate", null] }],
                  },
                  then: {
                    $round: [
                      {
                        $multiply: [
                          {
                            $divide: [{ $ifNull: ["$$order.amount", 0] }, { $ifNull: ["$$order.exchangeRate", 1] }],
                          },
                          { $ifNull: [currencyExchangeRate, 1] },
                        ],
                      },
                      2,
                    ],
                  },
                  else: 0,
                },
              },
            },
          },
        },
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

  const query: Object = {};

  if (search) {
    query["retailer.storeName"] = { $regex: search, $options: "i" };
  }

  const [scans, total] = await Promise.all([
    OrderStamp.aggregate([
      {
        $match: {
          customerId: mongoose.Types.ObjectId.createFromHexString(id),
          ...(req.role === ROLE.RETAILER && { retailerId: req.user._id }),
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
          from: "collect_stamps",
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
                    $unwind: {
                      path: "$category",
                      preserveNullAndEmptyArrays: true,
                    },
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
              $unwind: {
                path: "$stamp",
                preserveNullAndEmptyArrays: true,
              },
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
              $unwind: {
                path: "$branch",
                preserveNullAndEmptyArrays: true,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$collectstamp",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "sub_admins",
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
        $unwind: {
          path: "$subAdmin",
          preserveNullAndEmptyArrays: true,
        },
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
        $unwind: {
          path: "$retailer",
          preserveNullAndEmptyArrays: true,
        },
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
          "scan.amountCurrency": "$amountCurrency",
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

  const query: any = { softDeleted: false, isVerified: true };

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

  query._id = { $in: collectStamp?.customerIds ?? [] };

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
          from: "collect_stamps",
          localField: "_id",
          foreignField: "customerId",
          as: "collectStamps",
          pipeline: [
            {
              $match: {
                branchId: { $in: branchIds },
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "order_stamps",
          localField: "_id",
          foreignField: "customerId",
          as: "orderStamps",
          pipeline: [
            {
              $match: {
                branchId: { $in: branchIds },
              },
            },
          ],
        },
      },
      {
        $addFields: {
          totalStampsCollected: { $size: "$collectStamps" },
          totalActiveStampsCollected: {
            $size: {
              $filter: {
                input: "$collectStamps",
                as: "collectStamp",
                cond: { $eq: ["$$collectStamp.softDeleted", false] },
              },
            },
          },
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

  if (existingCustomer && existingCustomer.isVerified)
    return apiResponse(res, 400, false, "This customer already exists!");

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
  const { otp, otpExpiry, isVerified, verifiedAt, image, ref, address, password, ...updateBody } = result;

  const existingCustomer: IUser = await Customer.findOne({
    email: updateBody.email,
    _id: { $ne: id },
  });

  if (existingCustomer) return apiResponse(res, 400, false, "This customer already exists!");

  updateBody["address.name"] = address;

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
      token: null,
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
