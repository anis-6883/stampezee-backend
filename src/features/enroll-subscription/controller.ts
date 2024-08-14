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

  const alreadyApplied = await EnrollSubscription.countDocuments({
    retailerId: req.user._id,
    "couponSnapshot._id": coupon._id,
    paymentStatus: "completed",
  });

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

  const { slugs, code, branchIds }: { slugs: string[]; branchIds: string[]; code: string } = result;

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
      "stripe.stripeSecretKey": 1,
    }
  );

  if (!paymentMetadata) throw "Something went wrong in Stripe settings!";

  const { stripeSecretKey, planChangeCost, refundableThreshold, taxTitle, taxCost, taxStatus } = paymentMetadata.stripe;
  const stripe = new Stripe(stripeSecretKey);

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

    if (alreadyApplied >= coupon.limit) throw "Your coupon limit is over!";
    if (!coupon) throw "Provide invalid coupon code!";
  }

  // Plan Enroll ID - Need for updating branch expiration
  let planEnrollmentId;

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

    if (pickPlan && enrolled) {
      const changeMode = checkPlanChange(
        [PACKAGES.BASIC, PACKAGES.PRO, PACKAGES.ADVANCED],
        enrolled.planSnapshot.slug,
        pickPlan?.slug
      );

      const balanceAmount = calculateBalanceAmount(
        enrolled.validityFrom,
        enrolled.validityTo,
        enrolled.balanceInfo.planCurrentPrice
      );

      ////////////////////////////////
      //////// Plan Upgrade /////////
      ///////////////////////////////
      if (changeMode > 0) {
        for (const subscription of subscriptions) {
          if (subscription.type === "subscription") {
            let finalPrice = subscription.price - balanceAmount;

            // If add Coupon, it will attach only in plan!
            if (coupon) {
              if (finalPrice < coupon.minPurchaseAmount) {
                throw `Min. ${coupon.minPurchaseAmount}CAD required to apply coupon!`;
              }

              if (coupon.discountType === "percentage") {
                finalPrice -= Number((subscription.price * coupon.discount) / 100);
              } else {
                finalPrice -= coupon.discount;
              }
            }

            const enrollSubscription: any = await EnrollSubscription.create({
              retailerId: req.user._id,
              planSnapshot: subscription,
              couponSnapshot: coupon ?? null,
              taxSnapshot: {
                taxTitle: taxStatus === "on" ? taxTitle : null,
                taxCost: taxStatus === "on" ? taxCost : null,
              },
              balanceInfo: {
                currentBalance: balanceAmount,
                planCurrentPrice: coupon
                  ? subscription.price - Number((subscription.price * coupon.discount) / 100)
                  : subscription.price,
              },
              planChangeCost,
              paymentStatus: "pending",
              enrollStatus: "upgrade",
              status: false,
            });

            totalAmount += finalPrice;
            enrollIdDuration[enrollSubscription._id] = subscription.duration;
            planEnrollmentId = enrollSubscription._id;
            const couponPackageName = `${subscription.title} (-${coupon?.discount}${coupon?.discountType === "percentage" ? "%" : "CAD"})`;

            line_items.push({
              price_data: {
                currency: "cad",
                product_data: {
                  name: coupon ? couponPackageName : subscription.title,
                },
                unit_amount: Math.round(Number(finalPrice) * 100), // convert into cent,
              },
              quantity: 1,
            });
          } else {
            const enrollSubscription: any = await EnrollSubscription.create({
              retailerId: req.user._id,
              planSnapshot: subscription,
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
      }

      ////////////////////////////////
      //////// Plan Downgrade ///////
      ///////////////////////////////
      if (changeMode < 0) {
        const downgradeBranchLimit = pickPlan?.allowTotalBranch;
        const branches = await Branch.find({ retailerId: req.user._id, source: "subscription", softDeleted: false });
        const disabledBySystemBranch = branches.filter((branch) => !branch.disabledBySystem).length;

        if (branches.length > downgradeBranchLimit && disabledBySystemBranch > downgradeBranchLimit) {
          if (!branchIds) throw "branchIds field is required!";

          if (branchIds && branchIds.length !== disabledBySystemBranch - downgradeBranchLimit) {
            throw `You have to inactive ${disabledBySystemBranch - downgradeBranchLimit} subscription branch/s before downgrade!`;
          }

          if (branchIds && branchIds.length >= disabledBySystemBranch - downgradeBranchLimit) {
            await Branch.updateMany(
              { retailerId: req.user._id, _id: { $in: branchIds } },
              { disabledBySystem: true, status: false }
            );
          }
        }

        for (const subscription of subscriptions) {
          if (subscription.type === "subscription") {
            totalAmount += Number(subscription.price - balanceAmount);
          } else {
            totalAmount += Number(subscription.price); // Add-on
          }
        }

        // Decision 1: Refund & Downgrade
        if (totalAmount < 0) {
          const isRefunded = Math.abs(totalAmount + planChangeCost) >= refundableThreshold;
          let enrollSubscriptionId;

          for (const subscription of subscriptions) {
            if (subscription.type === "subscription") {
              // If add Coupon, it will attach only in plan!
              if (coupon) {
                if (subscription.price < coupon.minPurchaseAmount) {
                  throw `Min. ${coupon.minPurchaseAmount}CAD required to apply coupon!`;
                }

                if (coupon.discountType === "percentage") {
                  totalAmount -= Number((subscription.price * coupon.discount) / 100);
                } else {
                  totalAmount -= coupon.discount;
                }
              }

              const enrollSubscription = await EnrollSubscription.create({
                retailerId: req.user._id,
                planSnapshot: subscription,
                paymentStatus: "completed",
                enrollStatus: "downgrade",
                validityFrom: moment(),
                validityTo: moment().add(subscription.duration, "days"),
                balanceInfo: {
                  currentBalance: balanceAmount,
                  planCurrentPrice: coupon
                    ? subscription.price - Number((subscription.price * coupon.discount) / 100)
                    : subscription.price,
                },
                refundAmount: Math.abs(totalAmount) - planChangeCost,
                status: true,
                planChangeCost,
              });

              enrollSubscriptionId = enrollSubscription._id;
              planEnrollmentId = enrollSubscription._id;
            } else {
              await EnrollSubscription.create({
                retailerId: req.user._id,
                planSnapshot: subscription,
                paymentStatus: "completed",
                enrollStatus: "purchase",
                validityFrom: moment(),
                validityTo: moment().add(subscription.duration, "days"),
                status: true,
              });
            }
          }

          const updateQueries: any = [
            Branch.updateMany({ retailerId: req.user._id, source: "subscription" }, { enrollSubscriptionId }),
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
        // Decision 2: Payment & Downgrade or Not Now - (Add More)
        else if (totalAmount > 0) {
          let togetherPaymentAmount = 0;
          const planCurrentPrice = parseFloat(Number(pickPlan.price - balanceAmount).toFixed(2)); // This amount can be negative!

          for (const subscription of subscriptions) {
            if (subscription.type === "subscription") {
              // Decision: Stripe Entry or Not
              if (planCurrentPrice < 0) {
                if (coupon) {
                  togetherPaymentAmount -= Number((subscription.price * coupon.discount) / 100);
                }

                const enrollSubscription: any = await EnrollSubscription.create({
                  retailerId: req.user._id,
                  planSnapshot: pickPlan,
                  paymentStatus: "completed",
                  enrollStatus: "downgrade",
                  validityFrom: moment(),
                  validityTo: moment().add(pickPlan.duration, "days"),
                  balanceInfo: {
                    currentBalance: balanceAmount,
                    planCurrentPrice: coupon
                      ? subscription.price - Number((subscription.price * coupon.discount) / 100)
                      : subscription.price,
                  },
                  status: false,
                });

                planEnrollmentId = enrollSubscription._id;
                enrollIdDuration[enrollSubscription._id] = subscription.duration;
              } else {
                let finalPrice = planCurrentPrice;
                // If add Coupon, it will attach only in plan!
                if (coupon) {
                  if (planCurrentPrice < coupon.minPurchaseAmount) {
                    throw `Min. ${coupon.minPurchaseAmount}CAD required to apply coupon!`;
                  }

                  if (coupon.discountType === "percentage") {
                    finalPrice = Number(subscription.price - (subscription.price * coupon.discount) / 100);
                    togetherPaymentAmount -= finalPrice;
                  } else {
                    finalPrice = subscription.price - coupon.discount;
                    togetherPaymentAmount -= finalPrice;
                  }
                }

                const enrollSubscription: any = await EnrollSubscription.create({
                  retailerId: req.user._id,
                  planSnapshot: subscription,
                  couponSnapshot: coupon,
                  taxSnapshot: {
                    taxTitle: taxStatus === "on" ? taxTitle : null,
                    taxCost: taxStatus === "on" ? taxCost : null,
                  },
                  planChangeCost,
                  balanceInfo: {
                    currentBalance: balanceAmount,
                    planCurrentPrice: finalPrice, // coupon discount any apply in plan
                  },
                  paymentStatus: "pending",
                  enrollStatus: "downgrade",
                  status: false,
                });

                planEnrollmentId = enrollSubscription._id;
                enrollIdDuration[enrollSubscription._id] = subscription.duration;

                togetherPaymentAmount += pickPlan.price;
              }
            } else {
              // Take Ad-ons with downgrade
              const enrollSubscription: any = await EnrollSubscription.create({
                retailerId: req.user._id,
                planSnapshot: subscription,
                taxSnapshot: {
                  taxTitle: taxStatus === "on" ? taxTitle : null,
                  taxCost: taxStatus === "on" ? taxCost : null,
                },
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

          // Plan & Ad-ons Al-together cause (-) value is not allow to show in stripe
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
        ////// if totalAmount === 0 ////// (Rare Case)
        else {
          const enrollSubscription = await EnrollSubscription.create({
            retailerId: req.user._id,
            planSnapshot: pickPlan,
            paymentStatus: "completed",
            enrollStatus: "downgrade",
            validityFrom: moment(),
            validityTo: moment().add(pickPlan.duration, "days"),
            balanceInfo: {
              currentBalance: balanceAmount,
              planCurrentPrice: coupon
                ? pickPlan.price - Number((pickPlan.price * coupon.discount) / 100)
                : pickPlan.price,
            },
          });

          await Promise.all([
            Branch.updateMany(
              { retailerId: req.user._id, source: "subscription" },
              { enrollSubscriptionId: enrollSubscription._id }
            ),
            EnrollSubscription.updateOne({ _id: enrolled._id }, { status: false }),
          ]);

          planEnrollmentId = enrollSubscription._id;

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
      ///////////////////////////////////
      //////// New Subscription /////////
      ///////////////////////////////////
      for (const subscription of subscriptions) {
        if (subscription.type === "subscription") {
          let finalPrice = subscription.price;

          // If add Coupon, it will attach only in plan!
          if (coupon) {
            if (subscription.price < coupon.minPurchaseAmount) {
              throw `Min. ${coupon.minPurchaseAmount}CAD required to apply coupon!`;
            }

            if (coupon.discountType === "percentage") {
              finalPrice = Number(subscription.price - (subscription.price * coupon.discount) / 100);
            } else {
              finalPrice = subscription.price - coupon.discount;
            }
          }

          const enrollSubscription: any = await EnrollSubscription.create({
            retailerId: req.user._id,
            planSnapshot: subscription,
            couponSnapshot: coupon ?? null,
            taxSnapshot: {
              taxTitle: taxStatus === "on" ? taxTitle : null,
              taxCost: taxStatus === "on" ? taxCost : null,
            },
            balanceInfo: {
              planCurrentPrice: finalPrice,
            },
            paymentStatus: "pending",
            enrollStatus: "purchase",
            status: false,
          });

          planEnrollmentId = enrollSubscription._id;
          enrollIdDuration[enrollSubscription._id] = subscription.duration;
          totalAmount += finalPrice;

          const couponPackageName = `${subscription.title} (-${coupon?.discount}${coupon?.discountType === "percentage" ? "%" : "CAD"})`;

          line_items.push({
            price_data: {
              currency: "cad",
              product_data: {
                name: coupon ? couponPackageName : subscription.title,
              },
              unit_amount: Math.round(Number(finalPrice) * 100), // convert into cent
            },
            quantity: 1,
          });
        } else {
          const enrollSubscription: any = await EnrollSubscription.create({
            retailerId: req.user._id,
            planSnapshot: subscription,
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
    }

    // Add Tax in (%)
    if (taxStatus === "on") {
      if (coupon) {
        if (coupon.discountType === "percentage") {
          totalAmount += Number((pickPlan.price * coupon.discount) / 100);
        } else {
          totalAmount += coupon.discount;
        }
      }

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

    const session = await stripe.checkout.sessions.create({
      line_items,
      mode: "payment",
      metadata: enrollIdDuration,
      success_url: `${process.env.BACKEND_URL}/payment/complete?session_id={CHECKOUT_SESSION_ID}&stripe_success_token=${process.env.STRIPE_SUCCESS_TOKEN}&_id=${req.user._id}&takeFreeTrial=${req.user.takeFreeTrial}&pickPlan=${!!pickPlan}&enrolled=${!!enrolled}&planEnrollmentId=${planEnrollmentId}`,
      cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
      customer_email: req?.user?.email,
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
    const stripeMetadata = await Settings.findOne({}, { "stripe.stripeSecretKey": 1 });
    const { stripeSecretKey } = stripeMetadata?.stripe || {};

    if (!stripeSecretKey) throw "Something went wrong in Stripe settings!";
    const stripe = new Stripe(stripeSecretKey);

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

      // Update expiration for already created branch
      if (req.query.pickPlan === "true") {
        updateSubscriptions.push(
          Branch.updateMany(
            {
              retailerId: req.query._id,
              source: "subscription",
            },
            { enrollSubscriptionId: req.query.planEnrollmentId }
          )
        );
      }

      await Promise.all(updateSubscriptions);

      return res.redirect(`${process.env.FRONTEND_URL}/payment/complete`);
    } else {
      throw "Something went wrong in payment!";
    }
  } else {
    throw "Something went wrong in payment!";
  }
});
