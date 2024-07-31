import { Response } from "express";
import { apiResponse, asyncHandler } from "../../helpers";
import { IApiRequest } from "../../types";
import OrderStamp from "../mobile/sub-admin/home/model";
import Stamp from "../stamp/model";
import Customer from "../user/customer/model";
import Retailer from "../user/retailer/model";

export const fetchDashboardSuperAdmin = asyncHandler(async (req: IApiRequest, res: Response) => {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);

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

  return apiResponse(res, 200, true, "Dashboard fetched successfully!", data);
});

export const fetchDashboardRetailer = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { startDate, endDate }: any = req.query;

  const start = startDate ? new Date(startDate) : new Date("1970-01-01");
  const end = endDate ? new Date(endDate) : new Date();

  // Ensure the end date is inclusive by setting it to the end of the day
  end.setHours(23, 59, 59, 999);

  const [totalOrders, totalAmountAndReward, totalAmountAndRewardSubAdmin, totalStamps] = await Promise.all([
    OrderStamp.countDocuments({
      retailerId: req?.user?._id,
      createdAt: { $gte: start, $lte: end },
    }),
    OrderStamp.aggregate([
      {
        $match: {
          retailerId: req?.user?._id,
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalRewardCollected: { $sum: { $cond: [{ $eq: ["$rewardCollected", true] }, 1, 0] } },
        },
      },
    ]),
    OrderStamp.aggregate([
      {
        $match: {
          retailerId: req?.user?._id,
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$subAdminId",
          totalAmount: { $sum: "$amount" },
          totalRewardCollected: { $sum: { $cond: [{ $eq: ["$rewardCollected", true] }, 1, 0] } },
        },
      },
      {
        $lookup: {
          from: "subadmins",
          localField: "_id",
          foreignField: "_id",
          as: "subAdmin",
          pipeline: [
            {
              $lookup: {
                from: "branches",
                localField: "branchId",
                foreignField: "_id",
                as: "branch",
                pipeline: [
                  {
                    $project: {
                      _id: 0,
                      name: 1,
                      address: "$address.name",
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
                fullName: 1,
                image: 1,
                email: 1,
                branch: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: "$subAdmin",
      },
      {
        $project: {
          _id: 0,
          totalAmount: 1,
          totalRewardCollected: 1,
          subAdmin: 1,
        },
      },
    ]),
    Stamp.countDocuments({
      retailerId: req?.user?._id,
      softDeleted: { $ne: true },
      createdAt: { $gte: start, $lte: end },
    }),
  ]);

  const data = { totalOrders, totalAmountAndReward, totalAmountAndRewardSubAdmin, totalStamps };
  return apiResponse(res, 200, true, "Dashboard fetched successfully!", data);
});
