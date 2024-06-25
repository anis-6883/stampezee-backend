import { Response } from "express";
import { IApiRequest } from "types";
import { apiResponse, asyncHandler } from "../../../helpers";

/**
 * Get All Collected Stamps
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getCollectedStamps = asyncHandler(async (req: IApiRequest, res: Response) => {
  return apiResponse(res, 200, true, "Collected stamps fetched successfully!");
});
