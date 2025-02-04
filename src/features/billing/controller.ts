import { Response } from "express";
import fs from "fs";
import { Types } from "mongoose";
import path from "path";
import Stripe from "stripe";
import { PACKAGES } from "../../configs/constants";
import { apiResponse, asyncHandler, calculateBalanceAmount, htmlToPdf } from "../../helpers";
import { makePaginate } from "../../helpers/index";
import Branch from "../../models/branch";
import CurrencyExchange, { ICurrencyExchange } from "../../models/currency-exchange";
import EnrollSubscription from "../../models/enroll-subscription";
import Enrollment, { IEnrollment } from "../../models/enrollment";
import Payment from "../../models/payment";
import Refund from "../../models/refund";
import Retailer from "../../models/retailer";
import Settings from "../../models/settings";
import Stamp from "../../models/stamp";
import SubAdmin from "../../models/sub-admin";
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
                deletedByRetailer: 1,
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
  if (!Types.ObjectId.isValid(id)) return apiResponse(res, 400, false, "Please, provide valid id!");

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
            $lookup: {
              from: "branches",
              localField: "_id",
              foreignField: "enrollSubscriptionId",
              as: "branch",
              pipeline: [
                {
                  $project: {
                    name: 1,
                    address: "$address.name",
                  },
                },
              ],
            },
          },
          {
            $lookup: {
              from: "stamps",
              localField: "_id",
              foreignField: "enrollSubscriptionId",
              as: "stamp",
              pipeline: [
                {
                  $project: {
                    title: 1,
                    description: 1,
                  },
                },
              ],
            },
          },
          {
            $lookup: {
              from: "stamp_images",
              localField: "_id",
              foreignField: "enrollSubscriptionId",
              as: "stamp_image",
              pipeline: [
                {
                  $project: {
                    title: 1,
                    image: 1,
                  },
                },
              ],
            },
          },
          {
            $project: {
              subscriptionItemId: 1,
              title: "$planSnapshot.title",
              slug: "$planSnapshot.slug",
              type: "$planSnapshot.type",
              deletedByRetailer: 1,
              branch: 1,
              stamp: 1,
              stamp_image: 1,
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

  if (enrollment.length <= 0) return apiResponse(res, 400, false, "No Billing Found!");

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
  if (!enrollSubscription) return apiResponse(res, 400, false, "Enroll Subscription Not Found!");

  if (enrollSubscription?.planSnapshot?.type !== "subscription") {
    const totalPackage = await EnrollSubscription.countDocuments({
      enrollmentId: enrollSubscription.enrollmentId,
      status: true,
      deletedByRetailer: false,
    });

    if (totalPackage < 2) return apiResponse(res, 400, false, "At least one package is needed for subscription!");

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

    if (!paymentMetadata) return apiResponse(res, 400, false, "Something went wrong in Stripe settings!");

    const stripe = new Stripe(stripeSecretKey);

    const deletedItem = await stripe.subscriptionItems.del(enrollSubscription?.subscriptionItemId, {
      proration_behavior: "none", // Options: 'create_prorations', 'none', 'always_invoice'
    });

    if (deletedItem?.deleted) {
      await EnrollSubscription.findByIdAndUpdate(enrollSubscriptionId, {
        status: false,
        deletedByRetailerAt: new Date(),
      });

      // Attach Branch Check
      if (enrollSubscription.planSnapshot.slug === PACKAGES.BRANCH) {
        const branch = await Branch.findOneAndUpdate(
          { enrollSubscriptionId },
          {
            status: false,
            softDeleted: true,
          },
          {
            new: true,
          }
        );

        if (branch) {
          await Promise.all([
            Stamp.updateMany({ branchId: branch?._id }, { status: false, softDeleted: true }),
            SubAdmin.updateMany({ branchId: branch?._id }, { status: false, softDeleted: true }),
          ]);
        }
      }

      // Attach Stamp Check
      if (enrollSubscription.planSnapshot.slug === PACKAGES.STAMP) {
        await Stamp.findOneAndUpdate(
          { enrollSubscriptionId },
          {
            status: false,
            softDeleted: true,
          }
        );
      }
    }

    return apiResponse(res, 200, true, "Add-on Subscription Cancelled Successfully!");
  } else {
    return apiResponse(res, 400, false, "Cancel a Subscription Plan is not Allowed!");
  }
});

