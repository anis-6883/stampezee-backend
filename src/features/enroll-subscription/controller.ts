import { Response } from "express";
import moment from "moment";
import Stripe from "stripe";
import { PACKAGES } from "../../configs/constants";
import { apiResponse, asyncHandler, checkCombination, checkDuplicates } from "../../helpers";
import { IApiRequest, IEnrollPayment, ILineItem } from "../../types";
import Subscription from "../subscription/model";
import Retailer from "../user/retailer/model";
import { EnrollPayment, EnrollSubscription } from "./model";
import { enrollSubscriptionSchema } from "./validation";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Get Active Subscription Plans
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllPlans = asyncHandler(async (req: IApiRequest, res: Response) => {
  const subscriptions = await Subscription.find(
    { softDeleted: false },
    { softDeleted: 0, createdAt: 0, updatedAt: 0 }
  ).sort({ createdAt: "asc" });

  return apiResponse(res, 200, true, "Subscriptions fetched successfully!", subscriptions);
});

/**
 * Enroll Subscription
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const enrollSubscription = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await enrollSubscriptionSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { slugs }: { slugs: string[] } = result;

  if (slugs.includes(PACKAGES.TRIAL) && slugs.length > 1) {
    throw "Trial packages do not include any additional packages!";
  }

  // Enroll Free Trial
  if (slugs.includes(PACKAGES.TRIAL)) {
    if (!req.user.takeFreeTrial) {
      const subscription = await Subscription.findOne({ slug: "trial" });

      if (subscription) {
        const today = new Date();
        const expireDate = new Date(today);
        expireDate.setDate(today.getDate() + subscription.duration);

        Promise.all([
          EnrollSubscription.create({
            retailerId: req.user._id,
            planSnapshot: subscription,
            paymentStatus: "trial",
            validityFrom: Date.now(),
            validityTo: expireDate,
          }),
          Retailer.findByIdAndUpdate(req.user._id, { takeFreeTrial: true }),
        ]);
        return apiResponse(res, 200, true, "Free trial enrolled successfully!");
      }
      throw "Free trial package not found!";
    }
    throw "Free trial already taken!";
  }

  // Enroll Paid Subscription
  if (checkCombination(slugs, [PACKAGES.BASIC, PACKAGES.PRO, PACKAGES.ADVANCED]) && checkDuplicates(slugs)) {
    const subscriptions: any[] = await Subscription.find({ slug: { $in: slugs } });

    let enrollIdDuration: { [key: string]: number } = {};
    const line_items: ILineItem[] = [];

    for (const subscription of subscriptions) {
      const enrollSubscription: any = await EnrollSubscription.create({
        retailerId: req.user._id,
        planSnapshot: subscription,
        paymentStatus: "pending",
      });

      enrollIdDuration[enrollSubscription._id] = subscription.duration;

      line_items.push({
        price_data: {
          currency: "cad",
          product_data: {
            name: subscription.title,
          },
          unit_amount: Math.ceil(subscription.price * 100),
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      line_items,
      mode: "payment",
      metadata: enrollIdDuration,
      success_url: `${process.env.BACKEND_URL}/payment/complete?session_id={CHECKOUT_SESSION_ID}&stripe_success_token=${process.env.STRIPE_SUCCESS_TOKEN}`,
      cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
    });

    // return res.redirect(session?.url);

    return apiResponse(res, 200, true, "Send to Payment Page!", { url: session?.url });
  }
  throw "Only one subscription and no duplicate addons are allowed!";
});

/**
 * Success Enroll Subscription
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const successEnrollSubscription = asyncHandler(async (req: IApiRequest, res: Response) => {
  if (req.query.stripe_success_token === process.env.STRIPE_SUCCESS_TOKEN && req?.query?.session_id) {
    const payment: IEnrollPayment = await stripe.checkout.sessions.retrieve(String(req.query.session_id), {
      expand: ["payment_intent.payment_method"],
    });

    let subscriptionIds = [];
    let updateSubscriptions = [];

    if (payment.payment_intent.status === "succeeded") {
      for (let key in payment.metadata) {
        const now = moment();
        const expireDate = moment().add(payment.metadata[key], "days");
        subscriptionIds.push(key);

        updateSubscriptions.push(
          EnrollSubscription.findByIdAndUpdate(key, {
            paymentStatus: "completed",
            validityFrom: now,
            validityTo: expireDate,
          })
        );
      }

      Promise.all(updateSubscriptions);

      EnrollPayment.create({
        enrollSubscriptionId: subscriptionIds,
        paymentId: payment.id,
        paymentIntentId: payment.payment_intent.id,
        paymentStatus: payment.payment_intent.status,
        amountTotal: payment.amount_total,
      });

      return res.redirect(`${process.env.FRONTEND_URL}/payment/complete`);
    }
    throw "Something went wrong in payment!";
  } else {
    throw "Something went wrong in payment!";
  }
});
