import { Response } from "express";
import { COOKIE_KEY } from "../../configs/constants";
import { apiResponse, asyncHandler, generateSignature } from "../../helpers";
import { IApiRequest } from "../../types";

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
