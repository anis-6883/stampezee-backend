import { Response } from "express";
import { apiResponse, asyncHandler } from "../../helpers";
import { IApiRequest } from "../../types";
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
