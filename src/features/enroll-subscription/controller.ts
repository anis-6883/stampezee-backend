import { Request, Response } from "express";
import moment from "moment";
import Stripe from "stripe";
import { PACKAGES } from "../../configs/constants";
import { apiResponse, asyncHandler, calculateBalanceAmount, checkPlanChange } from "../../helpers";
import { IApiRequest, IEnrollSubscriptionBody, ILineItem } from "../../types";
import { IEnrollPayment } from "../../types/index";
import Branch from "../branch/model";
import Coupon from "../coupon/model";
import CurrencyExchange from "../currency-exchange/model";
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

  const { slug, code, branchIds, currency }: IEnrollSubscriptionBody = result;

  if (slug === PACKAGES.TRIAL && code) {
    throw "You can't take additional packages or coupon in free trial!";
  }

  // Enroll Free Trial
  if (slug === PACKAGES.TRIAL) {
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

  // Get Payment Metadata & Allowed Currencies
  const [paymentMetadata, allowCurrencies] = await Promise.all([
    Settings.findOne(
      {},
      {
        "stripe.planChangeCost": 1,
        "stripe.refundableThreshold": 1,
        "stripe.taxTitle": 1,
        "stripe.taxCost": 1,
        "stripe.taxStatus": 1,
        "stripe.stripeSecretKey": 1,
        "stripe.defaultCurrency": 1,
      }
    ),
    CurrencyExchange.find({ status: true }),
  ]);

  const { defaultCurrency, stripeSecretKey, planChangeCost, refundableThreshold, taxTitle, taxCost, taxStatus } =
    paymentMetadata.stripe ?? {};
  const selectCurrency = allowCurrencies.find((curr) => curr.name === currency);
  const baseCurrency = allowCurrencies.find((curr) => curr.name === defaultCurrency.currency);

  if (!paymentMetadata) throw "Something went wrong in Stripe settings!";
  if (!selectCurrency) throw "Provided currency is not allowed!";
  if (!baseCurrency) throw "Base currency is not active!";

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

    if (!coupon) throw "Provide invalid coupon code!";

    const alreadyApplied = await EnrollSubscription.find({
      retailerId: req.user._id,
      "couponSnapshot._id": coupon._id,
      paymentStatus: "completed",
    }).countDocuments();

    if (alreadyApplied >= coupon.limit) throw "Your coupon limit is over!";
  }

  // Enroll Paid Subscription

  const pickSubscriptionPlan = await Subscription.findOne({ slug });
  const isPlan = [PACKAGES.BASIC, PACKAGES.PRO, PACKAGES.ADVANCED].includes(slug);

  // Check Already enrolled or not
  const enrolled = await EnrollSubscription.findOne({
    retailerId: req.user._id,
    "planSnapshot.type": "subscription",
    paymentStatus: "completed",
    validityTo: { $gt: moment() },
    status: true,
  });

  if (enrolled && slug === enrolled.planSnapshot.slug) {
    throw `You already take ${enrolled.planSnapshot.title} plan!`;
  }

  ////////////////////////////////////////////////////////////////////////
  //////// Decision -> (Upgrade or Downgrade) or New Subscription ////////
  ////////////////////////////////////////////////////////////////////////

  const enrollIdDuration: { [key: string]: number | string } = {};
  const line_items: ILineItem[] = [];
  const coupons: { coupon: string }[] = [];
  let totalAmount = 0;

  if (isPlan && enrolled) {
    const changeMode = checkPlanChange(
      [PACKAGES.BASIC, PACKAGES.PRO, PACKAGES.ADVANCED],
      enrolled.planSnapshot.slug,
      pickSubscriptionPlan?.slug
    );

    const balanceAmount = calculateBalanceAmount(
      enrolled.validityFrom,
      enrolled.validityTo,
      enrolled.balanceInfo.planCurrentPrice
    );

    ////////////////////////////////
    //////// Plan Upgrade /////////
    ///////////////////////////////

    // TODO: Different currency payment handle
    if (changeMode > 0) {
      let finalPrice = 0;
      let couponValue = 0;

      finalPrice = Number(
        ((selectCurrency.exchangeRate / baseCurrency.exchangeRate) * pickSubscriptionPlan.price).toFixed(2)
      );

      // Check coupon eligibility & apply
      if (coupon) {
        if (pickSubscriptionPlan.price < coupon.minPurchaseAmount) {
          throw `Min. ${coupon.minPurchaseAmount}*Currency* required to apply coupon!`;
        }

        couponValue = coupon.discountType === "percentage" ? (finalPrice * coupon?.discount) / 100 : coupon?.discount;
      }

      // Only tax apply
      if (taxStatus === "on") {
        finalPrice += (finalPrice * taxCost) / 100;
      }

      console.log({ finalPrice, balanceAmount });

      const enrollSubscription: any = await EnrollSubscription.create({
        retailerId: req.user._id,
        planSnapshot: pickSubscriptionPlan,
        couponSnapshot: coupon ?? null,
        taxSnapshot: {
          taxTitle: taxStatus === "on" ? taxTitle : null,
          taxCost: taxStatus === "on" ? taxCost : null,
        },
        balanceInfo: {
          currency,
          currentBalance: balanceAmount,
          planCurrentPrice: coupon
            ? pickSubscriptionPlan.price - Number((pickSubscriptionPlan.price * coupon.discount) / 100)
            : pickSubscriptionPlan.price,
        },
        planChangeCost,
        paymentStatus: "pending",
        enrollStatus: "upgrade",
        status: false,
      });

      totalAmount += finalPrice;
      enrollIdDuration["planEnrollmentId"] = String(enrollSubscription._id);
      enrollIdDuration[enrollSubscription._id] = pickSubscriptionPlan.duration;

      line_items.push({
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: `${pickSubscriptionPlan.title} Plan`,
            ...(taxStatus === "on" && {
              description: `${pickSubscriptionPlan.title} Plan (including VAT ${taxCost}%)`,
            }),
          },
          unit_amount: Math.round(Number(finalPrice) * 100), // convert into cent
          recurring: {
            interval: "month",
          },
        },
        quantity: 1,
      });

      // Minus Balance Handle By Coupon
      const applyCoupon = await stripe.coupons.create({
        name: coupon ? "Current Balance + Coupon" : "Current Balance",
        amount_off: Math.round((balanceAmount + couponValue) * 100),
        currency,
        duration: "once",
      });

      coupons.push({
        coupon: applyCoupon.id,
      });
    }

    ////////////////////////////////
    //////// Plan Downgrade ///////
    ///////////////////////////////
    if (changeMode < 0) {
      const downgradeBranchLimit = pickSubscriptionPlan?.allowTotalBranch;
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

      // for (const subscription of subscriptions) {
      //   if (subscription.type === "subscription") {
      //     totalAmount += Number(subscription.price - balanceAmount);
      //   } else {
      //     totalAmount += Number(subscription.price); // Add-on
      //   }
      // }

      // Decision 1: Refund & Downgrade
      if (totalAmount < 0) {
        const isRefunded = Math.abs(totalAmount + planChangeCost) >= refundableThreshold;
        let enrollSubscriptionId;

        // for (const subscription of subscriptions) {
        //   if (subscription.type === "subscription") {
        //     // If add Coupon, it will attach only in plan!
        //     if (coupon) {
        //       if (subscription.price < coupon.minPurchaseAmount) {
        //         throw `Min. ${coupon.minPurchaseAmount}CAD required to apply coupon!`;
        //       }

        //       if (coupon.discountType === "percentage") {
        //         totalAmount -= Number((subscription.price * coupon.discount) / 100);
        //       } else {
        //         totalAmount -= coupon.discount;
        //       }
        //     }

        //     const enrollSubscription = await EnrollSubscription.create({
        //       retailerId: req.user._id,
        //       planSnapshot: subscription,
        //       paymentStatus: "completed",
        //       enrollStatus: "downgrade",
        //       validityFrom: moment(),
        //       validityTo: moment().add(subscription.duration, "days"),
        //       balanceInfo: {
        //         currentBalance: balanceAmount,
        //         planCurrentPrice: coupon
        //           ? subscription.price - Number((subscription.price * coupon.discount) / 100)
        //           : subscription.price,
        //       },
        //       refundAmount: Math.abs(totalAmount) - planChangeCost,
        //       status: true,
        //       planChangeCost,
        //     });

        //     enrollSubscriptionId = enrollSubscription._id;
        //     planEnrollmentId = enrollSubscription._id;
        //   } else {
        //     await EnrollSubscription.create({
        //       retailerId: req.user._id,
        //       planSnapshot: subscription,
        //       paymentStatus: "completed",
        //       enrollStatus: "purchase",
        //       validityFrom: moment(),
        //       validityTo: moment().add(subscription.duration, "days"),
        //       status: true,
        //     });
        //   }
        // }

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
          plan: pickSubscriptionPlan?.slug,
          planStartAt: moment(),
          planValidAt: moment().add(pickSubscriptionPlan.duration, "days"),
          totalBranch: pickSubscriptionPlan?.allowTotalBranch,
        });
      }
      // Decision 2: Payment & Downgrade or Not Now - (Add More)
      else if (totalAmount > 0) {
        let togetherPaymentAmount = 0;
        const planCurrentPrice = parseFloat(Number(pickSubscriptionPlan.price - balanceAmount).toFixed(2)); // This amount can be negative!

        // for (const subscription of subscriptions) {
        //   if (subscription.type === "subscription") {
        //     // Decision: Stripe Entry or Not
        //     if (planCurrentPrice < 0) {
        //       if (coupon) {
        //         togetherPaymentAmount -= Number((subscription.price * coupon.discount) / 100);
        //       }

        //       const enrollSubscription: any = await EnrollSubscription.create({
        //         retailerId: req.user._id,
        //         planSnapshot: pickSubscriptionPlan,
        //         paymentStatus: "completed",
        //         enrollStatus: "downgrade",
        //         validityFrom: moment(),
        //         validityTo: moment().add(pickSubscriptionPlan.duration, "days"),
        //         balanceInfo: {
        //           currentBalance: balanceAmount,
        //           planCurrentPrice: coupon
        //             ? subscription.price - Number((subscription.price * coupon.discount) / 100)
        //             : subscription.price,
        //         },
        //         status: false,
        //       });

        //       planEnrollmentId = enrollSubscription._id;
        //       enrollIdDuration[enrollSubscription._id] = subscription.duration;
        //     } else {
        //       let finalPrice = planCurrentPrice;
        //       // If add Coupon, it will attach only in plan!
        //       if (coupon) {
        //         if (planCurrentPrice < coupon.minPurchaseAmount) {
        //           throw `Min. ${coupon.minPurchaseAmount}CAD required to apply coupon!`;
        //         }

        //         if (coupon.discountType === "percentage") {
        //           finalPrice = Number(subscription.price - (subscription.price * coupon.discount) / 100);
        //           togetherPaymentAmount -= finalPrice;
        //         } else {
        //           finalPrice = subscription.price - coupon.discount;
        //           togetherPaymentAmount -= finalPrice;
        //         }
        //       }

        //       const enrollSubscription: any = await EnrollSubscription.create({
        //         retailerId: req.user._id,
        //         planSnapshot: subscription,
        //         couponSnapshot: coupon,
        //         taxSnapshot: {
        //           taxTitle: taxStatus === "on" ? taxTitle : null,
        //           taxCost: taxStatus === "on" ? taxCost : null,
        //         },
        //         planChangeCost,
        //         balanceInfo: {
        //           currentBalance: balanceAmount,
        //           planCurrentPrice: finalPrice, // coupon discount any apply in plan
        //         },
        //         paymentStatus: "pending",
        //         enrollStatus: "downgrade",
        //         status: false,
        //       });

        //       planEnrollmentId = enrollSubscription._id;
        //       enrollIdDuration[enrollSubscription._id] = subscription.duration;

        //       togetherPaymentAmount += pickSubscriptionPlan.price;
        //     }
        //   } else {
        //     // Take Ad-ons with downgrade
        //     const enrollSubscription: any = await EnrollSubscription.create({
        //       retailerId: req.user._id,
        //       planSnapshot: subscription,
        //       taxSnapshot: {
        //         taxTitle: taxStatus === "on" ? taxTitle : null,
        //         taxCost: taxStatus === "on" ? taxCost : null,
        //       },
        //       paymentStatus: "pending",
        //       enrollStatus: "purchase",
        //       status: false,
        //     });

        //     enrollIdDuration[enrollSubscription._id] = subscription.duration;

        //     togetherPaymentAmount += subscription.price;
        //   }
        // }

        if (planCurrentPrice < 0) {
          togetherPaymentAmount -= Math.abs(planCurrentPrice);
        }

        // Plan & Ad-ons Al-together cause (-) value is not allow to show in stripe
        line_items.push({
          price_data: {
            currency: "cad",
            product_data: {
              name: `${pickSubscriptionPlan.title} Plan & Ad-ons`,
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
          planSnapshot: pickSubscriptionPlan,
          paymentStatus: "completed",
          enrollStatus: "downgrade",
          validityFrom: moment(),
          validityTo: moment().add(pickSubscriptionPlan.duration, "days"),
          balanceInfo: {
            currentBalance: balanceAmount,
            planCurrentPrice: coupon
              ? pickSubscriptionPlan.price - Number((pickSubscriptionPlan.price * coupon.discount) / 100)
              : pickSubscriptionPlan.price,
          },
        });

        await Promise.all([
          Branch.updateMany(
            { retailerId: req.user._id, source: "subscription" },
            { enrollSubscriptionId: enrollSubscription._id }
          ),
          EnrollSubscription.updateOne({ _id: enrolled._id }, { status: false }),
        ]);

        // planEnrollmentId = enrollSubscription._id;

        return apiResponse(res, 200, true, `Your plan successfully downgraded!`);
      }
    }

    // Add Plan Change Cost
    line_items.push({
      price_data: {
        currency,
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
    let finalPrice = 0;

    finalPrice = Number(
      ((selectCurrency.exchangeRate / baseCurrency.exchangeRate) * pickSubscriptionPlan.price).toFixed(2)
    );

    // Check coupon eligibility & apply
    if (coupon) {
      if (pickSubscriptionPlan.price < coupon.minPurchaseAmount) {
        throw `Min. ${coupon.minPurchaseAmount}CAD required to apply coupon!`;
      }
      const couponValue =
        coupon.discountType === "percentage" ? (finalPrice * coupon?.discount) / 100 : coupon?.discount;

      // Tax deduct from coupon
      const applyCoupon = await stripe.coupons.create({
        name: coupon.title,
        amount_off: Math.round(couponValue * 100),
        currency,
        duration: "once",
      });

      coupons.push({
        coupon: applyCoupon.id,
      });
    }

    // Only tax apply
    if (taxStatus === "on") {
      finalPrice += (finalPrice * taxCost) / 100;
    }

    const planCurrentPrice = coupon
      ? coupon.discountType === "percentage"
        ? pickSubscriptionPlan.price - (pickSubscriptionPlan.price * coupon?.discount) / 100
        : pickSubscriptionPlan.price - coupon?.discount
      : pickSubscriptionPlan.price;

    const enrollSubscription: any = await EnrollSubscription.create({
      retailerId: req.user._id,
      planSnapshot: pickSubscriptionPlan,
      couponSnapshot: coupon ?? null,
      taxSnapshot: {
        taxTitle: taxStatus === "on" ? taxTitle : null,
        taxCost: taxStatus === "on" ? taxCost : null,
      },
      balanceInfo: {
        planCurrentPrice,
        currency,
      },
      paymentStatus: "pending",
      enrollStatus: "purchase",
      status: false,
    });

    enrollIdDuration["planEnrollmentId"] = String(enrollSubscription._id);
    enrollIdDuration[enrollSubscription._id] = pickSubscriptionPlan.duration;
    totalAmount += finalPrice;

    line_items.push({
      price_data: {
        currency: currency.toLowerCase(),
        product_data: {
          name: `${pickSubscriptionPlan.title} ${isPlan ? "Plan" : "Add-On"}`,
          ...(taxStatus === "on" && {
            description: `${pickSubscriptionPlan.title} ${isPlan ? "Plan" : "Add-On"} (including ${taxTitle} ${taxCost}%)`,
          }),
        },
        unit_amount: Math.round(Number(finalPrice) * 100), // convert into cent
        recurring: {
          interval: "month",
        },
      },
      quantity: 1,
    });
  }

  // if (1 === 1) {
  //   return apiResponse(res, 200, true, "Testing...");
  // }

  const session = await stripe.checkout.sessions.create({
    line_items,
    mode: "subscription",
    payment_method_types: ["card"],
    metadata: enrollIdDuration, // Need for update info after complete payment
    discounts: coupons,
    success_url: `${process.env.FRONTEND_URL}/payment/complete`,
    // success_url: `${process.env.BACKEND_URL}/payment/complete?session_id={CHECKOUT_SESSION_ID}&stripe_success_token=${process.env.STRIPE_SUCCESS_TOKEN}&_id=${req.user._id}&takeFreeTrial=${req.user.takeFreeTrial}&pickSubscriptionPlan=${!!pickSubscriptionPlan}&enrolled=${!!enrolled}&planEnrollmentId=${planEnrollmentId}`,
    cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
    customer_email: req?.user?.email,
  });

  return apiResponse(res, 200, true, "Send to Payment Page!", { url: session?.url });
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
    if (
      req.query.pickSubscriptionPlan === "true" &&
      (req.query.takeFreeTrial === "true" || req.query.enrolled === "true")
    ) {
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
      if (req.query.pickSubscriptionPlan === "true") {
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

/**
 * Test Enroll Subscription
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const testEnrollSubscription = asyncHandler(async (req: IApiRequest, res: Response) => {
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

  const { stripeSecretKey } = paymentMetadata.stripe;
  const stripe = new Stripe(stripeSecretKey);

  // // const stripeCoupon = await stripe.coupons.create({
  // //   name: `New Year Off`,
  // //   percent_off: 10,
  // //   duration: "once",
  // //   currency: "cad",
  // //   applies_to: {
  // //     products: ["prod_QcdozwoAKCURYf"],
  // //   },
  // // });

  // const session = await stripe.checkout.sessions.create({
  //   line_items: [
  //     {
  //       price: "price_1PlOXDJVIk5LKvIEkTdrlobS",
  //       quantity: 1,
  //     },
  //     {
  //       price: "price_1PlOapJVIk5LKvIER2Jw04my",
  //       quantity: 1,
  //     },
  //   ],
  //   // discounts: [
  //   //   {
  //   //     coupon: stripeCoupon.id,
  //   //   },
  //   // ],
  //   mode: "subscription",
  //   success_url: `${process.env.FRONTEND_URL}`,
  //   cancel_url: `${process.env.FRONTEND_URL}`,
  //   customer_email: "anisuzzaman.rootdevs@gmail.com",
  //   automatic_tax: { enabled: true },
  //   billing_address_collection: "required",
  // });

  // const subscriptions = await stripe.subscriptions.list({
  //   customer: "cus_Qkagtur67NADVx",
  // });

  const price = await stripe.prices.create({
    currency: "usd",
    unit_amount: 1000,
    recurring: {
      interval: "month",
    },
    product_data: {
      name: "Pro Plan",
    },
  });

  const subscription = await stripe.subscriptions.update("sub_1Pt5VZAUADTrRdVYmBnP4YZc", {
    items: [
      {
        id: "si_QkagbKEwwNARqR",
        price: price.id,
      },
    ],
    proration_behavior: "none",
  });

  return apiResponse(res, 200, true, "Send to Payment Page!", subscription);
});

/**
 * Test Customer Billing Portal
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const customerBillingPortal = asyncHandler(async (req: IApiRequest, res: Response) => {
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

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: req.params.customerId,
    return_url: `${process.env.FRONTEND_URL}/`,
  });

  console.log({ portalSession });

  return apiResponse(res, 200, true, "Send to Payment Page!", { url: portalSession.url });
});

/**
 * Test Webhook
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const stripeWebhookHandler = asyncHandler(async (req: IApiRequest, res: Response) => {
  const sig = req.headers["stripe-signature"];

  // Get Stripe Secret Key
  const paymentMetadata = await Settings.findOne({}, { "stripe.stripeSecretKey": 1 });
  if (!paymentMetadata) throw "Something went wrong in Stripe settings!";

  const { stripeSecretKey } = paymentMetadata.stripe;
  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-04-10", typescript: true });
  const event: Stripe.Event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET_KEY);

  // Handle the event
  switch (event.type) {
    //Event when the subscription started
    case "checkout.session.completed":
      console.log("New Subscription started!");
      // console.log(event.data.object);
      await checkoutSessionComplete(event.data.object, stripe);
      break;

    // Event when the payment is successful (every subscription interval)
    // case "invoice.paid":
    //   console.log("Invoice paid");
    //   // console.log(event.data);
    //   break;

    case "invoice.payment_succeeded":
      console.log("Invoice Payment Succeeded");
      const SubscriptionEventObject = event.data.object;

      if (
        SubscriptionEventObject.billing_reason === "subscription_update" ||
        SubscriptionEventObject.billing_reason === "subscription_cycle"
      ) {
        console.log("Subscription is updated");
        const now = moment();
        const expireDate = moment().add(30, "days");
        await EnrollSubscription.updateMany(
          { "stripe.subscriptionId": SubscriptionEventObject.subscription },
          {
            validityFrom: now,
            validityTo: expireDate,
          }
        );
      }
      break;

    // Event when the payment failed due to card problems or insufficient funds (every subscription interval)
    case "invoice.payment_failed":
      console.log("Invoice payment failed!");
      // console.log(event.data);
      break;

    // Event when subscription is updated
    case "customer.subscription.updated":
      console.log("Subscription updated!");
      let subscriptionUpdateObject = event.data.object;

      await EnrollSubscription.updateMany(
        { "stripe.subscriptionId": subscriptionUpdateObject.id },
        {
          "stripe.renewCancelAt": subscriptionUpdateObject.cancel_at
            ? new Date(subscriptionUpdateObject.cancel_at * 1000)
            : null,
          "stripe.renewCanceledAtByCustomer": subscriptionUpdateObject.canceled_at
            ? new Date(subscriptionUpdateObject.canceled_at * 1000)
            : null,
        }
      );
      break;

    // Event when subscription is deleted
    case "customer.subscription.deleted":
      console.log("Subscription deleted!");
      // console.log(event.data);
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return apiResponse(res, 200, true, "Send to Payment Page!");
});

/**
 * Checkout Session Complete
 * @param {Request} eventObject - The HTTP webhook event object.
 * @param {Request} stripe - The stripe object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
const checkoutSessionComplete = async (eventObject: Stripe.Checkout.Session, stripe: Stripe): Promise<void> => {
  const [payment, invoice, retailer, freeTrailSubscription] = await Promise.all<[any, any, any, any]>([
    stripe.checkout.sessions.retrieve(eventObject.id),
    stripe.invoices.retrieve(eventObject.invoice as string, {
      expand: ["payment_intent.payment_method"],
    }),
    Retailer.findOne({ email: eventObject.customer_email }),
    Subscription.findOne({ slug: "trial" }),
  ]);

  // If a user takes a plan without taking the free trial, then the free trial isn't applicable anymore
  if (!retailer.takeFreeTrial) {
    Promise.all([
      EnrollSubscription.create({
        retailerId: retailer._id,
        planSnapshot: freeTrailSubscription,
        paymentStatus: "trial",
        enrollStatus: "trial",
        validityFrom: moment(),
        validityTo: moment(),
        status: false,
      }),
      Retailer.findByIdAndUpdate(retailer._id, { takeFreeTrial: true }),
    ]);
  }

  let subscriptionId;
  let updateSubscriptions = [];

  // Deactivate last previous active plan
  const prevSubscription = await EnrollSubscription.findOneAndUpdate(
    {
      retailerId: retailer._id,
      "planSnapshot.type": "subscription",
      paymentStatus: { $in: ["completed", "trial"] },
      status: true,
    },
    { status: false },
    { new: true }
  );

  console.log({ prevSubscription });

  if (prevSubscription) {
    await stripe.subscriptions.cancel(prevSubscription.stripe.subscriptionId);
  }

  if (invoice.payment_intent.status === "succeeded") {
    for (let key in payment.metadata) {
      if (key !== "planEnrollmentId") {
        const now = moment();
        const expireDate = moment().add(payment.metadata[key], "days");
        subscriptionId = key;

        updateSubscriptions.push(
          EnrollSubscription.findByIdAndUpdate(key, {
            paymentStatus: "completed",
            stripe: {
              subscriptionId: payment.subscription,
              customerId: payment.customer,
              renewCancelAt: null,
              renewCanceledAtByCustomer: null,
            },
            validityFrom: now,
            validityTo: expireDate,
            status: true,
          })
        );
      }
    }

    // Store Payment Info
    updateSubscriptions.push(
      Payment.create({
        retailerId: retailer._id,
        enrollSubscriptionId: subscriptionId,
        paymentIntentId: invoice.payment_intent.id,
        paymentStatus: invoice.payment_intent.status,
        amountTotal: payment.amount_total,
      })
    );

    // Update expiration for already created branch
    if ("planEnrollmentId" in payment.metadata) {
      updateSubscriptions.push(
        Branch.updateMany(
          {
            retailerId: retailer._id,
            source: "subscription",
          },
          { enrollSubscriptionId: payment.metadata["planEnrollmentId"] }
        )
      );
    }

    await Promise.all(updateSubscriptions);
  }
};
