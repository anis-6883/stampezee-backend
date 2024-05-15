import { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { COOKIE_KEY } from "../configs/constants";
import Retailer from "../features/user/retailer/model";
import SuperAdmin from "../features/user/super-admin/model";
import { apiResponse } from "../helpers";
import { IApiRequest } from "../types";

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

export const tempRetailerAuthorize = async (req: IApiRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const token = req?.cookies?.temp || req.headers?.authorization?.replace("Bearer ", "");
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
