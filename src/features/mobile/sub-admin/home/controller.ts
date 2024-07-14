import { Request, Response } from "express";
import mongoose from "mongoose";
import { uploadFileToS3Bucket } from "../../../../configs/s3Bucket";
import { apiResponse, asyncHandler, fileValidation, formatErrorMsg } from "../../../../helpers";
import { IApiRequest } from "../../../../types";
import CollectStamp from "../../customer/search/model";
import { stampCollected } from "../../socket/socket";
import OrderStamp from "./model";
import { orderStampSchema, updateStampSchema } from "./validation";

/**
 * Get All Collected Stamps
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const orderStamp = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result: any = orderStampSchema.validate(req.body);
  if (result.error) return apiResponse(res, 400, false, formatErrorMsg(result));
  const { collectStampId } = req?.body;

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
        as: "rewardCollected",
        pipeline: [
          {
            $match: {
              rewardCollected: true,
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
        rewardTaken: {
          $ifNull: [{ $arrayElemAt: ["$rewardCollected", 0] }, false],
        },
      },
    },
    {
      $project: {
        rewardCollected: 0,
        stampTaken: 0,
      },
    },
  ]);

  if (stampIsCollected.length < 1) throw "Invalid QR Code";

  if (stampIsCollected[0].stamps.length < 1) throw "Stamp Expired";

  if (stampIsCollected[0].stamps.length < 1) throw "Stamp Expired";

  if (stampIsCollected[0].rewardTaken) throw "You have already collected the reward.";

  interface Object {
    [key: string]: any;
  }

  let orderBody: Object = {
    collectStampId,
    subAdminId: req?.user?._id,
    stamp: {},
  };
  const response: Object = { rewarded: false, totalStampCollected: stampIsCollected[0].totalStampTaken + 1 };
  const stampData = stampIsCollected[0].stamps[0];
  if (stampIsCollected[0].totalStampTaken >= stampData.noOfStampsToCollect) {
    const { noOfStampsToCollect, minPurchaseAmount, rewardType, promotionReward, discountReward } = stampData;
    orderBody.stamp = {
      noOfStampsToCollect,
      minPurchaseAmount,
      rewardType,
      promotionReward,
      discountReward,
    };
    orderBody.rewardCollected = true;
    response.rewarded = true;
    if (rewardType == "discount") {
      response.offer = discountReward + "%";
    } else {
      response.offer = promotionReward;
    }
  }

  const newOrder: any = await OrderStamp.create(orderBody);
  const data: Object = { collectStampId, response };
  stampCollected(data);
  return apiResponse(res, 200, true, "Stamp collected successfully", {
    ...response,
    collectStampId: newOrder._id,
  });
});

export const uploadInvoice = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result: any = updateStampSchema.validate(req.params);
  if (result.error) return apiResponse(res, 400, false, formatErrorMsg(result));
  const { amount } = req?.body;
  const orderStampId = req.params.orderStampId;

  const orderIsAvailable = await OrderStamp.aggregate([
    {
      $match: {
        _id: mongoose.Types.ObjectId.createFromHexString(orderStampId),
      },
    },
    {
      $lookup: {
        from: "subadmins",
        localField: "subAdminId",
        foreignField: "_id",
        as: "subAdmin",
        pipeline: [
          {
            $match: {
              branchId: req?.user?.branchId,
            },
          },
        ],
      },
    },
  ]);
  if (orderIsAvailable.length < 1) throw "Invalid Order";
  if (orderIsAvailable[0].subAdmin.length < 1) return apiResponse(res, 401, false, "Unauthorized Request!");

  if (!req?.file) {
    return apiResponse(res, 400, false, "Invalid Request!", { image: "image file is required!" });
  }

  const { status, message } = fileValidation(req.file, undefined, ["image/jpeg", "image/png", "image/jpg"]);
  if (!status) {
    return apiResponse(res, 400, false, "Invalid Request!", { image: message });
  }

  uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "stamp_image")
    .then(async ({ status: s3Status, key }) => {
      if (!s3Status) throw new Error("File upload failed");
      await OrderStamp.findByIdAndUpdate({ _id: orderStampId }, { invoice: key, amount });
    })
    .catch((err) => {
      console.error("Something went wrong while uploading invoice image:", err);
    });

  return apiResponse(res, 200, true, "Stamp invoice updated successfully");
});
