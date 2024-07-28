import { Response } from "express";
import { apiResponse, asyncHandler } from "../../helpers";
import { IApiRequest } from "../../types";

export const stampScanDetails = asyncHandler(async (req: IApiRequest, res: Response) => {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
  return apiResponse(res, 200, true, "Scans fetched successfully!");
});
