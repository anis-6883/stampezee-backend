import { Request, Response } from "express";
import mongoose from "mongoose";
import { uploadFileToS3Bucket } from "../../../../configs/s3Bucket";
import { apiResponse, asyncHandler, fileValidation, formatErrorMsg } from "../../../../helpers";
import { IApiRequest } from "../../../../types";
import CollectStamp from "../../customer/search/model";
import OrderStamp from "./model";
import { orderStampSchema } from "./validation";

/**
 * Get All Collected Stamps
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const orderStamp = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result: any = orderStampSchema.validate(req.body);
  if (result.error) return apiResponse(res, 400, false, formatErrorMsg(result));
  const { collectStampId, amount } = req?.body;

  const stampIsCollected = await CollectStamp.aggregate([
    {
      $match: {
        _id: mongoose.Types.ObjectId.createFromHexString(collectStampId),
        branchId: req?.user?.branchId,
      },
    },
    {
      $lookup: {
        from: "stamps",
        localField: "stampId",
        foreignField: "_id",
        as: "stamps",
        pipeline: [
          {
            $match: {
              startedAt: { $lte: new Date() },
              expiredAt: { $gte: new Date() },
            },
          },
          {
            $project: {
              _id: 1,
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
        from: "orderstamps",
        localField: "_id",
        foreignField: "collectStampId",
        as: "stampTaken",
        pipeline: [
          {
            $count: "totalStampTaken",
          },
        ],
      },
    },
    {
      $addFields: {
        totalStampTaken: {
          $ifNull: [{ $arrayElemAt: ["$stampTaken.totalStampTaken", 0] }, 0],
        },
      },
    },
  ]);

  if (stampIsCollected.length < 1) {
    throw "Invalid QR Code";
  }

  if (stampIsCollected[0].stamps.length < 1) {
    throw "Stamp Expired";
  }

  if (stampIsCollected[0].totalStampTaken > stampIsCollected[0].stamps[0].noOfStampsToCollect) {
    throw "You have already collected the reward.";
  }

  let imageKey = null;

  if (!req?.file) {
    return apiResponse(res, 400, false, "Invalid Request!", { image: "image file is required!" });
  }

  const { status, message } = fileValidation(req.file, undefined, ["image/jpeg", "image/png", "image/jpg"]);
  if (!status) {
    return apiResponse(res, 400, false, "Invalid Request!", { image: message });
  }
  // Upload File to S3 Bucket
  const { status: s3Status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "stamp_image");
  if (s3Status) {
    imageKey = key;
  }
  let orderBody = {
    collectStampId,
    subAdminId: req?.user?._id,
    amount,
    invoice: imageKey,
    stamp: {},
  };
  interface Object {
    [key: string]: string | number | Boolean;
  }
  const response: Object = { rewarded: false };

  if (stampIsCollected[0].totalStampTaken == stampIsCollected[0].stamps[0].noOfStampsToCollect) {
    const { noOfStampsToCollect, minPurchaseAmount, rewardType, promotionReward, discountReward } =
      stampIsCollected[0].stamps[0];
    orderBody.stamp = {
      noOfStampsToCollect,
      minPurchaseAmount,
      rewardType,
      promotionReward,
      discountReward,
    };
    response.rewarded = true;
    if (rewardType == "discount") {
      response.offer = discountReward + "%";
    } else {
      response.offer = promotionReward;
    }
  }

  await OrderStamp.create(orderBody);
  return apiResponse(res, 200, true, "Stamp collected successfully", response);
});
