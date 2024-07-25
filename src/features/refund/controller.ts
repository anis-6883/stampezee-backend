import { Response } from "express";
import { apiResponse, asyncHandler, makePaginate } from "../../helpers";
import { IApiRequest } from "../../types";
import Refund from "./model";

/**
 * Get Retailer Refunds
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getRetailerRefunds = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10 }: any = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const [docs, total] = await Promise.all([
    Refund.aggregate([
      {
        $lookup: {
          from: "enrollsubscriptions",
          localField: "enrollSubscriptionId",
          foreignField: "_id",
          as: "enrollsubscription",
        },
      },
      {
        $unwind: {
          path: "$enrollsubscription",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          "enrollsubscription.retailerId": req.user._id,
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
    Refund.aggregate([
      {
        $lookup: {
          from: "enrollsubscriptions",
          localField: "enrollSubscriptionId",
          foreignField: "_id",
          as: "enrollsubscription",
        },
      },
      {
        $unwind: {
          path: "$enrollsubscription",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          "enrollsubscription.retailerId": req.user._id,
        },
      },
    ]),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total.length);

  return apiResponse(res, 200, true, "Retailer refund fetched successfully!", data);
});

/**
 * Get All Refunds for Super Admin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllRefundsForSuperAdmin = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10 }: any = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const [docs, total] = await Promise.all([
    Refund.aggregate([
      {
        $lookup: {
          from: "enrollsubscriptions",
          localField: "enrollSubscriptionId",
          foreignField: "_id",
          as: "enrollsubscription",
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
                      otp: 0,
                      otpExpiry: 0,
                      password: 0,
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
                retailerId: 0,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$enrollsubscription",
          preserveNullAndEmptyArrays: true,
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
    Refund.find({}).countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Super Admin refund fetched successfully!", data);
});

/**
 * Refund Confirm By Super Admin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const refundConfirmBySuperAdmin = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const refundUpdate = await Refund.findByIdAndUpdate(
    id,
    {
      refundStatus: "completed",
      refundedBy: req.user._id,
      refundedAt: new Date(),
    },
    { new: true }
  );

  if (!refundUpdate) throw "Refund not found!";

  return apiResponse(res, 200, true, "Refund completed successfully!");
});
