import { Response } from "express";
import mongoose from "mongoose";
import { apiResponse, asyncHandler, formatErrorMsg, makePaginateForMobile } from "../../../../helpers";
import Branch from "../../../../models/branch";
import Category from "../../../../models/category";
import CollectStamp from "../../../../models/collect-stamp";
import Enrollment from "../../../../models/enrollment";
import Retailer from "../../../../models/retailer";
import Sorting from "../../../../models/sorting";
import Stamp from "../../../../models/stamp";
import Subscription from "../../../../models/subscription";
import { IApiRequest } from "../../../../types";
import { collectStampSchema } from "./validation";

/**
 * Get All Stamp Categories
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllCategories = asyncHandler(async (req: IApiRequest, res: Response) => {
  const docs = await Category.find({ softDeleted: false, status: true }, { name: 1, image: 1 });

  const sorting = await Sorting.findOne({ title: "category" });
  const sortedIds = sorting ? sorting.sortedData : [];

  const categoryMap = new Map(docs.map((category) => [category._id.toString(), category]));
  const sortedList = sortedIds.map((id) => categoryMap.get(id)).filter(Boolean);

  return apiResponse(res, 200, true, "Stamp categories fetched successfully!", sortedList);
});

/**
 * Get All Branches with Stamp By Customer Location
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllStampsByLocation = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search = "", categoryId }: any = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);
  const long = req.user.address.loc.coordinates[0];
  const lat = req.user.address.loc.coordinates[1];

  if (!long || !lat) return apiResponse(res, 400, false, "Latitude & Longitude must be set!");

  // Find already collected stampIds
  const stampIds = (
    await CollectStamp.find({ customerId: req.user._id, softDeleted: false }, { stampId: 1, _id: 0 })
  ).map(({ stampId }) => stampId);

  let branchIds = [];

  if (search) {
    const result = (
      await Retailer.aggregate([
        {
          $match: { storeName: { $regex: search, $options: "i" } },
        },
        {
          $lookup: {
            from: "branches",
            localField: "_id",
            foreignField: "retailerId",
            as: "branches",
          },
        },
        {
          $unwind: {
            path: "$branches",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $group: {
            _id: null, // Group by null to accumulate all branch IDs
            branchIds: { $addToSet: "$branches._id" }, // Use $addToSet to ensure unique branch IDs
          },
        },
        {
          $project: {
            _id: 0,
            branchIds: 1,
          },
        },
      ])
    )[0];

    if (result) {
      branchIds = result.branchIds;
    }
  }

  const gioPipeline: any = [
    {
      $geoNear: {
        near: { type: "Point", coordinates: [Number(long), Number(lat)] },
        distanceField: "distance",
        spherical: true,
      },
    },
  ];

  // Add $match stage only if branchIds array is not empty
  if (branchIds.length > 0) {
    gioPipeline.push({
      $match: { _id: { $in: branchIds } },
    });
  }

  // Add sorting
  gioPipeline.push({
    $sort: {
      distance: 1,
    },
  });

  const freeTrialRetailers = await Enrollment.aggregate([
    {
      $match: {
        planExists: "trial",
        validityTo: { $gt: new Date() },
        status: true,
      },
    },
    {
      $lookup: {
        from: "order_stamps",
        let: { retailerId: "$retailerId" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$retailerId", "$$retailerId"] },
            },
          },
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              customerIds: { $addToSet: "$customerId" },
            },
          },
          {
            $project: {
              _id: 0,
              totalOrders: 1,
              uniqueCustomers: { $size: "$customerIds" },
            },
          },
        ],
        as: "orderStats",
      },
    },
    {
      $addFields: {
        totalOrders: { $ifNull: [{ $arrayElemAt: ["$orderStats.totalOrders", 0] }, 0] },
        uniqueCustomers: { $ifNull: [{ $arrayElemAt: ["$orderStats.uniqueCustomers", 0] }, 0] },
      },
    },
    {
      $project: {
        retailerId: 1,
        totalOrders: 1,
        uniqueCustomers: 1,
      },
    },
  ]);

  const subscription = await Subscription.findOne({ slug: "trial" }).select("allowTotalUser allowTotalScan");

  const activeSubscriptionRetailerIds = (
    await Enrollment.find(
      {
        planExists: { $nin: [null, "trial"] },
        validityTo: { $gt: new Date() },
        status: true,
      },
      { retailerId: 1 }
    )
  ).map(({ retailerId }) => retailerId);

  if (subscription?.allowTotalScan || subscription?.allowTotalUser) {
    freeTrialRetailers.forEach((retailer: any) => {
      if (subscription.allowTotalScan && retailer.totalOrders < subscription.allowTotalScan) {
        activeSubscriptionRetailerIds.push(retailer.retailerId);
      } else if (subscription.allowTotalUser && retailer.uniqueCustomers < subscription.allowTotalUser) {
        activeSubscriptionRetailerIds.push(retailer.retailerId);
      }
    });
  }

  const [branchSortByGio, docs, total] = await Promise.all([
    Branch.aggregate(gioPipeline),
    Stamp.aggregate([
      {
        $match: {
          startedAt: { $lte: new Date() },
          expiredAt: { $gte: new Date() },
          isPublished: true,
          status: true,
          softDeleted: false,
          _id: { $nin: stampIds },
          retailerId: { $in: activeSubscriptionRetailerIds },
          ...(categoryId && { categoryId: mongoose.Types.ObjectId.createFromHexString(categoryId) }),
          ...(search && { $or: [{ title: { $regex: search, $options: "i" } }, { branchId: { $in: branchIds } }] }),
        },
      },
      {
        $lookup: {
          from: "order_stamps",
          localField: "retailerId",
          foreignField: "retailerId",
          as: "orderStamps",
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
          from: "branches",
          localField: "branchId",
          foreignField: "_id",
          as: "branch",
          pipeline: [
            {
              $lookup: {
                from: "retailers",
                localField: "retailerId",
                foreignField: "_id",
                as: "retailer",
              },
            },
            {
              $unwind: {
                path: "$retailer",
                preserveNullAndEmptyArrays: true,
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
          stamp: {
            $mergeObjects: [
              {
                $arrayToObject: {
                  $filter: { input: { $objectToArray: "$$ROOT" }, cond: { $ne: ["$$this.k", "branch"] } },
                },
              },
            ],
          },
          "branch._id": "$branch._id",
          "branch.name": "$branch.name",
          "branch.address": "$branch.address.name",
          "retailer._id": "$branch.retailer._id",
          "retailer.storeName": "$branch.retailer.storeName",
          "retailer.image": "$branch.retailer.image",
          _id: 0,
        },
      },
    ]),
    Stamp.countDocuments({
      startedAt: { $lte: new Date() },
      expiredAt: { $gte: new Date() },
      isPublished: true,
      status: true,
      softDeleted: false,
      _id: { $nin: stampIds },
      ...(categoryId && { categoryId: mongoose.Types.ObjectId.createFromHexString(categoryId) }),
      ...(search && { $or: [{ title: { $regex: search, $options: "i" } }, { branchId: { $in: branchIds } }] }),
    }),
  ]);

  // Create a lookup object to maintain the order of branchIds
  const branchIdOrder: any = {};
  branchSortByGio.forEach((branch: any, index: number) => {
    branchIdOrder[branch._id.toString()] = index;
  });

  // Sort the stamps based on the order of branchId in the branchIdOrder
  const sortedStamps = docs.sort((a, b) => {
    const aBranchId = a.branch._id.toString();
    const bBranchId = b.branch._id.toString();

    return branchIdOrder[aBranchId] - branchIdOrder[bBranchId];
  });

  const mobilePagination = makePaginateForMobile(Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Location by stamp fetched successfully!", sortedStamps, mobilePagination);
});

/**
 * Collect stamp by customer
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const collectStamp = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result: any = collectStampSchema.validate(req.body);
  if (result.error) return apiResponse(res, 400, false, formatErrorMsg(result));

  const { branchId, stampId } = result.value;

  const [alreadyCollected, branch, stamp] = await Promise.all([
    CollectStamp.findOne({
      branchId,
      stampId,
      customerId: req.user._id,
    }),
    Branch.findById(branchId),
    Stamp.findById(stampId),
  ]);

  if (alreadyCollected && alreadyCollected.softDeleted === false) {
    return apiResponse(res, 400, false, "This stamp already collected!");
  }

  if (alreadyCollected && alreadyCollected.softDeleted === true) {
    await CollectStamp.findByIdAndUpdate(alreadyCollected._id, { softDeleted: false });
    return apiResponse(res, 200, true, "Stamp added successfully!");
  }

  if (!branch || !stamp) return apiResponse(res, 400, false, "Branch or Stamp not found!");

  const [[freeTrialRetailers], subscription] = await Promise.all([
    Enrollment.aggregate([
      {
        $match: {
          retailerId: stamp.retailerId,
          planExists: "trial",
          validityTo: { $gt: new Date() },
          status: true,
        },
      },
      {
        $lookup: {
          from: "order_stamps",
          let: { retailerId: "$retailerId" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$retailerId", "$$retailerId"] },
              },
            },
            {
              $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                customerIds: { $addToSet: "$customerId" },
              },
            },
            {
              $project: {
                _id: 0,
                totalOrders: 1,
                uniqueCustomers: { $size: "$customerIds" },
              },
            },
          ],
          as: "orderStats",
        },
      },
      {
        $addFields: {
          totalOrders: { $ifNull: [{ $arrayElemAt: ["$orderStats.totalOrders", 0] }, 0] },
          uniqueCustomers: { $ifNull: [{ $arrayElemAt: ["$orderStats.uniqueCustomers", 0] }, 0] },
        },
      },
      {
        $project: {
          retailerId: 1,
          totalOrders: 1,
          uniqueCustomers: 1,
        },
      },
    ]),
    Subscription.findOne({ slug: "trial" }).select("allowTotalUser allowTotalScan"),
  ]);

  if (freeTrialRetailers && subscription && (subscription.allowTotalScan || subscription.allowTotalUser)) {
    const { allowTotalScan, allowTotalUser } = subscription;
    const { totalOrders, uniqueCustomers } = freeTrialRetailers;

    const scanLimitReached = allowTotalScan && totalOrders >= allowTotalScan;
    const userLimitReached = allowTotalUser && uniqueCustomers >= allowTotalUser;

    if (scanLimitReached || userLimitReached) {
      return apiResponse(
        res,
        400,
        false,
        "This stamp card has been disabled. Please contact this retailer for more information."
      );
    }
  }

  await CollectStamp.create({ branchId, stampId, customerId: req.user._id });

  return apiResponse(res, 200, true, "Stamp added successfully!");
});
