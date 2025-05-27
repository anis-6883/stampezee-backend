import { Response } from "express";
import moment from "moment-timezone";
import { Types } from "mongoose";
import Stripe from "stripe";
import { apiResponse, asyncHandler, makePaginate, roundToNearestTen } from "../../helpers";
import Payment from "../../models/payment";
import Refund from "../../models/refund";
import Settings from "../../models/settings";
import { IApiRequest, Object } from "../../types";

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
  const { page = 1, limit = 10, search, start = undefined, end = undefined } = req.query;

  const skip: number = (Number(page) - 1) * Number(limit);
  const settings = await Settings.findOne();
  const timezone = settings.general.timezone.label;

  let startDate, endDate;

  // Handle date logic
  if (start) {
    startDate = moment.tz(start, timezone).startOf("day").toDate();
    endDate = end ? moment.tz(end, timezone).endOf("day").toDate() : moment.tz(start, timezone).endOf("day").toDate(); // treat start as end
  }

  const dateFilter: Object = {};
  if (startDate) dateFilter.$gte = startDate;
  if (endDate) dateFilter.$lte = endDate;

  const query: any = {};
  if (start || end) query.createdAt = dateFilter;

  const [docs, total] = await Promise.all([
    Refund.aggregate([
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
    ]),
    Refund.countDocuments(query),
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
  if (!Types.ObjectId.isValid(id)) return apiResponse(res, 400, false, "Please, provide valid id!");

  const [refund, paymentMetadata] = await Promise.all([
    Refund.findById(id),
    Settings.findOne({}, { "stripe.stripeSecretKey": 1 }),
  ]);
  if (!refund) return apiResponse(res, 400, false, "No refund found!");
  if (!paymentMetadata) return apiResponse(res, 400, false, "Something went wrong in Stripe settings!");

  const enrollmentId = refund.reason === "cancelled" ? refund.enrollmentId : refund.prevEnrollmentId;

  const lastPayment = await Payment.findOne({ enrollmentId }, { paymentIntentId: 1 }).sort({
    createdAt: -1,
  });
  if (!lastPayment) return apiResponse(res, 400, false, "No payment found for this refund!");

  const { stripeSecretKey } = paymentMetadata.stripe ?? {};
  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-04-10", typescript: true });

  let refundUnitAmount = Math.round(Number(refund.refundAmount) * 100); // convert into cent
  if (refund?.currency === "JPY") refundUnitAmount = Math.round(Number(refund.refundAmount));
  else if (refund?.currency === "KWD") refundUnitAmount = roundToNearestTen(refund.refundAmount);

  // const stripeRefund = await stripe.refunds.create({
  //   payment_intent: lastPayment.paymentIntentId,
  //   reason: "requested_by_customer",
  //   metadata: {
  //     refundId: id,
  //     reason: refund.reason,
  //   },
  //   amount: refundUnitAmount,
  // });

  // await Refund.findOneAndUpdate(
  //   { _id: id },
  //   {
  //     stripeRefundId: stripeRefund.id,
  //     refundStatus: "processing",
  //     refundedBy: req.user._id,
  //     refundedAt: new Date(),
  //   },
  //   { new: true }
  // );

  return apiResponse(res, 200, true, "Refund completed successfully!");
});
