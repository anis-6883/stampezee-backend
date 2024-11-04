import { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { Model } from "mongoose";
import { COOKIE_KEY, ROLE } from "../configs/constants";
import { apiResponse } from "../helpers";
import Customer from "../models/customer";
import Retailer from "../models/retailer";
import SubAdmin from "../models/sub-admin";
import SuperAdmin from "../models/super-admin";
import { IApiRequest, IJWTQuery } from "../types";

export const authAndPermissionCheck =
  (role: string | string[], checkPermission: boolean = true, findUser: boolean = true, ott: boolean = false) =>
  async (req: IApiRequest, res: Response, next: NextFunction): Promise<any> => {
    try {
      const token =
        req?.cookies?.temp || req.headers?.authorization?.replace("Bearer ", "") || req?.cookies?.[COOKIE_KEY];
      if (!token) return apiResponse(res, 401, false, "Unauthorized Request!");

      const decoded: any = jwt.verify(token, process.env.APP_SECRET!);
      let model: Model<any>;

      const hasPermission = Array.isArray(role) ? role.includes(decoded.role) : role === decoded.role;

      if (checkPermission && (!hasPermission || ott !== decoded.ott)) {
        return apiResponse(res, 403, false, "You are not authorized to perform this action!");
      }

      const query: IJWTQuery = { email: decoded?.email };
      if (findUser) {
        switch (decoded.role) {
          case ROLE.SUPER_ADMIN:
            model = SuperAdmin;
            break;
          case ROLE.RETAILER:
            model = Retailer;
            break;
          case ROLE.SUB_ADMIN:
            if (!ott) {
              query.token = token;
            }
            model = SubAdmin;
            break;
          case ROLE.CUSTOMER:
            if (!ott) {
              query.token = token;
            }
            model = Customer;
            break;
          default:
            return apiResponse(res, 401, false, "Unauthorized!");
        }
      }

      const user: any = await model.findOne(query);
      if (!user || (decoded.role === ROLE.RETAILER && (user?.status === false || user?.softDeleted === true))) {
        return apiResponse(res, 401, false, "Unauthorized Request!");
      }
      req.user = user._doc;
      req.token = token;
      req.role = decoded.role;
      return next();
    } catch (err) {
      console.error(err);
      return apiResponse(res, 401, false, "Unauthorized Request!");
    }
  };
