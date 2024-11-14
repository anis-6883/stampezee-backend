import { Response } from "express";
import moment from "moment";
import nodemailer from "nodemailer";
import Stripe from "stripe";
import { PACKAGES } from "../../configs/constants";
import { apiResponse, asyncHandler, checkCombination, checkDuplicates, exclude, htmlToPdf } from "../../helpers";
import Coupon, { ICoupon } from "../../models/coupon";
import CriticalPayment from "../../models/critical-payment";
import CurrencyExchange from "../../models/currency-exchange";
import EnrollSubscription from "../../models/enroll-subscription";
import Enrollment from "../../models/enrollment";
import Payment from "../../models/payment";
import Retailer from "../../models/retailer";
import Settings from "../../models/settings";
import Subscription, { ISubscription } from "../../models/subscription";
import { getInvoiceTemplate } from "../../templates/invoice";
import { IApiRequest, ILineItem } from "../../types";
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
 * Enroll Subscription
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
// export const enrollSubscription = asyncHandler(async (req: IApiRequest, res: Response) => {
//   const result = await enrollSubscriptionSchema.validateAsync(req.body, {
//     abortEarly: false,
//   });

//   const { slug, code, branchIds, stampIds, currency }: IEnrollSubscriptionBody = result;

//   if (slug === PACKAGES.TRIAL && code) {
//     throw "You can't take additional packages or coupon in free trial!";
//   }

//   // Enroll Free Trial
//   if (slug === PACKAGES.TRIAL) {
//     if (!req.user.takeFreeTrial) {
//       const subscription = await Subscription.findOne({ slug: "trial" });

//       if (subscription) {
//         const now = moment();
//         const expireDate = moment().add(subscription.duration, "days");

//         Promise.all([
//           EnrollSubscription.create({
//             retailerId: req.user._id,
//             planSnapshot: subscription,
//             paymentStatus: "trial",
//             validityFrom: now,
//             validityTo: expireDate,
//             enrollStatus: "trial",
//           }),
//           Retailer.findByIdAndUpdate(req.user._id, { takeFreeTrial: true }),
//         ]);
//         return apiResponse(res, 200, true, "Free trial enrolled successfully!", {
//           takeFreeTrial: true,
//           plan: "trial",
//           planStartAt: now,
//           planValidAt: expireDate,
//           totalBranch: 1,
//         });
//       }
//       throw "Free trial package not found!";
//     }
//     throw "Free trial already taken!";
//   }

//   const pickSubscriptionPlan = await Subscription.findOne({ slug });
//   const isPlan = [PACKAGES.BASIC, PACKAGES.PRO, PACKAGES.ADVANCED].includes(slug);

//   // Check already enrolled or not
//   const enrolled = await EnrollSubscription.findOne({
//     retailerId: req.user._id,
//     "planSnapshot.type": "subscription",
//     paymentStatus: "completed",
//     validityTo: { $gt: moment() },
//     status: true,
//   });

//   // if (enrolled && slug === enrolled.planSnapshot.slug) throw `You already take ${enrolled.planSnapshot.title} plan!`;
//   if (!enrolled && !isPlan) throw `You can't purchase an add-on without an active plan!`;

//   // Check & Get Coupon
//   let coupon = null;
//   if (code) {
//     coupon = (
//       await Coupon.aggregate([
//         {
//           $match: {
//             code,
//             startedAt: { $lte: new Date() },
//             expiredAt: { $gte: new Date() },
//             status: true,
//             softDeleted: false,
//           },
//         },
//         {
//           $project: {
//             _id: 1,
//             title: 1,
//             code: 1,
//             discountType: 1,
//             discount: 1,
//             allowFor: 1,
//             allowedRetailers: 1,
//             applicablePackages: 1,
//             limit: 1,
//           },
//         },
//       ])
//     )[0];

//     if (!coupon) throw "Provided invalid coupon code!";

//     const subscriptions = await Subscription.find({
//       _id: { $in: coupon?.applicablePackages || [] },
//       slug: { $ne: "trial" },
//     });

//     const applicablePackages = subscriptions.map((subscription) => subscription.slug);
//     if (!applicablePackages.includes(slug)) throw "Provided invalid coupon code!";

//     if (coupon.allowFor === "specific") {
//       if (!coupon.allowedRetailers.includes(req.user._id as any)) throw "Provided invalid coupon code!";
//     }

//     const alreadyApplied = await EnrollSubscription.countDocuments({
//       retailerId: req.user._id,
//       "couponSnapshot._id": coupon._id,
//       paymentStatus: "completed",
//     });

//     if (alreadyApplied >= coupon.limit) throw "Your coupon limit is over!";
//   }

