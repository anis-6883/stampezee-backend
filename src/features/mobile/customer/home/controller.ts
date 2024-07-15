import { Response } from "express";
import mongoose from "mongoose";
import { apiResponse, asyncHandler } from "../../../../helpers";
import { IApiRequest, IOwn, IStamp } from "../../../../types";
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
      $project: {
        _id: 1,
        createdAt: 1,
        stamp: 1,
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
      $unwind: "$branch",
    },
    {
      $project: {
        _id: 1,
        createdAt: 1,
        stamp: 1,
        stampsTaken: 1,
        "branch._id": "$branch._id",
        "branch.name": "$branch.name",
        "branch.address": "$branch.address.name",
        "retailer._id": "$branch.retailer._id",
        "retailer.storeName": "$branch.retailer.storeName",
        "retailer.image": "$branch.retailer.image",
      },
    },
  ]);

  if (collectedStamp.length < 1) throw "Please collect the stamp first";

  let own: IOwn = {
    rewardTaken: false,
    totalStampCollected: 0, // You can initialize it with 0 or add a `?` to make it optional
    stampCollectionDate: [], // You can initialize it with an empty array or add a `?` to make it optional
  };

  own.totalStampCollected = collectedStamp[0].stampsTaken.length;
  collectedStamp[0].stampsTaken.forEach((data: IStamp) => {
    if (data.rewardCollected) {
      own.rewardTaken = true;
    }
    own.stampCollectionDate.push({ createdAt: data.createdAt });
  });

  delete collectedStamp[0].stampsTaken;
  collectedStamp[0].own = own;
  return apiResponse(res, 200, true, "Collected stamps fetched successfully!", collectedStamp);
});
