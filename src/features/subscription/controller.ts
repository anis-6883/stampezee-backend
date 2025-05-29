import { Response } from "express";
import pLimit from "p-limit";
import Stripe from "stripe";
import { deleteFileFromS3Bucket, uploadFileToS3Bucket } from "../../configs/s3Bucket";
import { apiResponse, asyncHandler, fileValidation, makePaginate, roundToNearestTen } from "../../helpers";
import CurrencyExchange from "../../models/currency-exchange";
import EnrollSubscription from "../../models/enroll-subscription";
import Settings from "../../models/settings";
import Subscription from "../../models/subscription";
import { IApiRequest, Object } from "../../types";
import { updateRetailerFreePlan } from "./service";
import { subscriptionSchema, subscriptionStatusSchema, updateSubscriptionSchema } from "./validation";

/**
 * Create A Subscription
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const createSubscription = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await subscriptionSchema.validateAsync(req.body, {
    abortEarly: false,
  });
  if (result?.allowTotalScan == "null") {
    result.allowTotalScan = null;
  }

  if (result?.allowTotalUser == "null") {
    result.allowTotalUser = null;
  }

  result.superAdminId = req.user._id;

  const existingSubscription = await Subscription.findOne({ slug: result.slug });
  if (existingSubscription) return apiResponse(res, 400, false, "This subscription already exists!");

  let imageKey = null;

  // File Validation
  if (req.file) {
    const { status, message } = fileValidation(req.file, undefined, ["image/jpeg", "image/png", "image/jpg"]);
    if (!status) {
      return apiResponse(res, 400, false, "Invalid Request!", { image: message });
    }
  }

  // Upload File to S3 Bucket
  if (req.file) {
    const { status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "subscription");
    if (status) {
      imageKey = key;
    }
  }

  const subscription = await Subscription.create({
    ...result,
    image: imageKey,
  });

  return apiResponse(res, 201, true, "Subscription created successfully!", subscription);
});

/**
 * Get All Subscriptions
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllSubscriptions = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10 } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const [docs, total] = await Promise.all([
    Subscription.find({ softDeleted: false }).limit(Number(limit)).skip(skip).sort({ createdAt: "asc" }),
    Subscription.countDocuments({ softDeleted: false }),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Subscriptions fetched successfully!", data);
});

/**
 * Get A Single Subscription
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getSingleSubscription = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const subscription = await Subscription.findOne({ _id: id });
  if (!subscription) return apiResponse(res, 404, false, "Subscription not found!");

  return apiResponse(res, 200, true, "Subscription fetched successfully!", subscription);
});

/**
 * Update A Single Subscription
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateSubscription = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await updateSubscriptionSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  if (result?.allowTotalScan == "null") result.allowTotalScan = null;
  if (result?.allowTotalUser == "null") result.allowTotalUser = null;

  const { id } = req.params;
  const { softDeleted, image, slug, ...updatedBody } = result;

  const subscription = await Subscription.findById(id);
  if (!subscription) return apiResponse(res, 400, false, "Subscription not found!");

  // File Validation
  if (req.file) {
    const { status, message } = fileValidation(req.file, undefined, ["image/jpeg", "image/png", "image/jpg"]);
    if (!status) return apiResponse(res, 400, false, "Invalid Request!", { image: message });
  }

  // Upload File to S3 Bucket
  if (req.file) {
    const { status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "subscription");
    if (status) updatedBody.image = key;

    // Delete Existing Image if have
    const prevImage = await Subscription.findById(id, { image: 1 });
    deleteFileFromS3Bucket(prevImage?.image);
  }

  if (!updatedBody?.isUnlimited) updatedBody.unlimitedFieldName = null;
  else updatedBody.duration = 0;

  const updatedSubscription = await Subscription.findOneAndUpdate({ _id: id }, updatedBody, { new: true });
  if (!updatedSubscription) return apiResponse(res, 404, false, "Subscription not found!");

  // Bulk Update
  if (updatedSubscription?.slug === "trial") updateRetailerFreePlan(updatedSubscription);

  const priceChangeFlag = updatedBody?.price && updatedBody?.price !== subscription?.price;

  // Bulk Update
  if (updatedSubscription?.slug !== "trial" && priceChangeFlag) {
    // Get Payment Metadata, Allowed Currencies & enroll Subscriptions
    const [paymentMetadata, allowCurrencies, enrollSubscriptions] = await Promise.all([
      Settings.findOne({}, { "stripe.taxCost": 1, "stripe.taxStatus": 1, "stripe.stripeSecretKey": 1 }),
      CurrencyExchange.find({ status: true }),
      EnrollSubscription.aggregate([
        {
          $match: {
            "planSnapshot.slug": updatedSubscription?.slug,
            $or: [{ status: true }, { status: false, validAtAfterCancel: { $gt: new Date() } }],
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
          $unwind: "$enrollment",
        },
        {
          $project: {
            subscriptionItemId: 1,
            currency: "$enrollment.currency",
          },
        },
        {
          $group: {
            _id: null,
            subscriptions: { $push: "$$ROOT" },
            currencies: { $addToSet: "$currency" },
          },
        },
        {
          $project: {
            _id: 0,
            subscriptions: 1,
            currencies: 1,
          },
        },
      ]),
    ]);

    const { stripeSecretKey = null, taxCost = null, taxStatus = null } = paymentMetadata.stripe ?? {};
    const stripe = new Stripe(stripeSecretKey);
    const currencyPriceIdMap: Object = {};

    // Create Prices for each currency
    for (const currency of enrollSubscriptions[0]?.currencies || []) {
      let finalPrice = 0;
      const selectCurrency = allowCurrencies.find((item) => item.currency === currency);

      // Exchange rate & TAX apply
      finalPrice = Number((selectCurrency.exchangeRate * updatedSubscription?.price).toFixed(2));
      if (taxStatus === "on") finalPrice += (finalPrice * taxCost) / 100;

      let unitAmount = Math.round(Number(finalPrice) * 100); // convert into cent
      if (selectCurrency?.currency === "JPY") unitAmount = Math.round(Number(finalPrice));
      else if (selectCurrency?.currency === "KWD") unitAmount = roundToNearestTen(finalPrice);

      const price = await stripe.prices.create({
        currency: currency,
        unit_amount: unitAmount,
        recurring: {
          interval: "month",
        },
        product_data: {
          name: updatedSubscription?.title,
        },
      });

      currencyPriceIdMap[currency] = price.id;
    }

    // Update enroll subscriptions with new price id
    // for (const enrollSubscription of enrollSubscriptions[0]?.subscriptions || []) {
    //   console.log("ID: ", enrollSubscription.subscriptionItemId);

    //   const subscriptionItem = await stripe.subscriptionItems.update(enrollSubscription.subscriptionItemId, {
    //     price: currencyPriceIdMap[enrollSubscription.currency] || "",
    //   });
    // }

    let counter = 0;
    const limit = pLimit(10);

    const updatePromises = (enrollSubscriptions[0]?.subscriptions || []).map((enrollSubscription: any, index: number) =>
      limit(async () => {
        const updatedSubscription = await stripe.subscriptionItems.update(enrollSubscription.subscriptionItemId, {
          price: currencyPriceIdMap[enrollSubscription.currency] || "",
          proration_behavior: "none",
        });

        // Price update in EnrollSubscription
        await EnrollSubscription.findOneAndUpdate(
          {
            subscriptionItemId: enrollSubscription.subscriptionItemId,
          },
          {
            "planSnapshot.price": updatedSubscription.price, // Access updated price
          }
        );

        counter++;
        return updatedSubscription;
      })
    );

    const updatedSubscriptionItems = await Promise.all(updatePromises);

    return apiResponse(res, 200, true, "Test!", { updatedSubscriptionItems });
  }

  return apiResponse(res, 200, true, "Subscription updated successfully!", updatedSubscription);
});

/**
 * Update Status A Subscription
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateSubscriptionStatus = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await subscriptionStatusSchema.validateAsync(req.body, {
    abortEarly: false,
  });
  const { id } = req.params;
  const { status } = result;

  const subscription = await Subscription.findOneAndUpdate(
    { _id: id },
    {
      status,
    },
    {
      new: true,
    }
  );

  if (!subscription) return apiResponse(res, 404, false, "Subscription not found!");

  return apiResponse(res, 200, true, "Subscription status updated successfully!");
});

/**
 * Soft Delete A Subscription
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const softDeleteSubscription = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const subscription = await Subscription.findOneAndUpdate(
    { _id: id },
    {
      softDeleted: true,
    }
  );

  if (!subscription) return apiResponse(res, 404, false, "Subscription not found!");

  return apiResponse(res, 200, true, "Subscription deleted successfully!");
});

/**
 * Get All Deleted Subscription
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllDeletedSubscription = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10 } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const [docs, total] = await Promise.all([
    Subscription.find({ softDeleted: true }).limit(Number(limit)).skip(skip).sort({ createdAt: "desc" }),
    Subscription.find({ softDeleted: true }).countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Deleted subscriptions fetched successfully!", data);
});

/**
 * Confirm Delete A Single Subscription
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const confirmDeleteSubscription = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  // Delete Existing Image if have
  const prevImage = await Subscription.findById(id, { image: 1 });
  deleteFileFromS3Bucket(prevImage?.image);

  const subscription = await Subscription.findOneAndDelete({ _id: id });
  if (!subscription) return apiResponse(res, 404, false, "Subscription not found!");

  return apiResponse(res, 200, true, "Subscription deleted successfully!");
});
