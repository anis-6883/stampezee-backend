import { Response } from "express";
import { apiResponse, asyncHandler, makePaginate } from "../../helpers";
import { IApiRequest } from "../../types";
import EnrollSubscription from "../enroll-subscription/model";

/**
 * Get Subscription Payments
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllBillings = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10 }: any = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);
  const query = { paymentStatus: "completed", retailerId: req.user._id };

  const [docs, total] = await Promise.all([
    EnrollSubscription.aggregate([
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
        $match: query,
      },
      // {
      //   $lookup: {
      //     from: "retailers",
      //     localField: "retailerId",
      //     foreignField: "_id",
      //     as: "retailer",
      //   },
      // },
      // {
      //   $unwind: "$retailer",
      // },
      // {
      //   $project: {
      //     paymentStatus: 1,
      //     enrollStatus: 1,
      //     validityFrom: 1,
      //     validityTo: 1,
      //     createdAt: 1,
      //   },
      // },
    ]),
    EnrollSubscription.find(query).countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Billing fetched successfully!", data);
});
