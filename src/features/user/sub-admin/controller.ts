import bcrypt from "bcrypt";
import { Request, Response } from "express";
import { COOKIE_KEY, REFRESH_TOKEN_KEY, ROLE } from "../../../configs/constants";
import { apiResponse, asyncHandler, exclude, generateSignature, validateBody } from "../../../helpers";
import { IApiRequest } from "../../../types";
import { loginSchema } from "../validation";
import SubAdmin from "./model";

/**
 * Sub Admin Login
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const subAdminLogin = asyncHandler(async (req: Request, res: Response) => {
  const result = validateBody(loginSchema, req.body);
  if (!result) return apiResponse(res, 400, false, "Invalid Request!");

  const subAdmin: any = await SubAdmin.findOne({ email: req.body.email, status: true });
  if (!subAdmin) return apiResponse(res, 401, false, "Invalid Credentials!");

  const isPasswordValid = await bcrypt.compare(req.body.password, subAdmin.password);
  if (!isPasswordValid) return apiResponse(res, 401, false, "Invalid Credentials!");

  const accessToken = generateSignature({ email: subAdmin.email, role: ROLE.SUB_ADMIN }, "1d");
  const refreshToken = generateSignature({ email: subAdmin.email, role: ROLE.SUB_ADMIN }, "7d");

  res.cookie(COOKIE_KEY, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "development" ? false : true,
    sameSite: process.env.NODE_ENV === "development" ? "lax" : "none",
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  res.cookie(REFRESH_TOKEN_KEY, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "development" ? false : true,
    sameSite: process.env.NODE_ENV === "development" ? "lax" : "none",
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  // Remove Sensitive Data
  const data = exclude(subAdmin._doc, ["password", "createdAt", "updatedAt"]);

  return apiResponse(res, 200, true, "SubAdmin Login Successfully!", data);
});

/**
 * Sub Admin Profile
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const subAdminProfile = asyncHandler(async (req: IApiRequest, res: Response) => {
  if ("user" in req) {
    if (!req.user) return apiResponse(res, 401, false, "Unauthorized Request!");

    // Remove Sensitive Data
    const data = exclude(req.user, ["password", "createdAt", "updatedAt"]);

    return apiResponse(res, 200, true, "Sub Admin Profile", { ...data, role: req.role });
  } else {
    return apiResponse(res, 401, false, "Unauthorized!");
  }
});
