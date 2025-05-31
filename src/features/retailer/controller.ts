import bcrypt from "bcrypt";
import { Response } from "express";
import moment from "moment-timezone";
import mongoose, { Types } from "mongoose";
import { PACKAGES } from "../../configs/constants";
import { deleteFileFromS3Bucket, uploadFileToS3Bucket } from "../../configs/s3Bucket";
import { apiResponse, asyncHandler, exclude, makePaginate } from "../../helpers";
import Branch from "../../models/branch";
import CollectStamp from "../../models/collect-stamp";
import CurrencyExchange from "../../models/currency-exchange";
import Customer from "../../models/customer";
import EnrollSubscription from "../../models/enroll-subscription";
import Enrollment from "../../models/enrollment";
import OrderStamp from "../../models/order-stamp";
import Retailer from "../../models/retailer";
import Settings from "../../models/settings";
import Stamp from "../../models/stamp";
import SubAdmin from "../../models/sub-admin";
import Subscription from "../../models/subscription";
import { IApiRequest, Object } from "../../types";
import { IRetailerScanQuery } from "../../types/index";
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

  const newRetailer: any = await Retailer.create({
    ...createBody,
    fullName,
    image: imageKey,
    isVerified: true,
    takeFreeTrial: true,
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
    validityTo: freeTrial?.isUnlimited ? new Date("3030-01-01") : moment().add(freeTrial.duration, "days"),
    enrollStatus: "trial",
  });

  const enrollSubscription = await EnrollSubscription.create({
    enrollmentId: enrollment?._id,
    planSnapshot: freeTrial,
    status: true,
  });

  await Branch.create({
    name: newRetailer?.storeName,
    address: {
      loc: { type: "Point", coordinates: [retailer.longitude, retailer.latitude] },
      name: retailer.address,
    },
    retailerId: retailer._id,
    enrollSubscriptionId: enrollSubscription._id,
    validityTill: freeTrial?.isUnlimited ? new Date("3030-01-01") : moment().add(freeTrial.duration, "days"),
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

  const [retailer, activeSubscriptions] = await Promise.all([
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
                totalCustomers: { $ifNull: ["$collect_stamps.totalCustomer", 0] },
                totalStamps: { $size: "$order_stamps" },
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
          as: "stampCards",
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
          totalBranches: { $size: "$branches" },
          totalSubAdmins: { $size: "$sub_admins" },
          totalStampCards: { $size: "$stampCards" },
          totalCustomers: { $sum: "$branches.totalCustomers" },
          totalStamps: { $sum: "$branches.totalStamps" },
          totalRevenue: { $sum: "$branches.totalRevenue" },
        },
      },
      {
        $project: {
          enrollment: 0,
          stampCards: 0,
          sub_admins: 0,
          branches: 0,
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
          as: "enrollSubscription",
          pipeline: [
            {
              $match: {
                $or: [{ status: true }, { status: false, validAtAfterCancel: { $gt: new Date() } }],
              },
            },
          ],
        },
      },
      {
        $unwind: "$enrollSubscription",
      },
      {
        $addFields: {
          "enrollSubscription.enrollment": {
            _id: "$_id",
            validityFrom: "$validityFrom",
            validityTo: "$validityTo",
            status: "$status",
          },
        },
      },
      {
        $group: {
          _id: "$enrollSubscription.planSnapshot.slug",
          title: { $first: "$enrollSubscription.planSnapshot.title" },
          slug: { $first: "$enrollSubscription.planSnapshot.slug" },
          type: { $first: "$enrollSubscription.planSnapshot.type" },
          enrollSubscriptions: {
            $push: {
              _id: "$enrollSubscription._id",
              validAtAfterCancel: "$enrollSubscription.validAtAfterCancel",
              enrollment: "$enrollSubscription.enrollment",
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
        },
      },
    ]),
  ]);

  if (retailer.length <= 0) return apiResponse(res, 404, false, "Retailer not found!");

  retailer[0].activeSubscriptions = activeSubscriptions;

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
 * Retailer Payments
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const retailerPayments = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search }: any = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = {
    retailerId: Types.ObjectId.createFromHexString(String(req.params.id)),
    paymentStatus: { $in: ["completed", "trial"] },
  };

  if (search) {
    const regex = { $regex: search, $options: "i" };
    query["stripe.subscriptionId"] = regex;
  }

  const [docs, total] = await Promise.all([
    Enrollment.aggregate([
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
          from: "enroll_subscriptions",
          localField: "_id",
          foreignField: "enrollmentId",
          as: "enrollSubscriptions",
          pipeline: [
            {
              $project: {
                subscriptionItemId: 1,
                title: "$planSnapshot.title",
                slug: "$planSnapshot.slug",
                type: "$planSnapshot.type",
                deletedByRetailerAt: 1,
                validAtAfterCancel: 1,
              },
            },
            {
              $sort: {
                type: -1,
              },
            },
          ],
        },
      },
    ]),
    Enrollment.countDocuments(query),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Retailer payments fetched successfully!", data);
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
 * Retailer Branches
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const retailerBranches = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { retailerId } = req.params;
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const retailer = await Retailer.findById(retailerId, { businessCurrency: 1 });
  const currencyExchange = await CurrencyExchange.findOne({ currency: retailer?.businessCurrency });

  const query: any = { retailerId: retailer._id, softDeleted: false };
  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); //case insensitive search. For sensitive remove i
    query.name = regex;
  }

  const [docs, total] = await Promise.all([
    Branch.aggregate([
      {
        $match: query,
      },
      {
        $sort: {
          disabledBySystem: 1,
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
                totalCustomers: { $size: "$uniqueCustomers" }, // Count the distinct customerId's
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
          from: "stamps",
          localField: "_id",
          foreignField: "branchId",
          as: "stampCards",
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
          totalCustomers: { $ifNull: ["$collect_stamps.totalCustomers", 0] },
          totalStamps: { $size: "$order_stamps" },
          totalStampsCards: { $size: "$stampCards" },
          totalRevenue: {
            $reduce: {
              input: {
                $map: {
                  input: "$order_stamps",
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
                              { $ifNull: [currencyExchange.exchangeRate, 1] },
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
              initialValue: 0,
              in: { $add: ["$$value", "$$this"] },
            },
          },
          currency: retailer?.businessCurrency,
        },
      },
    ]),
    Branch.countDocuments(query),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Retailer's branches fetched successfully!", data);
});

/**
 * Retailer Stamp Cards
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const retailerStampCards = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { retailerId } = req.params;
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = { retailerId: Types.ObjectId.createFromHexString(retailerId), softDeleted: false };
  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); //case insensitive search. For sensitive remove i
    query.title = regex;
  }

  const [docs, total] = await Promise.all([
    Stamp.aggregate([
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
        $lookup: {
          from: "categories",
          localField: "categoryId",
          foreignField: "_id",
          as: "category",
          pipeline: [
            {
              $project: {
                name: 1,
                image: 1,
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "stamp_images",
          localField: "stampImageId",
          foreignField: "_id",
          as: "stampImage",
          pipeline: [
            {
              $project: {
                title: 1,
                image: 1,
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
      {
        $unwind: {
          path: "$category",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $unwind: {
          path: "$stampImage",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          branchId: 0,
          categoryId: 0,
          stampImageId: 0,
        },
      },
    ]),
    Stamp.countDocuments(query),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Retailer's stamp cards fetched successfully!", data);
});

/**
 * Retailer Stamps
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const retailerStamps = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { retailerId } = req.params;
  const { page = 1, limit = 10, search }: any = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);
  const query: IRetailerScanQuery = { retailerId: Types.ObjectId.createFromHexString(retailerId) };

  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); // case insensitive search. For sensitive remove 'i'
    const customers = await Customer.find({
      $or: [{ fullName: regex }, { email: regex }],
    }).select("_id");

    // Extract array of _id values
    const customerIds = customers.map((customer) => customer._id);
    query.customerId = { $in: customerIds };
  }
  const [docs, total] = await Promise.all([
    OrderStamp.aggregate([
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
        $unwind: "$subAdmin",
      },
      {
        $lookup: {
          from: "customers",
          localField: "customerId",
          foreignField: "_id",
          as: "customer",
          pipeline: [
            {
              $project: {
                _id: 0,
                fullName: 1,
                email: 1,
                contactEmail: 1,
                image: 1,
                dialCode: 1,
                phone: 1,
                country: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: "$customer",
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
        },
      },
    ]),
    OrderStamp.countDocuments(query),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Retailer's stamps fetched successfully!", data);
});

/**
 * Retailer Customers
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const retailerCustomers = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { retailerId } = req.params;
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = { softDeleted: false, isVerified: true };

  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); // case insensitive search. For sensitive remove i
    const orQuery = [{ fullName: regex }, { email: regex }];
    query.$or = orQuery;
  }

  const branchIds = (await Branch.find({ retailerId })).map((branch) => branch._id);

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

  return apiResponse(res, 200, true, "Retailer's customers fetched successfully!", data);
});

/**
 * Retailer Sub-Admins
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const retailerSubAdmins = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { retailerId } = req.params;
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = { retailerId: Types.ObjectId.createFromHexString(retailerId), softDeleted: false };
  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); //case insensitive search. For sensitive remove i
    const orQuery = [{ fullName: regex }, { email: regex }];
    query.$or = orQuery;
  }

  const [docs, total] = await Promise.all([
    SubAdmin.aggregate([
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
          pipeline: [
            {
              $project: {
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
      {
        $project: {
          branchId: 0,
          password: 0,
        },
      },
    ]),
    SubAdmin.countDocuments(query),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Retailer's loyalty executives fetched successfully!", data);
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
