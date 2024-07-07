import { Request, Response } from "express";
import moment from "moment";
import { COOKIE_KEY, REFRESH_TOKEN_KEY, ROLE } from "../../configs/constants";
import { apiResponse, asyncHandler, exclude, generateSignature } from "../../helpers";
import { IApiRequest } from "../../types";
import EnrollSubscription from "../enroll-subscription/model";

/**
 * Verify Access Token
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const verifyToken = asyncHandler(async (req: IApiRequest, res: Response) => {
  if (!req.role) {
    return apiResponse(res, 401, false, "Unauthorized Request!");
  }
  return apiResponse(res, 200, true, "Authorized!", { role: req.role });
});

/**
 * Refresh Access Token
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const refreshAccessToken = asyncHandler(async (req: IApiRequest, res: Response) => {
  const accessToken = generateSignature({ email: req.user.email, role: req.role }, "1d");

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
  // Remove Sensitive Data
  const data = exclude(req.user, ["password", "createdAt", "updatedAt"]);
  data.plan = null;
  data.planValidAt = null;

  // Check Subscription & Addon Enrollment
  if (req.role === ROLE.RETAILER) {
    const subscription = await EnrollSubscription.findOne({
      retailerId: req.user._id,
      "planSnapshot.type": "subscription",
      paymentStatus: { $in: ["completed", "trial"] },
      validityTo: { $gt: moment() },
    }).sort({ createdAt: "desc" });

    if (subscription) {
      data.plan = subscription.planSnapshot.slug;
      data.planValidAt = subscription.validityTo;
    }
  }

  data.role = req.role;

  return apiResponse(res, 200, true, "Profile fetched successfully!", data);
});

/**
 * Super Admin and Retailer Logout
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

  return apiResponse(res, 200, true, "Logout Successfully!");
});
