import bcrypt from "bcrypt";
import { Response } from "express";
import moment from "moment";
import mongoose from "mongoose";
import { PACKAGES } from "../../configs/constants";
import { deleteFileFromS3Bucket, uploadFileToS3Bucket } from "../../configs/s3Bucket";
import { apiResponse, asyncHandler, exclude, makePaginate } from "../../helpers";
import Branch from "../../models/branch";
import EnrollSubscription from "../../models/enroll-subscription";
import Enrollment from "../../models/enrollment";
import Retailer from "../../models/retailer";
import Subscription from "../../models/subscription";
import { IApiRequest } from "../../types";
import { sendRegistrationMail } from "./service";
import { retailerSchema, retailerSchemaUpdate, retailerStatusSchema } from "./validation";
import SubAdmin from "../../models/sub-admin";

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

  const newRetailer: any = await Retailer.create({
    ...createBody,
    fullName,
    image: imageKey,
    isVerified: true,
    verifiedAt: Date.now(),
    ref: req.role,
  });

  const retailer = await Retailer.findOneAndUpdate(
    { email: createBody.email },
    { isVerified: true, verifiedAt: new Date(), otp: null, otpExpiry: null },
    { new: true }
  );

  const freeTrial = await Subscription.findOne({ slug: "trial" });
  if (!freeTrial) return apiResponse(res, 400, false, "Free trial package not found!");

  const enrollment = await Enrollment.create({
    retailerId: retailer._id,
    planExists: PACKAGES.TRIAL,
    paymentStatus: "trial",
    validityFrom: moment(),
    validityTo: moment().add(freeTrial.duration, "days"),
    enrollStatus: "trial",
  });

  const enrollSubscription = await EnrollSubscription.create({
    enrollmentId: enrollment?._id,
    planSnapshot: freeTrial,
    status: true,
  });

  await Branch.create({
    name: "Default Branch",
    address: {
      loc: { type: "Point", coordinates: [retailer.longitude, retailer.latitude] },
      name: retailer.address,
    },
    retailerId: retailer._id,
    enrollSubscriptionId: enrollSubscription._id,
    source: "subscription",
  });

  // Sending Mail
  await sendRegistrationMail(createBody.email, fullName, retailer.address, createBody.storeName);

  // Remove Sensitive Data
  const data = exclude(newRetailer._doc, ["password", "createdAt", "updatedAt"]);

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
          from: "enrollments",
          localField: "_id",
          foreignField: "retailerId",
          as: "enrollment",
          pipeline: [
            {
              $match: {
                planExists: { $ne: null },
                validityTo: { $gt: new Date() },
                status: true,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$enrollment",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          currentPlan: { $ifNull: ["$enrollment.planExists", null] },
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
          enrollment: 0,
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

  const [retailer, addonSubscriptions] = await Promise.all([
    Retailer.aggregate([
      {
        $match: { _id: mongoose.Types.ObjectId.createFromHexString(id) },
      },
      {
        $lookup: {
          from: "sub_admins",
          localField: "_id",
          foreignField: "retailerId",
          as: "sub_admins",
          pipeline: [
            {
              $match: {
                status: true,
                softDeleted: false,
              },
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
              $unwind: {
                path: "$branch",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                firstName: 1,
                lastName: 1,
                fullName: 1,
                email: 1,
                branchName: "$branch.name",
                branchAddress: "$branch.address.name",
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "enrollments",
          localField: "_id",
          foreignField: "retailerId",
          as: "enrollment",
          pipeline: [
            {
              $match: {
                planExists: { $ne: null },
                validityTo: { $gt: new Date() },
                status: true,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$enrollment",
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
                from: "collect_stamps",
                localField: "_id",
                foreignField: "branchId",
                as: "collect_stamps",
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
                path: "$collect_stamps",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $lookup: {
                from: "order_stamps",
                localField: "_id",
                foreignField: "branchId",
                as: "order_stamps",
              },
            },
            {
              $project: {
                _id: 1,
                name: 1,
                address: "$address.name",
                totalCustomer: { $ifNull: ["$collect_stamps.totalCustomer", 0] },
                totalOrder: { $size: "$order_stamps" },
                totalRevenue: { $sum: "$order_stamps.amount" },
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
          currentPlan: { $ifNull: ["$enrollment.planExists", null] },
          totalActiveBranch: { $size: "$branches" },
          totalSubAdmin: { $size: "$sub_admins" },
          totalActiveStamp: { $size: "$stamps" },
          totalCustomer: { $sum: "$branches.totalCustomer" },
          totalOrder: { $sum: "$branches.totalOrder" },
          totalRevenue: { $sum: "$branches.totalRevenue" },
        },
      },
      {
        $project: {
          enrollment: 0,
          stamps: 0,
          password: 0,
          otp: 0,
          otpExpiry: 0,
        },
      },
    ]),
    Enrollment.aggregate([
      {
        $match: {
          retailerId: mongoose.Types.ObjectId.createFromHexString(id),
          validityTo: { $gt: new Date() },
          status: true,
        },
      },
      {
        $lookup: {
          from: "enroll_subscriptions",
          localField: "_id",
          foreignField: "enrollmentId",
          as: "addonEnrollSubscriptions",
          pipeline: [
            {
              $match: {
                "planSnapshot.type": "addon", // Add-on specific condition
                status: true,
              },
            },
            {
              $group: {
                _id: "$planSnapshot.slug",
                count: { $sum: 1 },
                title: { $first: "$planSnapshot.title" },
              },
            },
            {
              $project: {
                slug: "$_id", // Rename _id to slug
                title: 1,
                count: 1,
                _id: 0,
              },
            },
          ],
        },
      },
      {
        $unwind: "$addonEnrollSubscriptions",
      },
      {
        $group: {
          _id: "$addonEnrollSubscriptions.slug",
          count: { $sum: 1 },
          title: { $first: "$addonEnrollSubscriptions.title" },
        },
      },
    ]),
  ]);

  if (retailer.length <= 0) return apiResponse(res, 404, false, "Retailer not found!");

  retailer[0].addonSubscriptions = addonSubscriptions;

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

  const subAdmins = await SubAdmin.find({ retailerId: id });
  const subAdminPromises: any[] = [];
  subAdmins.forEach(async (subAdmin) => {
    subAdminPromises.push(
      SubAdmin.findByIdAndUpdate(subAdmin._id, {
        email: `deleted-${new Date().toISOString()}-${subAdmin.email}`,
        softDeleted: true,
        status: false,
      })
    );
  });
  Promise.all(subAdminPromises);

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
