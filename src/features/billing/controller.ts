import { Response } from "express";
import { apiResponse, asyncHandler, makePaginate } from "../../helpers";
import { IApiRequest } from "../../types";
import EnrollSubscription from "../enroll-subscription/model";
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

  const [docs, total] = await Promise.all([
    EnrollSubscription.aggregate([
      {
        $match: { retailerId: req.user._id },
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
          from: "payments",
          localField: "_id",
          foreignField: "enrollSubscriptionId",
          as: "payment",
          pipeline: [
            {
              $project: {
                retailerId: 0,
                enrollSubscriptionId: 0,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$payment",
        },
      },
    ]),
    Payment.find({ retailerId: req.user._id }).countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Subscription payments fetched successfully!", data);
});
