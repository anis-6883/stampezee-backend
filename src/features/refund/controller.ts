import { Response } from "express";
import { Types } from "mongoose";
import Stripe from "stripe";
import { apiResponse, asyncHandler, makePaginate } from "../../helpers";
import Refund from "../../models/refund";
import Settings from "../../models/settings";
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
              $unwind: {
                path: "$retailer",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                retailer: 1,
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
 * Get Refund Details for Super Admin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const refundDetailsForSuperAdmin = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) return apiResponse(res, 400, false, "Please, provide valid id!");

  const data = await Refund.aggregate([
    {
      $match: { _id: Types.ObjectId.createFromHexString(id) },
    },
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
            $unwind: {
              path: "$retailer",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $lookup: {
              from: "enroll_subscriptions",
              localField: "_id",
              foreignField: "enrollmentId",
              as: "enrollSubscriptions",
              pipeline: [
                {
                  $project: {
                    "planSnapshot.price": 1,
                    "planSnapshot.type": 1,
                    "planSnapshot.slug": 1,
                    "planSnapshot.title": 1,
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
      $lookup: {
        from: "enrollments",
        localField: "prevEnrollmentId",
        foreignField: "_id",
        as: "prevEnrollment",
        pipeline: [
          {
            $lookup: {
              from: "enroll_subscriptions",
              localField: "_id",
              foreignField: "enrollmentId",
              as: "enrollSubscription",
              pipeline: [
                {
                  $match: {
                    "planSnapshot.type": "subscription",
                  },
                },
                {
                  $project: {
                    "planSnapshot.price": 1,
                    "planSnapshot.title": 1,
                  },
                },
              ],
            },
          },
          {
            $unwind: {
              path: "$enrollSubscription",
              preserveNullAndEmptyArrays: true,
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
        path: "$prevEnrollment",
        preserveNullAndEmptyArrays: true,
      },
    },
  ]);

  if (!data.length) return apiResponse(res, 400, false, "Refund not found!");

  return apiResponse(res, 200, true, "Super Admin refund fetched successfully!", data[0]);
});

/**
 * Refund Confirm By Super Admin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const refundConfirmBySuperAdmin = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  // const refund = await Refund.findById(id);

  const paymentMetadata = await Settings.findOne({}, { "stripe.stripeSecretKey": 1 });
  if (!paymentMetadata) throw "Something went wrong in Stripe settings!";

  const { stripeSecretKey } = paymentMetadata.stripe ?? {};
  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-04-10", typescript: true });

  // const paymentIntent = await stripe.paymentIntents.retrieve("pi_3RRY864Ko2vWsPPw1NPmPRGM");

  // const refund = await stripe.refunds.create({
  //   payment_intent: paymentIntent.id,
  //   reason: "requested_by_customer",
  //   metadata: {
  //     refundId: id,
  //     reason: "cancelled", // or "downgrade" based on your logic
  //   },
  //   amount: 2 * 100,
  // });

  const refund = await stripe.refunds.retrieve("re_3RRY864Ko2vWsPPw1q2dg8hA");

  // const refundUpdate = await Refund.findByIdAndUpdate(
  //   id,
  //   {
  //     refundStatus: "completed",
  //     refundedBy: req.user._id,
  //     refundedAt: new Date(),
  //   },
  //   { new: true }
  // );

  // if (!refundUpdate) return apiResponse(res, 400, false, "Refund not found!");

  return apiResponse(res, 200, true, "Refund completed successfully!", refund);
});
