import bcrypt from "bcrypt";
import { Request, Response } from "express";
import { COOKIE_KEY, REFRESH_TOKEN_KEY } from "../../configs/constants";
import operations from "../../controllers/operations";
import { apiResponse, asyncHandler, decodeAuthToken, generateSignature, validateBody } from "../../helpers";
import { IUser } from "../../types";
import User from "../user/model";
import { loginSchema, registerSchema } from "./validation";

/**
 * Admin Registration
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const adminRegistration = asyncHandler(async (req: Request, res: Response) => {
  const result = validateBody(registerSchema, req.body);
  if (!result) return apiResponse(res, 400, false, "Invalid Request!");

  const existingAdmin = await operations.findOne({ table: User, key: { email: req.body.email } });
  if (existingAdmin) return apiResponse(res, 400, false, "User already exists!");

  req.body.password = await bcrypt.hash(req.body.password, 10);

  const admin: IUser = await operations.create({ table: User, key: { ...req.body, role: "admin" } });

  const accessToken = generateSignature({ email: admin.email, role: admin.role }, "1d");
  const refreshToken = generateSignature({ email: admin.email, role: admin.role }, "7d");

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

  return apiResponse(res, 201, true, "Admin Registration Successfully!", admin);
});

/**
 * Admin Login
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const adminLogin = asyncHandler(async (req: Request, res: Response) => {
  const result = validateBody(loginSchema, req.body);
  if (!result) return apiResponse(res, 400, false, "Invalid Request!");

  const admin: IUser = await operations.findOne({ table: User, key: { email: req.body.email } });
  if (!admin) return apiResponse(res, 401, false, "User does not exist!");

  const isPasswordValid = await bcrypt.compare(req.body.password, admin.password);
  if (!isPasswordValid) return apiResponse(res, 401, false, "Invalid Credentials!");

  const accessToken = generateSignature({ email: admin.email, role: admin.role }, "1d");
  const refreshToken = generateSignature({ email: admin.email, role: admin.role }, "7d");

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

  return apiResponse(res, 200, true, "Admin Login Successfully!", admin);
});

/**
 * Admin Logout
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const adminLogout = asyncHandler(async (_req: Request, res: Response) => {
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

  return apiResponse(res, 200, true, "Admin Logout Successfully!");
});

/**
 * Admin Profile
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const adminProfile = asyncHandler(async (req: Request, res: Response) => {
  if ("user" in req) {
    if (!req.user) return apiResponse(res, 401, false, "Unauthorized!");
    return apiResponse(res, 200, true, "Admin Profile", req.user);
  } else {
    return apiResponse(res, 401, false, "Unauthorized!");
  }
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

  const user = await decodeAuthToken(token);
  if (!user) return apiResponse(res, 401, false, "Unauthorized!");

  const accessToken = generateSignature({ email: user.email, role: user.role }, "1d");

  res.cookie(COOKIE_KEY, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "development" ? false : true,
    sameSite: process.env.NODE_ENV === "development" ? "lax" : "none",
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  return apiResponse(res, 200, true, "Access Token Generated!", user);
});
