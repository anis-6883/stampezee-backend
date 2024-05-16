import { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { Model } from "mongoose";
import { COOKIE_KEY } from "../configs/constants";
import Customer from "../features/user/customer/model";
import Retailer from "../features/user/retailer/model";
import SubAdmin from "../features/user/sub-admin/model";
import SuperAdmin from "../features/user/super-admin/model";
import { apiResponse } from "../helpers";
import { IApiRequest } from "../types";

export const checkAuth = (data: any) => {
  return async (req: IApiRequest, res: Response, next: NextFunction): Promise<any> => {
    try {
      const token = req?.cookies?.[COOKIE_KEY] || req.headers?.authorization?.replace("Bearer ", "");
      if (!token) return apiResponse(res, 401, false, "Unauthorized Request!");

      const decoded: any = jwt.verify(token, process.env.APP_SECRET!);
      let model: Model<any>;

      switch (decoded.role) {
        case "super-admin":
          model = SuperAdmin;
          break;
        case "retailer":
          model = Retailer;
          break;
        case "sub-admin":
          model = SubAdmin;
          break;
        case "customer":
          model = Customer;
          break;
        default:
          return apiResponse(res, 401, false, "Unauthorized!");
      }

      const user: any = await model.findOne({ email: decoded?.email });
      if (!user) return apiResponse(res, 401, false, "Unauthorized Request!");

      req.token = token;
      req.user = user._doc;
      return next();
    } catch (err) {
      console.error(err);
      return apiResponse(res, 401, false, "Unauthorized Request!");
    }
  };
};

export const superAdminAuthorize = async (req: IApiRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const token = req?.cookies?.[COOKIE_KEY] || req.headers?.authorization?.replace("Bearer ", "");
    if (!token) return apiResponse(res, 401, false, "Unauthorized Request!");

    const decoded: any = jwt.verify(token, process.env.APP_SECRET!);

    const user: any = await SuperAdmin.findOne({ email: decoded?.email });
    if (!user) return apiResponse(res, 401, false, "Unauthorized Request!");

    req.token = token;
    req.user = user._doc;
    return next();
  } catch (err) {
    console.error(err);
    return apiResponse(res, 401, false, "Unauthorized Request!");
  }
};

export const retailerAuthorize = async (req: IApiRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const token =
      req?.cookies?.[COOKIE_KEY] || req?.cookies?.temp || req.headers?.authorization?.replace("Bearer ", "");
    if (!token) return apiResponse(res, 401, false, "Unauthorized Request!");

    const decoded: any = jwt.verify(token, process.env.APP_SECRET!);

    const user: any = await Retailer.findOne({ email: decoded?.email });
    if (!user) return apiResponse(res, 401, false, "Unauthorized Request!");

    req.token = token;
    req.user = user._doc;
    return next();
  } catch (err) {
    console.error(err);
    return apiResponse(res, 401, false, "Unauthorized Request!");
  }
};

export const subAuthorize = async (req: IApiRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const token =
      req?.cookies?.[COOKIE_KEY] || req?.cookies?.temp || req.headers?.authorization?.replace("Bearer ", "");
    if (!token) return apiResponse(res, 401, false, "Unauthorized Request!");

    const decoded: any = jwt.verify(token, process.env.APP_SECRET!);

    const user: any = await Retailer.findOne({ email: decoded?.email });
    if (!user) return apiResponse(res, 401, false, "Unauthorized Request!");

    req.token = token;
    req.user = user._doc;
    return next();
  } catch (err) {
    console.error(err);
    return apiResponse(res, 401, false, "Unauthorized Request!");
  }
};

export const customerAuthorize = async (req: IApiRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const token = req?.cookies?.[COOKIE_KEY] || req.headers?.authorization?.replace("Bearer ", "");
    if (!token) return apiResponse(res, 401, false, "Unauthorized Request!");

    const decoded: any = jwt.verify(token, process.env.APP_SECRET!);

    const user: any = await Customer.findOne({ email: decoded?.email });
    if (!user) return apiResponse(res, 401, false, "Unauthorized Request!");

    req.token = token;
    req.user = user._doc;
    return next();
  } catch (err) {
    console.error(err);
    return apiResponse(res, 401, false, "Unauthorized Request!");
  }
};
