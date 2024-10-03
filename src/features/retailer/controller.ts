import bcrypt from "bcrypt";
import { Response } from "express";
import mongoose from "mongoose";
import { deleteFileFromS3Bucket, uploadFileToS3Bucket } from "../../configs/s3Bucket";
import { apiResponse, asyncHandler, exclude, makePaginate } from "../../helpers";
import { IApiRequest } from "../../types";
import Retailer from "../user/retailer/model";
import { sendRegistrationMail } from "./service";
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
  const fullName = createBody?.lastName ? `${createBody.firstName} ${createBody.lastName}` : createBody.firstName;

  const retailer: any = await Retailer.create({
    ...createBody,
    fullName,
    image: imageKey,
    isVerified: true,
    verifiedAt: Date.now(),
    ref: req.role,
  });

  // Sending Mail
  await sendRegistrationMail(createBody.email, fullName, password, createBody.storeName);

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

  const query: any = { softDeleted: false, isVerified: true };

  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); //case insensitive search. For sensitive remove i
    const orQuery = [{ fullName: regex }, { email: regex }, { storeName: regex }];
    query.$or = orQuery;
  }

  const [docs, total] = await Promise.all([
    Retailer.aggregate([
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
          from: "enrollsubscriptions",
          localField: "_id",
          foreignField: "retailerId",
          as: "enrollSubscription",
          pipeline: [
            {
              $match: {
                "planSnapshot.type": "subscription",
                status: true,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$enrollSubscription",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          currentPlan: {
            $cond: {
              if: { $gt: [{ $type: "$enrollSubscription" }, "missing"] }, // Check if enrollSubscription exists
              then: "$enrollSubscription.planSnapshot.title", // If true, set currentPlan to title
              else: null, // If false, set it to null
            },
          },
        },
      },
      {
        $lookup: {
          from: "branches",
          localField: "_id",
          foreignField: "retailerId",
          as: "branches",
          pipeline: [
            {
              $match: {
                status: true,
                softDeleted: false,
                disabledBySystem: false,
              },
            },
          ],
        },
      },
      {
        $addFields: {
          totalActiveBranch: { $size: "$branches" }, // Count the number of branches returned in the lookup
        },
      },
      {
        $lookup: {
          from: "stamps",
          localField: "_id",
          foreignField: "retailerId",
          as: "stamps",
          pipeline: [
            {
              $match: {
                startedAt: { $lte: new Date() },
                expiredAt: { $gte: new Date() },
                isPublished: true,
                status: true,
                softDeleted: false,
              },
            },
          ],
        },
      },
      {
        $addFields: {
          totalActiveStamp: { $size: "$stamps" }, // Count the number of stamps returned in the lookup
        },
      },
      {
        $project: {
          enrollSubscription: 0,
          branches: 0,
          stamps: 0,
          password: 0,
          otp: 0,
          otpExpiry: 0,
        },
      },
    ]),
    Retailer.countDocuments(query),
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

  const retailer = await Retailer.aggregate([
    {
      $match: { _id: mongoose.Types.ObjectId.createFromHexString(id) },
    },
    {
      $lookup: {
        from: "enrollsubscriptions",
        localField: "_id",
        foreignField: "retailerId",
        as: "enrollSubscription",
        pipeline: [
          {
            $match: {
              "planSnapshot.type": "subscription",
              status: true,
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: "$enrollSubscription",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "branches",
        localField: "_id",
        foreignField: "retailerId",
        as: "branches",
        pipeline: [
          {
            $match: {
              status: true,
              softDeleted: false,
              disabledBySystem: false,
            },
          },
          {
            $lookup: {
              from: "collectstamps",
              localField: "_id",
              foreignField: "branchId",
              as: "collectstamps",
              pipeline: [
                {
                  $group: {
                    _id: "$branchId", // Group by branchId
                    uniqueCustomers: { $addToSet: "$customerId" }, // Collect unique customerId values in a set
                  },
                },
                {
                  $project: {
                    _id: 1, // Include branchId (this is the default _id generated by $group)
                    totalCustomer: { $size: "$uniqueCustomers" }, // Count the distinct customerId's
                  },
                },
              ],
            },
          },
          {
            $unwind: {
              path: "$collectstamps",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $lookup: {
              from: "orderstamps",
              localField: "_id",
              foreignField: "branchId",
              as: "orderstamps",
            },
          },
          {
            $lookup: {
              from: "subadmins",
              localField: "_id",
              foreignField: "branchId",
              as: "subadmin",
              pipeline: [
                {
                  $match: {
                    softDeleted: false,
                  },
                },
              ],
            },
          },
          {
            $unwind: {
              path: "$subadmin",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              _id: 1,
              name: 1,
              address: "$address.name",
              subAdminName: { $ifNull: ["$subadmin.fullName", null] },
              subAdminEmail: { $ifNull: ["$subadmin.email", null] },
              totalCustomer: { $ifNull: ["$collectstamps.totalCustomer", 0] },
              totalOrder: { $size: "$orderstamps" },
              totalRevenue: { $sum: "$orderstamps.amount" },
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "stamps",
        localField: "_id",
        foreignField: "retailerId",
        as: "stamps",
        pipeline: [
          {
            $match: {
              startedAt: { $lte: new Date() },
              expiredAt: { $gte: new Date() },
              isPublished: true,
              status: true,
              softDeleted: false,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        currentPlan: {
          $cond: {
            if: { $gt: [{ $type: "$enrollSubscription" }, "missing"] }, // Check if enrollSubscription exists
            then: "$enrollSubscription.planSnapshot.title", // If true, set currentPlan to title
            else: null, // If false, set it to null
          },
        },
        totalActiveBranch: { $size: "$branches" },
        totalActiveStamp: { $size: "$stamps" },
        totalCustomer: { $sum: "$branches.totalCustomer" },
        totalOrder: { $sum: "$branches.totalOrder" },
        totalRevenue: { $sum: "$branches.totalRevenue" },
      },
    },
    {
      $project: {
        enrollSubscription: 0,
        stamps: 0,
        password: 0,
        otp: 0,
        otpExpiry: 0,
      },
    },
  ]);

  if (retailer.length <= 0) return apiResponse(res, 404, false, "Retailer not found!");

  return apiResponse(res, 201, true, "Retailer fetched successfully!", retailer[0]);
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
