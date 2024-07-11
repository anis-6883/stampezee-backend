import { Response } from "express";
import { apiResponse, asyncHandler } from "../../../../helpers";
import { IApiRequest } from "../../../../types";
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