//   // Get Payment Metadata & Allowed Currencies
//   const [paymentMetadata, allowCurrencies] = await Promise.all([
//     Settings.findOne(
//       {},
//       {
//         "stripe.planChangeCost": 1,
//         "stripe.refundableThreshold": 1,
//         "stripe.taxTitle": 1,
//         "stripe.taxCost": 1,
//         "stripe.taxStatus": 1,
//         "stripe.stripeSecretKey": 1,
//       }
//     ),
//     CurrencyExchange.find({ status: true }),
//   ]);

//   const { stripeSecretKey, planChangeCost, refundableThreshold, taxTitle, taxCost, taxStatus } =
//     paymentMetadata.stripe ?? {};
//   const selectCurrency = allowCurrencies.find((curr) => curr.name === currency);

//   if (!paymentMetadata) throw "Something went wrong in Stripe settings!";
//   if (!selectCurrency) throw "Provided currency is not allowed!";

//   const stripe = new Stripe(stripeSecretKey);

//   ////////////////////////////////////////////////////////////////////////
//   //////// Decision -> (Upgrade or Downgrade) or New Subscription ////////
//   ////////////////////////////////////////////////////////////////////////

//   const enrollIdDuration: { [key: string]: number | string } = {};
//   const line_items: ILineItem[] = [];
//   const coupons: { coupon: string }[] = [];

//   if (isPlan && enrolled) {
//     // const changeMode: number = checkPlanChange(
//     //   [PACKAGES.BASIC, PACKAGES.PRO, PACKAGES.ADVANCED],
//     //   enrolled.planSnapshot.slug,
//     //   pickSubscriptionPlan?.slug
//     // );

//     const changeMode: number = 1;

//     const convertToSelectedCurrency = Number(
//       (
//         (selectCurrency.exchangeRate / enrolled.balanceInfo.currencyRate) *
//         enrolled.balanceInfo.planCurrentPrice
//       ).toFixed(2)
//     );

//     const balanceAmount: number = calculateBalanceAmount(
//       enrolled.validityFrom,
//       enrolled.validityTo,
//       convertToSelectedCurrency
//     );

//     ///////////////////////////////
//     //////// Plan Upgrade /////////
//     ///////////////////////////////
//     if (changeMode > 0) {
//       let finalPrice = 0;
//       let taxValue = 0;
//       let couponValue = 0;

//       finalPrice = Number((selectCurrency.exchangeRate * pickSubscriptionPlan.price).toFixed(2));

//       // Check coupon eligibility & apply
//       if (coupon) {
//         couponValue =
//           coupon.discountType === "percentage"
//             ? (finalPrice * coupon?.discount) / 100
//             : selectCurrency.exchangeRate * coupon?.discount;
//       }

//       // Only tax apply
//       if (taxStatus === "on") {
//         taxValue += (finalPrice * taxCost) / 100;
//         finalPrice += taxValue;
//       }

//       const enrollSubscription: any = await EnrollSubscription.create({
//         retailerId: req.user._id,
//         planSnapshot: pickSubscriptionPlan,
//         couponSnapshot: coupon ?? null,
//         taxSnapshot: {
//           taxTitle: taxStatus === "on" ? taxTitle : null,
//           taxCost: taxStatus === "on" ? taxCost : null,
//         },
//         balanceInfo: {
//           currency,
//           currentBalance: balanceAmount,
//           currencyRate: selectCurrency.exchangeRate,
//           planCurrentPrice: (finalPrice - taxValue - couponValue).toFixed(2),
//         },
//         planChangeCost: planChangeCost * selectCurrency.exchangeRate,
//         paymentStatus: "pending",
//         enrollStatus: "upgrade",
//         status: false,
//       });

//       enrollIdDuration["planEnrollmentId"] = String(enrollSubscription._id);
//       enrollIdDuration[enrollSubscription._id] = pickSubscriptionPlan.duration;

//       line_items.push({
//         price_data: {
//           currency: currency.toLowerCase(),
//           product_data: {
//             name: `${pickSubscriptionPlan.title} Plan`,
//             ...(taxStatus === "on" && {
//               description: `${pickSubscriptionPlan.title} Plan (including VAT ${taxCost}%)`,
//             }),
//           },
//           unit_amount:
//             selectCurrency?.name === "JPY" ? Math.round(Number(finalPrice)) : Math.round(Number(finalPrice) * 100), // convert into cent
//           recurring: {
//             interval: "month",
//           },
//         },
//         quantity: 1,
//       });

//       // Minus Balance Handle By Coupon
//       const applyCoupon = await stripe.coupons.create({
//         name: coupon ? "Current Balance + Coupon" : "Current Balance",
//         amount_off:
//           selectCurrency?.name === "JPY"
//             ? Math.round(Number(balanceAmount + couponValue))
//             : Math.round(Number(balanceAmount + couponValue) * 100),
//         currency,
//         duration: "once",
//       });

//       coupons.push({
//         coupon: applyCoupon.id,
//       });
//     }

