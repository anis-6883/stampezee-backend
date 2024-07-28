import { Response } from "express";
import { apiResponse, asyncHandler } from "../../helpers";
import { IApiRequest } from "../../types";
import Stamp from "../stamp/model";
import Customer from "../user/customer/model";
import Retailer from "../user/retailer/model";

export const fetchDashboardSuperAdmin = asyncHandler(async (req: IApiRequest, res: Response) => {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
  const [totalCustomer, totalRetailer, newCustomerThisMonth, newRetailerThisMonth, totalStamps, newStampsThisMonth] =
    await Promise.all([
      Customer.countDocuments({ isVerified: true }),
      Retailer.countDocuments({ isVerified: true, softDeleted: { $ne: true } }),
      Customer.countDocuments({
        isVerified: true,
        createdAt: {
          $gte: startOfMonth,
          $lt: endOfMonth,
        },
      }),
      Retailer.countDocuments({
        isVerified: true,
        softDeleted: { $ne: true },
        createdAt: {
          $gte: startOfMonth,
          $lt: endOfMonth,
        },
      }),
      Stamp.countDocuments({
        softDeleted: { $ne: true },
      }),
      Stamp.countDocuments({
        softDeleted: { $ne: true },
        createdAt: {
          $gte: startOfMonth,
          $lt: endOfMonth,
        },
      }),
    ]);
  const totalUser = totalCustomer + totalRetailer;

  const signup = {
    retailer: ((totalRetailer / totalUser) * 100).toFixed(2),
    customer: ((totalCustomer / totalUser) * 100).toFixed(2),
  };
  const data = {
    totalUser,
    totalCustomer,
    totalRetailer,
    newCustomerThisMonth,
    newRetailerThisMonth,
    totalStamps,
    newStampsThisMonth,
    signup: signup,
  };

  return apiResponse(res, 200, true, "Dashboard fetched successfully!", data);
});
