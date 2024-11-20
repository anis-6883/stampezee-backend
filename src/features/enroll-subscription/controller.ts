import { Response } from "express";
import moment from "moment";
import nodemailer from "nodemailer";
import Stripe from "stripe";
import { PACKAGES } from "../../configs/constants";
import {
  apiResponse,
  asyncHandler,
  calculateBalanceAmount,
  checkCombination,
  checkDuplicates,
  checkPlanChange,
  exclude,
  htmlToPdf,
} from "../../helpers";
import Branch from "../../models/branch";
import Coupon, { ICoupon } from "../../models/coupon";
import CriticalPayment from "../../models/critical-payment";
import CurrencyExchange from "../../models/currency-exchange";
import EnrollSubscription from "../../models/enroll-subscription";
import Enrollment from "../../models/enrollment";
import Payment from "../../models/payment";
import Refund from "../../models/refund";
import Retailer from "../../models/retailer";
import Settings from "../../models/settings";
import Stamp from "../../models/stamp";
import Subscription, { ISubscription } from "../../models/subscription";
import { getInvoiceTemplate } from "../../templates/invoice";
import { IApiRequest, IEnrollSubscriptionBody, ILineItem, Object } from "../../types";
import { sendInvoiceToEmail } from "./service";
import { couponSchema, enrollmentSchema, extraAddonSchema } from "./validation";

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

  const { code, slugs } = result || {};

  const coupon = (
    await Coupon.aggregate([
      {
        $match: {
          code,
          startedAt: { $lte: new Date() },
          expiredAt: { $gte: new Date() },
          status: true,
          softDeleted: false,
        },
      },
      {
        $project: {
          _id: 1,
          code: 1,
          title: 1,
          discountType: 1,
          discount: 1,
          allowFor: 1,
          allowedRetailers: 1,
          applicablePackages: 1,
          limit: 1,
        },
      },
    ])
  )[0];

  if (!coupon) throw "Provided invalid coupon code!";

  const subscriptions = await Subscription.find({
    _id: { $in: coupon?.applicablePackages || [] },
    slug: { $ne: "trial" },
  });

  const applicablePackages = subscriptions.map((subscription) => subscription.slug);
  const appliedSlugs = applicablePackages.filter((slug) => slugs.includes(slug));
  if (appliedSlugs.length <= 0) throw "Provided invalid coupon code!";

  if (coupon.allowFor === "specific") {
    if (!coupon.allowedRetailers.includes(req.user._id as any)) throw "Provided invalid coupon code!";
  }

  // TODO: Check This Condition
  const alreadyApplied = await Enrollment.countDocuments({
    retailerId: req.user._id,
    "couponSnapshot._id": coupon._id,
    paymentStatus: "completed",
  });

  if (alreadyApplied >= coupon.limit) throw "Your coupon limit is over!";

  const data = exclude(coupon, ["applicablePackages", "allowedRetailers", "allowFor", "limit"]);
  data.appliedSlugs = appliedSlugs;

  return apiResponse(res, 200, true, "Coupon applied!", data);
});

