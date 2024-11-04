import { Response } from "express";
import { apiResponse, asyncHandler, makePaginateForMobile } from "../../../../helpers/index";
import CollectStamp from "../../../../models/collect-stamp";
import { IApiRequest } from "../../../../types/index";

/**
 * Get All Rewards
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllReward = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10 }: any = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);
  const [eligibleRewardList, results] = await Promise.all([
    CollectStamp.aggregate([
      {
        $match: {
          eligibleForReward: true,
          customerId: req?.user?._id,
        },
      },
      {
        $sort: {
          updatedAt: -1,
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
              $match: {
                startedAt: { $lte: new Date() },
                expiredAt: { $gte: new Date() },
              },
            },
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
                _id: 1,
                title: 1,
                description: 1,
                rules: 1,
                image: "$stampImage.image",
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
        $unwind: "$branch",
      },
      {
        $project: {
          stamp: 1,
          "branch._id": "$branch._id",
          "branch.name": "$branch.name",
          "branch.address": "$branch.address.name",
          "retailer._id": "$branch.retailer._id",
          "retailer.storeName": "$branch.retailer.storeName",
          "retailer.image": "$branch.retailer.image",
        },
      },
    ]),
    CollectStamp.aggregate([
      {
        $match: {
          eligibleForReward: true,
          customerId: req?.user?._id,
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
              $match: {
                startedAt: { $lte: new Date() },
                expiredAt: { $gte: new Date() },
              },
            },
          ],
        },
      },
      {
        $unwind: "$stamp",
      },
      {
        $count: "total",
      },
    ]),
  ]);

  const total = results[0]?.total || 0;

  const mobilePagination = makePaginateForMobile(Number(page), Number(limit), skip, total);
  return apiResponse(
    res,
    200,
    true,
    "Eligible reward list fetched successfully!",
    eligibleRewardList,
    mobilePagination
  );
});