//     ////////////////////////////////
//     //////// Plan Downgrade ///////
//     ///////////////////////////////
//     if (changeMode < 0) {
//       if (coupon) throw `Coupon is not allowed in plan downgrade!`;
//       if (!enrolled?.stripe?.paymentMethodId) throw `Something went wrong on your payment method!`;

//       const downgradeBranchLimit = pickSubscriptionPlan?.allowTotalBranch;
//       const downgradeStampLimit = pickSubscriptionPlan?.allowTotalStamp;

//       const branches = await Branch.find({ retailerId: req.user._id, source: "subscription", softDeleted: false });
//       const stamps = await Stamp.find({ retailerId: req.user._id, softDeleted: false });

//       const disabledBySystemBranch = branches.filter((branch) => !branch.disabledBySystem).length;

//       if (branches.length > downgradeBranchLimit && disabledBySystemBranch > downgradeBranchLimit) {
//         if (!branchIds) throw "branchIds is required!";

//         if (branchIds && branchIds.length !== disabledBySystemBranch - downgradeBranchLimit) {
//           throw `You have to inactive ${disabledBySystemBranch - downgradeBranchLimit} subscription branch/s before downgrade!`;
//         }

//         if (branchIds && branchIds.length >= disabledBySystemBranch - downgradeBranchLimit) {
//           await Branch.updateMany(
//             { retailerId: req.user._id, _id: { $in: branchIds } },
//             { disabledBySystem: true, status: false }
//           );
//         }
//       }

//       if (stamps.length > downgradeStampLimit) {
//         if (!stampIds) throw "stampIds is required!";

//         if (stampIds) {
//           await Stamp.updateMany(
//             { retailerId: req.user._id, _id: { $in: stampIds } },
//             { softDeleted: true, status: false }
//           );
//         }
//       }

//       let finalPrice = Number((selectCurrency.exchangeRate * pickSubscriptionPlan.price).toFixed(2));
//       let taxValue = 0;

//       const totalAmount = Number(finalPrice - balanceAmount);

//       // Only tax apply
//       if (taxStatus === "on") {
//         taxValue += (finalPrice * taxCost) / 100;
//         finalPrice += taxValue;
//       }

//       //////// Decision 1: Refund & Downgrade ///////
//       if (totalAmount <= 0) {
//         // Create price/product for plan downgrading in stripe
//         const price = await stripe.prices.create({
//           currency: currency.toLocaleLowerCase(),
//           unit_amount:
//             selectCurrency?.name === "JPY" ? Math.round(Number(finalPrice)) : Math.round(Number(finalPrice * 100)),
//           recurring: {
//             interval: "month",
//           },
//           product_data: {
//             name:
//               taxStatus === "on"
//                 ? `${pickSubscriptionPlan.title} Plan (including ${taxTitle} ${taxCost}%)`
//                 : `${pickSubscriptionPlan.title} Plan`,
//           },
//         });

//         //  Cancel Previous Subscription from Stripe
//         await stripe.subscriptions.cancel(enrolled?.stripe?.subscriptionId);

//         //  Create New Subscription from Stripe
//         const stripeSubscription = await stripe.subscriptions.create({
//           customer: enrolled.stripe.customerId,
//           items: [
//             {
//               price: price.id,
//             },
//           ],
//           default_payment_method: enrolled?.stripe?.paymentMethodId,
//         });

//         //  Create New Enrollment
//         const enrollSubscription = await EnrollSubscription.create({
//           retailerId: req.user._id,
//           stripe: {
//             subscriptionId: stripeSubscription.id,
//             customerId: enrolled?.stripe?.customerId,
//             paymentMethodId: enrolled?.stripe?.paymentMethodId,
//           },
//           planSnapshot: pickSubscriptionPlan,
//           taxSnapshot: {
//             taxTitle: taxStatus === "on" ? taxTitle : null,
//             taxCost: taxStatus === "on" ? taxCost : null,
//           },
//           paymentStatus: "completed",
//           enrollStatus: "downgrade",
//           validityFrom: moment(),
//           validityTo: moment().add(pickSubscriptionPlan.duration, "days"),
//           balanceInfo: {
//             currency,
//             currentBalance: balanceAmount,
//             planCurrentPrice: finalPrice - taxValue,
//             currencyRate: selectCurrency.exchangeRate,
//           },
//           refundAmount: parseFloat(Math.abs(totalAmount).toFixed(2)),
//           status: true,
//         });

//         // Queries: Update Branch Expire, Disable Previous Enrollment, Cancel Previous Subscription from Stripe
//         const updateQueries: any = [
//           Branch.updateMany(
//             { retailerId: req.user._id, source: "subscription" },
//             { enrollSubscriptionId: enrollSubscription._id }
//           ),
//           EnrollSubscription.updateOne({ _id: enrolled._id }, { status: false }),
//         ];

