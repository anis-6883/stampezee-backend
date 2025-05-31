import moment from "moment-timezone";
import Stripe from "stripe";
import { roundToNearestTen } from "../../helpers/index";
import CurrencyExchange from "../../models/currency-exchange";
import EnrollSubscription from "../../models/enroll-subscription";
import Enrollment from "../../models/enrollment";
import Settings from "../../models/settings";
import { ISubscription } from "../../models/subscription";
import { Object } from "../../types/index";

export const updateRetailerFreePlan = async (subscription: ISubscription) => {
  const freeTrialEnrollment = await Enrollment.find({
    status: true,
    planExists: "trial",
  }).distinct("_id");

  const updateArr = [
    EnrollSubscription.updateMany({ enrollmentId: { $in: freeTrialEnrollment } }, { planSnapshot: subscription }),
  ];

  if (subscription.unlimitedFieldName) {
    updateArr.push(
      Enrollment.updateMany({ status: true, planExists: "trial" }, { validityTo: new Date("3030-01-01") })
    );
  } else {
    updateArr.push(
      Enrollment.updateMany(
        { status: true, planExists: "trial" },
        { validityTo: moment().add(subscription.duration, "days") }
      )
    );
  }

  Promise.all(updateArr);
};

export const updateRetailerPaidPlan = async (subscription: ISubscription) => {
  const pLimit = await import("p-limit").then((mod) => mod.default);

  // Get Payment Metadata, Allowed Currencies & enroll Subscriptions
  const [paymentMetadata, allowCurrencies, enrollSubscriptions] = await Promise.all([
    Settings.findOne({}, { "stripe.taxCost": 1, "stripe.taxStatus": 1, "stripe.stripeSecretKey": 1 }),
    CurrencyExchange.find({ status: true }),
    EnrollSubscription.aggregate([
      {
        $match: {
          "planSnapshot.slug": subscription?.slug,
          $or: [{ status: true }, { status: false, validAtAfterCancel: { $gt: new Date() } }],
        },
      },
      {
        $lookup: {
          from: "enrollments",
          localField: "enrollmentId",
          foreignField: "_id",
          as: "enrollment",
        },
      },
      {
        $unwind: "$enrollment",
      },
      {
        $project: {
          subscriptionItemId: 1,
          currency: "$enrollment.currency",
        },
      },
      {
        $group: {
          _id: null,
          subscriptions: { $push: "$$ROOT" },
          currencies: { $addToSet: "$currency" },
        },
      },
      {
        $project: {
          _id: 0,
          subscriptions: 1,
          currencies: 1,
        },
      },
    ]),
  ]);

  const { stripeSecretKey = null, taxCost = null, taxStatus = null } = paymentMetadata.stripe ?? {};
  const stripe = new Stripe(stripeSecretKey);
  const currencyPriceIdMap: Object = {};

  // Create Prices for each currency
  for (const currency of enrollSubscriptions[0]?.currencies || []) {
    let finalPrice = 0;
    const selectCurrency = allowCurrencies.find((item) => item.currency === currency);

    // Exchange rate & TAX apply
    finalPrice = Number((selectCurrency.exchangeRate * subscription?.price).toFixed(2));
    if (taxStatus === "on") finalPrice += (finalPrice * taxCost) / 100;

    let unitAmount = Math.round(Number(finalPrice) * 100); // convert into cent
    if (selectCurrency?.currency === "JPY") unitAmount = Math.round(Number(finalPrice));
    else if (selectCurrency?.currency === "KWD") unitAmount = roundToNearestTen(finalPrice);

    const price = await stripe.prices.create({
      currency: currency,
      unit_amount: unitAmount,
      recurring: {
        interval: "month",
      },
      product_data: {
        name: subscription?.title,
      },
    });

    currencyPriceIdMap[currency] = price.id;
  }

  const limit = pLimit(10);

  const updatePromises = (enrollSubscriptions[0]?.subscriptions || []).map((enrollSubscription: any) =>
    limit(async () => {
      const updatedSubscription = await stripe.subscriptionItems.update(enrollSubscription.subscriptionItemId, {
        price: currencyPriceIdMap[enrollSubscription.currency] || "",
        proration_behavior: "none",
      });

      const updateEnrollSubscriptionPrice = await EnrollSubscription.findOneAndUpdate(
        {
          subscriptionItemId: enrollSubscription.subscriptionItemId,
        },
        {
          "planSnapshot.price": subscription?.price,
        },
        { new: true } // Return the updated document
      );

      return {
        stripe: updatedSubscription,
        mongo: updateEnrollSubscriptionPrice,
      };
    })
  );

  await Promise.all(updatePromises);
};
