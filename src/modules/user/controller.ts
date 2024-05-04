import { Request, Response } from "express";
import { COOKIE_KEY } from "../../configs/constants";
import { apiResponse, asyncHandler, decodeAuthToken } from "../../helpers";
import { registerSchema } from "./validation";

export const userRegistration = asyncHandler((req: Request, res: Response) => {
  const result = registerSchema.validate(req.body, {
    allowUnknown: true,
    abortEarly: false,
  });

  if (result.error) {
    const format: any = {};

    result.error.details.forEach((detail) => {
      format[detail.context.label] = detail.message;
    });

    return apiResponse(res, 400, false, "Input validation failed!", format);
  }

  return apiResponse(res, 200, true, "User Registration!");
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
