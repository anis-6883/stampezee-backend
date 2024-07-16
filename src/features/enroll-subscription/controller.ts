import { Request, Response } from "express";
import moment from "moment";
import Stripe from "stripe";
import { PACKAGES } from "../../configs/constants";
import {
  apiResponse,
  asyncHandler,
  calculateBalanceAmount,
  checkCombination,
  checkDuplicates,
  checkPlanChange,
} from "../../helpers";
import { IApiRequest, IEnrollPayment, ILineItem } from "../../types";
import Branch from "../branch/model";
import Coupon from "../coupon/model";
import Payment from "../payment/model";
import Refund from "../refund/model";
import Settings from "../settings/model";
import Subscription from "../subscription/model";
import Retailer from "../user/retailer/model";
import EnrollSubscription from "./model";
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
      _id: 1,
      title: 1,
      discountType: 1,
      discount: 1,
      minPurchaseAmount: 1,
      limit: 1,
    }
  );

  if (!coupon) throw "Provide invalid coupon code!";

  const alreadyApplied = await EnrollSubscription.find({
    retailerId: req.user._id,
    "couponSnapshot._id": coupon._id,
  }).countDocuments();

  if (alreadyApplied >= coupon.limit) {
    throw "Your coupon limit is over!";
  }

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

  if ((slugs.includes(PACKAGES.TRIAL) && slugs.length > 1) || (slugs.includes(PACKAGES.TRIAL) && code)) {
    throw "You can't take additional packages or coupon in free trial!";
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
            enrollStatus: "trial",
          }),
          Retailer.findByIdAndUpdate(req.user._id, { takeFreeTrial: true }),
        ]);
        return apiResponse(res, 200, true, "Free trial enrolled successfully!", {
          takeFreeTrial: true,
          plan: "trial",
          planStartAt: now,
          planValidAt: expireDate,
          totalBranch: 1,
        });
      }
      throw "Free trial package not found!";
    }
    throw "Free trial already taken!";
  }

  // Get payment metadata
  const paymentMetadata = await Settings.findOne(
    {},
    {
      "stripe.planChangeCost": 1,
      "stripe.refundableThreshold": 1,
      "stripe.taxTitle": 1,
      "stripe.taxCost": 1,
      "stripe.taxStatus": 1,
    }
  );

  if (!paymentMetadata) {
    throw "Setup payment cost threshold!";
  }

  const { planChangeCost, refundableThreshold, taxTitle, taxCost, taxStatus } = paymentMetadata.stripe;

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

    const alreadyApplied = await EnrollSubscription.find({
      retailerId: req.user._id,
      "couponSnapshot._id": coupon._id,
      paymentStatus: "completed",
    }).countDocuments();

    if (alreadyApplied >= coupon.limit) {
      throw "Your coupon limit is over!";
    }

    if (!coupon) throw "Provide invalid coupon code!";
  }

  // Enroll Paid Subscription
  if (checkCombination(slugs, [PACKAGES.BASIC, PACKAGES.PRO, PACKAGES.ADVANCED]) && checkDuplicates(slugs)) {
    const subscriptions: any[] = await Subscription.find({ slug: { $in: slugs } });
    const pickPlan = subscriptions.find((subs) => subs.type === "subscription");

    // Check Already enrolled or not
    const enrolled = await EnrollSubscription.findOne({
      retailerId: req.user._id,
      "planSnapshot.type": "subscription",
      paymentStatus: "completed",
      validityTo: { $gt: moment() },
      status: true,
    });

    if (enrolled && slugs.includes(enrolled.planSnapshot.slug)) {
      throw `You already take ${enrolled.planSnapshot.title} plan!`;
    }

    ////////////////////////////////////////////////////////////////////////
    //////// Decision -> (Upgrade or Downgrade) or New Subscription ////////
    ////////////////////////////////////////////////////////////////////////

    const enrollIdDuration: { [key: string]: number } = {};
    const line_items: ILineItem[] = [];
    let totalAmount = 0;
    let unitAmount = 0;

    if (pickPlan && enrolled) {
      const changeMode = checkPlanChange(
        [PACKAGES.BASIC, PACKAGES.PRO, PACKAGES.ADVANCED],
        enrolled.planSnapshot.slug,
        pickPlan?.slug
      );

      const balanceAmount = calculateBalanceAmount(
        enrolled.validityFrom,
        enrolled.validityTo,
        enrolled.planSnapshot.price
      );

      console.log("Change Mode: ", changeMode > 0 ? "Upgrade" : "Downgrade");

      // Plan Upgrade
      if (changeMode > 0) {
        for (const subscription of subscriptions) {
          let planCurrentPrice = 0;
          let enrollStatus = "upgrade";

          if ([PACKAGES.BASIC, PACKAGES.PRO, PACKAGES.ADVANCED].includes(subscription.slug)) {
            planCurrentPrice = parseFloat(Number(subscription.price - balanceAmount).toFixed(2));
            enrollStatus = "upgrade";
          } else {
            planCurrentPrice = parseFloat(Number(subscription.price).toFixed(2));
            enrollStatus = "purchase";
          }

          const enrollSubscription: any = await EnrollSubscription.create({
            retailerId: req.user._id,
            planSnapshot: subscription,
            couponSnapshot: coupon,
            taxSnapshot: {
              taxTitle: taxStatus === "on" ? taxTitle : null,
              taxCost: taxStatus === "on" ? taxCost : null,
            },
            balanceInfo: {
              currentBalance: balanceAmount,
              planCurrentPrice,
            },
            planChangeCost,
            paymentStatus: "pending",
            enrollStatus,
            status: false,
          });

          enrollIdDuration[enrollSubscription._id] = subscription.duration;

          if ([PACKAGES.BASIC, PACKAGES.PRO, PACKAGES.ADVANCED].includes(subscription.slug)) {
            totalAmount += Number(subscription.price - balanceAmount);
            unitAmount = Math.round(Number(subscription.price - balanceAmount) * 100);
          } else {
            totalAmount += Number(subscription.price);
            unitAmount = Math.round(Number(subscription.price) * 100);
          }

          line_items.push({
            price_data: {
              currency: "cad",
              product_data: {
                name: subscription.title,
              },
              unit_amount: unitAmount,
            },
            quantity: 1,
          });
        }
      }

      // Plan Downgrade
      if (changeMode < 0) {
        const downgradeBranchLimit = pickPlan?.allowTotalBranch;
        const branches = await Branch.find({ retailerId: req.user._id, source: "subscription" });
        const activeBranch = branches.filter((branch) => branch.status).length;

        if (branches.length > downgradeBranchLimit && activeBranch > downgradeBranchLimit) {
          throw `You have to inactive ${activeBranch - downgradeBranchLimit} subscription branch/s before downgrade!`;
        }

        for (const subscription of subscriptions) {
          if ([PACKAGES.BASIC, PACKAGES.PRO, PACKAGES.ADVANCED].includes(subscription.slug)) {
            totalAmount += Number(subscription.price - balanceAmount);
          } else {
            totalAmount += Number(subscription.price); // Add-on
          }
        }

        console.log({ totalAmount });

        // const expireDate = moment().add(pickPlan.duration, "days");

        // Decision 1: Refund & Downgrade
        if (totalAmount < 0) {
          const isRefunded = Math.abs(totalAmount + planChangeCost) >= refundableThreshold;
          let enrollSubscriptionId;

          for (const subscription of subscriptions) {
            const enrollSubscription = await EnrollSubscription.create({
              retailerId: req.user._id,
              planSnapshot: subscription,
              paymentStatus: "completed",
              enrollStatus: subscription.type === "addon" ? "purchase" : "downgrade",
              validityFrom: moment(),
              validityTo: moment().add(subscription.duration, "days"),
              balanceInfo: {
                currentBalance: balanceAmount,
                planCurrentPrice:
                  subscription.type === "addon" ? subscription.price : subscription.price - balanceAmount,
              },
              refundAmount:
                subscription.type === "addon" ? 0 : parseFloat(Math.abs(totalAmount + planChangeCost).toFixed(2)),
              status: true,
              planChangeCost,
            });

            if (subscription.type === "subscription") {
              enrollSubscriptionId = enrollSubscription._id;
            }
          }

          const updateQueries: any = [
            Branch.updateMany(
              { retailerId: req.user._id, source: "subscription", status: false },
              { disabledBySystem: true }
            ),
            EnrollSubscription.updateOne({ _id: enrolled._id }, { status: false }),
          ];

          if (isRefunded) {
            updateQueries.push(
              Refund.create({
                enrollSubscriptionId,
                refundAmount: parseFloat(Math.abs(totalAmount + planChangeCost).toFixed(2)),
                refundStatus: "pending",
              })
            );
          }

          await Promise.all(updateQueries);

          return apiResponse(res, 200, true, `Your plan successfully downgraded!`, {
            plan: pickPlan?.slug,
            planStartAt: moment(),
            planValidAt: moment().add(pickPlan.duration, "days"),
            totalBranch: pickPlan?.allowTotalBranch,
          });
        }
        // Decision 2: Payment & Downgrade or Not Now
        else if (totalAmount > 0) {
          console.log("Working...");

          let togetherPaymentAmount = 0;
          const planCurrentPrice = parseFloat(Number(pickPlan.price - balanceAmount).toFixed(2)); // This amount can be negative!

          for (const subscription of subscriptions) {
            if ([PACKAGES.BASIC, PACKAGES.PRO, PACKAGES.ADVANCED].includes(subscription.slug)) {
              // Decision: Stripe Entry or Not
              if (planCurrentPrice < 0) {
                await EnrollSubscription.create({
                  retailerId: req.user._id,
                  planSnapshot: pickPlan,
                  paymentStatus: "completed",
                  enrollStatus: "downgrade",
                  validityFrom: moment(),
                  validityTo: moment().add(pickPlan.duration, "days"),
                  balanceInfo: {
                    currentBalance: balanceAmount,
                    planCurrentPrice: totalAmount,
                  },
                  status: true,
                });
              } else {
                const enrollSubscription: any = await EnrollSubscription.create({
                  retailerId: req.user._id,
                  planSnapshot: subscription,
                  couponSnapshot: coupon,
                  taxSnapshot: {
                    taxTitle: taxStatus === "on" ? taxTitle : null,
                    taxCost: taxStatus === "on" ? taxCost : null,
                  },
                  paymentStatus: "pending",
                  enrollStatus: "downgrade",
                  status: false,
                });

                enrollIdDuration[enrollSubscription._id] = subscription.duration;

                togetherPaymentAmount += planCurrentPrice;
              }
            } else {
              const enrollSubscription: any = await EnrollSubscription.create({
                retailerId: req.user._id,
                planSnapshot: subscription,
                couponSnapshot: coupon,
                taxSnapshot: {
                  taxTitle: taxStatus === "on" ? taxTitle : null,
                  taxCost: taxStatus === "on" ? taxCost : null,
                },
                balanceInfo: {
                  currentBalance: balanceAmount,
                  planCurrentPrice: subscription.price,
                },
                planChangeCost,
                paymentStatus: "pending",
                enrollStatus: "purchase",
                status: false,
              });

              enrollIdDuration[enrollSubscription._id] = subscription.duration;

              togetherPaymentAmount += subscription.price;
            }
          }

          if (planCurrentPrice < 0) {
            togetherPaymentAmount -= Math.abs(planCurrentPrice);
          }

          // Plan & Ad-ons Al-together cause (-) value is not allow in stripe
          line_items.push({
            price_data: {
              currency: "cad",
              product_data: {
                name: `${pickPlan.title} Plan & Ad-ons`,
              },
              unit_amount: Math.round(togetherPaymentAmount * 100),
            },
            quantity: 1,
          });
        }
        ////// if totalAmount === 0 //////
        else {
          await Promise.all([
            Branch.updateMany(
              { retailerId: req.user._id, source: "subscription", status: false },
              { disabledBySystem: true }
            ),
            EnrollSubscription.updateOne({ _id: enrolled._id }, { status: false }),
            EnrollSubscription.create({
              retailerId: req.user._id,
              planSnapshot: pickPlan,
              paymentStatus: "completed",
              enrollStatus: "downgrade",
              validityFrom: moment(),
              validityTo: moment().add(pickPlan.duration, "days"),
              balanceInfo: {
                currentBalance: balanceAmount,
                planCurrentPrice: 0,
              },
            }),
          ]);

          return apiResponse(res, 200, true, `Your plan successfully downgraded!`);
        }
      }

      // Add Plan Change Cost
      line_items.push({
        price_data: {
          currency: "cad",
          product_data: {
            name: `Plan Change Cost`,
          },
          unit_amount: Math.round(Number(planChangeCost) * 100), // convert into cent
        },
        quantity: 1,
      });
    } else {
      for (const subscription of subscriptions) {
        const enrollSubscription: any = await EnrollSubscription.create({
          retailerId: req.user._id,
          planSnapshot: subscription,
          couponSnapshot: coupon,
          taxSnapshot: {
            taxTitle: taxStatus === "on" ? taxTitle : null,
            taxCost: taxStatus === "on" ? taxCost : null,
          },
          paymentStatus: "pending",
          enrollStatus: "purchase",
          status: false,
        });

        enrollIdDuration[enrollSubscription._id] = subscription.duration;
        totalAmount += Number(subscription.price);

        line_items.push({
          price_data: {
            currency: "cad",
            product_data: {
              name: subscription.title,
            },
            unit_amount: Math.round(Number(subscription.price) * 100), // convert into cent
          },
          quantity: 1,
        });
      }
    }

    // Add Tax in (%)
    if (taxStatus === "on") {
      line_items.push({
        price_data: {
          currency: "cad",
          product_data: {
            name: `${taxTitle} (${taxCost}%)`,
          },
          unit_amount: Math.round(((Number(totalAmount) * taxCost) / 100) * 100), // convert into cent
        },
        quantity: 1,
      });
    }

    const discounts: any[] = [];

    // Attach coupon in the checkout if it has
    if (coupon) {
      let stripeCoupon = null;

      if (totalAmount + (Number(totalAmount) * taxCost) / 100 < coupon.minPurchaseAmount) {
        throw `Min. ${coupon.minPurchaseAmount}CAD required to apply coupon!`;
      }

      if (coupon.discountType === "percentage") {
        stripeCoupon = await stripe.coupons.create({
          percent_off: coupon.discount,
          duration: "once",
        });
      } else {
        stripeCoupon = await stripe.coupons.create({
          amount_off: coupon.discount * 100, // convert into cent
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
      success_url: `${process.env.BACKEND_URL}/payment/complete?session_id={CHECKOUT_SESSION_ID}&stripe_success_token=${process.env.STRIPE_SUCCESS_TOKEN}&_id=${req.user._id}&takeFreeTrial=${req.user.takeFreeTrial}&pickPlan=${!!pickPlan}&enrolled=${!!enrolled}`,
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
          enrollStatus: "trial",
          validityFrom: moment(),
          validityTo: moment(),
          status: false,
        }),
        Retailer.findByIdAndUpdate(req.query._id, { takeFreeTrial: true }),
      ]);
    }

    let subscriptionIds = [];
    let updateSubscriptions = [];

    // Deactivate last previous active plan
    if (req.query.pickPlan === "true" && (req.query.takeFreeTrial === "true" || req.query.enrolled === "true")) {
      await EnrollSubscription.updateOne(
        {
          retailerId: req.query._id,
          "planSnapshot.type": "subscription",
          paymentStatus: { $in: ["completed", "trial"] },
          status: true,
        },
        { status: false }
      );
    }

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
            status: true,
          })
        );
      }

      // Store Payment Info
      updateSubscriptions.push(
        Payment.create({
          retailerId: req.query._id,
          enrollSubscriptionId: subscriptionIds,
          paymentId: payment.id,
          paymentIntentId: payment.payment_intent.id,
          paymentStatus: payment.payment_intent.status,
          amountTotal: payment.amount_total,
        })
      );

      await Promise.all(updateSubscriptions);

      return res.redirect(`${process.env.FRONTEND_URL}/payment/complete`);
    }
  } else {
    throw "Something went wrong in payment!";
  }
});
