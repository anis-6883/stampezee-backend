import bcrypt from "bcrypt";
import { Request, Response } from "express";
import _ from "lodash";
import { IApiRequest } from "types";
import { COOKIE_KEY, REFRESH_TOKEN_KEY } from "../../../configs/constants";
import { apiResponse, asyncHandler, generateSignature, validateBody } from "../../../helpers";
import { adminRegisterSchema, loginSchema } from "../validation";
import SuperAdmin from "./model";

/**
 * Super Admin Registration
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const superAdminRegistration = asyncHandler(async (req: Request, res: Response) => {
  const result = validateBody(adminRegisterSchema, req.body);
  if (!_.isEmpty(result)) return apiResponse(res, 400, false, "Invalid Request!", result);

  const existingAdmin = await SuperAdmin.findOne({ email: req.body.email });
  if (existingAdmin) return apiResponse(res, 400, false, "This Super Admin already exists!");

  req.body.password = await bcrypt.hash(req.body.password, 10);

  const superAdmin: any = await SuperAdmin.create(req.body);

  // Remove Field
  delete superAdmin._doc.password;
  delete superAdmin._doc.createdAt;
  delete superAdmin._doc.updatedAt;

  return apiResponse(res, 201, true, "Super Admin registration successfully!", superAdmin);
});

/**
 * Super Admin Login
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const superAdminLogin = asyncHandler(async (req: Request, res: Response) => {
  const result = validateBody(loginSchema, req.body);
  if (!result) return apiResponse(res, 400, false, "Invalid Request!");

  const superAdmin: any = await SuperAdmin.findOne({ email: req.body.email });
  if (!superAdmin) return apiResponse(res, 401, false, "Invalid Credentials!");

  const isPasswordValid = await bcrypt.compare(req.body.password, superAdmin.password);
  if (!isPasswordValid) return apiResponse(res, 401, false, "Invalid Credentials!");

  const accessToken = generateSignature({ email: superAdmin.email, role: "super-admin" }, "1d");
  const refreshToken = generateSignature({ email: superAdmin.email, role: "super-admin" }, "7d");

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

  // Remove Field
  delete superAdmin._doc.password;
  delete superAdmin._doc.createdAt;
  delete superAdmin._doc.updatedAt;

  return apiResponse(res, 200, true, "Super Admin Login Successfully!", superAdmin);
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

    // Remove Field
    delete req.user.password;
    delete req.user.createdAt;
    delete req.user.updatedAt;

    return apiResponse(res, 200, true, "Super Admin Profile", req.user);
  } else {
    return apiResponse(res, 401, false, "Unauthorized!");
  }
});
