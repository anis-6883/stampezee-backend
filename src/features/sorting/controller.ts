import { Response } from "express";
import _ from "lodash";
import { IApiRequest } from "types";
import { apiResponse, asyncHandler, validateBody } from "../../helpers";
import Sorting from "./model";
import { sortingSchema } from "./validation";

/**
 * Update Sorting Data
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateSortingData = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = validateBody(sortingSchema, req.body);
  if (!_.isEmpty(result)) return apiResponse(res, 400, false, "Invalid Request!", result);

  const { title, sortedData } = req.body;
  await Sorting.findOneAndUpdate({ title }, { sortedData }, { upsert: true });

  return apiResponse(res, 200, true, `${title} sorting updated successfully`);
});
