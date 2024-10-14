import { Response } from "express";
import mongoose from "mongoose";
import Stripe from "stripe";
import { apiResponse, asyncHandler, makePaginate } from "../../helpers";
import { IApiRequest } from "../../types";
import EnrollSubscription from "../enroll-subscription/model";
import Settings from "../settings/model";
import Retailer from "../user/retailer/model";
import { portalSchema } from "./validation";

/**
 * Get All Subscription Payments
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getSubscriptionPayments = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search }: any = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = { paymentStatus: "completed" };

  if (search) {
    const regex = new RegExp(`.*${search.trim()}.*`, "i"); //case insensitive search. For sensitive remove i
    const retailerIds = (await Retailer.find({ storeName: regex }, { _id: 1 })).map((store) => store._id);

    const orQuery = [{ "stripe.subscriptionId": regex }, { retailerId: { $in: retailerIds } }];
    query.$or = orQuery;
  }

  const [docs, total] = await Promise.all([
    EnrollSubscription.aggregate([
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
          from: "payments",
          localField: "_id",
          foreignField: "enrollSubscriptionId",
          as: "payments",
          pipeline: [
            {
              $sort: { createdAt: -1 },
            },
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
    EnrollSubscription.countDocuments(query),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Subscription payments fetched successfully!", data);
});

/**
 * Get Single Subscription Payment
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getSingleSubscriptionPayment = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) throw "Please, provide valid id!";

  const enrollSubscription = await EnrollSubscription.aggregate([
    {
      $match: { _id: mongoose.Types.ObjectId.createFromHexString(id) },
    },
    {
      $lookup: {
        from: "payments",
        localField: "_id",
        foreignField: "enrollSubscriptionId",
        as: "payments",
        pipeline: [
          {
            $sort: { createdAt: -1 },
          },
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
  ]);

  if (enrollSubscription.length <= 0) throw "No Subscription Found!";

  return apiResponse(res, 200, true, "Get single subscription payment successfully!", enrollSubscription[0]);
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
  if (!paymentMetadata) throw "Something went wrong in Stripe settings!";

  const { stripeSecretKey } = paymentMetadata?.stripe;
  const stripe = new Stripe(stripeSecretKey);

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return apiResponse(res, 200, true, "Get Retailer Billing Portal!", { url: portalSession.url });
});
