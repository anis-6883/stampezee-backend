import { Response } from "express";
import Stripe from "stripe";
import { PACKAGES } from "../../configs/constants";
import { apiResponse, asyncHandler, checkCombination, checkDuplicates } from "../../helpers";
import { IApiRequest } from "../../types";
import Subscription from "../subscription/model";
import Retailer from "../user/retailer/model";
import EnrollSubscription from "./model";
import { enrollSubscriptionSchema } from "./validation";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Get Active Subscription Plans
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllSubscriptions = asyncHandler(async (req: IApiRequest, res: Response) => {
  const subscriptions = await Subscription.find(
    { softDeleted: false, type: "subscription" },
    { softDeleted: 0, type: 0, createdAt: 0, updatedAt: 0 }
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
        Promise.all([
          EnrollSubscription.create({ retailerId: req.user._id, planSnapshot: [subscription], paymentStatus: "trial" }),
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
    const subscriptions = await Subscription.find({ slug: { $in: slugs } });
    console.log(slugs);
    console.log(subscriptions);

    const line_items = [];

    subscriptions.forEach((subscription) => {
      console.log("Title: ", subscription.title);
    });

    // const session = await stripe.checkout.sessions.create({
    //   line_items: [
    //     {
    //       price_data: {
    //         currency: "cad",
    //         product_data: {
    //           name: "Basic Plan",
    //         },
    //         unit_amount: 9.99 * 100,
    //       },
    //       quantity: 1,
    //     },
    //   ],
    //   mode: "payment",
    //   success_url: `${process.env.BACKEND_URL}/payment/complete?session_id={CHECKOUT_SESSION_ID}&stripe_success_token=${process.env.STRIPE_SUCCESS_TOKEN}`,
    //   cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
    // });

    // res.redirect(session?.url);

    return apiResponse(res, 200, true, "Subscriptions!", subscriptions);
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
  if (req.query.stripe_success_token === process.env.STRIPE_SUCCESS_TOKEN) {
    // @ts-ignore
    const payment = await stripe.checkout.sessions.retrieve(req.query.session_id, {
      expand: ["payment_intent.payment_method"],
    });

    console.log("Payment: ", payment);

    return res.redirect(`${process.env.FRONTEND_URL}/payment/complete`);
  } else {
    return apiResponse(res, 400, false, "Invalid Request!");
  }
});
