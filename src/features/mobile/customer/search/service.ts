import CollectStamp from "../../../../models/collect-stamp";
import { IStamp } from "../../../../types/index";
import { ObjectId } from "mongoose";

export const stampDetails = async (userId: any, collectedStampId: any) => {
  const collectedStamp = await CollectStamp.aggregate([
    {
      $match: {
        customerId: userId,
        _id: collectedStampId,
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

  if (collectedStamp.length < 1) throw new Error("Please collect the stamp first");

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
  return collectedStamp[0];
};
