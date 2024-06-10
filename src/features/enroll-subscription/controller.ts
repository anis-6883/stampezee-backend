import { Response } from "express";
import Stripe from "stripe";
import { apiResponse, asyncHandler } from "../../helpers";
import { IApiRequest } from "../../types";
import Subscription from "../subscription/model";

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
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: "cad",
          product_data: {
            name: "Basic Plan",
          },
          unit_amount: 9.99 * 100,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${process.env.BACKEND_URL}/payment/complete?session_id={CHECKOUT_SESSION_ID}&stripe_success_token=${process.env.STRIPE_SUCCESS_TOKEN}`,
    cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
  });

  // res.redirect(session?.url);
  return apiResponse(res, 200, true, "Checkout Page Successful!", session?.url);
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
