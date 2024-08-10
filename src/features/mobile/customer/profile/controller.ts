import { Response } from "express";
import { apiResponse, asyncHandler } from "../../../../helpers/index";
import { IApiRequest } from "../../../../types/index";
import Settings from "../../../settings/model";

/**
 * Get All Settings
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getSettings = asyncHandler(async (req: IApiRequest, res: Response) => {
  const settings = await Settings.findOne().select("general.contactEmail");
  const data = {
    termsAndCondition: `${process.env.FRONTEND_URL}/terms`,
    privacy: `${process.env.FRONTEND_URL}/privacy-policy`,
    faq: `${process.env.FRONTEND_URL}/faqs`,
    help: settings.general.contactEmail,
  };
  return apiResponse(res, 200, true, "Customer settings fetched successfully!", data);
});
