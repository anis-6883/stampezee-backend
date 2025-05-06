import { Response } from "express";
import { apiResponse, asyncHandler, makePaginate } from "../../helpers";
import Refund from "../../models/refund";
import { IApiRequest } from "../../types";

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
          from: "enrollments",
          localField: "enrollmentId",
          foreignField: "_id",
          as: "enrollment",
        },
      },
      {
        $unwind: {
          path: "$enrollment",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          "enrollment.retailerId": req.user._id,
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
          from: "enrollments",
          localField: "enrollmentId",
          foreignField: "_id",
          as: "enrollment",
        },
      },
      {
        $unwind: {
          path: "$enrollment",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          "enrollment.retailerId": req.user._id,
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
          from: "enrollments",
          localField: "enrollmentId",
          foreignField: "_id",
          as: "enrollment",
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
                      storeName: 1,
                      firstName: 1,
                      lastName: 1,
                      fullName: 1,
                      email: 1,
                      image: 1,
                      phone: 1,
                      dialCode: 1,
                      country: 1,
                    },
                  },
                ],
              },
            },
            {
              $unwind: "$retailer",
            },
            {
              $lookup: {
                from: "enroll_subscriptions",
                localField: "_id",
                foreignField: "enrollmentId",
                as: "enrollSubscriptions",
                pipeline: [
                  {
                    $match: {
                      "planSnapshot.type": "subscription",
                    },
                  },
                ],
              },
            },
            {
              $lookup: {
                from: "payments",
                localField: "_id",
                foreignField: "enrollmentId",
                as: "payments",
                pipeline: [
                  {
                    $project: {
                      paymentMethodDetails: 0,
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$enrollment",
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
    Refund.countDocuments(),
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

  if (!refundUpdate) return apiResponse(res, 400, false, "Refund not found!");

  return apiResponse(res, 200, true, "Refund completed successfully!");
});
