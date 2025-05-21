import { asyncHandler } from "./../../../helpers/index";
import { apiResponse } from "../../../helpers/index";
import Settings from "../../../models/settings";
import { IApiRequest } from "../../../types/index";
import { Response } from "express";

export const getSettings = asyncHandler(async (req: IApiRequest, res: Response) => {
  const settings = await Settings.findOne().select("appVersion");

  return apiResponse(res, 200, true, "Customer settings fetched successfully!", settings);
});
