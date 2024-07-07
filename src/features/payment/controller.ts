import { Request, Response } from "express";
import { apiResponse, asyncHandler } from "../../helpers";
import { IApiRequest } from "../../types";

/**
 * Get Active Payment Plans
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllPayments = asyncHandler(async (req: IApiRequest, res: Response) => {
  return apiResponse(res, 200, true, "Payments fetched successfully!");
});
