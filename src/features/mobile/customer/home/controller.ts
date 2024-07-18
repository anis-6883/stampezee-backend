import { Response } from "express";
import mongoose from "mongoose";
import { apiResponse, asyncHandler } from "../../../../helpers";
import { IApiRequest, IStamp } from "../../../../types";
import CollectStamp from "../search/model";

/**
 * Get All Collected Stamps
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getCollectedStamps = asyncHandler(async (req: IApiRequest, res: Response) => {
  const collectedStamps = await CollectStamp.aggregate([
    {
      $match: { customerId: req.user._id },
    },
    {
      $lookup: {
        from: "stamps",
        localField: "stampId",
        foreignField: "_id",
        as: "stamp",
        pipeline: [
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
            },
          },
        ],
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
      $lookup: {
        from: "orderstamps",
        localField: "_id",
        foreignField: "collectStampId",
        as: "stampsTaken",
        pipeline: [
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
          ],
        },
        "branch._id": "$branch._id",
        "branch.name": "$branch.name",
        "branch.address": "$branch.address.name",
        "retailer._id": "$branch.retailer._id",
        "retailer.storeName": "$branch.retailer.storeName",
        "retailer.image": "$branch.retailer.image",
      },
    },
  ]);

  return apiResponse(res, 200, true, "Collected stamps fetched successfully!", collectedStamps);
});

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
              from: "stampimages",
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
        from: "orderstamps",
        localField: "_id",
        foreignField: "collectStampId",
        as: "stampsTaken",
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
          ],
        },
        "branch._id": "$branch._id",
        "branch.name": "$branch.name",
        "branch.address": "$branch.address.name",
        "retailer._id": "$branch.retailer._id",
        "retailer.storeName": "$branch.retailer.storeName",
        "retailer.image": "$branch.retailer.image",
        noOfStampsToCollect: "$stamp.noOfStampsToCollect",
      },
    },
  ]);

  if (collectedStamp.length < 1) throw "Please collect the stamp first";

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