//         // Check Refund
//         const isRefunded = Math.abs(totalAmount) >= refundableThreshold;
//         if (isRefunded && totalAmount !== 0) {
//           updateQueries.push(
//             Refund.create({
//               currency,
//               enrollSubscriptionId: enrollSubscription._id,
//               refundAmount: parseFloat(Math.abs(totalAmount).toFixed(2)),
//               refundStatus: "pending",
//             })
//           );
//         }

//         await Promise.all(updateQueries);

//         // @TODO: Send Subscription Invoice

//         const retailer = await Retailer.findById(req.user._id);

//         const customerInfo = {
//           name: retailer?.fullName,
//           phone: `${retailer?.dialCode}-${retailer?.phone}`,
//           address: `${retailer?.address}, ${retailer?.city}, ${retailer?.postalCode}`,
//         };

//         // const purchasedItems = [
//         //   {
//         //     title: enrollSubscription?.planSnapshot?.title,
//         //     quantity: 1,
//         //     unitPrice: `${Number(enrollSubscription?.planSnapshot?.price * enrollSubscription?.balanceInfo?.currencyRate).toFixed(2)} ${enrollSubscription?.balanceInfo?.currency}`,
//         //     total: `${Number(enrollSubscription?.planSnapshot?.price * enrollSubscription?.balanceInfo?.currencyRate).toFixed(2)} ${enrollSubscription?.balanceInfo?.currency}`,
//         //   },
//         // ];

//         let taxAmount = 0;
//         let couponAmount = 0;

//         // Check coupon eligibility & apply
//         // if (enrollSubscription?.couponSnapshot) {
//         //   couponAmount =
//         //     enrollSubscription?.couponSnapshot?.discountType === "percentage"
//         //       ? (enrollSubscription?.balanceInfo?.planCurrentPrice * enrollSubscription?.couponSnapshot?.discount) / 100
//         //       : enrollSubscription?.balanceInfo?.currencyRate * enrollSubscription?.couponSnapshot?.discount;
//         //   couponAmount = Number(couponAmount.toFixed(2));
//         // }

//         // Only tax apply
//         // if (enrollSubscription?.taxSnapshot) {
//         //   taxAmount =
//         //     (enrollSubscription?.balanceInfo?.planCurrentPrice * enrollSubscription?.taxSnapshot?.taxCost) / 100;
//         // }

//         // const invoiceMetadata = {
//         //   invoiceNo: "",
//         //   subtotal: `${Number(enrollSubscription?.planSnapshot?.price * enrollSubscription?.balanceInfo?.currencyRate).toFixed(2)} ${enrollSubscription?.balanceInfo?.currency}`,
//         //   remainingAmount:
//         //     enrollSubscription?.enrollStatus === "purchase"
//         //       ? null
//         //       : `${enrollSubscription?.balanceInfo?.currentBalance?.toFixed(2)} ${enrollSubscription?.balanceInfo?.currency}`,
//         //   planChangeCost:
//         //     enrollSubscription?.enrollStatus === "purchase" || enrollSubscription?.enrollStatus === "downgrade"
//         //       ? null
//         //       : `${enrollSubscription?.planChangeCost.toFixed(2)} ${enrollSubscription?.balanceInfo?.currency}`,
//         //   couponDiscount: enrollSubscription?.couponSnapshot
//         //     ? `${couponAmount.toFixed(2)} ${enrollSubscription?.balanceInfo?.currency}`
//         //     : null,
//         //   taxDiscount:
//         //     enrollSubscription?.taxSnapshot && enrollSubscription?.enrollStatus !== "downgrade"
//         //       ? `${taxAmount?.toFixed(2)} ${enrollSubscription?.balanceInfo?.currency}`
//         //       : null,
//         //   coupon: enrollSubscription?.couponSnapshot
//         //     ? {
//         //         title: enrollSubscription?.couponSnapshot?.title,
//         //         discountType: enrollSubscription?.couponSnapshot?.discountType,
//         //         discount: enrollSubscription?.couponSnapshot?.discount,
//         //       }
//         //     : null,
//         //   tax:
//         //     enrollSubscription?.taxSnapshot && enrollSubscription?.enrollStatus !== "downgrade"
//         //       ? {
//         //           taxTitle: enrollSubscription?.taxSnapshot?.taxTitle,
//         //           taxCost: enrollSubscription?.taxSnapshot?.taxCost,
//         //         }
//         //       : null,
//         //   total: `${Math.abs(totalAmount).toFixed(2)} ${enrollSubscription?.balanceInfo?.currency}`,
//         // };

//         const paymentInfo = {
//           bankName: "Fauget Bank",
//           accountName: "Juliana Silva",
//           accountNo: "123-456-7890",
//         };