/**
 * Extra Addon Check
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const extraAddonCheck = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await extraAddonSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { currency } = result;

  const enrolled = await Enrollment.findOne({
    retailerId: req.user._id,
    planExists: { $ne: null },
    paymentStatus: "completed",
    validityTo: { $gt: moment() },
    status: true,
  });

  if (!enrolled) throw `No active enrollment yet!`;

  let extraPayableAmount = 0;

  const [prevAddons, allowCurrencies] = await Promise.all([
    EnrollSubscription.find({ enrollmentId: enrolled?._id, "planSnapshot.type": "addon", status: true }),
    CurrencyExchange.find({ status: true }),
  ]);

  const selectCurrency = allowCurrencies.find((curr) => curr.name === currency);
  if (!selectCurrency) throw "Provided currency is not allowed!";

  // Add Previous Add-on Payable Amount in totalAmount
  for (const prevAddon of prevAddons) {
    const convertToSelectedCurrency = Number(
      ((selectCurrency.exchangeRate / enrolled.currencyRate) * prevAddon.planSnapshot.price).toFixed(2)
    );

    const addonBalanceAmount: number = calculateBalanceAmount(
      enrolled.validityFrom,
      enrolled.validityTo,
      convertToSelectedCurrency
    );

    extraPayableAmount += convertToSelectedCurrency - addonBalanceAmount;
  }

  const data: Object = {};

  if (extraPayableAmount > 0) {
    data["addonExists"] = true;
    data["payableAmount"] = extraPayableAmount.toFixed(2);
  } else {
    data["addonExists"] = false;
  }

  return apiResponse(res, 200, true, "Extra Payable Amount for Addon!", data);
});

/**
 * Enroll Subscription
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const enrollSubscription = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await enrollmentSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { slugs, code, branchIds, stampIds, currency }: IEnrollSubscriptionBody = result;

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

        const [enrollment] = await Promise.all([
          Enrollment.create({
            retailerId: req.user._id,
            planExists: PACKAGES.TRIAL,
            paymentStatus: "trial",
            validityFrom: now,
            validityTo: expireDate,
            enrollStatus: "trial",
          }),
          Retailer.findByIdAndUpdate(req.user._id, { takeFreeTrial: true }),
        ]);

        await EnrollSubscription.create({
          enrollmentId: enrollment?._id,
          planSnapshot: subscription,
        });

        return apiResponse(res, 200, true, "Free trial enrolled successfully!", {
          takeFreeTrial: true,
          plan: "trial",
          planStartAt: now,
          planValidAt: expireDate,
          totalBranch: subscription?.allowTotalBranch,
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
      }
    ),
    CurrencyExchange.find({ status: true }),
  ]);

  const {
    stripeSecretKey = null,
    planChangeCost = null,
    refundableThreshold = null,
    taxTitle = null,
    taxCost = null,
    taxStatus = null,
  } = paymentMetadata.stripe ?? {};

  const selectCurrency = allowCurrencies.find((curr) => curr.name === currency);

  if (!paymentMetadata) throw "Something went wrong in Stripe settings!";
  if (!selectCurrency) throw "Provided currency is not allowed!";

  const stripe = new Stripe(stripeSecretKey);

  // Enroll Paid Subscription
  if (checkCombination(slugs, [PACKAGES.BASIC, PACKAGES.PRO, PACKAGES.ADVANCED]) && checkDuplicates(slugs)) {
    const subscriptions: any[] = await Subscription.find({ slug: { $in: slugs } });
    const pickPlan: ISubscription = subscriptions.find((subs) => subs.type === "subscription"); // Always Get One Plan if Exists

    // Check Already enrolled or not
    const enrolled = await Enrollment.findOne({
      retailerId: req.user._id,
      planExists: { $ne: null },
      paymentStatus: "completed",
      validityTo: { $gt: moment() },
      status: true,
    });

    if (!enrolled && !pickPlan) throw `You can't purchase an add-on without an active plan!`;

    if (enrolled && slugs.includes(enrolled.planExists)) {
      throw `You already take ${pickPlan.title} plan!`;
    }

    // Check & Get Coupon
    let coupon: ICoupon = null;
    let appliedSlugs: string[] = [];
    if (code) {
      coupon = (
        await Coupon.aggregate([
          {
            $match: {
              code,
              startedAt: { $lte: new Date() },
              expiredAt: { $gte: new Date() },
              status: true,
              softDeleted: false,
            },
          },
          {
            $project: {
              _id: 1,
              code: 1,
              title: 1,
              discountType: 1,
              discount: 1,
              allowFor: 1,
              allowedRetailers: 1,
              applicablePackages: 1,
              limit: 1,
            },
          },
        ])
      )[0];

      if (!coupon) throw "Provided invalid coupon code!";

      const subscriptions: ISubscription[] = await Subscription.find({
        _id: { $in: coupon?.applicablePackages || [] },
        slug: { $ne: "trial" },
      });

      const applicablePackages = subscriptions.map((subscription) => subscription.slug);
      appliedSlugs = applicablePackages.filter((slug) => slugs.includes(slug));
      if (appliedSlugs.length <= 0) throw "Provided invalid coupon code!";

      if (coupon.allowFor === "specific") {
        if (!coupon.allowedRetailers.includes(req.user._id as any)) throw "Provided invalid coupon code!";
      }

      const alreadyApplied = await Enrollment.countDocuments({
        retailerId: req.user._id,
        "couponSnapshot._id": coupon._id,
        paymentStatus: "completed",
      });

      if (alreadyApplied >= coupon.limit) throw "Your coupon limit is over!";
    }

    ////////////////////////////////////////////////////////////////////////
    //////// Decision -> (Upgrade or Downgrade) or New Subscription ////////
    ////////////////////////////////////////////////////////////////////////
    const metadata: { [key: string]: number | string } = {};
    metadata["currency"] = currency;
    const line_items: ILineItem[] = [];
    const coupons: { coupon: string }[] = [];
    let extraPayableAmount = 0;

    if (pickPlan && enrolled) {
      const changeMode: number = checkPlanChange(
        [PACKAGES.BASIC, PACKAGES.PRO, PACKAGES.ADVANCED],
        enrolled.planExists,
        pickPlan?.slug
      );

      const subscriptionPlan = await EnrollSubscription.findOne({
        enrollmentId: enrolled?._id,
        "planSnapshot.type": "subscription",
        status: true,
      });

      const convertToSelectedCurrency = Number(
        ((selectCurrency.exchangeRate / enrolled.currencyRate) * subscriptionPlan.planCurrentPrice).toFixed(2)
      );

      const balanceAmount: number = calculateBalanceAmount(
        enrolled.validityFrom,
        enrolled.validityTo,
        convertToSelectedCurrency
      );

      let totalCouponAmount = balanceAmount ?? 0;

      const enrollment = await Enrollment.create({
        retailerId: req.user._id,
        planExists: pickPlan ? pickPlan?.slug : null,
        taxSnapshot: {
          taxTitle: taxStatus === "on" ? taxTitle : null,
          taxCost: taxStatus === "on" ? taxCost : null,
        },
        currency,
        currencyRate: selectCurrency.exchangeRate,
        planChangeCost,
        paymentStatus: "pending",
        enrollStatus: changeMode > 0 ? "upgrade" : "downgrade",
        status: false,
      });

      metadata["enrollmentId"] = String(enrollment._id);
      metadata["balanceAmount"] = balanceAmount;

      const prevAddons = await EnrollSubscription.find({
        enrollmentId: enrolled?._id,
        "planSnapshot.type": "addon",
        status: true,
      });

      ///////////////////////////////
      //////// Plan Upgrade /////////
      ///////////////////////////////
      if (changeMode > 0) {
        // Add Previous Add-on into new enrollment
        for (const prevAddon of prevAddons) {
          let finalPrice = 0;
          let taxValue = 0;

          finalPrice = Number((selectCurrency.exchangeRate * prevAddon.planSnapshot.price).toFixed(2));

          const convertToSelectedCurrency = Number(
            ((selectCurrency.exchangeRate / enrolled.currencyRate) * prevAddon.planSnapshot.price).toFixed(2)
          );

          const addonBalanceAmount: number = calculateBalanceAmount(
            enrolled.validityFrom,
            enrolled.validityTo,
            convertToSelectedCurrency
          );

          if (enrolled.taxSnapshot.taxTitle) {
            const prevTax = (prevAddon.planSnapshot.price * enrolled.taxSnapshot.taxCost) / 100;

            totalCouponAmount += addonBalanceAmount + prevTax; // Minus Used Amount with Tax
          } else {
            totalCouponAmount += addonBalanceAmount; // Minus Used Amount
          }

          extraPayableAmount += convertToSelectedCurrency - addonBalanceAmount; // Send to Frontend

          // Only tax apply
          if (taxStatus === "on") {
            taxValue = (finalPrice * taxCost) / 100;
            finalPrice += taxValue;
          }

          const enrollSubscription = await EnrollSubscription.create({
            enrollmentId: enrollment?._id,
            planSnapshot: prevAddon.planSnapshot,
            couponSnapshot: null,
            planCurrentPrice: (finalPrice - taxValue).toFixed(2),
          });

          line_items.push({
            price_data: {
              currency: currency.toLowerCase(),
              product_data: {
                name: `${prevAddon.planSnapshot.title} Add-On (Previous)`,
                ...(taxStatus === "on" && {
                  description: `${prevAddon.planSnapshot.title} Add-On (including ${taxTitle} ${taxCost}%)`,
                }),
                metadata: {
                  enrollSubscriptionId: String(enrollSubscription._id),
                  prev: "true",
                },
              },
              unit_amount:
                selectCurrency?.name === "JPY" ? Math.round(Number(finalPrice)) : Math.round(Number(finalPrice) * 100), // convert into cent
              recurring: {
                interval: "month",
              },
            },
            quantity: 1,
          });
        }

        // Add New Plan & Add-on into new enrollment
        for (const subscription of subscriptions) {
          let finalPrice = 0;
          let taxValue = 0;

          finalPrice = Number((selectCurrency.exchangeRate * subscription.price).toFixed(2));

          // Only tax apply
          if (taxStatus === "on") {
            taxValue = (finalPrice * taxCost) / 100;
            finalPrice += taxValue;
          }

          const enrollSubscription = await EnrollSubscription.create({
            enrollmentId: enrollment?._id,
            planSnapshot: subscription,
            couponSnapshot: null,
            planCurrentPrice: (finalPrice - taxValue).toFixed(2),
          });

          const isPlan = [PACKAGES.BASIC, PACKAGES.PRO, PACKAGES.ADVANCED].includes(subscription.slug);

          line_items.push({
            price_data: {
              currency: currency.toLowerCase(),
              product_data: {
                name: `${subscription.title} ${isPlan ? "Plan" : "Add-On"}`,
                ...(taxStatus === "on" && {
                  description: `${subscription.title} ${isPlan ? "Plan" : "Add-On"} (including ${taxTitle} ${taxCost}%)`,
                }),
                metadata: {
                  enrollSubscriptionId: String(enrollSubscription._id),
                  prev: "false",
                },
              },
              unit_amount:
                selectCurrency?.name === "JPY" ? Math.round(Number(finalPrice)) : Math.round(Number(finalPrice) * 100), // convert into cent
              recurring: {
                interval: "month",
              },
            },
            quantity: 1,
          });
        }

        const applyCoupon = await stripe.coupons.create({
          name: "Current Balance",
          amount_off:
            selectCurrency?.name === "JPY"
              ? Math.round(Number(totalCouponAmount))
              : Math.round(Number(totalCouponAmount) * 100),
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
        if (!enrolled?.stripe?.paymentMethodId) throw `Something went wrong on your payment method!`;

        const downgradeBranchLimit = pickPlan?.allowTotalBranch;
        const downgradeStampLimit = pickPlan?.allowTotalStamp;

        const [branches, stamps] = await Promise.all([
          Branch.find({ retailerId: req.user._id, source: "subscription", softDeleted: false }),
          Stamp.find({ retailerId: req.user._id, softDeleted: false }),
        ]);

        const disabledBySystemBranch = branches.filter((branch) => !branch.disabledBySystem).length;

        if (branches.length > downgradeBranchLimit && disabledBySystemBranch > downgradeBranchLimit) {
          if (!branchIds) throw "branchIds is required!";

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

        if (stamps.length > downgradeStampLimit) {
          if (!stampIds) throw "stampIds is required!";

          if (stampIds) {
            await Stamp.updateMany(
              { retailerId: req.user._id, _id: { $in: stampIds } },
              { softDeleted: true, status: false }
            );
          }
        }

        let totalAmount = 0;
        for (const subscription of subscriptions) {
          if (subscription.type === "subscription") {
            totalAmount += Number(subscription.price - balanceAmount);
          } else {
            totalAmount += Number(subscription.price); // Add-on
          }
        }

        // Add Previous Add-on Payable Amount in totalAmount
        for (const prevAddon of prevAddons) {
          const convertToSelectedCurrency = Number(
            ((selectCurrency.exchangeRate / enrolled.currencyRate) * prevAddon.planSnapshot.price).toFixed(2)
          );

          const addonBalanceAmount: number = calculateBalanceAmount(
            enrolled.validityFrom,
            enrolled.validityTo,
            convertToSelectedCurrency
          );

          totalAmount += convertToSelectedCurrency - addonBalanceAmount;
        }

        ///////////////////////////////////////////////
        //////// Decision 1: Refund & Downgrade //////
        //////////////////////////////////////////////
        if (totalAmount <= 0) {
          const priceIds = [];

          // Add Previous Add-on into new enrollment
          for (const prevAddon of prevAddons) {
            let finalPrice = 0;
            let taxValue = 0;

            finalPrice = Number((selectCurrency.exchangeRate * prevAddon.planSnapshot.price).toFixed(2));

            const convertToSelectedCurrency = Number(
              ((selectCurrency.exchangeRate / enrolled.currencyRate) * prevAddon.planCurrentPrice).toFixed(2)
            );

            const addonBalanceAmount: number = calculateBalanceAmount(
              enrolled.validityFrom,
              enrolled.validityTo,
              convertToSelectedCurrency
            );

            if (enrolled.taxSnapshot.taxTitle) {
              const prevTax = (prevAddon.planSnapshot.price * enrolled.taxSnapshot.taxCost) / 100;

              totalCouponAmount += addonBalanceAmount + prevTax; // Minus Used Amount with Tax
            } else {
              totalCouponAmount += addonBalanceAmount; // Minus Used Amount
            }

            // Only tax apply
            if (taxStatus === "on") {
              taxValue = (finalPrice * taxCost) / 100;
              finalPrice += taxValue;
            }

            const enrollSubscription = await EnrollSubscription.create({
              enrollmentId: enrollment?._id,
              planSnapshot: prevAddon.planSnapshot,
              couponSnapshot: null,
              planCurrentPrice: (finalPrice - taxValue).toFixed(2),
            });

            // Create price/product for plan downgrading in stripe
            const product = await stripe.products.create({
              name: `${prevAddon.planSnapshot.title} Add-On`,
              ...(taxStatus === "on" && {
                description: `${prevAddon.planSnapshot.title} Add-On (including ${taxTitle} ${taxCost}%)`,
              }),
              metadata: {
                enrollSubscriptionId: String(enrollSubscription._id),
                prev: "true",
              },
            });

            const price = await stripe.prices.create({
              currency: currency.toLocaleLowerCase(),
              unit_amount:
                selectCurrency?.name === "JPY" ? Math.round(Number(finalPrice)) : Math.round(Number(finalPrice * 100)),
              recurring: {
                interval: "month",
              },
              product: product.id,
            });

            priceIds.push({
              price: price?.id,
            });
          }

          // Add New Plan & Add-on into new enrollment
          for (const subscription of subscriptions) {
            let finalPrice = 0;
            let taxValue = 0;

            finalPrice = Number((selectCurrency.exchangeRate * subscription.price).toFixed(2));

            // Only tax apply
            if (taxStatus === "on") {
              taxValue = (finalPrice * taxCost) / 100;
              finalPrice += taxValue;
            }

            const enrollSubscription = await EnrollSubscription.create({
              enrollmentId: enrollment?._id,
              planSnapshot: subscription,
              couponSnapshot: null,
              planCurrentPrice: (finalPrice - taxValue).toFixed(2),
            });

            const isPlan = [PACKAGES.BASIC, PACKAGES.PRO, PACKAGES.ADVANCED].includes(subscription.slug);

            // Create price/product for plan downgrading in stripe
            const product = await stripe.products.create({
              name: `${subscription.title} ${isPlan ? "Plan" : "Add-On"}`,
              ...(taxStatus === "on" && {
                description: `${subscription.title} ${isPlan ? "Plan" : "Add-On"} (including ${taxTitle} ${taxCost}%)`,
              }),
              metadata: {
                enrollSubscriptionId: String(enrollSubscription._id),
                prev: "false",
              },
            });

            const price = await stripe.prices.create({
              currency: currency.toLocaleLowerCase(),
              unit_amount:
                selectCurrency?.name === "JPY" ? Math.round(Number(finalPrice)) : Math.round(Number(finalPrice * 100)),
              recurring: {
                interval: "month",
              },
              product: product.id,
            });

            priceIds.push({
              price: price?.id,
            });
          }

          //  Create New Subscription from Stripe
          const stripeSubscription = await stripe.subscriptions.create({
            customer: enrolled.stripe.customerId,
            items: priceIds,
            default_payment_method: enrolled?.stripe?.paymentMethodId,
          });

          // Queries:
          // Cancel Previous Subscription from Stripe
          // Update Branch Expire,
          // Disable Previous Enrollment,
          // Disable Previous Enrollment Subscription
          // Update New Enrollment,
          const updateQueries: any[] = [
            stripe.subscriptions.cancel(enrolled?.stripe?.subscriptionId),
            Branch.updateMany({ retailerId: req.user._id, source: "subscription" }, { enrollmentId: enrollment._id }),
            Enrollment.updateOne({ _id: enrolled._id }, { status: false }),
            EnrollSubscription.updateMany({ enrollmentId: enrolled._id }, { status: false }),
            Enrollment.updateOne(
              { _id: enrollment._id },
              {
                status: true,
                paymentStatus: "completed",
                validityFrom: moment(),
                validityTo: moment().add(30, "days"),
                "stripe.subscriptionId": stripeSubscription.id,
                "stripe.customerId": enrolled.stripe.customerId,
                "stripe.paymentMethodId": enrolled.stripe.paymentMethodId,
              }
            ),
          ];

          // Get Subscription Items Id and Map with Enroll Id
          const subscriptionItems: any = await stripe.subscriptionItems.list({
            subscription: stripeSubscription?.id,
            expand: ["data.plan.product"],
          });

          const subscriptionItemsMap = Object.fromEntries(
            subscriptionItems.data.map((item: any) => [item.plan.product.metadata.enrollSubscriptionId, item.id])
          );

          for (const key in subscriptionItemsMap) {
            updateQueries.push(
              EnrollSubscription.findByIdAndUpdate(key, {
                subscriptionItemId: subscriptionItemsMap[key],
                status: true,
              })
            );
          }

          // Check Refund
          const isRefunded = Math.abs(totalAmount) >= refundableThreshold;
          if (isRefunded && totalAmount !== 0) {
            updateQueries.push(
              Refund.create({
                currency,
                enrollmentId: enrollment._id,
                refundAmount: parseFloat(Math.abs(totalAmount).toFixed(2)),
                refundStatus: "pending",
              })
            );
          }

          await Promise.all(updateQueries);

          // send invoice mail
          const enrollSubscriptions = await EnrollSubscription.find({
            enrollmentId: enrollment?._id,
          });

          const prevOrCurrentSubscriptionsMap = Object.fromEntries(
            subscriptionItems.data.map((item: any) => [
              item.plan.product.metadata.enrollSubscriptionId,
              item.plan.product.metadata.prev,
            ])
          );

          const newEnrollSubscriptions = enrollSubscriptions?.filter(
            (item: any) => prevOrCurrentSubscriptionsMap[item?._id] === "false"
          );

          const customerInfo = {
            name: req?.user.firstName + req?.user?.lastName,
            phone: `${req?.user?.dialCode}-${req?.user?.phone}`,
            address: `${req?.user?.address}, ${req?.user?.city}, ${req?.user?.postalCode}`,
          };

          let taxValue = 0;
          let couponValue = 0;
          let subTotal = 0;

          let coupon: any = null;
          const purchasedItems = newEnrollSubscriptions?.map((purchasedSubscription: any) => {
            // Check coupon eligibility & apply
            if (purchasedSubscription?.couponSnapshot) {
              couponValue +=
                purchasedSubscription?.couponSnapshot?.discountType === "percentage"
                  ? (purchasedSubscription?.planSnapshot?.price * purchasedSubscription?.couponSnapshot?.discount) / 100
                  : enrollment?.currencyRate * purchasedSubscription?.couponSnapshot?.discount;
              coupon = purchasedSubscription?.couponSnapshot;
            }

            // Only tax apply
            if (enrollment?.taxSnapshot) {
              taxValue += (purchasedSubscription?.planSnapshot?.price * enrollment?.taxSnapshot?.taxCost) / 100;
            }

            subTotal += purchasedSubscription?.planSnapshot?.price * enrollment?.currencyRate;

            return {
              title: purchasedSubscription?.planSnapshot?.title,
              quantity: 1,
              unitPrice: `${Number(purchasedSubscription?.planSnapshot?.price * enrollment?.currencyRate).toFixed(2)} ${enrollment?.currency}`,
              total: `${Number(purchasedSubscription?.planSnapshot?.price * enrollment?.currencyRate).toFixed(2)} ${enrollment?.currency}`,
            };
          });

          const invoiceMetadata = {
            invoiceNo: "",
            subtotal: `${Number(subTotal).toFixed(2)} ${enrollment?.currency}`,
            remainingAmount:
              enrollment?.enrollStatus === "purchase" ? null : `${balanceAmount} ${enrollment?.currency}`,
            planChangeCost:
              enrollment?.enrollStatus === "purchase"
                ? null
                : `${enrollment?.planChangeCost.toFixed(2)} ${enrollment?.currency}`,
            couponDiscount: couponValue !== 0 ? `${couponValue.toFixed(2)} ${enrollment?.currency}` : null,
            taxDiscount: enrollment?.taxSnapshot ? `${taxValue?.toFixed(2)} ${enrollment?.currency}` : null,
            coupon,
            tax: enrollment?.taxSnapshot
              ? {
                  taxTitle: enrollment?.taxSnapshot?.taxTitle,
                  taxCost: enrollment?.taxSnapshot?.taxCost,
                }
              : null,
            total: `${parseFloat(Math.abs(totalAmount).toFixed(2))} ${enrollment?.currency}`,
            extraPayableAmount:
              enrollment?.enrollStatus === "purchase" || !Number(extraPayableAmount)
                ? null
                : Number(extraPayableAmount)?.toFixed(2),
          };

          // console.log({ purchasedItems, subTotal, taxValue, couponValue, balanceAmount, invoiceMetadata });

          const paymentInfo = {
            bankName: "Fauget Bank",
            accountName: "Juliana Silva",
            accountNo: "123-456-7890",
          };

          await sendInvoiceToEmail({
            email: req?.user?.email,
            customerInfo,
            purchasedItems,
            invoiceMetadata,
            paymentInfo,
          });

          return apiResponse(res, 200, true, `Your plan successfully downgraded!`, {
            plan: pickPlan?.slug,
            planStartAt: moment(),
            planValidAt: moment().add(pickPlan.duration, "days"),
            totalBranch: pickPlan?.allowTotalBranch,
          });
        }
        /////////////////////////////////////////////////
        //////// Decision 2: Payment & Downgrade ////////
        /////////////////////////////////////////////////
        else {
          // Add Previous Add-on into new enrollment
          for (const prevAddon of prevAddons) {
            let finalPrice = 0;
            let taxValue = 0;

            finalPrice = Number((selectCurrency.exchangeRate * prevAddon.planSnapshot.price).toFixed(2));

            const convertToSelectedCurrency = Number(
              ((selectCurrency.exchangeRate / enrolled.currencyRate) * prevAddon.planSnapshot.price).toFixed(2)
            );

            const addonBalanceAmount: number = calculateBalanceAmount(
              enrolled.validityFrom,
              enrolled.validityTo,
              convertToSelectedCurrency
            );

            if (enrolled.taxSnapshot.taxTitle) {
              const prevTax = (prevAddon.planSnapshot.price * enrolled.taxSnapshot.taxCost) / 100;

              totalCouponAmount += addonBalanceAmount + prevTax; // Minus Used Amount with Tax
            } else {
              totalCouponAmount += addonBalanceAmount; // Minus Used Amount
            }

            extraPayableAmount += convertToSelectedCurrency - addonBalanceAmount; // Send to Frontend

            // Only tax apply
            if (taxStatus === "on") {
              taxValue = (finalPrice * taxCost) / 100;
              finalPrice += taxValue;
            }

            const enrollSubscription = await EnrollSubscription.create({
              enrollmentId: enrollment?._id,
              planSnapshot: prevAddon.planSnapshot,
              couponSnapshot: null,
              planCurrentPrice: (finalPrice - taxValue).toFixed(2),
            });

            line_items.push({
              price_data: {
                currency: currency.toLowerCase(),
                product_data: {
                  name: `${prevAddon.planSnapshot.title} Add-On (Previous)`,
                  ...(taxStatus === "on" && {
                    description: `${prevAddon.planSnapshot.title} Add-On (including ${taxTitle} ${taxCost}%)`,
                  }),
                  metadata: {
                    enrollSubscriptionId: String(enrollSubscription._id),
                  },
                },
                unit_amount:
                  selectCurrency?.name === "JPY"
                    ? Math.round(Number(finalPrice))
                    : Math.round(Number(finalPrice) * 100), // convert into cent
                recurring: {
                  interval: "month",
                },
              },
              quantity: 1,
            });
          }

          // Add New Plan & Add-on into new enrollment
          for (const subscription of subscriptions) {
            let finalPrice = 0;
            let taxValue = 0;

            finalPrice = Number((selectCurrency.exchangeRate * subscription.price).toFixed(2));

            // Only tax apply
            if (taxStatus === "on") {
              taxValue = (finalPrice * taxCost) / 100;
              finalPrice += taxValue;
            }

            const enrollSubscription = await EnrollSubscription.create({
              enrollmentId: enrollment?._id,
              planSnapshot: subscription,
              couponSnapshot: null,
              planCurrentPrice: (finalPrice - taxValue).toFixed(2),
            });

            const isPlan = [PACKAGES.BASIC, PACKAGES.PRO, PACKAGES.ADVANCED].includes(subscription.slug);

            line_items.push({
              price_data: {
                currency: currency.toLowerCase(),
                product_data: {
                  name: `${subscription.title} ${isPlan ? "Plan" : "Add-On"}`,
                  ...(taxStatus === "on" && {
                    description: `${subscription.title} ${isPlan ? "Plan" : "Add-On"} (including ${taxTitle} ${taxCost}%)`,
                  }),
                  metadata: {
                    enrollSubscriptionId: String(enrollSubscription._id),
                  },
                },
                unit_amount:
                  selectCurrency?.name === "JPY"
                    ? Math.round(Number(finalPrice))
                    : Math.round(Number(finalPrice) * 100), // convert into cent
                recurring: {
                  interval: "month",
                },
              },
              quantity: 1,
            });
          }

          const applyCoupon = await stripe.coupons.create({
            name: "Current Balance",
            amount_off:
              selectCurrency?.name === "JPY"
                ? Math.round(Number(totalCouponAmount))
                : Math.round(Number(totalCouponAmount) * 100),
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
          unit_amount:
            selectCurrency?.name === "JPY"
              ? Math.round(Number(planChangeCost * selectCurrency.exchangeRate))
              : Math.round(Number(planChangeCost * selectCurrency.exchangeRate) * 100), // convert into cent
        },
        quantity: 1,
      });
    } else {
      ///////////////////////////////////
      //////// New Subscription /////////
      ///////////////////////////////////

      const enrollment = await Enrollment.create({
        retailerId: req.user._id,
        planExists: pickPlan ? pickPlan?.slug : null,
        taxSnapshot: {
          taxTitle: taxStatus === "on" ? taxTitle : null,
          taxCost: taxStatus === "on" ? taxCost : null,
        },
        currency,
        currencyRate: selectCurrency.exchangeRate,
        paymentStatus: "pending",
        enrollStatus: "purchase",
        status: false,
      });

      let totalCouponAmount = 0;
      metadata["enrollmentId"] = String(enrollment._id);

      // Package push into line items
      for (const subscription of subscriptions) {
        let finalPrice = 0;
        let taxValue = 0;
        let couponValue = 0;

        finalPrice = Number((selectCurrency.exchangeRate * subscription.price).toFixed(2));

        //Check coupon eligibility & apply
        if (coupon && appliedSlugs.includes(subscription.slug)) {
          couponValue =
            coupon.discountType === "percentage"
              ? (finalPrice * coupon?.discount) / 100
              : selectCurrency.exchangeRate * coupon?.discount;

          totalCouponAmount += Number(couponValue.toFixed(2));
        }

        // Only tax apply
        if (taxStatus === "on") {
          taxValue = (finalPrice * taxCost) / 100;
          finalPrice += taxValue;
        }

        const enrollSubscription = await EnrollSubscription.create({
          enrollmentId: enrollment?._id,
          planSnapshot: subscription,
          couponSnapshot: coupon && appliedSlugs.includes(subscription.slug) ? coupon : null,
          planCurrentPrice: (finalPrice - taxValue - couponValue).toFixed(2),
        });

        const isPlan = [PACKAGES.BASIC, PACKAGES.PRO, PACKAGES.ADVANCED].includes(subscription.slug);

        line_items.push({
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: `${subscription.title} ${isPlan ? "Plan" : "Add-On"}`,
              ...(taxStatus === "on" && {
                description: `${subscription.title} ${isPlan ? "Plan" : "Add-On"} (including ${taxTitle} ${taxCost}%)`,
              }),
              metadata: {
                enrollSubscriptionId: String(enrollSubscription._id),
                prev: "false",
              },
            },
            unit_amount:
              selectCurrency?.name === "JPY" ? Math.round(Number(finalPrice)) : Math.round(Number(finalPrice) * 100), // convert into cent
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        });
      }

      // Create the coupon and push into line items
      if (coupon) {
        const applyCoupon = await stripe.coupons.create({
          name: coupon.title,
          amount_off:
            selectCurrency?.name === "JPY"
              ? Math.round(Number(totalCouponAmount))
              : Math.round(Number(totalCouponAmount) * 100),
          currency,
          duration: "once",
        });

        coupons.push({
          coupon: applyCoupon.id,
        });
      }
    }

    metadata["extraPayableAmount"] = extraPayableAmount;

    const session = await stripe.checkout.sessions.create({
      line_items,
      mode: "subscription",
      payment_method_types: ["card"],
      metadata, // Need for update info after complete payment
      discounts: coupons,
      success_url: `${process.env.FRONTEND_URL}/payment/complete`,
      cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
      customer_email: req?.user?.email,
    });

    const data: Object = { url: session?.url };

    if (extraPayableAmount > 0) {
      data["addonExists"] = true;
      data["payableAmount"] = extraPayableAmount.toFixed(2);
    } else {
      data["addonExists"] = false;
    }

    return apiResponse(res, 200, true, "Send to Payment Page!", data);
  }

  throw "Only one subscription plan and no duplicate addons are allowed!";
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

    /////////////////////////////////////////////////////////////////
    //////// Handling Renew Subscription (Recurring Payment) ////////
    ////////////////////////////////////////////////////////////////
    case "invoice.payment_succeeded":
      console.log("Handling Renew Subscription (Recurring Payment)!");
      const invoicePaymentEvent = event.data.object;

      const invoice: any = await stripe.invoices.retrieve(invoicePaymentEvent?.id as string, {
        expand: ["payment_intent.payment_method"],
      });

      if (
        invoicePaymentEvent.billing_reason === "subscription_update" ||
        invoicePaymentEvent.billing_reason === "subscription_cycle"
      ) {
        console.log("Subscription is updated!");

        const updatedEnrollment = await Enrollment.findOneAndUpdate(
          { "stripe.subscriptionId": invoicePaymentEvent.subscription },
          {
            validityFrom: moment(),
            validityTo: moment().add(30, "days"),
          },
          { new: true }
        );

        const enrollSubscriptionIds = (
          await EnrollSubscription.find({
            enrollmentId: updatedEnrollment?._id,
            status: true,
          })
        ).map((subscription) => subscription?._id);

        await Payment.create({
          enrollmentId: updatedEnrollment?._id,
          enrollSubscriptionIds,
          paymentIntentId: invoicePaymentEvent.payment_intent,
          invoiceNumber: invoicePaymentEvent.number,
          invoicePdf: invoicePaymentEvent.invoice_pdf,
          paymentStatus: "succeeded",
          amountTotal:
            updatedEnrollment?.currency === "JPY"
              ? invoicePaymentEvent?.total
              : (invoicePaymentEvent?.total / 100).toFixed(2),
          currency: updatedEnrollment?.currency,
          paymentMethodDetails: invoice?.payment_intent?.payment_method, // Kind of Log Store
        });
      }
      break;

    /////////////////////////////////////////////////////////////////
    //////// Handling Cancel & Renew Subscription By Retailer ///////
    /////////////////////////////////////////////////////////////////
    case "customer.subscription.updated":
      console.log("Handling Cancel & Renew Subscription By Retailer!");
      let subscriptionUpdateObject = event.data.object;

      await Enrollment.findOneAndUpdate(
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
          Enrollment.findOneAndUpdate(
            { "stripe.subscriptionId": invoiceObject.subscription },
            {
              status: false,
            }
          ),
          stripe.subscriptions.cancel(invoiceObject.subscription as string),
        ]);
      }
      break;

    //////////////////////////////////////////////////////////////////
    //////// Handling Customer Default Payment Card /////////////////
    /////////////////////////////////////////////////////////////////
    case "customer.updated":
      console.log("Customer Updated!");
      let customerObject = event.data.object;

      await Enrollment.findOneAndUpdate(
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
    const [checkoutSession, retailer, freeTrailSubscription] = await Promise.all<[any, any, any]>([
      stripe.checkout.sessions.retrieve(eventObject.id),
      Retailer.findOne({ email: eventObject.customer_email }),
      Subscription.findOne({ slug: "trial" }),
    ]);

    const invoice: any = await stripe.invoices.retrieve(eventObject.invoice as string, {
      expand: ["payment_intent.payment_method"],
    });

    if (invoice.payment_intent.status !== "succeeded") return;

    // Get Subscription Items Id and Map with Enroll Id
    const subscriptionItems: any = await stripe.subscriptionItems.list({
      subscription: checkoutSession.subscription as string,
      expand: ["data.plan.product"],
    });

    const subscriptionItemsMap = Object.fromEntries(
      subscriptionItems.data.map((item: any) => [item.plan.product.metadata.enrollSubscriptionId, item.id])
    );

    const prevOrCurrentSubscriptionsMap = Object.fromEntries(
      subscriptionItems.data.map((item: any) => [
        item.plan.product.metadata.enrollSubscriptionId,
        item.plan.product.metadata.prev,
      ])
    );

    // If a user takes a plan without taking the free trial, then the free trial isn't applicable anymore
    if (!retailer.takeFreeTrial) {
      if (freeTrailSubscription) {
        const now = moment();
        const expireDate = moment().add(freeTrailSubscription.duration, "days");

        const [enrollment] = await Promise.all([
          Enrollment.create({
            retailerId: retailer._id,
            planExists: PACKAGES.TRIAL,
            paymentStatus: "trial",
            validityFrom: now,
            validityTo: expireDate,
            enrollStatus: "trial",
          }),
          Retailer.findByIdAndUpdate(retailer._id, { takeFreeTrial: true }),
        ]);

        await EnrollSubscription.create({
          enrollmentId: enrollment?._id,
          planSnapshot: freeTrailSubscription,
        });
      }
    }

    let updateSubscriptions: any = [];
    const { enrollmentId = null, balanceAmount = 0, extraPayableAmount = 0 } = checkoutSession?.metadata;

    const enrollment = await Enrollment.findById(enrollmentId);

    // Deactivate last previous active plan
    let prevEnrollment;

    if (enrollment?.planExists) {
      prevEnrollment = await Enrollment.findOneAndUpdate(
        {
          retailerId: retailer._id,
          planExists: { $ne: null },
          paymentStatus: { $in: ["completed", "trial"] },
          status: true,
        },
        { status: false },
        { new: true }
      );

      await EnrollSubscription.updateMany(
        {
          enrollmentId: prevEnrollment?._id,
        },
        {
          status: false,
        }
      );

      if (prevEnrollment && prevEnrollment.paymentStatus !== "trial") {
        await stripe.subscriptions.cancel(prevEnrollment?.stripe?.subscriptionId);
      }

      const enrollSubscription = await EnrollSubscription.findOne({
        enrollmentId,
        "planSnapshot.type": "subscription",
      });

      // Update expiration for already created branch
      if (enrollment?.planExists) {
        updateSubscriptions.push(
          Branch.updateMany(
            {
              retailerId: retailer._id,
              source: "subscription",
            },
            { enrollSubscriptionId: enrollSubscription._id }
          )
        );
      }
    }

    // Store Payment Info
    const payment = await Payment.create({
      enrollmentId: enrollment?._id,
      enrollSubscriptionIds: Object.keys(subscriptionItemsMap),
      invoiceNumber: invoice?.number,
      invoicePdf: invoice?.invoice_pdf,
      paymentIntentId: invoice?.payment_intent?.id,
      paymentStatus: invoice?.payment_intent?.status,
      amountTotal:
        checkoutSession.metadata["currency"] === "JPY"
          ? checkoutSession?.amount_total
          : (checkoutSession?.amount_total / 100).toFixed(2),
      currency: checkoutSession.metadata["currency"],
      paymentMethodDetails: invoice?.payment_intent?.payment_method, // Kind of Log Store
    });

    // Update Enrollment with Payment
    updateSubscriptions.push(
      Enrollment.findByIdAndUpdate(enrollmentId, {
        paymentStatus: "completed",
        stripe: {
          subscriptionId: checkoutSession?.subscription,
          customerId: checkoutSession?.customer,
          paymentMethodId: invoice?.payment_intent?.payment_method?.id,
          renewCancelAt: null,
          renewCanceledAtByCustomer: null,
        },
        validityFrom: moment(),
        validityTo: moment().add(30, "days"),
        status: true,
      })
    );

    const updatedEnrollSubscriptions = await Promise.all(
      Object.keys(subscriptionItemsMap).map(async (key) => {
        return EnrollSubscription.findByIdAndUpdate(
          key,
          {
            subscriptionItemId: subscriptionItemsMap[key],
            status: true,
          },
          { new: true }
        );
      })
    );

    // Handle Critical Payment (if payment method id is missing)
    if (!invoice?.payment_intent?.payment_method?.id) {
      await CriticalPayment.create({
        enrollmentId,
        paymentId: payment._id,
        stripeInvoiceId: eventObject.invoice,
        status: "pending",
      });
    }

    // Prepare to send invoice
    const customerInfo = {
      name: retailer?.fullName,
      phone: `${retailer?.dialCode}-${retailer?.phone}`,
      address: `${retailer?.address}, ${retailer?.city}, ${retailer?.postalCode}`,
    };

    const newEnrollSubscriptions = updatedEnrollSubscriptions?.filter(
      (item: any) => prevOrCurrentSubscriptionsMap[item?._id] === "false"
    );

    let taxValue = 0;
    let couponValue = 0;
    let subTotal = 0;

    let coupon: any = null;
    const purchasedItems = newEnrollSubscriptions?.map((purchasedSubscription: any) => {
      // Check coupon eligibility & apply
      if (purchasedSubscription?.couponSnapshot) {
        couponValue +=
          purchasedSubscription?.couponSnapshot?.discountType === "percentage"
            ? (purchasedSubscription?.planSnapshot?.price * purchasedSubscription?.couponSnapshot?.discount) / 100
            : enrollment?.currencyRate * purchasedSubscription?.couponSnapshot?.discount;
        coupon = purchasedSubscription?.couponSnapshot;
      }

      // Only tax apply
      if (enrollment?.taxSnapshot) {
        taxValue += (purchasedSubscription?.planSnapshot?.price * enrollment?.taxSnapshot?.taxCost) / 100;
      }

      subTotal += purchasedSubscription?.planSnapshot?.price * enrollment?.currencyRate;

      return {
        title: purchasedSubscription?.planSnapshot?.title,
        quantity: 1,
        unitPrice: `${Number(purchasedSubscription?.planSnapshot?.price * enrollment?.currencyRate).toFixed(2)} ${enrollment?.currency}`,
        total: `${Number(purchasedSubscription?.planSnapshot?.price * enrollment?.currencyRate).toFixed(2)} ${enrollment?.currency}`,
      };
    });

    const invoiceMetadata = {
      invoiceNo: invoice?.number,
      subtotal: `${Number(subTotal).toFixed(2)} ${enrollment?.currency}`,
      remainingAmount: enrollment?.enrollStatus === "purchase" ? null : `${balanceAmount} ${enrollment?.currency}`,
      planChangeCost:
        enrollment?.enrollStatus === "purchase"
          ? null
          : `${enrollment?.planChangeCost.toFixed(2)} ${enrollment?.currency}`,
      couponDiscount: couponValue !== 0 ? `${couponValue.toFixed(2)} ${enrollment?.currency}` : null,
      taxDiscount: enrollment?.taxSnapshot ? `${taxValue?.toFixed(2)} ${enrollment?.currency}` : null,
      coupon,
      tax: enrollment?.taxSnapshot
        ? {
            taxTitle: enrollment?.taxSnapshot?.taxTitle,
            taxCost: enrollment?.taxSnapshot?.taxCost,
          }
        : null,
      total: `${(checkoutSession?.amount_total / 100).toFixed(2)} ${enrollment?.currency}`,
      extraPayableAmount:
        enrollment?.enrollStatus === "purchase" || !Number(extraPayableAmount)
          ? null
          : Number(extraPayableAmount)?.toFixed(2),
    };

    // console.log({ purchasedItems, subTotal, taxValue, couponValue, balanceAmount, invoiceMetadata });

    const paymentInfo = {
      bankName: "Fauget Bank",
      accountName: "Juliana Silva",
      accountNo: "123-456-7890",
    };

    await Promise.all(updateSubscriptions);

    await sendInvoiceToEmail({ email: retailer?.email, customerInfo, purchasedItems, invoiceMetadata, paymentInfo });
  } catch (err) {
    console.log(err);
    // throw err.message || err || "Something went wrong!";
  }
};

/**
 * Test Email with PDF
 * @param {Request} eventObject - The HTTP webhook event object.
 * @param {Request} stripe - The stripe object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const testEmailPDF = asyncHandler(async (req: IApiRequest, res: Response) => {
  const settings = await Settings.findOne(
    {},
    {
      "mail.host": 1,
      "mail.port": 1,
      "mail.username": 1,
      "mail.password": 1,
      "general.companyName": 1,
    }
  );

  const customerInfo = {
    name: "Estelle Darcy",
    phone: "+123-456-7890123",
    address: "Anywhere St., Any City, ST 12345",
  };
  const purchasedItems = [{ title: "Advanced Plan", quantity: 1, unitPrice: 30.0, total: 30 }];

  const invoiceMetadata = {
    invoiceNo: 1234,
    subtotal: 30,
    remainingAmount: 5,
    planChangeCost: 1,
    couponDiscount: 3,
    taxDiscount: 0.6,
    coupon: {
      title: "Eid Coupon",
      discountType: "percentage",
      discount: 10,
    },
    tax: {
      taxTitle: "VAT",
      taxCost: 2,
    },
    total: 24.44,
  };

  const paymentInfo = {
    bankName: "Fauget Bank",
    accountName: "Juliana Silva",
    accountNo: "123-456-7890",
  };

  await htmlToPdf({ customerInfo, purchasedItems, invoiceMetadata, paymentInfo });

  const transporter = nodemailer.createTransport({
    host: settings?.mail?.host,
    port: Number(settings?.mail?.port),
    secure: true,
    auth: {
      user: settings?.mail?.username,
      pass: settings?.mail?.password,
    },
  });

  const mailOptions = {
    from: settings?.mail?.username,
    to: "rakibiuaece@gmail.com",
    subject: "Subscription Invoice",
    html: getInvoiceTemplate({ customerInfo, purchasedItems, invoiceMetadata, paymentInfo }),
    attachments: [
      {
        path: __dirname + "/temp/invoice.pdf",
        filename: "invoice.pdf",
        contentType: "contentType",
      },
    ],
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Demo PDF created successfully!");
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw new Error("Error sending verification email!");
  }

  return apiResponse(res, 200, true, "Test Email with Pdf!");
});
