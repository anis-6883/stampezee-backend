import { Response } from "express";
import mongoose from "mongoose";
import { apiResponse, asyncHandler, makePaginateForMobile } from "../../../../helpers";
import CollectStamp from "../../../../models/collect-stamp";
import Subscription from "../../../../models/subscription";
import { IApiRequest, IStamp } from "../../../../types";

/**
 * Get All Collected Stamps
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getCollectedStamps = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10 }: any = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const [collectedStamps, total] = await Promise.all([
    CollectStamp.aggregate([
      {
        $match: { customerId: req.user._id, softDeleted: false },
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
          from: "stamps",
          localField: "stampId",
          foreignField: "_id",
          as: "stamp",
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
              $unwind: "$retailer",
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
                softDeleted: 1,
                expiredAt: 1,
                isExpired: {
                  $or: [
                    { $lt: ["$expiredAt", "$$NOW"] },
                    { $eq: ["$softDeleted", true] },
                    { $eq: ["$status", false] },
                    { $eq: ["$retailer.softDeleted", true] },
                    { $eq: ["$retailer.status", false] },
                  ],
                },
                isExpiredMessage: {
                  $cond: {
                    if: { $eq: ["$softDeleted", true] },
                    then: "This stamp has been removed by the retailer!",
                    else: {
                      $cond: {
                        if: { $lt: ["$expiredAt", "$$NOW"] },
                        then: "This stamp card has expired!",
                        else: {
                          $cond: {
                            if: {
                              $or: [
                                { $eq: ["$status", false] },
                                { $eq: ["$retailer.softDeleted", true] },
                                { $eq: ["$retailer.status", false] },
                              ],
                            },
                            then: "This Stamp Card has been disabled. Please contact the Retailer for more information!",
                            else: null,
                          },
                        },
                      },
                    },
                  },
                },
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
              $lookup: {
                from: "retailers",
                localField: "retailerId",
                foreignField: "_id",
                as: "retailer",
                pipeline: [
                  {
                    $lookup: {
                      from: "enrollments",
                      localField: "_id",
                      foreignField: "retailerId",
                      as: "enrollments",
                      pipeline: [
                        {
                          $match: {
                            planExists: { $ne: null },
                            paymentStatus: { $in: ["trial", "completed"] },
                            validityTo: { $gt: new Date() },
                            status: true,
                          },
                        },
                      ],
                    },
                  },
                  {
                    $lookup: {
                      from: "order_stamps",
                      let: { retailerId: "$_id" },
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
                ],
              },
            },
            {
              $unwind: "$retailer",
            },
          ],
        },
      },
      {
        $unwind: "$branch",
      },
      {
        $lookup: {
          from: "order_stamps",
          localField: "_id",
          foreignField: "collectStampId",
          as: "stampsTaken",
          pipeline: [
            {
              $match: {
                rewardCollected: false,
              },
            },
            {
              $count: "totalStampsTaken",
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$stampsTaken",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          createdAt: 1,
          stamp: {
            $mergeObjects: [
              "$stamp",
              {
                totalStampsCollected: {
                  $ifNull: ["$stampsTaken.totalStampsTaken", 0],
                },
              },
              {
                isRewarded: "$rewardCollected",
              },
              {
                condition: {
                  $cond: {
                    if: { $eq: ["$stamp.minPurchaseAmount", 0] },
                    then: "",
                    else: {
                      $concat: [
                        "Minimum purchase amount: ",
                        { $toString: "$stamp.minPurchaseAmount" },
                        " ",
                        "$branch.retailer.businessCurrency",
                      ],
                    },
                  },
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
          "retailer.isPlanExpired": {
            $cond: {
              if: { $gt: [{ $size: "$branch.retailer.enrollments" }, 0] },
              then: false,
              else: true,
            },
          },
          "retailer.isPlanExpiredMessage": {
            $cond: {
              if: { $gt: [{ $size: "$branch.retailer.enrollments" }, 0] },
              then: null,
              else: "This stamp card has been disabled. Please contact this retailer for more information.",
            },
          },
          "retailer.totalOrders": "$branch.retailer.totalOrders",
          "retailer.uniqueCustomers": "$branch.retailer.uniqueCustomers",
          "retailer.planExists": {
            $cond: {
              if: { $gt: [{ $size: "$branch.retailer.enrollments" }, 0] },
              then: {
                $let: {
                  vars: {
                    firstEnrollment: { $arrayElemAt: ["$branch.retailer.enrollments", 0] },
                  },
                  in: "$$firstEnrollment.planExists",
                },
              },
              else: null,
            },
          },
        },
      },
    ]),
    CollectStamp.countDocuments({
      customerId: req.user._id,
      softDeleted: false,
    }),
  ]);

  const subscription = await Subscription.findOne({ slug: "trial" }).select("allowTotalUser allowTotalScan");

  if (collectedStamps.length > 0) {
    collectedStamps.forEach((collectedStamp: any) => {
      if (collectedStamp?.retailer.planExists === "trial") {
        if (subscription?.allowTotalScan || subscription?.allowTotalUser) {
          const { allowTotalScan, allowTotalUser } = subscription;
          const { totalOrders, uniqueCustomers } = collectedStamp?.retailer;

          const scanLimitReached = allowTotalScan && totalOrders >= allowTotalScan;
          const userLimitReached = allowTotalUser && uniqueCustomers >= allowTotalUser;
          if (scanLimitReached || userLimitReached) {
            collectedStamp.retailer.isPlanExpired = true;
            collectedStamp.retailer.isPlanExpiredMessage =
              "This stamp card has been disabled. Please contact this retailer for more information.";
          }
        }
      }
    });
  }

  const mobilePagination = makePaginateForMobile(Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Collected stamps fetched successfully!", collectedStamps, mobilePagination);
});

/**
 * Get Single Collected Stamps
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const collectedStampById = asyncHandler(async (req: IApiRequest, res: Response) => {
  const collectedStamp = await CollectStamp.aggregate([
    {
      $match: {
        customerId: req.user._id,
        _id: mongoose.Types.ObjectId.createFromHexString(req?.params?.id),
      },
    },
    {
      $lookup: {
        from: "stamps",
        localField: "stampId",
        foreignField: "_id",
        as: "stamp",
        pipeline: [
          {
            $lookup: {
              from: "stamp_images",
              localField: "stampImageId",
              foreignField: "_id",
              as: "stampImage",
            },
          },
          {
            $unwind: "$stampImage",
          },
          {
            $project: {
              title: 1,
              description: 1,
              expiredAt: 1,
              rules: 1,
              noOfStampsToCollect: 1,
              minPurchaseAmount: 1,
              rewardType: 1,
              promotionReward: 1,
              discountReward: 1,
              stampImage: "$stampImage.image",
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "order_stamps",
        localField: "_id",
        foreignField: "collectStampId",
        as: "stampsTaken",
        pipeline: [
          {
            $match: {
              rewardCollected: false,
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
            $lookup: {
              from: "retailers",
              localField: "retailerId",
              foreignField: "_id",
              as: "retailer",
            },
          },
          {
            $unwind: "$retailer",
          },
        ],
      },
    },
    {
      $unwind: "$stamp",
    },
    {
      $unwind: "$branch",
    },
    {
      $project: {
        _id: 1,
        createdAt: 1,
        stampsTaken: 1,
        stamp: {
          $mergeObjects: [
            "$stamp",
            {
              isRewarded: "$rewardCollected",
            },
            {
              condition: {
                $cond: {
                  if: { $eq: ["$stamp.minPurchaseAmount", 0] },
                  then: "",
                  else: {
                    $concat: [
                      "Minimum purchase amount: ",
                      { $toString: "$stamp.minPurchaseAmount" },
                      " ",
                      "$branch.retailer.businessCurrency",
                    ],
                  },
                },
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
        "retailer.website": "$branch.retailer.website",
        "retailer.about": "$branch.retailer.about",
        noOfStampsToCollect: "$stamp.noOfStampsToCollect",
      },
    },
  ]);

  if (collectedStamp.length < 1) return apiResponse(res, 400, false, "Please collect the stamp first");

  const stampCollectionDate: { createdAt: Date }[] = [];
  collectedStamp[0].totalStampCollected = collectedStamp[0].stampsTaken.length;
  collectedStamp[0].stampsTaken.forEach((data: IStamp) => {
    if (data.rewardCollected) {
      collectedStamp[0].rewardTaken = true;
    }
    stampCollectionDate.push({ createdAt: data.createdAt });
  });
  collectedStamp[0].stampCollectionDate = stampCollectionDate;
  delete collectedStamp[0].stampsTaken;
  return apiResponse(res, 200, true, "Collected stamps fetched successfully!", collectedStamp[0]);
});

/**
 * Delete Collected Stamp
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const deleteCollectedStamp = asyncHandler(async (req: IApiRequest, res: Response) => {
  if (!mongoose.Types.ObjectId.isValid(req?.params?.id))
    return apiResponse(res, 400, false, "Please, provide valid id!");

  await CollectStamp.findByIdAndUpdate(req?.params?.id, {
    softDeleted: true,
  });

  return apiResponse(res, 200, true, "Delete collected stamp successfully!");
});