//         // await sendInvoiceToEmail({
//         //   email: retailer?.email,
//         //   customerInfo,
//         //   purchasedItems,
//         //   invoiceMetadata,
//         //   paymentInfo,
//         // });
//         return apiResponse(res, 200, true, `Your plan successfully downgraded!`, {
//           plan: pickSubscriptionPlan?.slug,
//           planStartAt: moment(),
//           planValidAt: moment().add(pickSubscriptionPlan.duration, "days"),
//           totalBranch: pickSubscriptionPlan?.allowTotalBranch,
//         });
//       }
//       //////// Decision 2: Payment & Downgrade ////////
//       else {
//         const enrollSubscription: any = await EnrollSubscription.create({
//           retailerId: req.user._id,
//           planSnapshot: pickSubscriptionPlan,
//           taxSnapshot: {
//             taxTitle: taxStatus === "on" ? taxTitle : null,
//             taxCost: taxStatus === "on" ? taxCost : null,
//           },
//           planChangeCost: planChangeCost * selectCurrency.exchangeRate,
//           balanceInfo: {
//             currency,
//             planCurrentPrice: finalPrice - taxValue,
//             currentBalance: balanceAmount,
//             currencyRate: selectCurrency.exchangeRate,
//           },
//           paymentStatus: "pending",
//           enrollStatus: "downgrade",
//           status: true,
//         });

//         enrollIdDuration["planEnrollmentId"] = String(enrollSubscription._id);
//         enrollIdDuration[enrollSubscription._id] = pickSubscriptionPlan.duration;

//         line_items.push({
//           price_data: {
//             currency,
//             product_data: {
//               name: `${pickSubscriptionPlan.title} Plan (Downgrade)`,
//             },
//             unit_amount:
//               selectCurrency?.name === "JPY" ? Math.round(Number(finalPrice)) : Math.round(Number(finalPrice * 100)),
//             recurring: {
//               interval: "month",
//             },
//           },
//           quantity: 1,
//         });

//         // Minus Balance Handle By Coupon
//         const applyCoupon = await stripe.coupons.create({
//           name: "Current Balance",
//           amount_off:
//             selectCurrency?.name === "JPY"
//               ? Math.round(Number(balanceAmount))
//               : Math.round(Number(balanceAmount * 100)),
//           currency,
//           duration: "once",
//         });

//         coupons.push({
//           coupon: applyCoupon.id,
//         });
//       }
//     }

//     // Add Plan Change Cost
//     line_items.push({
//       price_data: {
//         currency,
//         product_data: {
//           name: `Plan Change Cost`,
//         },
//         unit_amount:
//           selectCurrency?.name === "JPY"
//             ? Math.round(Number(planChangeCost * selectCurrency.exchangeRate))
//             : Math.round(Number(planChangeCost * selectCurrency.exchangeRate) * 100), // convert into cent
//       },
//       quantity: 1,
//     });
//   } else {
//     ///////////////////////////////////
//     //////// New Subscription /////////
//     ///////////////////////////////////
//     let finalPrice = 0;
//     let taxValue = 0;
//     let couponValue = 0;

//     finalPrice = Number((selectCurrency.exchangeRate * pickSubscriptionPlan.price).toFixed(2));

//     // Check coupon eligibility & apply
//     if (coupon) {
//       couponValue =
//         coupon.discountType === "percentage"
//           ? (finalPrice * coupon?.discount) / 100
//           : selectCurrency.exchangeRate * coupon?.discount;
//       couponValue = Number(couponValue.toFixed(2));

//       const applyCoupon = await stripe.coupons.create({
//         name: coupon.title,
//         amount_off:
//           selectCurrency?.name === "JPY" ? Math.round(Number(couponValue)) : Math.round(Number(couponValue) * 100),
//         currency,
//         duration: "once",
//       });

//       coupons.push({
//         coupon: applyCoupon.id,
//       });
//     }

//     // Only tax apply
//     if (taxStatus === "on") {
//       taxValue = (finalPrice * taxCost) / 100;
//       finalPrice += taxValue;
//     }

//     const enrollSubscription: any = await EnrollSubscription.create({
//       retailerId: req.user._id,
//       planSnapshot: pickSubscriptionPlan,
//       couponSnapshot: coupon ?? null,
//       taxSnapshot: {
//         taxTitle: taxStatus === "on" ? taxTitle : null,
//         taxCost: taxStatus === "on" ? taxCost : null,
//       },
//       balanceInfo: {
//         planCurrentPrice: (finalPrice - taxValue - couponValue).toFixed(2),
//         currency,
//         currencyRate: selectCurrency.exchangeRate,
//       },
//       paymentStatus: "pending",
//       enrollStatus: "purchase",
//       status: false,
//     });

//     enrollIdDuration["planEnrollmentId"] = String(enrollSubscription._id);
//     enrollIdDuration[enrollSubscription._id] = pickSubscriptionPlan.duration;

