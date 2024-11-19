import { Response } from "express";
import Stripe from "stripe";
import { apiResponse, asyncHandler, makePaginate } from "../../helpers";
import CriticalPayment from "../../models/critical-payment";
import Enrollment from "../../models/enrollment";
import Settings from "../../models/settings";
import { IApiRequest } from "../../types";
import { criticalPaymentSchema } from "./validation";

/**
 * Get All Critical Payments
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllCriticalPayments = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = {};
  if (search) query.stripeInvoiceId = { $regex: search, $options: "i" };

  const [docs, total] = await Promise.all([
    CriticalPayment.aggregate([
      {
        $match: query,
      },
      {
        $addFields: {
          sortStatus: {
            $cond: {
              if: { $eq: ["$status", "pending"] },
              then: 0,
              else: 1,
            },
          },
        },
      },
      {
        $sort: {
          sortStatus: 1,
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
          localField: "paymentId",
          foreignField: "_id",
          as: "payment",
          pipeline: [
            {
              $project: {
                paymentIntentId: 1,
                invoiceNumber: 1,
                paymentMethodId: "$paymentMethodDetails.id",
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$payment",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          paymentId: 0,
          sortStatus: 0, // Hide the temporary sort field
        },
      },
    ]),
    CriticalPayment.countDocuments(query),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Critical payments fetched successfully!", data);
});

/**
 * Resolve Critical Payment
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const resolveCriticalPayment = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await criticalPaymentSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { stripeInvoiceId } = result;

  const paymentMetadata = await Settings.findOne({}, { "stripe.stripeSecretKey": 1 });
  if (!paymentMetadata) throw "Something went wrong in Stripe settings!";

  const { stripeSecretKey } = paymentMetadata.stripe;
  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-04-10", typescript: true });

  const invoice: any = await stripe.invoices.retrieve(stripeInvoiceId as string, {
    expand: ["payment_intent.payment_method"],
  });

  if (invoice?.id && invoice?.payment_intent?.payment_method?.id) {
    const criticalPayment = await CriticalPayment.findOne({ stripeInvoiceId });
    if (!criticalPayment) throw "Provided invalid stripe invoice id!";

    const enrollUpdated = await Enrollment.findOneAndUpdate(
      {
        _id: { $in: criticalPayment.enrollmentId },
      },
      {
        "stripe.paymentMethodId": invoice?.payment_intent?.payment_method?.id,
      },
      { new: true }
    );

    if (enrollUpdated) await CriticalPayment.findOneAndUpdate({ stripeInvoiceId }, { status: "resolved" });
  } else {
    throw "Try again to resolve!";
  }

  return apiResponse(res, 200, true, "Critical payment resolved successfully!");
});
