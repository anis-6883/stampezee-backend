import { Response } from "express";
import mongoose from "mongoose";
import Stripe from "stripe";
import { apiResponse, asyncHandler, makePaginate } from "../../helpers";
import { IApiRequest } from "../../types";
import EnrollSubscription from "../enroll-subscription/model";
import Payment from "../payment/model";
import Settings from "../settings/model";
import { portalSchema } from "./validation";

/**
 * Get All Subscription Billings
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllBillings = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search }: any = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = { retailerId: req.user._id, paymentStatus: "completed" };

  if (search) {
    const regex = new RegExp(`.*${search.trim()}.*`, "i"); //case insensitive search. For sensitive remove i
    query["stripe.subscriptionId"] = regex;
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
    ]),
    EnrollSubscription.countDocuments(query),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Retailer billing fetched successfully!", data);
});

/**
 * Get A Subscription Billing
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getSingleBilling = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) throw "Please, provide valid id!";

  const enrollSubscription: any = await EnrollSubscription.findById(id);
  if (!enrollSubscription) throw "No Subscription Found!";

  const payments = await Payment.find({ enrollSubscriptionId: id });

  return apiResponse(res, 200, true, "Retailer single billing fetched successfully!", {
    ...enrollSubscription._doc,
    payments,
  });
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
