import { Response } from "express";
import { apiResponse, asyncHandler, makePaginate } from "../../helpers";
import { IApiRequest } from "../../types";
import Payment from "./model";

/**
 * Get Subscription Payments
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getSubscriptionPayments = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, status, search }: any = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);
  const query: any = { paymentStatus: "succeeded" };

  if (search) {
    const regex = new RegExp(`.*${search.trim()}.*`, "i"); //case insensitive search. For sensitive remove i
    query.paymentIntentId = regex;
  }

  if (status && ["pending", "completed"].includes(status)) {
    query.paymentStatus = status;
  }

  const [docs, total] = await Promise.all([
    Payment.aggregate([
      {
        $match: query,
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
          from: "enrollsubscriptions",
          localField: "enrollSubscriptionId",
          foreignField: "_id",
          as: "enrollSubscription",
          pipeline: [
            {
              $lookup: {
                from: "retailers",
                localField: "retailerId",
                foreignField: "_id",
                as: "retailer",
                pipeline: [
                  {
                    $project: {
                      _id: 1,
                      storeName: 1,
                      email: 1,
                      fullName: 1,
                      image: 1,
                    },
                  },
                ],
              },
            },
            {
              $unwind: {
                path: "$retailer",
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$enrollSubscription",
        },
      },
    ]),
    Payment.countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Subscription payments fetched successfully!", data);
});
