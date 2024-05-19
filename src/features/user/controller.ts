import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Model } from "mongoose";
import { COOKIE_KEY, REFRESH_TOKEN_KEY, ROLE } from "../../configs/constants";
import { apiResponse, asyncHandler, exclude, generateSignature } from "../../helpers";
import { IApiRequest } from "../../types";
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
export const verifyToken = asyncHandler(async (req: Request, res: Response) => {
  const token = req?.cookies?.[COOKIE_KEY] || req.headers?.authorization?.replace("Bearer ", "");
  if (!token) return apiResponse(res, 401, false, "Unauthorized!");

  const decoded: any = jwt.verify(token, process.env.APP_SECRET!);
  let model: Model<any>;

  switch (decoded.role) {
    case ROLE.SUPER_ADMIN:
      model = SuperAdmin;
      break;
    case ROLE.RETAILER:
      model = Retailer;
      break;
    case ROLE.SUB_ADMIN:
      model = SubAdmin;
      break;
    case ROLE.CUSTOMER:
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
    case ROLE.SUPER_ADMIN:
      model = SuperAdmin;
      break;
    case ROLE.RETAILER:
      model = Retailer;
      break;
    case ROLE.SUB_ADMIN:
      model = SubAdmin;
      break;
    case ROLE.CUSTOMER:
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

/**
 * Get Retailer or Super Admin Profile
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getUserProfile = asyncHandler(async (req: IApiRequest, res: Response) => {
  if ("user" in req) {
    if (!req.user) return apiResponse(res, 401, false, "Unauthorized Request!");

    // Remove Sensitive Data
    const data = exclude(req.user, ["password", "createdAt", "updatedAt"]);

    return apiResponse(res, 200, true, "Profile fetched successfully!", { ...data, role: req.role });
  } else {
    return apiResponse(res, 401, false, "Unauthorized!");
  }
});
