import { Response } from "express";
import { apiResponse, asyncHandler } from "../../../helpers";
import { IApiRequest } from "../../../types";

/**
 * Get All Collected Stamps
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getCollectedStamps = asyncHandler(async (req: IApiRequest, res: Response) => {
  return apiResponse(res, 200, true, "Collected stamps fetched successfully!");
});
