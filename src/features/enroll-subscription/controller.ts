import { Response } from "express";
import moment from "moment";
import Stripe from "stripe";
import { PACKAGES } from "../../configs/constants";
import { apiResponse, asyncHandler, calculateBalanceAmount, checkPlanChange } from "../../helpers";
import { IApiRequest, IEnrollSubscriptionBody, ILineItem } from "../../types";
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

  const pickSubscriptionPlan = await Subscription.findOne({ slug });
  const isPlan = [PACKAGES.BASIC, PACKAGES.PRO, PACKAGES.ADVANCED].includes(slug);

  // Check already enrolled or not
  const enrolled = await EnrollSubscription.findOne({
    retailerId: req.user._id,
    "planSnapshot.type": "subscription",
    paymentStatus: "completed",
    validityTo: { $gt: moment() },
    status: true,
  });

  if (enrolled && slug === enrolled.planSnapshot.slug) throw `You already take ${enrolled.planSnapshot.title} plan!`;
  if (!enrolled && !isPlan) throw `You can't purchase an add-on without an active plan!`;

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
      }
    ),
    CurrencyExchange.find({ status: true }),
  ]);

  const { stripeSecretKey, planChangeCost, refundableThreshold, taxTitle, taxCost, taxStatus } =
    paymentMetadata.stripe ?? {};
  const selectCurrency = allowCurrencies.find((curr) => curr.name === currency);

  if (!paymentMetadata) throw "Something went wrong in Stripe settings!";
  if (!selectCurrency) throw "Provided currency is not allowed!";

  const stripe = new Stripe(stripeSecretKey);

  ////////////////////////////////////////////////////////////////////////
  //////// Decision -> (Upgrade or Downgrade) or New Subscription ////////
  ////////////////////////////////////////////////////////////////////////

  const enrollIdDuration: { [key: string]: number | string } = {};
  const line_items: ILineItem[] = [];
  const coupons: { coupon: string }[] = [];

  if (isPlan && enrolled) {
    const changeMode: number = checkPlanChange(
      [PACKAGES.BASIC, PACKAGES.PRO, PACKAGES.ADVANCED],
      enrolled.planSnapshot.slug,
      pickSubscriptionPlan?.slug
    );

    const convertToSelectedCurrency = Number(
      (
        (selectCurrency.exchangeRate / enrolled.balanceInfo.currencyRate) *
        enrolled.balanceInfo.planCurrentPrice
      ).toFixed(2)
    );

    const balanceAmount: number = calculateBalanceAmount(
      enrolled.validityFrom,
      enrolled.validityTo,
      convertToSelectedCurrency
    );

    ///////////////////////////////
    //////// Plan Upgrade /////////
    ///////////////////////////////
    if (changeMode > 0) {
      let finalPrice = 0;
      let taxValue = 0;
      let couponValue = 0;

      finalPrice = Number((selectCurrency.exchangeRate * pickSubscriptionPlan.price).toFixed(2));

      // Check coupon eligibility & apply
      if (coupon) {
        if (pickSubscriptionPlan.price < coupon.minPurchaseAmount) {
          throw `Min. ${(selectCurrency.exchangeRate * coupon.minPurchaseAmount).toFixed(2)}${currency} required to apply coupon!`;
        }

        couponValue =
          coupon.discountType === "percentage"
            ? (finalPrice * coupon?.discount) / 100
            : selectCurrency.exchangeRate * coupon?.discount;
      }

      // Only tax apply
      if (taxStatus === "on") {
        taxValue += (finalPrice * taxCost) / 100;
        finalPrice += taxValue;
      }

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
          currencyRate: selectCurrency.exchangeRate,
          planCurrentPrice: (finalPrice - taxValue - couponValue).toFixed(2),
        },
        planChangeCost: planChangeCost * selectCurrency.exchangeRate,
        paymentStatus: "pending",
        enrollStatus: "upgrade",
        status: false,
      });

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
      if (coupon) {
        throw `Coupon is not allowed in plan downgrade!`;
      }

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

      let finalPrice = Number((selectCurrency.exchangeRate * pickSubscriptionPlan.price).toFixed(2));
      let taxValue = 0;

      const totalAmount = Number(finalPrice - balanceAmount);

      // Only tax apply
      if (taxStatus === "on") {
        taxValue += (finalPrice * taxCost) / 100;
        finalPrice += taxValue;
      }

      //////// Decision 1: Refund & Downgrade ///////
      if (totalAmount <= 0) {
        // Create price/product for plan downgrading in stripe
        const price = await stripe.prices.create({
          currency: currency.toLocaleLowerCase(),
          unit_amount: Math.round(finalPrice * 100),
          recurring: {
            interval: "month",
          },
          product_data: {
            name:
              taxStatus === "on"
                ? `${pickSubscriptionPlan.title} Plan (including ${taxTitle} ${taxCost}%)`
                : `${pickSubscriptionPlan.title} Plan`,
          },
        });

        //  Cancel Previous Subscription from Stripe
        await stripe.subscriptions.cancel(enrolled.stripe.subscriptionId);

        //  Create New Subscription from Stripe
        const stripeSubscription = await stripe.subscriptions.create({
          customer: enrolled.stripe.customerId,
          items: [
            {
              price: price.id,
            },
          ],
          default_payment_method: enrolled.stripe.paymentMethodId,
        });

        //  Create New Enrollment
        const enrollSubscription = await EnrollSubscription.create({
          retailerId: req.user._id,
          stripe: {
            subscriptionId: stripeSubscription.id,
            customerId: enrolled.stripe.customerId,
            paymentMethodId: enrolled.stripe.paymentMethodId,
          },
          planSnapshot: pickSubscriptionPlan,
          taxSnapshot: {
            taxTitle: taxStatus === "on" ? taxTitle : null,
            taxCost: taxStatus === "on" ? taxCost : null,
          },
          paymentStatus: "completed",
          enrollStatus: "downgrade",
          validityFrom: moment(),
          validityTo: moment().add(pickSubscriptionPlan.duration, "days"),
          balanceInfo: {
            currency,
            currentBalance: balanceAmount,
            planCurrentPrice: finalPrice - taxValue,
            currencyRate: selectCurrency.exchangeRate,
          },
          refundAmount: parseFloat(Math.abs(totalAmount).toFixed(2)),
          status: true,
        });

        // Queries: Update Branch Expire, Disable Previous Enrollment, Cancel Previous Subscription from Stripe
        const updateQueries: any = [
          Branch.updateMany(
            { retailerId: req.user._id, source: "subscription" },
            { enrollSubscriptionId: enrollSubscription._id }
          ),
          EnrollSubscription.updateOne({ _id: enrolled._id }, { status: false }),
        ];

        // Check Refund
        const isRefunded = Math.abs(totalAmount) >= refundableThreshold;
        if (isRefunded && totalAmount !== 0) {
          updateQueries.push(
            Refund.create({
              currency,
              enrollSubscriptionId: enrollSubscription._id,
              refundAmount: parseFloat(Math.abs(totalAmount).toFixed(2)),
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
      //////// Decision 2: Payment & Downgrade ////////
      else {
        const enrollSubscription: any = await EnrollSubscription.create({
          retailerId: req.user._id,
          planSnapshot: pickSubscriptionPlan,
          taxSnapshot: {
            taxTitle: taxStatus === "on" ? taxTitle : null,
            taxCost: taxStatus === "on" ? taxCost : null,
          },
          planChangeCost: planChangeCost * selectCurrency.exchangeRate,
          balanceInfo: {
            currency,
            planCurrentPrice: finalPrice - taxValue,
            currentBalance: balanceAmount,
            currencyRate: selectCurrency.exchangeRate,
          },
          paymentStatus: "pending",
          enrollStatus: "downgrade",
          status: false,
        });

        enrollIdDuration["planEnrollmentId"] = String(enrollSubscription._id);
        enrollIdDuration[enrollSubscription._id] = pickSubscriptionPlan.duration;

        line_items.push({
          price_data: {
            currency,
            product_data: {
              name: `${pickSubscriptionPlan.title} Plan (Downgrade)`,
            },
            unit_amount: Math.round(finalPrice * 100),
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        });

        // Minus Balance Handle By Coupon
        const applyCoupon = await stripe.coupons.create({
          name: "Current Balance",
          amount_off: Math.round(totalAmount * 100),
          currency,
          duration: "once",
        });

        coupons.push({
          coupon: applyCoupon.id,
        });
      }
    }

    // Add Plan Change Cost
    line_items.push({
      price_data: {
        currency,
        product_data: {
          name: `Plan Change Cost`,
        },
        unit_amount: Math.round(Number(planChangeCost * selectCurrency.exchangeRate) * 100), // convert into cent
      },
      quantity: 1,
    });
  } else {
    ///////////////////////////////////
    //////// New Subscription /////////
    ///////////////////////////////////
    let finalPrice = 0;
    let taxValue = 0;
    let couponValue = 0;

    finalPrice = Number((selectCurrency.exchangeRate * pickSubscriptionPlan.price).toFixed(2));

    // Check coupon eligibility & apply
    if (coupon) {
      if (pickSubscriptionPlan.price < coupon.minPurchaseAmount) {
        throw `Min. ${(selectCurrency.exchangeRate * coupon.minPurchaseAmount).toFixed(2)}${currency} required to apply coupon!`;
      }

      couponValue =
        coupon.discountType === "percentage"
          ? (finalPrice * coupon?.discount) / 100
          : selectCurrency.exchangeRate * coupon?.discount;
      couponValue = Number(couponValue.toFixed(2));

      const applyCoupon = await stripe.coupons.create({
        name: coupon.title,
        amount_off: couponValue * 100,
        currency,
        duration: "once",
      });

      coupons.push({
        coupon: applyCoupon.id,
      });
    }

    // Only tax apply
    if (taxStatus === "on") {
      taxValue = (finalPrice * taxCost) / 100;
      finalPrice += taxValue;
    }

    const enrollSubscription: any = await EnrollSubscription.create({
      retailerId: req.user._id,
      planSnapshot: pickSubscriptionPlan,
      couponSnapshot: coupon ?? null,
      taxSnapshot: {
        taxTitle: taxStatus === "on" ? taxTitle : null,
        taxCost: taxStatus === "on" ? taxCost : null,
      },
      balanceInfo: {
        planCurrentPrice: (finalPrice - taxValue - couponValue).toFixed(2),
        currency,
        currencyRate: selectCurrency.exchangeRate,
      },
      paymentStatus: "pending",
      enrollStatus: "purchase",
      status: false,
    });

    enrollIdDuration["planEnrollmentId"] = String(enrollSubscription._id);
    enrollIdDuration[enrollSubscription._id] = pickSubscriptionPlan.duration;

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

  const session = await stripe.checkout.sessions.create({
    line_items,
    mode: "subscription",
    payment_method_types: ["card"],
    metadata: enrollIdDuration, // Need for update info after complete payment
    discounts: coupons,
    success_url: `${process.env.FRONTEND_URL}/payment/complete`,
    cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
    customer_email: req?.user?.email,
  });

  return apiResponse(res, 200, true, "Send to Payment Page!", { url: session?.url });
});

/**
 * Stripe Webhook Handler
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const stripeWebhookHandler = asyncHandler(async (req: IApiRequest, res: Response) => {
  const sig = req.headers["stripe-signature"];

  // Get Stripe Webhook Secret Key
  const paymentMetadata = await Settings.findOne(
    {},
    { "stripe.stripeSecretKey": 1, "stripe.stripeWebhookSecretKey": 1 }
  );
  if (!paymentMetadata) throw "Something went wrong in Stripe settings!";

  const { stripeSecretKey, stripeWebhookSecretKey } = paymentMetadata.stripe;
  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-04-10", typescript: true });
  const event: Stripe.Event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecretKey);

  switch (event.type) {
    //////////////////////////////////////////////
    ///////// Handling New Subscription /////////
    /////////////////////////////////////////////
    case "checkout.session.completed":
      console.log("Handling New Subscription!");
      await checkoutSessionComplete(event.data.object, stripe);
      break;

    //////////////////////////////////////////////
    //////// Handling Renew Subscription ////////
    /////////////////////////////////////////////
    case "invoice.payment_succeeded":
      console.log("Handling Renew Subscription!");
      const invoicePaymentEvent = event.data.object;

      if (
        invoicePaymentEvent.billing_reason === "subscription_update" ||
        invoicePaymentEvent.billing_reason === "subscription_cycle"
      ) {
        console.log("Subscription is updated!");
        const now = moment();
        const expireDate = moment().add(30, "days");

        const updatedSubscription = await EnrollSubscription.findOneAndUpdate(
          { "stripe.subscriptionId": invoicePaymentEvent.subscription },
          {
            validityFrom: now,
            validityTo: expireDate,
          },
          { new: true }
        );

        Payment.create({
          retailerId: updatedSubscription.retailerId,
          enrollSubscriptionId: updatedSubscription._id,
          paymentIntentId: invoicePaymentEvent.payment_intent,
          paymentStatus: "succeeded",
          amountTotal: invoicePaymentEvent.total,
        });
      }
      break;

    /////////////////////////////////////////////////////////////////
    //////// Handling Cancel & Renew Subscription By Retailer ///////
    /////////////////////////////////////////////////////////////////
    case "customer.subscription.updated":
      console.log("Handling Cancel & Renew Subscription By Retailer!");
      let subscriptionUpdateObject = event.data.object;

      await EnrollSubscription.updateOne(
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

      // @TODO: Send Cancel & Renew Subscription Mail
      break;

    //////////////////////////////////////////////////////////////////
    //////// Handling Insufficient Funds or Payment Failed //////////
    /////////////////////////////////////////////////////////////////
    case "invoice.payment_failed":
      console.log("Invoice Payment Failed!");
      let invoiceObject = event.data.object;

      if (
        invoiceObject.billing_reason === "subscription_update" ||
        invoiceObject.billing_reason === "subscription_cycle"
      ) {
        await Promise.all([
          EnrollSubscription.updateOne(
            { "stripe.subscriptionId": invoiceObject.subscription },
            {
              status: false,
            }
          ),
          stripe.subscriptions.cancel(invoiceObject.subscription as string),
        ]);

        // @TODO: Send Cancel Subscription Mail
      }
      break;

    //////////////////////////////////////////////////////////////////
    //////// Handling Customer Default Payment Card /////////////////
    /////////////////////////////////////////////////////////////////
    case "customer.updated":
      console.log("Customer Updated!");
      let customerObject = event.data.object;

      await EnrollSubscription.findOneAndUpdate(
        { "stripe.customerId": customerObject.id },
        {
          "stripe.paymentMethodId": customerObject?.invoice_settings?.default_payment_method,
        }
      );
      break;

    case "customer.subscription.deleted":
      console.log("Subscription Deleted!");
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return apiResponse(res, 200, true, "Send to Payment Page!");
});

/**
 * Checkout Session Complete Event Handling
 * @param {Request} eventObject - The HTTP webhook event object.
 * @param {Request} stripe - The stripe object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
const checkoutSessionComplete = async (eventObject: Stripe.Checkout.Session, stripe: Stripe): Promise<void> => {
  try {
    const [payment, invoice, retailer, freeTrailSubscription] = await Promise.all<[any, any, any, any]>([
      stripe.checkout.sessions.retrieve(eventObject.id),
      stripe.invoices.retrieve(eventObject.invoice as string, {
        expand: ["payment_intent.payment_method"],
      }),
      Retailer.findOne({ email: eventObject.customer_email }),
      Subscription.findOne({ slug: "trial" }),
    ]);

    if (invoice.payment_intent.status !== "succeeded") return;

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
    const purchasedSubscription = await EnrollSubscription.findById(payment.metadata["planEnrollmentId"]);

    // Deactivate last previous active plan
    if (purchasedSubscription.planSnapshot.type === "subscription") {
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

      if (prevSubscription && prevSubscription.paymentStatus !== "trial") {
        await stripe.subscriptions.cancel(prevSubscription.stripe.subscriptionId);
      }

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
    }

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
              paymentMethodId: invoice.payment_intent.payment_method.id,
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

    await Promise.all(updateSubscriptions);
  } catch (err) {
    console.log(err);
    // throw err.message || err || "Something went wrong!";
  }
};
