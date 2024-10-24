import { Response } from "express";
import fs from "fs";
import mongoose from "mongoose";
import path from "path";
import Stripe from "stripe";
import { apiResponse, asyncHandler, htmlToPdf, makePaginate } from "../../helpers";
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
            $limit: 5,
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
  ]);

  if (enrollSubscription.length <= 0) throw "No Subscription Found!";

  return apiResponse(res, 200, true, "Retailer single billing fetched successfully!", enrollSubscription[0]);
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

/**
 * Retailer Billing PDF Download
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getRetailerBillingPdf = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) throw "Please, provide valid id!";

  const payment = await Payment.aggregate([
    {
      $match: { _id: mongoose.Types.ObjectId.createFromHexString(id) },
    },
    {
      $lookup: {
        from: "retailers",
        localField: "retailerId",
        foreignField: "_id",
        as: "retailer",
      },
    },
    {
      $lookup: {
        from: "enrollsubscriptions",
        localField: "enrollSubscriptionId",
        foreignField: "_id",
        as: "enrollSubscription",
      },
    },
    {
      $unwind: {
        path: "$retailer",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$enrollSubscription",
        preserveNullAndEmptyArrays: true,
      },
    },
  ]);

  const { invoiceNumber, amountTotal, retailer, enrollSubscription } = payment[0];

  const customerInfo = {
    name: retailer?.fullName,
    phone: `${retailer?.dialCode}-${retailer?.phone}`,
    address: `${retailer?.address}, ${retailer?.city}, ${retailer?.postalCode}`,
  };
  const purchasedItems = [
    {
      title: enrollSubscription?.planSnapshot?.title,
      quantity: 1,
      unitPrice: `${Number(enrollSubscription?.planSnapshot?.price * enrollSubscription?.balanceInfo?.currencyRate).toFixed(2)} ${enrollSubscription?.balanceInfo?.currency}`,
      total: `${Number(enrollSubscription?.planSnapshot?.price * enrollSubscription?.balanceInfo?.currencyRate).toFixed(2)} ${enrollSubscription?.balanceInfo?.currency}`,
    },
  ];

  let taxValue = 0;
  let couponValue = 0;

  // Check coupon eligibility & apply
  if (enrollSubscription?.couponSnapshot) {
    couponValue =
      enrollSubscription?.couponSnapshot?.discountType === "percentage"
        ? (enrollSubscription?.balanceInfo?.planCurrentPrice * enrollSubscription?.couponSnapshot?.discount) / 100
        : enrollSubscription?.balanceInfo?.currencyRate * enrollSubscription?.couponSnapshot?.discount;
    couponValue = Number(couponValue.toFixed(2));
  }

  // Only tax apply
  if (enrollSubscription?.taxSnapshot) {
    taxValue = (enrollSubscription?.balanceInfo?.planCurrentPrice * enrollSubscription?.taxSnapshot?.taxCost) / 100;
  }

  const invoiceMetadata = {
    invoiceNo: invoiceNumber,
    subtotal: `${Number(enrollSubscription?.planSnapshot?.price * enrollSubscription?.balanceInfo?.currencyRate).toFixed(2)} ${enrollSubscription?.balanceInfo?.currency}`,
    remainingAmount:
      enrollSubscription?.enrollStatus === "purchase"
        ? null
        : `${enrollSubscription?.balanceInfo?.currentBalance?.toFixed(2)} ${enrollSubscription?.balanceInfo?.currency}`,
    planChangeCost:
      enrollSubscription?.enrollStatus === "purchase"
        ? null
        : `${enrollSubscription?.planChangeCost.toFixed(2)} ${enrollSubscription?.balanceInfo?.currency}`,
    couponDiscount: enrollSubscription?.couponSnapshot
      ? `${couponValue.toFixed(2)} ${enrollSubscription?.balanceInfo?.currency}`
      : null,
    taxDiscount: enrollSubscription?.taxSnapshot
      ? `${taxValue?.toFixed(2)} ${enrollSubscription?.balanceInfo?.currency}`
      : null,
    coupon: enrollSubscription?.couponSnapshot
      ? {
          title: enrollSubscription?.couponSnapshot?.title,
          discountType: enrollSubscription?.couponSnapshot?.discountType,
          discount: enrollSubscription?.couponSnapshot?.discount,
        }
      : null,
    tax: enrollSubscription?.taxSnapshot
      ? {
          taxTitle: enrollSubscription?.taxSnapshot?.taxTitle,
          taxCost: enrollSubscription?.taxSnapshot?.taxCost,
        }
      : null,
    total: `${(amountTotal / 100).toFixed(2)} ${enrollSubscription?.balanceInfo?.currency}`,
  };

  const paymentInfo = {
    bankName: "Fauget Bank",
    accountName: "Juliana Silva",
    accountNo: "123-456-7890",
  };

  await htmlToPdf({ customerInfo, purchasedItems, invoiceMetadata, paymentInfo });

  const pdfFileBuffer = path.join(process.cwd(), "/src/features/enroll-subscription/temp/invoice.pdf");

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="invoice.pdf"');
  const stream = fs.createReadStream(pdfFileBuffer);
  stream.pipe(res);

  // return apiResponse(res, 200, true, "Get Retailer Billing PDF Successfully!", {});
});
