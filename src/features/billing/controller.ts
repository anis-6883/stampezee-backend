import { Response } from "express";
import { apiResponse, asyncHandler, makePaginate } from "../../helpers";
import { IApiRequest } from "../../types";
import Payment from "../payment/model";

/**
 * Get Subscription Payments
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllBillings = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10 }: any = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  console.log({ hello: req.user });

  const [docs, total] = await Promise.all([
    Payment.aggregate([
      {
        $unwind: {
          path: "$enrollSubscriptionId",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "enrollsubscriptions",
          localField: "enrollSubscriptionId",
          foreignField: "_id",
          as: "enrollSubscriptions",
        },
      },
      {
        $addFields: {
          enrollSubscriptions: { $arrayElemAt: ["$enrollSubscriptions", 0] },
        },
      },
      {
        $group: {
          _id: "$_id",
          originalFields: { $first: "$$ROOT" },
          enrollSubscriptions: { $push: "$enrollSubscriptions" },
        },
      },
      {
        $replaceRoot: {
          newRoot: { $mergeObjects: ["$originalFields", { enrollSubscriptions: "$enrollSubscriptions" }] },
        },
      },
      {
        $match: {
          enrollSubscriptions: { $elemMatch: { retailerId: req.user._id } },
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
    ]),
    Payment.find().countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Subscription payments fetched successfully!", data);
});
