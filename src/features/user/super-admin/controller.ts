import bcrypt from "bcrypt";
import { Request, Response } from "express";
import { IApiRequest } from "types";
import { COOKIE_KEY, REFRESH_TOKEN_KEY, ROLE } from "../../../configs/constants";
import { apiResponse, asyncHandler, exclude, generateSignature } from "../../../helpers";
import { loginSchema, superAdminRegisterSchema } from "../validation";
import SuperAdmin from "./model";

/**
 * Super Admin Registration
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const superAdminRegistration = asyncHandler(async (req: Request, res: Response) => {
  const result = await superAdminRegisterSchema.validateAsync(req.body);

  const existingAdmin = await SuperAdmin.findOne({ email: result.email });
  if (existingAdmin) return apiResponse(res, 400, false, "This Super Admin already exists!");

  result.password = await bcrypt.hash(result.password, 10);

  const superAdmin: any = await SuperAdmin.create(result);

  // Remove Sensitive Data
  const data = exclude(superAdmin._doc, ["password", "createdAt", "updatedAt"]);

  return apiResponse(res, 201, true, "Super Admin registration successfully!", data);
});

/**
 * Super Admin Login
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const superAdminLogin = asyncHandler(async (req: Request, res: Response) => {
  const result = await loginSchema.validateAsync(req.body);

  const superAdmin: any = await SuperAdmin.findOne({ email: result.email });
  if (!superAdmin) return apiResponse(res, 401, false, "Invalid Credentials!");

  const isPasswordValid = await bcrypt.compare(result.password, superAdmin.password);
  if (!isPasswordValid) return apiResponse(res, 401, false, "Invalid Credentials!");

  const accessToken = generateSignature({ email: superAdmin.email, role: ROLE.SUPER_ADMIN }, "1d");
  const refreshToken = generateSignature({ email: superAdmin.email, role: ROLE.SUPER_ADMIN }, "7d");

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
  const data = exclude(superAdmin._doc, ["password", "createdAt", "updatedAt"]);

  return apiResponse(res, 200, true, "Super Admin Login Successfully!", { ...data, role: ROLE.SUPER_ADMIN });
});

/**
 * Super Admin Logout
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const superAdminLogout = asyncHandler(async (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_KEY, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "development" ? false : true,
    sameSite: process.env.NODE_ENV === "development" ? "lax" : "none",
    expires: new Date(Date.now()),
  });

  res.clearCookie(REFRESH_TOKEN_KEY, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "development" ? false : true,
    sameSite: process.env.NODE_ENV === "development" ? "lax" : "none",
    expires: new Date(Date.now()),
  });

  return apiResponse(res, 200, true, "Super Admin Logout Successfully!");
});

/**
 * Super Admin Profile
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const superAdminProfile = asyncHandler(async (req: IApiRequest, res: Response) => {
  if ("user" in req) {
    if (!req.user) return apiResponse(res, 401, false, "Unauthorized Request!");

    // Remove Sensitive Data
    const data = exclude(req.user, ["password", "createdAt", "updatedAt"]);

    return apiResponse(res, 200, true, "Super Admin Profile", { ...data, role: ROLE.SUPER_ADMIN });
  } else {
    return apiResponse(res, 401, false, "Unauthorized!");
  }
});
