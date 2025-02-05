import { Request, Response } from "express";
import { apiResponse, asyncHandler, flattenObject } from "../../helpers";
import Settings from "../../models/settings";
import { settingsSchema } from "./validation";

/**
 * Get Settings Data
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await Settings.findOne({});
  if (!settings) return apiResponse(res, 400, false, "Settings not found!");

  return apiResponse(res, 200, true, "Settings fetched Successfully!", settings);
});

/**
 * Update Settings Data
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const result = await settingsSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { general, notification, pages, s3Bucket, stripe, googleMap } = result;

  const settings = await Settings.findOne({});
  let data = null;

  if (!settings) {
    data = await Settings.create({
      pages,
      stripe,
      general,
      s3Bucket,
      googleMap,
      notification,
    });
  } else {
    const pattern = flattenObject(req.body);

    data = await Settings.findOneAndUpdate({ _id: settings._id }, pattern, {
      new: true,
    });
  }

  return apiResponse(res, 200, true, "Settings updated successfully!", data);
});

/**
 * Get Common Settings Data
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getCommonSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await Settings.findOne(
    {},
    {
      "general.timezone": 1,
      "general.facebook": 1,
      "general.instagram": 1,
      "general.tiktok": 1,
      "general.linkedin": 1,
      "general.androidDownloadLink": 1,
      "general.iosDownloadLink": 1,
      "stripe.stripePublishKey": 1,
      "stripe.planChangeCost": 1,
      "stripe.refundableThreshold": 1,
      "stripe.taxTitle": 1,
      "stripe.taxCost": 1,
      "stripe.taxStatus": 1,
      "stripe.allowCurrencies": 1,
      "page.terms": 1,
      "page.policy": 1,
      "googleMap.googleMapsApiKey": 1,
    }
  );

  if (!settings) return apiResponse(res, 400, false, "Settings not found!");

  return apiResponse(res, 200, true, "Settings fetched Successfully!", settings);
});

/**
 * Get Secret Settings Data
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getSecretSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await Settings.findOne({}, { "general.timezone": 1 });
  if (!settings) return apiResponse(res, 400, false, "Settings not found!");

  return apiResponse(res, 200, true, "Settings fetched Successfully!", settings);
});
