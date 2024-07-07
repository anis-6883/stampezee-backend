import { Request, Response } from "express";
import moment from "moment";
import Stripe from "stripe";
import { PACKAGES } from "../../configs/constants";
import { apiResponse, asyncHandler, checkCombination, checkDuplicates } from "../../helpers";
import { IApiRequest, IEnrollPayment, ILineItem } from "../../types";
import Coupon from "../coupon/model";
import Subscription from "../subscription/model";
import Retailer from "../user/retailer/model";
import { EnrollPayment, EnrollSubscription } from "./model";
import { couponSchema, enrollSubscriptionSchema } from "./validation";

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
 * Check Coupon Validity
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const couponValidityCheck = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await couponSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { code } = result || {};

  const coupon = await Coupon.findOne(
    {
      code,
      startedAt: { $lte: new Date() },
      expiredAt: { $gte: new Date() },
      status: true,
      softDeleted: false,
    },
    {
      _id: 0,
      title: 1,
      discountType: 1,
      discount: 1,
    }
  );

  if (!coupon) throw "Provide invalid coupon code!";

  return apiResponse(res, 200, true, "Coupon applied!", coupon);
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

  const { slugs, code }: { slugs: string[]; code: string } = result;

  if (slugs.includes(PACKAGES.TRIAL) && slugs.length > 1) {
    throw "Trial packages do not include any additional packages!";
  }

  // Enroll Free Trial
  if (slugs.includes(PACKAGES.TRIAL)) {
    if (!req.user.takeFreeTrial) {
      const subscription = await Subscription.findOne({ slug: "trial" });

      if (subscription) {
        const now = moment();
        const expireDate = moment().add(subscription.duration, "days");

        Promise.all([
          EnrollSubscription.create({
            retailerId: req.user._id,
            planSnapshot: subscription,
            paymentStatus: "trial",
            validityFrom: now,
            validityTo: expireDate,
          }),
          Retailer.findByIdAndUpdate(req.user._id, { takeFreeTrial: true }),
        ]);
        return apiResponse(res, 200, true, "Free trial enrolled successfully!", {
          takeFreeTrial: true,
          plan: "trial",
          planValidAt: expireDate,
        });
      }
      throw "Free trial package not found!";
    }
    throw "Free trial already taken!";
  }

  // Check & Get Coupon
  let coupon = null;
  if (code) {
    coupon = await Coupon.findOne({
      code,
      startedAt: { $lte: new Date() },
      expiredAt: { $gte: new Date() },
      status: true,
      softDeleted: false,
    });

    if (!coupon) throw "Provide invalid coupon code!";
  }

  // Enroll Paid Subscription
  if (checkCombination(slugs, [PACKAGES.BASIC, PACKAGES.PRO, PACKAGES.ADVANCED]) && checkDuplicates(slugs)) {
    const subscriptions: any[] = await Subscription.find({ slug: { $in: slugs } });

    const enrolled = await EnrollSubscription.findOne({
      retailerId: req.user._id,
      "planSnapshot.type": "subscription",
      paymentStatus: { $in: ["completed"] },
      validityTo: { $gt: moment() },
    }).sort({ createdAt: "desc" });

    if (enrolled && slugs.includes(enrolled.planSnapshot.slug)) {
      throw `You already take ${enrolled.planSnapshot.title} plan!`;
    }

    let enrollIdDuration: { [key: string]: number } = {};
    const line_items: ILineItem[] = [];

    for (const subscription of subscriptions) {
      const enrollSubscription: any = await EnrollSubscription.create({
        retailerId: req.user._id,
        planSnapshot: subscription,
        couponSnapshot: coupon,
        paymentStatus: "pending",
      });

      enrollIdDuration[enrollSubscription._id] = subscription.duration;

      line_items.push({
        price_data: {
          currency: "cad",
          product_data: {
            name: subscription.title,
          },
          unit_amount: Math.ceil(subscription.price * 100), // convert into cent
        },
        quantity: 1,
      });
    }

    const discounts: any[] = [];

    // Attach coupon in the checkout if it has
    if (coupon) {
      let stripeCoupon = null;

      if (coupon.discountType === "percentage") {
        stripeCoupon = await stripe.coupons.create({
          percent_off: coupon.discount,
          duration: "once",
        });
      } else {
        stripeCoupon = await stripe.coupons.create({
          amount_off: Math.ceil(coupon.discount * 100), // convert into cent
          duration: "once",
          currency: "cad",
        });
      }

      discounts.push({
        coupon: stripeCoupon.id,
      });
    }

    const session = await stripe.checkout.sessions.create({
      line_items,
      mode: "payment",
      discounts,
      metadata: enrollIdDuration,
      success_url: `${process.env.BACKEND_URL}/payment/complete?session_id={CHECKOUT_SESSION_ID}&stripe_success_token=${process.env.STRIPE_SUCCESS_TOKEN}&_id=${req.user._id}&takeFreeTrial=${req.user.takeFreeTrial}`,
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
export const successEnrollSubscription = asyncHandler(async (req: Request, res: Response) => {
  if (req.query.stripe_success_token === process.env.STRIPE_SUCCESS_TOKEN && req?.query?.session_id) {
    const payment: IEnrollPayment = await stripe.checkout.sessions.retrieve(String(req.query.session_id), {
      expand: ["payment_intent.payment_method"],
    });

    // If a user takes a plan without taking the free trial, then the free trial isn't applicable anymore
    if (req.query._id && req.query.takeFreeTrial && req.query.takeFreeTrial === "false") {
      const subscription = await Subscription.findOne({ slug: "trial" });
      Promise.all([
        EnrollSubscription.create({
          retailerId: req.query._id,
          planSnapshot: subscription,
          paymentStatus: "trial",
          validityFrom: moment(),
          validityTo: moment(),
        }),
        Retailer.findByIdAndUpdate(req.query._id, { takeFreeTrial: true }),
      ]);
    }

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
