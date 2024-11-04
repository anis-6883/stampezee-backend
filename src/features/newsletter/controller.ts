import { Response } from "express";
import { apiResponse, asyncHandler, makePaginate } from "../../helpers";
import { default as Newsletter } from "../../models/newsletters";
import { IApiRequest } from "../../types";
import { newsletterSchema } from "./validation";

/**
 * Subscribe to newsletter
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const subscribeNewsletter = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { email } = await newsletterSchema.validateAsync(req.body);
  const forwardedIpsStr = req.headers["x-forwarded-for"] as string | undefined;
  const publicIP = req.headers["cf-connecting-ip"] || req.headers["x-real-ip"] || req.socket.remoteAddress || "";
  const ip = forwardedIpsStr ? forwardedIpsStr.split(", ")[0] : publicIP;

  const isEmailAlreadySubscribed = await Newsletter.findOne({ email });
  if (isEmailAlreadySubscribed) {
    throw "You have already joined our newsletter";
  }
  await Newsletter.create({ ip, email });

  return apiResponse(res, 200, true, "Thank you for joining our newsletter!");
});

/**
 * All subscribed users list
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const subscribedUserList = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = {};

  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); //case insensitive search. For sensitive remove i
    query.email = regex;
  }

  const [docs, total] = await Promise.all([
    Newsletter.find(query).select("-updatedAt").limit(Number(limit)).skip(skip),
    Newsletter.find(query).countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Thank you for joining our newsletter!", data);
});
