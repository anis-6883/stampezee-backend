import { Response } from "express";
import moment from "moment-timezone";
import { apiResponse, asyncHandler, countryData, generateRandomColor } from "../../helpers";
import Branch from "../../models/branch";
import CollectStamp from "../../models/collect-stamp";
import CurrencyExchange from "../../models/currency-exchange";
import Customer from "../../models/customer";
import Enrollment from "../../models/enrollment";
import OrderStamp from "../../models/order-stamp";
import Payment from "../../models/payment";
import Refund from "../../models/refund";
import Retailer from "../../models/retailer";
import Settings from "../../models/settings";
import { IApiRequest, Object } from "../../types";
import { calculateRewardPercentages } from "./service";

/**
 * Get Super Admin Dashboard Card Stats (Super Admin)
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const superAdminDashboardCardStats = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { start = undefined, end = undefined } = req.query;

  const settings = await Settings.findOne();
  const timezone = settings.general.timezone.label;
  const now = moment().tz(settings.general.timezone.label);

  let startDate, endDate;

  // Handle date logic
  if (start) {
    startDate = moment.tz(start, timezone).startOf("day").toDate();
    endDate = end ? moment.tz(end, timezone).endOf("day").toDate() : moment.tz(start, timezone).endOf("day").toDate(); // treat start as end
  }

  const dateFilter: Object = {};
  if (startDate) dateFilter.$gte = startDate;
  if (endDate) dateFilter.$lte = endDate;

  const startOfMonth = now.clone().startOf("month").startOf("day");
  const endOfMonth = now.clone().endOf("month").endOf("day");

  const [totalVerifiedCustomer, totalVerifiedRetailer, newRetailerThisMonth, newCustomerThisMonth] = await Promise.all([
    Customer.countDocuments({
      isVerified: true,
      softDeleted: false,
      ...(start || end ? { createdAt: dateFilter } : {}),
    }),
    Retailer.countDocuments({
      isVerified: true,
      softDeleted: false,
      ...(start || end ? { createdAt: dateFilter } : {}),
    }),
    Retailer.countDocuments({
      isVerified: true,
      softDeleted: false,
      createdAt: { $gte: startOfMonth, $lt: endOfMonth },
    }),
    Customer.countDocuments({
      isVerified: true,
      softDeleted: false,
      createdAt: { $gte: startOfMonth, $lt: endOfMonth },
    }),
  ]);

  const totalUser = totalVerifiedCustomer + totalVerifiedRetailer;

  const signupRatio = {
    retailer: totalUser === 0 ? 0 : ((totalVerifiedRetailer / totalUser) * 100).toFixed(2),
    customer: totalUser === 0 ? 0 : ((totalVerifiedCustomer / totalUser) * 100).toFixed(2),
  };

  const data = {
    totalVerifiedCustomer,
    totalVerifiedRetailer,
    newRetailerThisMonth,
    newCustomerThisMonth,
    signupRatio,
  };

  return apiResponse(res, 200, true, "Super admin dashboard card stats fetched successfully!", data);
});

/**
 * Get Super Admin Dashboard Revenue (Super Admin)
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const superAdminDashboardRevenue = asyncHandler(async (req: IApiRequest, res: Response) => {
  // Convert payment to base currency
  // Rules: amount * (baseCurrencyRatio / convertCurrencyRatio)
  const { start = undefined, end = undefined } = req.query;

  const [totalRevenue, activeSubscription, totalRefund] = await Promise.all([
    Payment.aggregate([
      {
        $match: {
          paymentStatus: "succeeded", // Filter by completed payments
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
        $addFields: {
          convertedAmount: {
            // Convert payment to base currency (CAD)
            $round: [
              {
                $divide: ["$amountTotal", "$currencyRate"],
              },
              2,
            ],
          },
        },
      },
      {
        $group: {
          _id: null, // Group by null to aggregate all documents
          totalRevenueInCAD: { $sum: "$convertedAmount" }, // Sum the converted payment amounts for all types
        },
      },
    ]),
    Enrollment.countDocuments({
      $and: [{ planExists: { $ne: "trial" } }, { planExists: { $ne: null } }],
      validityTo: { $gt: new Date() },
      status: true,
    }),
    Refund.aggregate([
      {
        $match: {
          refundStatus: "completed", // Filter by completed payments
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
        $addFields: {
          convertedAmount: {
            // Convert payment to base currency (CAD)
            $round: [
              {
                $divide: ["$refundAmount", "$currencyRate"],
              },
              2,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalRefundAmountInCAD: { $sum: "$convertedAmount" },
        },
      },
    ]),
  ]);

  const data = {
    activeSubscription,
    totalEarningInCAD: totalRevenue[0]?.totalRevenueInCAD || 0,
    totalRefundAmountInCAD: totalRefund[0]?.totalRefundAmountInCAD || 0,
    totalRevenueInCAD: (totalRevenue[0]?.totalRevenueInCAD || 0) - (totalRefund[0]?.totalRefundAmountInCAD || 0),
  };

  return apiResponse(res, 200, true, "Super admin revenue stats fetched successfully!", data);
});

/**
 * Get All Customer Stats By Country Wise (Super Admin)
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
 * Get Top Outlets according to number of sales (Super Admin)
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const topOutlets = asyncHandler(async (req: IApiRequest, res: Response) => {
  const outlets = await OrderStamp.aggregate([
    {
      $addFields: {
        amountInCAD: {
          $cond: {
            if: { $eq: ["$amountCurrency", "CAD"] },
            then: "$amount",
            else: {
              $cond: {
                if: { $gt: ["$exchangeRate", 0] },
                then: { $divide: ["$amount", "$exchangeRate"] }, // Convert to CAD using exchangeRate if different currency
                else: 0, // or null, if preferred
              },
            },
          },
        },
      },
    },
    {
      $sort: {
        totalAmountInCAD: -1,
      },
    },
    {
      $limit: 10,
    },
    {
      $group: {
        _id: "$branchId", // Group by branchId
        totalAmountInCAD: { $sum: "$amountInCAD" }, // Sum the converted amountInCAD for each branchId
        retailerId: { $first: "$retailerId" },
        exchangeRate: { $first: "$exchangeRate" },
        amountCurrency: { $first: "$amountCurrency" },
      },
    },
    {
      $lookup: {
        from: "retailers",
        localField: "retailerId",
        foreignField: "_id",
        as: "retailer",
      },
    },
    {
      $unwind: "$retailer",
    },
    {
      $lookup: {
        from: "branches",
        localField: "_id",
        foreignField: "_id",
        as: "branch",
        pipeline: [
          {
            $lookup: {
              from: "collect_stamps",
              localField: "_id",
              foreignField: "branchId",
              as: "collect_stamps",
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
                    totalCustomers: { $size: "$uniqueCustomers" }, // Count the distinct customerId's
                  },
                },
              ],
            },
          },
          {
            $unwind: {
              path: "$collect_stamps",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $lookup: {
              from: "order_stamps",
              localField: "_id",
              foreignField: "branchId",
              as: "stamps",
            },
          },
          {
            $lookup: {
              from: "stamps",
              localField: "_id",
              foreignField: "branchId",
              as: "stampCards",
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
            $project: {
              name: 1,
              address: "$address.name",
              totalCustomers: { $ifNull: ["$collect_stamps.totalCustomers", 0] },
              totalStampsCards: { $size: "$stampCards" },
              totalStamps: { $size: "$stamps" },
            },
          },
        ],
      },
    },
    {
      $unwind: "$branch",
    },
    {
      $project: {
        _id: 0,
        totalRevenue: {
          $round: [{ $multiply: ["$totalAmountInCAD", "$exchangeRate"] }, 2],
        },
        amountCurrency: 1,
        retailer: {
          _id: "$retailer._id",
          storeName: "$retailer.storeName",
          email: "$retailer.email",
        },
        branch: {
          _id: "$branch._id",
          name: "$branch.name",
          address: "$branch.address.name",
          totalCustomers: "$branch.totalCustomers",
          totalStampsCards: "$branch.totalStampsCards",
          totalStamps: "$branch.totalStamps",
        },
      },
    },
  ]);

  return apiResponse(res, 200, true, "Top Outlets List!", outlets);
});

/**
 * Get Retailer Admin Dashboard Card Stats (Retailer)
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const retailerDashboardCardStats = asyncHandler(async (req: IApiRequest, res: Response) => {
  const retailer = await Retailer.findById(req.user?._id, { businessCurrency: 1 });
  const currencyExchange = await CurrencyExchange.findOne({ currency: retailer?.businessCurrency });

  const { start = undefined, end = undefined } = req.query;

  const settings = await Settings.findOne();
  const timezone = settings.general.timezone.label;

  let startDate, endDate;

  // Handle date logic
  if (start) {
    startDate = moment.tz(start, timezone).startOf("day").toDate();
    endDate = end ? moment.tz(end, timezone).endOf("day").toDate() : moment.tz(start, timezone).endOf("day").toDate(); // treat start as end
  }

  const dateFilter: Object = {};
  if (startDate) dateFilter.$gte = startDate;
  if (endDate) dateFilter.$lte = endDate;

  const [customerStats, result] = await Promise.all([
    Retailer.aggregate([
      {
        $match: { _id: req?.user?._id },
      },
      {
        $lookup: {
          from: "branches",
          localField: "_id",
          foreignField: "retailerId",
          as: "branchCustomer",
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
                from: "collect_stamps",
                localField: "_id",
                foreignField: "branchId",
                as: "collectStamps",
                pipeline: [
                  {
                    $match: {
                      ...(start || end ? { createdAt: dateFilter } : {}),
                    },
                  },
                ],
              },
            },
            {
              $unwind: "$collectStamps",
            },
            {
              $group: {
                _id: "$retailerId",
                totalCustomer: { $addToSet: "$collectStamps.customerId" },
              },
            },
            {
              $project: {
                _id: 0,
                totalCustomer: { $size: "$totalCustomer" }, // Calculate size of the unique customer set
              },
            },
          ],
        },
      },
      {
        $unwind: "$branchCustomer",
      },
      {
        $addFields: {
          totalCustomer: "$branchCustomer.totalCustomer",
        },
      },
      {
        $project: {
          totalCustomer: 1,
        },
      },
    ]),
    Retailer.aggregate([
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
                from: "collect_stamps",
                localField: "_id",
                foreignField: "branchId",
                as: "collect_stamps",
                pipeline: [
                  {
                    $match: {
                      ...(start || end ? { createdAt: dateFilter } : {}),
                    },
                  },
                  {
                    $group: {
                      _id: "$branchId", // Group by branchId
                      uniqueCustomers: { $addToSet: "$customerId" }, // Collect unique customerId values in a set
                    },
                  },
                  {
                    $project: {
                      _id: 1, // Include branchId (this is the default _id generated by $group)
                      totalCustomers: { $size: "$uniqueCustomers" }, // Count the distinct customerId's
                    },
                  },
                ],
              },
            },
            {
              $unwind: {
                path: "$collect_stamps",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $lookup: {
                from: "collect_stamps",
                localField: "_id",
                foreignField: "branchId",
                as: "rewardCollects",
                pipeline: [
                  {
                    $match: {
                      rewardCollected: true,
                      ...(start || end ? { createdAt: dateFilter } : {}),
                    },
                  },
                ],
              },
            },
            {
              $lookup: {
                from: "order_stamps",
                localField: "_id",
                foreignField: "branchId",
                as: "order_stamps",
                pipeline: [
                  {
                    $match: {
                      ...(start || end ? { createdAt: dateFilter } : {}),
                    },
                  },
                ],
              },
            },
            {
              $lookup: {
                from: "sub_admins",
                localField: "_id",
                foreignField: "branchId",
                as: "sub_admins",
                pipeline: [
                  {
                    $match: {
                      softDeleted: false,
                      ...(start || end ? { createdAt: dateFilter } : {}),
                    },
                  },
                ],
              },
            },
            {
              $lookup: {
                from: "stamps",
                localField: "_id",
                foreignField: "branchId",
                as: "stampCards",
                pipeline: [
                  {
                    $match: {
                      startedAt: { $lte: new Date() },
                      expiredAt: { $gte: new Date() },
                      isPublished: true,
                      status: true,
                      softDeleted: false,
                      ...(start || end ? { createdAt: dateFilter } : {}),
                    },
                  },
                ],
              },
            },
            {
              $project: {
                _id: 1,
                name: 1,
                totalRewardCollected: { $size: "$rewardCollects" },
                address: "$address.name",
                totalCustomers: { $ifNull: ["$collect_stamps.totalCustomers", 0] },
                totalSubAdmins: { $size: "$sub_admins" },
                totalStamps: { $size: "$order_stamps" },
                totalStampsCards: { $size: "$stampCards" },
                totalRevenue: {
                  $reduce: {
                    input: {
                      $map: {
                        input: "$order_stamps",
                        as: "order",
                        in: {
                          $cond: {
                            if: {
                              $and: [{ $ne: ["$$order.exchangeRate", 0] }, { $ne: ["$$order.exchangeRate", null] }],
                            },
                            then: {
                              $round: [
                                {
                                  $multiply: [
                                    {
                                      $divide: [
                                        { $ifNull: ["$$order.amount", 0] },
                                        { $ifNull: ["$$order.exchangeRate", 1] },
                                      ],
                                    },
                                    { $ifNull: [currencyExchange.exchangeRate, 1] },
                                  ],
                                },
                                2,
                              ],
                            },
                            else: 0,
                          },
                        },
                      },
                    },
                    initialValue: 0,
                    in: { $add: ["$$value", "$$this"] },
                  },
                },
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
          totalActiveBranches: { $size: "$branches" },
          totalStampCards: { $sum: "$branches.totalStampsCards" },
          totalStamps: { $sum: "$branches.totalStamps" },
          totalRevenue: { $sum: "$branches.totalRevenue" },
        },
      },
      {
        $project: {
          _id: 0,
          branches: 1,
          totalActiveBranches: 1,
          totalStampCards: 1,
          totalStamps: 1,
          totalRevenue: 1,
        },
      },
    ]),
  ]);

  if (result.length <= 0) return apiResponse(res, 404, false, "Retailer not found!");

  const data: Object = result[0];
  data.totalCustomers = customerStats.length > 0 ? customerStats[0].totalCustomer : 0;

  return apiResponse(res, 200, true, "Retailer dashboard card stats fetched successfully!", data);
});

/**
 * Get All Retailer Stats By Country Wise (Retailer)
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
 * Get Avg Stamp Collect per Customer (Retailer)
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const avgCollectedStamp = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { start = undefined, end = undefined } = req.query;

  const settings = await Settings.findOne();
  const timezone = settings.general.timezone.label;

  let startDate, endDate;

  // Handle date logic
  if (start) {
    startDate = moment.tz(start, timezone).startOf("day").toDate();
    endDate = end ? moment.tz(end, timezone).endOf("day").toDate() : moment.tz(start, timezone).endOf("day").toDate(); // treat start as end
  }

  const dateFilter: Object = {};
  if (startDate) dateFilter.$gte = startDate;
  if (endDate) dateFilter.$lte = endDate;

  const result = await OrderStamp.aggregate([
    {
      $match: {
        retailerId: req.user._id,
        ...(start || end ? { createdAt: dateFilter } : {}),
      },
    },
    {
      $group: {
        _id: "$customerId",
        totalCustomerStamps: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: null,
        totalStampsCollected: { $sum: "$totalCustomerStamps" },
        totalCustomer: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        totalStampsCollected: 1,
        totalCustomer: 1,
        avgStampCollect: {
          $cond: [
            { $eq: ["$totalCustomer", 0] },
            0,
            { $round: [{ $divide: ["$totalStampsCollected", "$totalCustomer"] }, 0] },
          ],
        },
      },
    },
  ]);

  if (result.length <= 0) {
    return apiResponse(res, 200, true, "Avg stamp collect per customer fetched successfully!", {
      totalStampsCollected: 0,
      totalCustomer: 0,
      avgStampCollect: 0,
    });
  }

  return apiResponse(res, 200, true, "Avg stamp collect per customer fetched successfully!", result[0]);
});

/**
 * Get Reward Collect Percentage (Retailer)
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const rewardCollectPercentage = asyncHandler(async (req: IApiRequest, res: Response) => {
  const branches = await Branch.find({ retailerId: req.user._id, status: true, softDeleted: false }).select("_id");
  const branchIds = branches.map((branch) => branch._id);

  const { start = undefined, end = undefined } = req.query;

  const settings = await Settings.findOne();
  const timezone = settings.general.timezone.label;

  let startDate, endDate;

  // Handle date logic
  if (start) {
    startDate = moment.tz(start, timezone).startOf("day").toDate();
    endDate = end ? moment.tz(end, timezone).endOf("day").toDate() : moment.tz(start, timezone).endOf("day").toDate(); // treat start as end
  }

  const dateFilter: Object = {};
  if (startDate) dateFilter.$gte = startDate;
  if (endDate) dateFilter.$lte = endDate;

  const [result1, result2] = await Promise.all([
    CollectStamp.aggregate([
      {
        $match: {
          branchId: { $in: branchIds },
        },
      },
      {
        $lookup: {
          from: "order_stamps",
          localField: "_id",
          foreignField: "collectStampId",
          as: "scans",
          pipeline: [
            {
              $match: {
                ...(start || end ? { createdAt: dateFilter } : {}),
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "stamps",
          localField: "stampId",
          foreignField: "_id",
          as: "stamp",
        },
      },
      {
        $unwind: "$stamp",
      },
      {
        $addFields: {
          noOfStampsToCollect: "$stamp.noOfStampsToCollect",
          scansCount: { $size: "$scans" },
          isCompleted: {
            $eq: ["$stamp.noOfStampsToCollect", { $size: "$scans" }],
          },
        },
      },
      {
        $project: {
          customerId: 1,
          isCompleted: 1,
        },
      },
      {
        $group: {
          _id: "$customerId",
          isCompleted: { $max: { $cond: ["$isCompleted", 1, 0] } },
        },
      },
      {
        $group: {
          _id: null,
          totalEligibleForReward: {
            $sum: "$isCompleted",
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalEligibleForReward: 1,
        },
      },
    ]),
    CollectStamp.aggregate([
      {
        $match: {
          branchId: { $in: branchIds },
        },
      },
      {
        $lookup: {
          from: "order_stamps",
          localField: "_id",
          foreignField: "collectStampId",
          as: "scans",
          pipeline: [
            {
              $match: {
                ...(start || end ? { createdAt: dateFilter } : {}),
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "stamps",
          localField: "stampId",
          foreignField: "_id",
          as: "stamp",
        },
      },
      {
        $unwind: "$stamp",
      },
      {
        $addFields: {
          noOfStampsToCollect: "$stamp.noOfStampsToCollect",
          scansCount: { $size: "$scans" },
          isCompleted: {
            $gte: [{ $size: "$scans" }, "$stamp.noOfStampsToCollect"],
          },
          isRewardCollected: {
            $gt: [{ $size: "$scans" }, "$stamp.noOfStampsToCollect"],
          },
        },
      },
      {
        $project: {
          isCompleted: 1,
          isRewardCollected: 1,
        },
      },
      {
        $group: {
          _id: null,
          totalEligibleForReward: {
            $sum: {
              $cond: [
                {
                  $and: [{ $eq: ["$isCompleted", true] }, { $eq: ["$isRewardCollected", false] }],
                },
                1,
                0,
              ],
            },
          },
          totalRewardCollected: { $sum: { $cond: [{ $eq: ["$isRewardCollected", true] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const data: any = {};

  if (result1.length > 0) {
    data.totalEligibleForReward = result1[0].totalEligibleForReward;
  } else {
    data.totalEligibleForReward = 0;
  }

  if (result2.length <= 0) {
    data.totalReward = 0;
    data.totalRewardCollectedTrue = 0;
    data.totalRewardCollectedFalse = 0;
    data.rewardCollectedTruePercentage = 0;
    data.rewardCollectedFalsePercentage = 0;
  } else {
    const filterData = calculateRewardPercentages(result2[0]);
    data.totalReward = result2[0].totalEligibleForReward + result2[0].totalRewardCollected;
    data.totalRewardCollectedTrue = result2[0].totalRewardCollected;
    data.totalRewardCollectedFalse = result2[0].totalEligibleForReward;
    data.rewardCollectedTruePercentage = filterData.collectedPercentage;
    data.rewardCollectedFalsePercentage = filterData.notCollectedPercentage;
  }

  return apiResponse(res, 200, true, "Reward collect percentage fetched successfully!", data);
});
