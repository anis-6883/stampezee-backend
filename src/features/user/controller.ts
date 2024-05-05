import bcrypt from "bcrypt";
import { Request, Response } from "express";
import { COOKIE_KEY, REFRESH_TOKEN_KEY } from "../../configs/constants";
import operations from "../../controllers/operations";
import { apiResponse, asyncHandler, decodeAuthToken, generateSignature, validateBody } from "../../helpers";
import { IUser } from "../../types";
import User from "./model";
import { createUser } from "./service";
import { adminRegisterSchema, loginSchema, registerSchema } from "./validation";

/**
 * User Registration
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const userRegistration = asyncHandler(async (req: Request, res: Response) => {
  const result = validateBody(registerSchema, req.body);
  if (!result) return apiResponse(res, 400, false, "Invalid Request!");

  return createUser(req, res, "user");
});

/**
 * Admin Registration
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const adminRegistration = asyncHandler(async (req: Request, res: Response) => {
  const result = validateBody(adminRegisterSchema, req.body);
  if (!result) return apiResponse(res, 400, false, "Invalid Request!");

  return createUser(req, res, "admin");
});

/**
 * User Login
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const userLogin = asyncHandler(async (req: Request, res: Response) => {
  const result = validateBody(loginSchema, req.body);
  if (!result) return apiResponse(res, 400, false, "Invalid Request!");

  const user: IUser = await operations.findOne({ table: User, key: { email: req.body.email } });
  if (!user) return apiResponse(res, 401, false, "User does not exist!");

  const isPasswordValid = await bcrypt.compare(req.body.password, user.password);
  if (!isPasswordValid) return apiResponse(res, 401, false, "Invalid Credentials!");

  const accessToken = generateSignature({ email: user.email, role: user.role }, "1d");
  const refreshToken = generateSignature({ email: user.email, role: user.role }, "7d");

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

  return apiResponse(res, 200, true, "User Login Successfully!", user);
});

/**
 * User Logout
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const userLogout = asyncHandler(async (_req: Request, res: Response) => {
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

  return apiResponse(res, 200, true, "User Logout Successfully!");
});

/**
 * User Profile
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const userProfile = asyncHandler(async (req: Request, res: Response) => {
  if ("user" in req) {
    if (!req.user) return apiResponse(res, 401, false, "Unauthorized!");
    return apiResponse(res, 200, true, "User Profile", req.user);
  } else {
    return apiResponse(res, 401, false, "Unauthorized!");
  }
});

/**
 * Verify Access Token
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const authCheck = asyncHandler(async (req: Request, res: Response) => {
  const token = req?.cookies?.[COOKIE_KEY] || req.headers?.authorization?.replace("Bearer ", "");
  if (!token) return apiResponse(res, 401, false, "Unauthorized!");

  const user = await decodeAuthToken(token);
  if (!user) return apiResponse(res, 401, false, "Unauthorized!");

  return apiResponse(res, 200, true, "Authorized!", user);
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
