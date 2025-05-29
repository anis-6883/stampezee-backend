import { Response } from "express";
import moment from "moment-timezone";
import { Types } from "mongoose";
import Stripe from "stripe";
import { apiResponse, asyncHandler, makePaginate } from "../../helpers";
import Enrollment from "../../models/enrollment";
import Payment from "../../models/payment";
import Retailer from "../../models/retailer";
import Settings from "../../models/settings";
import { IApiRequest, Object } from "../../types";
import { portalSchema } from "./validation";

/**
 * Get All Enrollments
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getEnrollments = asyncHandler(async (req: IApiRequest, res: Response) => {
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

  const query: any = { paymentStatus: { $in: ["completed", "trial"] } };
  if (start || end) query.createdAt = dateFilter;

  if (search) {
    const regex = { $regex: search, $options: "i" };
    const orQuery: {}[] = [{ "stripe.subscriptionId": regex }];

    const retailers = await Retailer.find({ storeName: regex });

    if (retailers.length > 0) {
      const retailerIds = retailers.map((retailer) => retailer._id);
      orQuery.push({ retailerId: { $in: retailerIds } });
    }

    query.$or = orQuery;
  }

  const [docs, total] = await Promise.all([
    Enrollment.aggregate([
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
          from: "enroll_subscriptions",
          localField: "_id",
          foreignField: "enrollmentId",
          as: "enrollSubscriptions",
          pipeline: [
            {
              $project: {
                subscriptionItemId: 1,
                title: "$planSnapshot.title",
                slug: "$planSnapshot.slug",
                type: "$planSnapshot.type",
                unlimitedFieldName: "$planSnapshot.unlimitedFieldName",
                deletedByRetailerAt: 1,
                validAtAfterCancel: 1,
              },
            },
            {
              $sort: {
                type: -1,
              },
            },
          ],
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
                storeName: 1,
                image: 1,
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
    ]),
    Enrollment.countDocuments(query),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "All retailers payment fetched successfully!", data);
});

/**
 * Get Single Enrollment
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getSingleEnrollment = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { enrollmentId } = req.params;
  if (!Types.ObjectId.isValid(enrollmentId)) return apiResponse(res, 400, false, "Please, provide valid id!");

  const enrollment = await Enrollment.aggregate([
    {
      $match: { _id: Types.ObjectId.createFromHexString(enrollmentId) },
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
              storeName: 1,
              image: 1,
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
              subscriptionItemId: 1,
              title: "$planSnapshot.title",
              slug: "$planSnapshot.slug",
              type: "$planSnapshot.type",
              unlimitedFieldName: "$planSnapshot.unlimitedFieldName",
              deletedByRetailerAt: 1,
              validAtAfterCancel: 1,
            },
          },
          {
            $sort: {
              type: -1,
            },
          },
        ],
      },
    },
  ]);

  if (enrollment.length <= 0) return apiResponse(res, 400, false, "No Billing Found!");

  return apiResponse(res, 200, true, "Retailer single billing fetched successfully!", enrollment[0]);
});

/**
 * Get Single Enrollment
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getSingleEnrollmentPayments = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10 } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const { enrollmentId } = req.params;
  if (!Types.ObjectId.isValid(enrollmentId)) return apiResponse(res, 400, false, "Please, provide valid id!");

  const payments = await Payment.aggregate([
    {
      $match: { enrollmentId: Types.ObjectId.createFromHexString(enrollmentId) },
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
      $project: {
        paymentIntentId: 1,
        invoiceNumber: 1,
        amountTotal: 1,
        currency: 1,
        paymentMethodId: "$paymentMethodDetails.id",
        cardBrand: "$paymentMethodDetails.card.brand",
        cardLast4: "$paymentMethodDetails.card.last4",
        createdAt: 1,
      },
    },
  ]);

  return apiResponse(res, 200, true, "Retailer single enrollment payments fetched successfully!", payments);
});

/**
 * Retailer Billing Portal
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getRetailerBillingPortal = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await portalSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { customerId, returnUrl } = result;

  const paymentMetadata = await Settings.findOne({}, { "stripe.stripeSecretKey": 1 });
  if (!paymentMetadata) return apiResponse(res, 400, false, "Something went wrong in Stripe settings!");

  const { stripeSecretKey } = paymentMetadata?.stripe;
  const stripe = new Stripe(stripeSecretKey);

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return apiResponse(res, 200, true, "Get Retailer Billing Portal!", { url: portalSession.url });
});
