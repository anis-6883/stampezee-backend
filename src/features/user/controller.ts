import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Model } from "mongoose";
import { COOKIE_KEY, REFRESH_TOKEN_KEY } from "../../configs/constants";
import { apiResponse, asyncHandler, generateSignature } from "../../helpers";
import Customer from "./customer/model";
import Retailer from "./retailer/model";
import SubAdmin from "./sub-admin/model";
import SuperAdmin from "./super-admin/model";

/**
 * Verify Access Token
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const authCheck = asyncHandler(async (req: Request, res: Response) => {
  const token = req?.cookies?.[COOKIE_KEY] || req.headers?.authorization?.replace("Bearer ", "");
  if (!token) return apiResponse(res, 401, false, "Unauthorized!");

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

  const user = await model.findOne({ email: decoded?.email });
  if (!user) return apiResponse(res, 401, false, "Unauthorized!");

  return apiResponse(res, 200, true, "Authorized!");
});

/**
 * Refresh Access Token
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const refreshAccessToken = asyncHandler(async (req: Request, res: Response) => {
  const token = req?.cookies[REFRESH_TOKEN_KEY] || req?.headers?.authorization?.replace("Bearer", "");
  if (!token) return apiResponse(res, 401, false, "Unauthorized!");

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

  const user = await model.findOne({ email: decoded?.email });
  if (!user) return apiResponse(res, 401, false, "Unauthorized!");

  const accessToken = generateSignature({ email: decoded.email, role: decoded.role }, "1d");

  res.cookie(COOKIE_KEY, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "development" ? false : true,
    sameSite: process.env.NODE_ENV === "development" ? "lax" : "none",
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  return apiResponse(res, 200, true, "Access Token Regenerated!");
});
