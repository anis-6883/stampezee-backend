import { Response } from "express";
import { apiResponse, asyncHandler, generateSignature } from "../../helpers";
import { IApiRequest } from "../../types";
const ALARM_EXPIRE_TIME = 60 * 60 * 24 * 29 * 1000; // 29 Days

/**
 * Refresh Access Token
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const refreshAccessToken = asyncHandler(async (req: IApiRequest, res: Response) => {
  const accessToken = generateSignature({ email: req.user.email, role: req.role }, 2592000); // 30 Day expiry 30*24*60*60;
  const refreshToken = generateSignature({ email: req.user.email, role: req.role }, 5184000); // 60 Day expiry 60*24*60*60;

  return apiResponse(res, 200, true, "Access Token Regenerated!", {
    accessToken,
    refreshToken,
    expiresIn: new Date().setTime(new Date().getTime() + ALARM_EXPIRE_TIME),
  });
});
