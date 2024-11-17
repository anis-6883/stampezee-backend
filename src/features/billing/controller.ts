import { Response } from "express";
import fs from "fs";
import { Types } from "mongoose";
import path from "path";
import Stripe from "stripe";
import { apiResponse, asyncHandler, htmlToPdf } from "../../helpers";
import { makePaginate } from "../../helpers/index";
import EnrollSubscription from "../../models/enroll-subscription";
import Enrollment from "../../models/enrollment";
import Payment from "../../models/payment";
import Settings from "../../models/settings";
import { IApiRequest } from "../../types";
import { enrollSubscriptionSchema, portalSchema } from "./validation";

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
    query["stripe.subscriptionId"] = { $regex: search, $options: "i" };
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
    ]),
    Enrollment.countDocuments(query),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Retailer all billings fetched successfully!", data);
});

/**
 * Get A Subscription Billing
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getSingleBilling = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) throw "Please, provide valid id!";

  const enrollment = await Enrollment.aggregate([
    {
      $match: { _id: Types.ObjectId.createFromHexString(id) },
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
        from: "payments",
        localField: "_id",
        foreignField: "enrollmentId",
        as: "payments",
        pipeline: [
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
          {
            $sort: {
              createdAt: -1,
            },
          },
        ],
      },
    },
  ]);

  if (enrollment.length <= 0) throw "No Billing Found!";

  return apiResponse(res, 200, true, "Retailer single billing fetched successfully!", enrollment[0]);
});

/**
 * Cancel Subscription Item from Packages
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const cancelAddOnSubscription = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await enrollSubscriptionSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { enrollSubscriptionId } = result;
  const enrollSubscription = await EnrollSubscription.findById(enrollSubscriptionId);
  if (!enrollSubscription) throw "Enroll Subscription Not Found!";

  if (enrollSubscription?.planSnapshot?.type !== "subscription") {
    const paymentMetadata = await Settings.findOne(
      {},
      {
        "stripe.planChangeCost": 1,
        "stripe.refundableThreshold": 1,
        "stripe.taxTitle": 1,
        "stripe.taxCost": 1,
        "stripe.taxStatus": 1,
        "stripe.stripeSecretKey": 1,
      }
    );

    const { stripeSecretKey } = paymentMetadata.stripe ?? {};

    if (!paymentMetadata) throw "Something went wrong in Stripe settings!";

    const stripe = new Stripe(stripeSecretKey);

    const deletedItem = await stripe.subscriptionItems.del(enrollSubscription?.subscriptionItemId, {
      proration_behavior: "none", // Options: 'create_prorations', 'none', 'always_invoice'
    });

    if (deletedItem?.deleted) {
      await EnrollSubscription.findByIdAndUpdate(enrollSubscriptionId, {
        status: false,
        deletedByRetailer: true,
      });
    }

    return apiResponse(res, 200, true, "Add-on Subscription Cancelled Successfully!");
  } else {
    return apiResponse(res, 400, true, "Cancel a Subscription Plan is not Allowed!");
  }
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
  if (!Types.ObjectId.isValid(id)) throw "Please, provide valid id!";

  const payment = await Payment.aggregate([
    {
      $match: { _id: Types.ObjectId.createFromHexString(id) },
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
        from: "enroll_subscriptions",
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

/**
 * Get All Payment Method for Customer ID
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllPaymentMethod = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { customerId } = req.params;
  const { limit = 3 } = req.query;

  if (!customerId) throw "No provide customer id!";

  const paymentMetadata = await Settings.findOne({}, { "stripe.stripeSecretKey": 1 });
  if (!paymentMetadata) throw "Something went wrong in Stripe settings!";

  const { stripeSecretKey } = paymentMetadata?.stripe;
  const stripe = new Stripe(stripeSecretKey);

  const paymentMethods = await stripe.customers.listPaymentMethods(customerId, {
    limit: Number(limit),
  });

  return apiResponse(res, 200, true, "Get all payment method successfully!", paymentMethods);
});

/**
 * Setup Payment Intent for Attach Payment Method
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const setupPaymentIntent = asyncHandler(async (req: IApiRequest, res: Response) => {
  const paymentMetadata = await Settings.findOne({}, { "stripe.stripeSecretKey": 1 });
  if (!paymentMetadata) throw "Something went wrong in Stripe settings!";

  const { stripeSecretKey } = paymentMetadata?.stripe;
  const stripe = new Stripe(stripeSecretKey);

  const setupIntent = await stripe.setupIntents.create({
    payment_method_types: ["card"],
  });

  return apiResponse(res, 200, true, "Setup payment intent successfully!", setupIntent);
});

/**
 * Attach Payment Method with Customer ID
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const attachPaymentMethod = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { paymentMethodId, customerId } = req.body;

  if (!paymentMethodId) throw "No provide payment method id!";
  if (!customerId) throw "No provide customer id!";

  const paymentMetadata = await Settings.findOne({}, { "stripe.stripeSecretKey": 1 });
  if (!paymentMetadata) throw "Something went wrong in Stripe settings!";

  const { stripeSecretKey } = paymentMetadata?.stripe;
  const stripe = new Stripe(stripeSecretKey);

  const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
    customer: customerId,
  });

  return apiResponse(res, 200, true, "Attach payment method successfully!", paymentMethod);
});
