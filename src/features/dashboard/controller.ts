import { Response } from "express";
import moment from "moment";
import { apiResponse, asyncHandler, countryData, generateRandomColor } from "../../helpers";
import { IApiRequest } from "../../types";
import EnrollSubscription from "../enroll-subscription/model";
import OrderStamp from "../mobile/sub-admin/home/model";
import Stamp from "../stamp/model";
import Customer from "../user/customer/model";
import Retailer from "../user/retailer/model";

/**
 * Get Super Admin Dashboard Card Stats
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const superAdminDashboardCardStats = asyncHandler(async (req: IApiRequest, res: Response) => {
  const currentDate = moment();

  const startOfMonth = currentDate.clone().startOf("month");
  const endOfMonth = currentDate.clone().endOf("month");

  const [
    totalVerifiedRetailer,
    totalVerifiedCustomer,
    totalStamps,
    newCustomerThisMonth,
    newRetailerThisMonth,
    newStampsThisMonth,
  ] = await Promise.all([
    Retailer.countDocuments({ isVerified: true, softDeleted: false }),
    Customer.countDocuments({ isVerified: true }),
    Stamp.countDocuments({ softDeleted: false }),
    Customer.countDocuments({ isVerified: true, createdAt: { $gte: startOfMonth, $lt: endOfMonth } }),
    Retailer.countDocuments({
      isVerified: true,
      softDeleted: false,
      createdAt: { $gte: startOfMonth, $lt: endOfMonth },
    }),
    Stamp.countDocuments({ softDeleted: false, createdAt: { $gte: startOfMonth, $lt: endOfMonth } }),
  ]);

  const totalUser = totalVerifiedCustomer + totalVerifiedRetailer;

  const signup = {
    retailer: ((totalVerifiedRetailer / totalUser) * 100).toFixed(2),
    customer: ((totalVerifiedCustomer / totalUser) * 100).toFixed(2),
  };

  const data = {
    totalUser,
    totalVerifiedCustomer,
    totalVerifiedRetailer,
    newCustomerThisMonth,
    newRetailerThisMonth,
    totalStamps,
    newStampsThisMonth,
    signup,
  };

  return apiResponse(res, 200, true, "Super admin dashboard card stats fetched successfully!", data);
});

/**
 * Get Super Admin Dashboard Revenue
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const superAdminDashboardRevenue = asyncHandler(async (req: IApiRequest, res: Response) => {
  // Convert payment to base currency
  // Rules: amount * (baseCurrencyRatio / convertCurrencyRatio)
  const { start = undefined, end = undefined } = req.query;

  const revenueStats = await EnrollSubscription.aggregate([
    {
      $match: {
        paymentStatus: "completed", // Filter by completed payments
        ...(start &&
          end && {
            createdAt: {
              $gte: new Date(`${start}T00:00:00` as string), // Greater than or equal to start date
              $lte: new Date(`${end}T23:59:59` as string), // Less than or equal to end date
            },
          }),
      },
    },
    {
      $lookup: {
        from: "payments",
        localField: "_id",
        foreignField: "enrollSubscriptionId",
        as: "payments",
      },
    },
    {
      $unwind: "$payments", // Unwind the payments array to process each payment
    },
    {
      $addFields: {
        convertedAmount: {
          // Convert payment to base currency (CAD)
          $multiply: ["$payments.amountTotal", { $divide: [1, "$balanceInfo.currencyRate"] }],
        },
      },
    },
    {
      $facet: {
        totalRevenue: [
          {
            $group: {
              _id: null, // Group by null to aggregate all documents
              totalInCents: { $sum: "$convertedAmount" }, // Sum the converted payment amounts for all types
            },
          },
          {
            $addFields: {
              totalRevenueInCAD: {
                $round: [{ $divide: ["$totalInCents", 100] }, 2], // Round to 2 decimal places
              },
            },
          },
        ],
        totalSubscriptionRevenue: [
          {
            $match: {
              "planSnapshot.type": "subscription", // Filter for subscription plans
            },
          },
          {
            $group: {
              _id: null, // Group by null to aggregate all subscription-type payments
              totalSubscriptionInCents: { $sum: "$convertedAmount" }, // Sum the subscription payments
            },
          },
          {
            $addFields: {
              totalSubscriptionRevenueInCAD: {
                $round: [{ $divide: ["$totalSubscriptionInCents", 100] }, 2], // Round to 2 decimal places
              },
            },
          },
        ],
        totalAddonRevenue: [
          {
            $match: {
              "planSnapshot.type": "addon", // Filter for addon plans
            },
          },
          {
            $group: {
              _id: null, // Group by null to aggregate all addon-type payments
              totalAddonInCents: { $sum: "$convertedAmount" }, // Sum the addon payments
            },
          },
          {
            $addFields: {
              totalAddonRevenueInCAD: {
                $round: [{ $divide: ["$totalAddonInCents", 100] }, 2], // Round to 2 decimal places
              },
            },
          },
        ],
        activeSubscription: [
          {
            $match: {
              "planSnapshot.type": "subscription",
              status: true,
            },
          },
          {
            $count: "activeSubscription", // Count the active subscription plans
          },
        ],
      },
    },
    {
      $project: {
        totalRevenueInCAD: { $arrayElemAt: ["$totalRevenue.totalRevenueInCAD", 0] },
        totalSubscriptionRevenueInCAD: { $arrayElemAt: ["$totalSubscriptionRevenue.totalSubscriptionRevenueInCAD", 0] },
        totalAddonRevenueInCAD: { $arrayElemAt: ["$totalAddonRevenue.totalAddonRevenueInCAD", 0] },
        activeSubscription: { $arrayElemAt: ["$activeSubscription.activeSubscription", 0] },
      },
    },
  ]);

  if (!revenueStats || revenueStats.length === 0) {
    return apiResponse(res, 200, true, "No revenue stats available.", {});
  }

  const {
    totalRevenueInCAD = 0,
    totalSubscriptionRevenueInCAD = 0,
    totalAddonRevenueInCAD = 0,
    activeSubscription = 0,
  } = revenueStats[0];

  // Calculate percentages only if totalRevenueInCAD > 0
  const subscriptionPercentage =
    totalRevenueInCAD > 0 ? ((totalSubscriptionRevenueInCAD / totalRevenueInCAD) * 100).toFixed(2) : 0;
  const addonPercentage = totalRevenueInCAD > 0 ? ((totalAddonRevenueInCAD / totalRevenueInCAD) * 100).toFixed(2) : 0;

  const data = {
    activeSubscription,
    totalRevenueInCAD,
    totalSubscriptionRevenueInCAD,
    totalAddonRevenueInCAD,
    subscriptionPercentage,
    addonPercentage,
  };

  return apiResponse(res, 200, true, "Super admin revenue stats fetched successfully!", data);
});

/**
 * Get Retailer Admin Dashboard Card Stats
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const retailerDashboardCardStats = asyncHandler(async (req: IApiRequest, res: Response) => {
  const retailer = await Retailer.aggregate([
    {
      $match: { _id: req?.user?._id },
    },
    {
      $lookup: {
        from: "branches",
        localField: "_id",
        foreignField: "retailerId",
        as: "branches",
        pipeline: [
          {
            $match: {
              status: true,
              softDeleted: false,
              disabledBySystem: false,
            },
          },
          {
            $lookup: {
              from: "collectstamps",
              localField: "_id",
              foreignField: "branchId",
              as: "collectstamps",
              pipeline: [
                {
                  $group: {
                    _id: "$branchId", // Group by branchId
                    uniqueCustomers: { $addToSet: "$customerId" }, // Collect unique customerId values in a set
                  },
                },
                {
                  $project: {
                    _id: 1, // Include branchId (this is the default _id generated by $group)
                    totalCustomer: { $size: "$uniqueCustomers" }, // Count the distinct customerId's
                  },
                },
              ],
            },
          },
          {
            $unwind: {
              path: "$collectstamps",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $lookup: {
              from: "orderstamps",
              localField: "_id",
              foreignField: "branchId",
              as: "orderstamps",
            },
          },
          {
            $lookup: {
              from: "subadmins",
              localField: "_id",
              foreignField: "branchId",
              as: "subadmin",
              pipeline: [
                {
                  $match: {
                    softDeleted: false,
                  },
                },
              ],
            },
          },
          {
            $unwind: {
              path: "$subadmin",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              _id: 1,
              name: 1,
              address: "$address.name",
              subAdminName: { $ifNull: ["$subadmin.fullName", null] },
              subAdminEmail: { $ifNull: ["$subadmin.email", null] },
              totalCustomer: { $ifNull: ["$collectstamps.totalCustomer", 0] },
              totalOrder: { $size: "$orderstamps" },
              totalRevenue: { $sum: "$orderstamps.amount" },
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "stamps",
        localField: "_id",
        foreignField: "retailerId",
        as: "stamps",
        pipeline: [
          {
            $match: {
              startedAt: { $lte: new Date() },
              expiredAt: { $gte: new Date() },
              isPublished: true,
              status: true,
              softDeleted: false,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        currentPlan: {
          $cond: {
            if: { $gt: [{ $type: "$enrollSubscription" }, "missing"] }, // Check if enrollSubscription exists
            then: "$enrollSubscription.planSnapshot.title", // If true, set currentPlan to title
            else: null, // If false, set it to null
          },
        },
        totalActiveBranch: { $size: "$branches" },
        totalActiveStamp: { $size: "$stamps" },
        totalCustomer: { $sum: "$branches.totalCustomer" },
        totalOrder: { $sum: "$branches.totalOrder" },
        totalRevenue: { $sum: "$branches.totalRevenue" },
      },
    },
    {
      $project: {
        _id: 0,
        totalActiveBranch: 1,
        totalActiveStamp: 1,
        totalCustomer: 1,
        totalOrder: 1,
        totalRevenue: 1,
        branches: 1,
      },
    },
  ]);

  if (retailer.length <= 0) return apiResponse(res, 404, false, "Retailer not found!");

  return apiResponse(res, 200, true, "Retailer dashboard card stats fetched successfully!", retailer[0]);
});

/**
 * Get All Retailer Stats By Country Wise
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const retailerStatsWithCountryWise = asyncHandler(async (req: IApiRequest, res: Response) => {
  // Perform the aggregation to get country-wise counts and total count
  const retailerCounts = await Retailer.aggregate([
    {
      $group: {
        _id: "$country",
        count: { $sum: 1 }, // Count retailers in each country
      },
    },
    {
      $group: {
        _id: null,
        totalRetailers: { $sum: "$count" }, // Total count of all retailers
        countries: {
          $push: {
            country: "$_id",
            count: "$count",
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        totalRetailers: 1,
        countries: 1,
      },
    },
  ]);

  if (!retailerCounts.length) {
    return apiResponse(res, 200, true, "Customer countries fetched successfully!", {
      totalRetailers: 0,
      countries: [],
    });
  }

  const { totalRetailers, countries } = retailerCounts[0];

  // Map the results to the desired format
  const formattedResponse = countries.map((c: any) => ({
    country: countryData?.find((item: any) => item?.country === c.country)?.code?.toLocaleLowerCase(),
    name: c.country,
    value: Math.round((c.count / totalRetailers) * 100), // Percentage value
    style: generateRandomColor(), // Random color for background
  }));

  return apiResponse(res, 200, true, "Retailer countries fetched successfully!", {
    totalRetailers,
    countries: formattedResponse?.sort((a: any, b: any) => b.value - a.value),
  });
});

/**
 * Get All Customer Stats By Country Wise
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const customerStatsWithCountryWise = asyncHandler(async (req: IApiRequest, res: Response) => {
  // Perform the aggregation to get country-wise counts and total count
  const customerCounts = await Customer.aggregate([
    {
      $group: {
        _id: "$country",
        count: { $sum: 1 }, // Count customers in each country
      },
    },
    {
      $group: {
        _id: null,
        totalCustomers: { $sum: "$count" }, // Total count of all customer
        countries: {
          $push: {
            country: "$_id",
            count: "$count",
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        totalCustomers: 1,
        countries: 1,
      },
    },
  ]);

  if (!customerCounts.length) {
    return apiResponse(res, 200, true, "Customer countries fetched successfully!", {
      totalCustomers: 0,
      countries: [],
    });
  }

  const { totalCustomers, countries } = customerCounts[0];

  // Map the results to the desired format
  const formattedResponse = countries
    .map((c: any) => ({
      country: countryData?.find((item: any) => item?.country === c.country)?.code?.toLocaleLowerCase(),
      name: c.country,
      value: Math.round((c.count / totalCustomers) * 100), // Percentage value
      style: generateRandomColor(), // Random color for background
    }))
    .filter((c: any) => c.name !== null);

  return apiResponse(res, 200, true, "Customer countries fetched successfully!", {
    totalCustomers,
    countries: formattedResponse?.sort((a: any, b: any) => b.value - a.value),
  });
});

/**
 * Get Top Outlets according to number of sales
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const topOutlets = asyncHandler(async (req: IApiRequest, res: Response) => {
  const test = await OrderStamp.aggregate([
    {
      $addFields: {
        amountInCAD: {
          $cond: {
            if: { $eq: ["$amountCurrency", "CAD"] },
            then: "$amount",
            else: { $multiply: ["$amount", "$exchangeRate"] }, // Convert to CAD using exchangeRate if different currency
          },
        },
      },
    },
    {
      $group: {
        _id: "$branchId", // Group by branchId
        totalAmountInCAD: { $sum: "$amountInCAD" }, // Sum the converted amountInCAD for each branchId
        retailerId: { $first: "$retailerId" }, // Capture the retailerId for each branchId
      },
    },
    {
      $lookup: {
        from: "retailers", // Lookup to retailers collection
        localField: "retailerId", // Local field from OrderStamp
        foreignField: "_id", // Foreign field in retailers collection
        as: "retailer", // Resulting array field
      },
    },
    {
      $unwind: "$retailer", // Unwind retailer array if you expect only one retailer per branch
    },
    {
      $lookup: {
        from: "branches", // Lookup to branches collection
        localField: "_id", // Use the grouped branchId
        foreignField: "_id", // Foreign field in branches collection
        as: "branch", // Resulting array field
      },
    },
    {
      $unwind: "$branch", // Unwind branch array to get branch details
    },
    {
      $sort: {
        totalAmountInCAD: -1, // Sort by totalAmount in descending order
      },
    },
    {
      $project: {
        _id: 0, // Exclude the default _id field
        totalAmountInCAD: 1, // Include the totalAmount
        retailer: {
          _id: "$retailer._id", // Include specific fields from retailer
          storeName: "$retailer.storeName", // Include specific fields from retailer
          email: "$retailer.email",
        },
        branch: {
          _id: "$branch._id",
          name: "$branch.name", // Include specific fields from branch
          address: "$branch.address.name", // Include specific fields from branch
        },
      },
    },
  ]);

  return apiResponse(res, 200, true, "Top Outlets List!", test);
});
