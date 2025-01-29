import { Request, Response } from "express";
import mongoose from "mongoose";
import zlib from "zlib";
import { uploadFileToS3Bucket } from "../../../../configs/s3Bucket";
import { apiResponse, asyncHandler, fileValidation, formatErrorMsg, makePaginateForMobile } from "../../../../helpers";
import Branch from "../../../../models/branch";
import CollectStamp from "../../../../models/collect-stamp";
import CurrencyExchange from "../../../../models/currency-exchange";
import OrderStamp from "../../../../models/order-stamp";
import Retailer from "../../../../models/retailer";
import { IApiRequest, INumberObject, Object } from "../../../../types";
import { stampCollected } from "../../socket/socket";
import { orderStampSchema, updateStampSchema } from "./validation";

/**
 * Order Stamp After Sub-admin Scan the QR
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const orderStamp = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result: any = orderStampSchema.validate(req.body);
  if (result.error) return apiResponse(res, 400, false, formatErrorMsg(result));

  const { collectStampId, number } = req?.body;
  const alreadyScanned = await OrderStamp.findOne({ collectStampId, number });

  if (alreadyScanned) {
    if (alreadyScanned.invoice == null) {
      await OrderStamp.deleteOne({ _id: alreadyScanned._id });
    } else {
      return apiResponse(res, 400, false, "This stamp has already been used!");
    }
  }

  const [stampIsCollected, retailer] = await Promise.all([
    CollectStamp.aggregate([
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
          from: "order_stamps",
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
          from: "order_stamps",
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
    ]),
    Retailer.findById(req?.user?.retailerId, { businessCurrency: 1 }),
  ]);

  const currencyExchange = await CurrencyExchange.findOne({ name: retailer?.businessCurrency });

  if (stampIsCollected.length < 1) return apiResponse(res, 400, false, "Invalid QR Code!");

  if (stampIsCollected[0].stamps.length < 1) return apiResponse(res, 400, false, "Stamp Expired!");

  if (stampIsCollected[0].rewardTaken) return apiResponse(res, 400, false, "You have already collected the reward!");

  let orderBody: Object = {
    collectStampId,
    number,
    retailerId: req?.user?.retailerId,
    branchId: req?.user?.branchId,
    customerId: stampIsCollected[0].customerId,
    subAdminId: req?.user?._id,
    stamp: "",
    amountCurrency: retailer?.businessCurrency,
    exchangeRate: currencyExchange?.exchangeRate,
  };

  const response: Object = {
    message: "Woahh! You're One Step Closer to Your Reward! 🥳",
    eligibleForReward: false,
    isRewarded: false,
    totalStampCollected: stampIsCollected[0].totalStampTaken + 1,
    offer: null,
  };

  const stampData = stampIsCollected[0].stamps[0];

  if (stampIsCollected[0].totalStampTaken + 1 == stampData.noOfStampsToCollect) {
    response.eligibleForReward = true;
    await CollectStamp.updateOne({ _id: collectStampId }, { eligibleForReward: true });
  }

  if (stampIsCollected[0].totalStampTaken >= stampData.noOfStampsToCollect) {
    const { rewardType, promotionReward, discountReward } = stampData;
    const dataString = JSON.stringify(stampData);

    orderBody.stamp = zlib.deflateSync(dataString).toString("base64");
    orderBody.rewardCollected = true;

    await CollectStamp.updateOne({ _id: collectStampId }, { eligibleForReward: false, rewardCollected: true });

    response.totalStampCollected = stampIsCollected[0].totalStampTaken;
    response.isRewarded = true;
    response.offer = rewardType === "discount" ? `${discountReward}%` : promotionReward;
    response.message = "Congratulations! You've unlocked a reward!";
  }

  const newOrder = await OrderStamp.create(orderBody);
  const data = { collectStampId, response };

  stampCollected(data);

  return apiResponse(res, 200, true, "Stamp collected successfully!", {
    ...response,
    collectStampId: newOrder._id,
  });
});

/**
 * Update Invoice
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const uploadInvoice = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result: any = updateStampSchema.validate(req.params);
  if (result.error) return apiResponse(res, 400, false, formatErrorMsg(result));

  const { amount } = req?.body;
  const orderStampId = req?.params?.orderStampId;

  const [orderIsAvailable, retailer] = await Promise.all([
    OrderStamp.aggregate([
      {
        $match: {
          _id: mongoose.Types.ObjectId.createFromHexString(orderStampId),
        },
      },
      {
        $lookup: {
          from: "sub_admins",
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
    ]),
    Retailer.findById(req?.user?.retailerId, { businessCurrency: 1 }),
  ]);

  if (orderIsAvailable.length < 1) return apiResponse(res, 400, false, "Invalid Order!");
  if (orderIsAvailable[0].subAdmin.length < 1) return apiResponse(res, 401, false, "Unauthorized Request!");

  const updatedBody: any = { amount };
  updatedBody.amountCurrency = retailer?.businessCurrency;

  if (req?.file) {
    const { status, message } = fileValidation(req.file, undefined, ["image/jpeg", "image/png", "image/jpg"]);
    if (!status) {
      return apiResponse(res, 400, false, "Invalid Request!", { image: message });
    }
  }

  if (req?.file) {
    const { status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "invoice_image");
    if (status) {
      updatedBody.invoice = key;
    }
  }

  const updateOrder: any = await OrderStamp.findByIdAndUpdate({ _id: orderStampId }, updatedBody, { new: true });

  return apiResponse(res, 200, true, "Stamp invoice updated successfully!", {
    invoice: updateOrder.invoice,
    amount: updateOrder.amount,
  });
});

/**
 * Scan History
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const scanHistory = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10 }: any = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Set to the beginning of the week
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const startOfYear = new Date();
  startOfYear.setMonth(0);
  startOfYear.setDate(1);
  startOfYear.setHours(0, 0, 0, 0);

  const [storeDetails, thisWeek, thisMonth, thisYear, total] = await Promise.all([
    Branch.aggregate([
      {
        $match: {
          _id: req?.user?.branchId,
        },
      },
      {
        $lookup: {
          from: "retailers",
          localField: "retailerId",
          foreignField: "_id",
          as: "retailer",
          pipeline: [
            {
              $project: {
                image: 1,
                storeName: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: "$retailer",
      },
      {
        $project: {
          name: 1,
          address: 1,
          retailer: 1,
        },
      },
    ]),
    OrderStamp.countDocuments({
      subAdminId: req.user._id,
      createdAt: { $gte: startOfWeek },
    }),
    OrderStamp.countDocuments({
      subAdminId: req.user._id,
      createdAt: { $gte: startOfMonth },
    }),
    OrderStamp.countDocuments({
      subAdminId: req.user._id,
      createdAt: { $gte: startOfYear },
    }),
    OrderStamp.find({ subAdminId: req.user._id }).countDocuments(),
  ]);

  const recentStamps: INumberObject = {
    thisWeek,
    thisMonth,
    thisYear,
    total,
  };

  return apiResponse(res, 200, true, "Stamp scan history fetched successfully!", {
    storeDetails: storeDetails[0],
    recentStamps,
  });
});

/**
 * Recent Scans
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const recentScans = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10 }: any = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const [docs, total] = await Promise.all([
    OrderStamp.aggregate([
      {
        $match: {
          subAdminId: req.user._id,
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
          from: "collect_stamps",
          localField: "collectStampId",
          foreignField: "_id",
          as: "collectedstamps",
          pipeline: [
            {
              $lookup: {
                from: "stamps",
                localField: "stampId",
                foreignField: "_id",
                as: "stampDetails",
                pipeline: [
                  {
                    $project: {
                      title: 1,
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
              $unwind: "$stampDetails",
            },
          ],
        },
      },
      {
        $unwind: "$collectedstamps",
      },
      {
        $addFields: {
          hasInvoice: { $cond: { if: { $eq: ["$invoice", null] }, then: false, else: true } },
        },
      },
      {
        $project: {
          stamp: "$collectedstamps.stampDetails",
          hasInvoice: 1,
          invoice: 1,
          amount: 1,
          createdAt: 1,
        },
      },
    ]),
    OrderStamp.find({ subAdminId: req.user._id }).countDocuments(),
  ]);

  const mobilePagination = makePaginateForMobile(Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Recent scans have fetched successfully!", docs, mobilePagination);
});

/**
 * Order Details
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const orderDetails = asyncHandler(async (req: IApiRequest, res: Response) => {
  const orderDetails = await OrderStamp.aggregate([
    {
      $match: {
        _id: mongoose.Types.ObjectId.createFromHexString(req?.params?.id),
        subAdminId: req.user._id,
      },
    },
    {
      $lookup: {
        from: "collect_stamps",
        localField: "collectStampId",
        foreignField: "_id",
        as: "collectedstamps",
        pipeline: [
          {
            $lookup: {
              from: "stamps",
              localField: "stampId",
              foreignField: "_id",
              as: "stampDetails",
              pipeline: [
                {
                  $project: {
                    title: 1,
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
            $unwind: "$stampDetails",
          },
        ],
      },
    },
    {
      $lookup: {
        from: "customers",
        localField: "customerId",
        foreignField: "_id",
        as: "customer",
        pipeline: [
          {
            $project: { fullName: 1, email: 1 },
          },
        ],
      },
    },
    {
      $unwind: "$customer",
    },
    {
      $unwind: "$collectedstamps",
    },
    {
      $addFields: {
        hasInvoice: { $cond: { if: { $eq: ["$invoice", null] }, then: false, else: true } },
      },
    },
    {
      $project: {
        stamp: "$collectedstamps.stampDetails",
        customer: 1,
        hasInvoice: 1,
        invoice: 1,
        amount: 1,
        rewardCollected: 1,
        createdAt: 1,
      },
    },
  ]);

  /**
   * Following error throw when
   * orderId is invalid
   * this order doesn't belong to this sub-admin
   * customer account is hard deleted from db
   * stamp is hard deleted
   */
  if (orderDetails.length < 1) return apiResponse(res, 400, false, "Invalid order!");

  return apiResponse(res, 200, true, "Order details have fetched successfully!", orderDetails[0]);
});
