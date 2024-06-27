import { Response } from "express";
import { apiResponse, asyncHandler } from "../../helpers";
import Sorting from "./model";
import { sortingSchema } from "./validation";

/**
 * Update Sorting Data
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateSortingData = asyncHandler(async (req: any, res: Response) => {
  const result = await sortingSchema.validateAsync(req.body);
  const { title, sortedData } = result;

  await Sorting.findOneAndUpdate({ title }, { sortedData }, { upsert: true });

  return apiResponse(res, 200, true, `${title} sorting updated successfully!`);
});