/**
 * Cancel Base Plan or Addon
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const cancelBasePlanOrAddOn = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await enrollSubscriptionSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { enrollSubscriptionId } = result;

  const [enrollSubscription, paymentMetadata] = await Promise.all([
    EnrollSubscription.findById(enrollSubscriptionId),
    Settings.findOne(
      {},
      {
        "stripe.planChangeCost": 1,
        "stripe.refundableThreshold": 1,
        "stripe.taxTitle": 1,
        "stripe.taxCost": 1,
        "stripe.taxStatus": 1,
        "stripe.stripeSecretKey": 1,
      }
    ),
  ]);

  if (!enrollSubscription) throw "Enroll Subscription Not Found!";
  if (enrollSubscription?.deletedByRetailerAt) throw "Enroll Subscription already deleted by client!";
  if (!paymentMetadata) throw "Something went wrong in Stripe settings!";

  const { stripeSecretKey } = paymentMetadata.stripe ?? {};

  const stripe = new Stripe(stripeSecretKey);

  if (enrollSubscription?.planSnapshot?.type === "subscription") {
    const enrollment: IEnrollment = await Enrollment.findById(enrollSubscription.enrollmentId);
    const allowCurrencies: ICurrencyExchange[] = await CurrencyExchange.find({ status: true });
    const selectCurrency: ICurrencyExchange = allowCurrencies.find(
      (curr: ICurrencyExchange) => curr.name === enrollment.currency
    );

    const convertToSelectedCurrency = Number(
      ((selectCurrency.exchangeRate / enrollment.currencyRate) * enrollSubscription.planCurrentPrice).toFixed(2)
    );

    const balanceAmount: number = calculateBalanceAmount(
      enrollment.validityFrom,
      enrollment.validityTo,
      convertToSelectedCurrency
    );

    // Check Refund
    const isRefunded = Math.abs(balanceAmount) >= paymentMetadata.stripe.refundableThreshold;
    if (isRefunded) {
      await Refund.create({
        currency: enrollment.currency,
        enrollmentId: enrollment._id,
        refundAmount: parseFloat(Math.abs(balanceAmount).toFixed(2)),
        refundStatus: "pending",
      });
    }

    await Promise.all([
      stripe.subscriptions.cancel(enrollment?.stripe?.subscriptionId),
      Enrollment.findByIdAndUpdate(enrollSubscription.enrollmentId, { status: false }),
      EnrollSubscription.updateMany(
        { enrollmentId: enrollSubscription.enrollmentId },
        { status: false, deletedByRetailerAt: new Date() }
      ),
    ]);

    return apiResponse(res, 200, true, "Subscription Cancelled Successfully!");
  } else {
    const totalPackage = await EnrollSubscription.countDocuments({
      enrollmentId: enrollSubscription.enrollmentId,
      status: true,
      deletedByRetailerAt: null,
    });

    // Cancel the subscription if it contains only one add-on
    if (totalPackage < 2) {
      const enrollment: IEnrollment = await Enrollment.findById(enrollSubscription.enrollmentId);

      await Promise.all([
        stripe.subscriptions.cancel(enrollment?.stripe?.subscriptionId),
        Enrollment.findByIdAndUpdate(enrollSubscription.enrollmentId, { status: false }),
        EnrollSubscription.findByIdAndUpdate(enrollSubscription._id, {
          status: false,
          deletedByRetailerAt: new Date(),
        }),
      ]);

      return apiResponse(res, 200, true, "Add-on Subscription Cancelled Successfully!");
    } else {
      const deletedItem = await stripe.subscriptionItems.del(enrollSubscription?.subscriptionItemId, {
        proration_behavior: "none", // Options: 'create_prorations', 'none', 'always_invoice'
      });

      if (deletedItem?.deleted) {
        await EnrollSubscription.findByIdAndUpdate(enrollSubscriptionId, {
          status: false,
          deletedByRetailerAt: new Date(),
        });
      }

      return apiResponse(res, 200, true, "Add-on Subscription Cancelled Successfully!");
    }
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
  if (!paymentMetadata) return apiResponse(res, 400, false, "Something went wrong in Stripe settings!");

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
  if (!Types.ObjectId.isValid(id)) return apiResponse(res, 400, false, "Please, provide valid id!");

  const payment = await Payment.aggregate([
    {
      $match: { _id: Types.ObjectId.createFromHexString(id) },
    },
    {
      $lookup: {
        from: "enroll_subscriptions",
        localField: "enrollSubscriptionIds",
        foreignField: "_id",
        as: "enrollSubscriptions",
      },
    },
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
  ]);

  const retailer = await Retailer.findById(payment[0]?.enrollment?.retailerId);
  const customerInfo = {
    name: retailer?.fullName,
    phone: `${retailer?.dialCode}-${retailer?.phone}`,
    address: `${retailer?.address}, ${retailer?.city}, ${retailer?.postalCode}`,
  };
  let taxValue = 0;
  let subTotal = 0;

  let coupon: any = null;
  const purchasedItems = payment[0]?.enrollSubscriptions?.map((purchasedSubscription: any) => {
    // Only tax apply
    if (payment[0]?.enrollment?.taxSnapshot) {
      taxValue += (purchasedSubscription?.planSnapshot?.price * payment[0]?.enrollment?.taxSnapshot?.taxCost) / 100;
    }

    subTotal += purchasedSubscription?.planSnapshot?.price * payment[0]?.enrollment?.currencyRate;

    return {
      title: purchasedSubscription?.planSnapshot?.title,
      quantity: 1,
      unitPrice: `${Number(purchasedSubscription?.planSnapshot?.price * payment[0]?.enrollment?.currencyRate).toFixed(2)} ${payment[0]?.enrollment?.currency}`,
      total: `${Number(purchasedSubscription?.planSnapshot?.price * payment[0]?.enrollment?.currencyRate).toFixed(2)} ${payment[0]?.enrollment?.currency}`,
    };
  });

  const invoiceMetadata = {
    invoiceNo: payment[0]?.invoiceNumber,
    subtotal: `${Number(subTotal).toFixed(2)} ${payment[0]?.enrollment?.currency}`,
    remainingAmount:
      payment[0]?.enrollment?.enrollStatus === "purchase" || !payment[0]?.balanceAmount
        ? null
        : `${payment[0]?.balanceAmount} ${payment[0]?.enrollment?.currency}`,
    planChangeCost:
      payment[0]?.enrollment?.enrollStatus === "purchase"
        ? null
        : `${payment[0]?.enrollment?.planChangeCost.toFixed(2)} ${payment[0]?.enrollment?.currency}`,
    couponDiscount: payment[0]?.coupon?._id
      ? `${payment[0]?.coupon?.discountAmount?.toFixed(2)} ${payment[0]?.enrollment?.currency}`
      : null,
    taxDiscount: payment[0]?.enrollment?.taxSnapshot
      ? `${taxValue?.toFixed(2)} ${payment[0]?.enrollment?.currency}`
      : null,
    coupon: {
      discount: payment[0]?.coupon?.discount,
    },
    tax: payment[0]?.enrollment?.taxSnapshot
      ? {
          taxTitle: payment[0]?.enrollment?.taxSnapshot?.taxTitle,
          taxCost: payment[0]?.enrollment?.taxSnapshot?.taxCost,
        }
      : null,
    total: `${parseFloat(Math.abs(payment[0]?.amountTotal).toFixed(2))} ${payment[0]?.enrollment?.currency}`,
    extraPayableAmount:
      payment[0]?.enrollment?.enrollStatus === "purchase" || !payment[0]?.extraPayableAmount
        ? null
        : `${payment[0]?.extraPayableAmount} ${payment[0]?.enrollment?.currency}`,
  };
  const paymentInfo = {
    bankName: "Fauget Bank",
    accountName: "Juliana Silva",
    accountNo: "123-456-7890",
  };

  await htmlToPdf({ customerInfo, purchasedItems, invoiceMetadata, paymentInfo });

  const pdfFileBuffer = path.join(process.cwd(), "/src/templates/invoice.pdf");

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

  if (!customerId) return apiResponse(res, 400, false, "No provide customer id!");

  const paymentMetadata = await Settings.findOne({}, { "stripe.stripeSecretKey": 1 });
  if (!paymentMetadata) return apiResponse(res, 400, false, "Something went wrong in Stripe settings!");

  const { stripeSecretKey } = paymentMetadata?.stripe;
  const stripe = new Stripe(stripeSecretKey);

  const [paymentMethods, customer]: any = await Promise.all([
    stripe.customers.listPaymentMethods(customerId, {
      limit: Number(limit),
    }),
    stripe.customers.retrieve(customerId),
  ]);

  const allPaymentMethod = paymentMethods?.data?.map((item: any) => {
    if (customer?.invoice_settings?.default_payment_method === item?.id) {
      return {
        id: item?.id,
        isDefault: true,
        customer: item?.customer,
        card: {
          brand: item?.card?.brand,
          country: item?.card?.country,
          exp_month: item?.card?.exp_month,
          exp_year: item?.card?.exp_year,
          last4: item?.card?.last4,
        },
      };
    }
    return {
      id: item?.id,
      isDefault: false,
      customer: item?.customer,
      card: {
        brand: item?.card?.brand,
        country: item?.card?.country,
        exp_month: item?.card?.exp_month,
        exp_year: item?.card?.exp_year,
        last4: item?.card?.last4,
      },
    };
  });

  return apiResponse(res, 200, true, "Get all payment method successfully!", allPaymentMethod);
});

/**
 * Setup Payment Intent for Attach Payment Method
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const setupPaymentIntent = asyncHandler(async (req: IApiRequest, res: Response) => {
  const paymentMetadata = await Settings.findOne({}, { "stripe.stripeSecretKey": 1 });
  if (!paymentMetadata) return apiResponse(res, 400, false, "Something went wrong in Stripe settings!");

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

  if (!paymentMethodId) return apiResponse(res, 400, false, "No provide payment method id!");
  if (!customerId) return apiResponse(res, 400, false, "No provide customer id!");

  const paymentMetadata = await Settings.findOne({}, { "stripe.stripeSecretKey": 1 });
  if (!paymentMetadata) return apiResponse(res, 400, false, "Something went wrong in Stripe settings!");

  const { stripeSecretKey } = paymentMetadata?.stripe;
  const stripe = new Stripe(stripeSecretKey);

  const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
  await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethodId } });

  return apiResponse(res, 200, true, "Attach payment method successfully!", paymentMethod);
});

/**
 * Detach Payment Method with Payment Method Id
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const detachPaymentMethod = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { paymentMethodId } = req.body;

  if (!paymentMethodId) return apiResponse(res, 400, false, "No provide payment method id!");

  const paymentMetadata = await Settings.findOne({}, { "stripe.stripeSecretKey": 1 });
  if (!paymentMetadata) return apiResponse(res, 400, false, "Something went wrong in Stripe settings!");

  const { stripeSecretKey } = paymentMetadata?.stripe;
  const stripe = new Stripe(stripeSecretKey);

  const paymentMethod = await stripe.paymentMethods.detach(paymentMethodId);

  return apiResponse(res, 200, true, "Detach payment method successfully!", paymentMethod);
});

/**
 * Set Default Payment Method with Customer ID
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const setDefaultPaymentMethod = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { paymentMethodId, customerId } = req.body;

  if (!paymentMethodId) return apiResponse(res, 400, false, "No provide payment method id!");
  if (!customerId) return apiResponse(res, 400, false, "No provide customer id!");

  const paymentMetadata = await Settings.findOne({}, { "stripe.stripeSecretKey": 1 });
  if (!paymentMetadata) return apiResponse(res, 400, false, "Something went wrong in Stripe settings!");

  const { stripeSecretKey } = paymentMetadata?.stripe;
  const stripe = new Stripe(stripeSecretKey);

  const updatedCustomer = await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });

  return apiResponse(res, 200, true, "Attach payment method successfully!", updatedCustomer);
});