//     line_items.push({
//       price_data: {
//         currency: currency.toLowerCase(),
//         product_data: {
//           name: `${pickSubscriptionPlan.title} ${isPlan ? "Plan" : "Add-On"}`,
//           ...(taxStatus === "on" && {
//             description: `${pickSubscriptionPlan.title} ${isPlan ? "Plan" : "Add-On"} (including ${taxTitle} ${taxCost}%)`,
//           }),
//         },
//         unit_amount:
//           selectCurrency?.name === "JPY" ? Math.round(Number(finalPrice)) : Math.round(Number(finalPrice) * 100), // convert into cent
//         recurring: {
//           interval: "month",
//         },
//       },
//       quantity: 1,
//     });
//   }

//   const session = await stripe.checkout.sessions.create({
//     line_items,
//     mode: "subscription",
//     payment_method_types: ["card"],
//     metadata: enrollIdDuration, // Need for update info after complete payment
//     discounts: coupons,
//     success_url: `${process.env.FRONTEND_URL}/payment/complete`,
//     cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
//     customer_email: req?.user?.email,
//   });

//   return apiResponse(res, 200, true, "Send to Payment Page!", { url: session?.url });
// });

/**
 * Enroll Subscription (Re-build)
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const enrollSubscriptionRebuild = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await enrollSubscriptionSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  interface IEnrollSubscriptionBodyRebuild {
    slugs: string[];
    branchIds?: string[];
    stampIds?: string[];
    code: string;
    currency: string;
  }

  const { slugs, code, branchIds, stampIds, currency }: IEnrollSubscriptionBodyRebuild = result;

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

        const [enrollSubscription] = await Promise.all([
          EnrollSubscription.create({
            planSnapshot: subscription,
          }),
          Retailer.findByIdAndUpdate(req.user._id, { takeFreeTrial: true }),
        ]);

        await Enrollment.create({
          retailerId: req.user._id,
          packages: [enrollSubscription._id],
          paymentStatus: "trial",
          validityFrom: now,
          validityTo: expireDate,
          enrollStatus: "trial",
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
    const pickPlan = subscriptions.find((subs) => subs.type === "subscription"); // Always Get One Plan if Exists

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

    // TODO: Check & Get Coupon

    // TODO: Take a Subscription with [One Plan and One Add-on]
    // TODO: Or, Take a Subscription with [Two Add-ons]
    // TODO: Make a payment with [packages]
    // TODO: If One add-on cancelled then handle payment with [package] (recurring)
    // TODO: If plan cancelled then handle cancel subscription

    ////////////////////////////////////////////////////////////////////////
    //////// Decision -> (Upgrade or Downgrade) or New Subscription ////////
    ////////////////////////////////////////////////////////////////////////
    const enrollIdDuration: { [key: string]: number | string } = {};
    enrollIdDuration["currency"] = currency;
    const line_items: ILineItem[] = [];
    const coupons: { coupon: string }[] = [];

    if (pickPlan && enrolled) {
      return apiResponse(res, 200, true, "Upgrade or Downgrade!");
    } else {
      ///////////////////////////////////
      //////// New Subscription /////////
      ///////////////////////////////////
      let totalCouponAmount = 0;
      let packages = [];

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
          planSnapshot: subscription,
          couponSnapshot: coupon && appliedSlugs.includes(subscription.slug) ? coupon : null,
          planCurrentPrice: (finalPrice - taxValue - couponValue).toFixed(2),
        });

        packages.push(enrollSubscription._id);

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
              selectCurrency?.name === "JPY" ? Math.round(Number(finalPrice)) : Math.round(Number(finalPrice) * 100), // convert into cent
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        });
      }

      const enrollment = await Enrollment.create({
        retailerId: req.user._id,
        planExists: pickPlan ? pickPlan?.slug : null,
        packages,
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

      if (pickPlan) enrollIdDuration["enrollmentId"] = String(enrollment._id);

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

    //////////////////////////////////////////////
    //////// Handling Renew Subscription ////////
    /////////////////////////////////////////////
    case "invoice.payment_succeeded":
      console.log("Handling Renew Subscription!");
      const invoicePaymentEvent = event.data.object;

      const invoice: any = await stripe.invoices.retrieve(invoicePaymentEvent?.id as string, {
        expand: ["payment_intent.payment_method"],
      });

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
          // retailerId: updatedSubscription?.retailerId,
          // enrollSubscriptionId: updatedSubscription._id,
          paymentIntentId: invoicePaymentEvent.payment_intent,
          invoiceNumber: invoicePaymentEvent.number,
          invoicePdf: invoicePaymentEvent.invoice_pdf,
          paymentStatus: "succeeded",
          amountTotal: invoicePaymentEvent.total,
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

    console.log({ subscriptionItemsMap });

    // If a user takes a plan without taking the free trial, then the free trial isn't applicable anymore
    if (!retailer.takeFreeTrial) {
      if (freeTrailSubscription) {
        const now = moment();
        const expireDate = moment().add(freeTrailSubscription.duration, "days");

        const [enrollSubscription] = await Promise.all([
          EnrollSubscription.create({
            planSnapshot: freeTrailSubscription,
          }),
          Retailer.findByIdAndUpdate(retailer._id, { takeFreeTrial: true }),
        ]);

        await Enrollment.create({
          retailerId: retailer._id,
          packages: [enrollSubscription._id],
          paymentStatus: "trial",
          validityFrom: now,
          validityTo: expireDate,
          enrollStatus: "trial",
        });
      }
    }

    let subscriptionIds: string[] = [];
    let updateSubscriptions: any = [];
    // const purchasedSubscription = await EnrollSubscription.findById(checkoutSession.metadata["planEnrollmentId"]);

    // TODO: Deactivate last previous active plan
    // if (purchasedSubscription.planSnapshot.type === "subscription") {
    // const prevSubscription = await EnrollSubscription.findOneAndUpdate(
    //   {
    //     retailerId: retailer._id,
    //     "planSnapshot.type": "subscription",
    //     paymentStatus: { $in: ["completed", "trial"] },
    //     status: true,
    //   },
    //   { status: false },
    //   { new: true }
    // );
    // if (prevSubscription && prevSubscription.paymentStatus !== "trial") {
    //   await stripe.subscriptions.cancel(prevSubscription.stripe.subscriptionId);
    // }
    // Update expiration for already created branch
    // if ("planEnrollmentId" in checkoutSession.metadata) {
    //   updateSubscriptions.push(
    //     Branch.updateMany(
    //       {
    //         retailerId: retailer._id,
    //         source: "subscription",
    //       },
    //       { enrollSubscriptionId: checkoutSession.metadata["planEnrollmentId"] }
    //     )
    //   );
    // }
    // }

    // Store Payment Info
    const payment = await Payment.create({
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

    const { enrollmentId = null } = checkoutSession?.metadata;

    // Update Enrollment with Payment
    updateSubscriptions.push(
      Enrollment.findByIdAndUpdate(enrollmentId, {
        paymentStatus: "completed",
        payments: [payment._id],
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

    for (const key in subscriptionItemsMap) {
      await EnrollSubscription.findByIdAndUpdate(key, {
        subscriptionItemId: subscriptionItemsMap[key],
      });
    }

    // TODO: Test Needed in Critical Payment
    // Handle Critical Payment (if payment method id is missing)
    if (!invoice?.payment_intent?.payment_method?.id) {
      await CriticalPayment.create({
        paymentId: payment._id,
        enrollmentId,
        stripeInvoiceId: eventObject.invoice,
        status: "pending",
      });
    }

    // TODO: Send Subscription Invoice

    const customerInfo = {
      name: retailer?.fullName,
      phone: `${retailer?.dialCode}-${retailer?.phone}`,
      address: `${retailer?.address}, ${retailer?.city}, ${retailer?.postalCode}`,
    };
    // const purchasedItems = [
    //   {
    //     title: purchasedSubscription?.planSnapshot?.title,
    //     quantity: 1,
    //     unitPrice: `${Number(purchasedSubscription?.planSnapshot?.price * purchasedSubscription?.balanceInfo?.currencyRate).toFixed(2)} ${purchasedSubscription?.balanceInfo?.currency}`,
    //     total: `${Number(purchasedSubscription?.planSnapshot?.price * purchasedSubscription?.balanceInfo?.currencyRate).toFixed(2)} ${purchasedSubscription?.balanceInfo?.currency}`,
    //   },
    // ];

    let taxValue = 0;
    let couponValue = 0;

    // Check coupon eligibility & apply
    // if (purchasedSubscription?.couponSnapshot) {
    //   couponValue =
    //     purchasedSubscription?.couponSnapshot?.discountType === "percentage"
    //       ? (purchasedSubscription?.balanceInfo?.planCurrentPrice * purchasedSubscription?.couponSnapshot?.discount) /
    //         100
    //       : purchasedSubscription?.balanceInfo?.currencyRate * purchasedSubscription?.couponSnapshot?.discount;
    //   couponValue = Number(couponValue.toFixed(2));
    // }

    // Only tax apply
    // if (purchasedSubscription?.taxSnapshot) {
    //   taxValue =
    //     (purchasedSubscription?.balanceInfo?.planCurrentPrice * purchasedSubscription?.taxSnapshot?.taxCost) / 100;
    // }

    // const invoiceMetadata = {
    //   invoiceNo: invoice?.number,
    //   subtotal: `${Number(purchasedSubscription?.planSnapshot?.price * purchasedSubscription?.balanceInfo?.currencyRate).toFixed(2)} ${purchasedSubscription?.balanceInfo?.currency}`,
    //   remainingAmount:
    //     purchasedSubscription?.enrollStatus === "purchase"
    //       ? null
    //       : `${purchasedSubscription?.balanceInfo?.currentBalance?.toFixed(2)} ${purchasedSubscription?.balanceInfo?.currency}`,
    //   planChangeCost:
    //     purchasedSubscription?.enrollStatus === "purchase"
    //       ? null
    //       : `${purchasedSubscription?.planChangeCost.toFixed(2)} ${purchasedSubscription?.balanceInfo?.currency}`,
    //   couponDiscount: purchasedSubscription?.couponSnapshot
    //     ? `${couponValue.toFixed(2)} ${purchasedSubscription?.balanceInfo?.currency}`
    //     : null,
    //   taxDiscount: purchasedSubscription?.taxSnapshot
    //     ? `${taxValue?.toFixed(2)} ${purchasedSubscription?.balanceInfo?.currency}`
    //     : null,
    //   coupon: purchasedSubscription?.couponSnapshot
    //     ? {
    //         title: purchasedSubscription?.couponSnapshot?.title,
    //         discountType: purchasedSubscription?.couponSnapshot?.discountType,
    //         discount: purchasedSubscription?.couponSnapshot?.discount,
    //       }
    //     : null,
    //   tax: purchasedSubscription?.taxSnapshot
    //     ? {
    //         taxTitle: purchasedSubscription?.taxSnapshot?.taxTitle,
    //         taxCost: purchasedSubscription?.taxSnapshot?.taxCost,
    //       }
    //     : null,
    //   total: `${(checkoutSession?.amount_total / 100).toFixed(2)} ${purchasedSubscription?.balanceInfo?.currency}`,
    // };

    const paymentInfo = {
      bankName: "Fauget Bank",
      accountName: "Juliana Silva",
      accountNo: "123-456-7890",
    };

    await Promise.all(updateSubscriptions);

    // await sendInvoiceToEmail({ email: retailer?.email, customerInfo, purchasedItems, invoiceMetadata, paymentInfo });
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

/**
 * Test MultiPackage Subscription
 * @param {Request} eventObject - The HTTP webhook event object.
 * @param {Request} stripe - The stripe object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const testMultiPackage = asyncHandler(async (req: IApiRequest, res: Response) => {
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

  if (!paymentMetadata) throw "Something went wrong in Stripe settings!";

  const stripe = new Stripe(stripeSecretKey);

  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: "cad",
          product_data: {
            name: `Custom Plan 1`,
          },
          unit_amount: 20 * 100, // convert into cent
          recurring: {
            interval: "month",
          },
        },
        quantity: 1,
      },
      {
        price_data: {
          currency: "cad",
          product_data: {
            name: `Custom Plan 2`,
          },
          unit_amount: 50 * 100, // convert into cent
          recurring: {
            interval: "month",
          },
        },
        quantity: 1,
      },
    ],
    mode: "subscription",
    payment_method_types: ["card"],
    success_url: `${process.env.FRONTEND_URL}/payment/complete`,
    cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
    customer_email: req?.user?.email,
  });

  return apiResponse(res, 200, true, "Test Multi Package!", { url: session?.url });
});

/**
 * Test Delete Subscription Item
 * @param {Request} eventObject - The HTTP webhook event object.
 * @param {Request} stripe - The stripe object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const deleteSubItem = asyncHandler(async (req: IApiRequest, res: Response) => {
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

  if (!paymentMetadata) throw "Something went wrong in Stripe settings!";

  const stripe = new Stripe(stripeSecretKey);

  // const deletedItem = await stripe.subscriptionItems.del("si_RCKkNVcqJegihY", {
  //   proration_behavior: "none", // Options: 'create_prorations', 'none', 'always_invoice'
  // });

  // console.log("Deleted subscription item without proration:", deletedItem);

  // const subscription = await stripe.subscriptions.cancel("sub_1QJw59JVIk5LKvIENo37jYSe");

  // stripe.subscriptions.update("sub_1QJwEgJVIk5LKvIEdI8WVtv6", {
  //   cancel_at_period_end: true,
  // });

  // const paymentMethods = await stripe.customers.listPaymentMethods("cus_RCj2NchPrjMs6y", {
  //   limit: 3,
  // });

  // const customer = await stripe.customers.update("cus_RCj2NchPrjMs6y", {
  //   invoice_settings: {
  //     default_payment_method: "pm_1QKYwMJVIk5LKvIExxn64Pzt",
  //   },
  // });

  const subscriptionItems: any = await stripe.subscriptionItems.list({
    // limit: 3,
    subscription: "sub_1QKubdJVIk5LKvIE5M5GtWns",
    expand: ["data.plan.product"],
  });

  const result = Object.fromEntries(
    subscriptionItems.data.map((item: any) => [item.plan.product.metadata.enrollSubscriptionId, item.id])
  );

  return apiResponse(res, 200, true, "Deleted Sub Item!", result);
});
