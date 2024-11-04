import Cryptr from "cryptr";
import { Response } from "express";
import { apiResponse, asyncHandler, makePaginate } from "../../helpers";
import Contact from "../../models/contact";
import { IApiRequest } from "../../types";
import { contactSchema } from "./validation";

/**
 * Subscribe to newsletter
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const submitContact = asyncHandler(async (req: IApiRequest, res: Response) => {
  const token = req.headers?.authorization?.replace("Bearer ", "");
  if (!token) return apiResponse(res, 401, false, "Unauthorized Request!");
  const { name, dialCode, phone, email, message } = await contactSchema.validateAsync(req.body);
  const forwardedIpsStr = req.headers["x-forwarded-for"] as string | undefined;
  const publicIP = req.headers["cf-connecting-ip"] || req.headers["x-real-ip"] || req.socket.remoteAddress || "";
  const ip = forwardedIpsStr ? forwardedIpsStr.split(", ")[0] : publicIP;
  const cryptr = new Cryptr(process.env.ENCRYPTION_KEY, {
    encoding: "base64",
    pbkdf2Iterations: 10000,
    saltLength: 12,
  });
  const macAddress = cryptr.decrypt(token);
  const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

  if (!macRegex.test(macAddress)) {
    throw "Invalid token!";
  }
  const randomDecimal = Math.random();
  const randomNumber = 6 + randomDecimal * 2;
  const sixToEightHoursAgo = new Date(Date.now() - randomNumber * 60 * 60 * 1000);
  const alreadySubmittedForm = await Contact.findOne({ macAddress, ip, createdAt: { $gte: sixToEightHoursAgo } });
  if (alreadySubmittedForm) throw "We have already received your message. Please wait, we will contact you shortly.";
  await Contact.create({ macAddress, name, dialCode, phone, ip, email, message });

  return apiResponse(res, 200, true, "Thank you for contacting with us! We will get back to you shortly");
});

/**
 * All subscribed users list
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const contactMessageList = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = {};

  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); //case insensitive search. For sensitive remove i
    query.email = regex;
    query.message = regex;
  }

  const [docs, total] = await Promise.all([
    Contact.find(query).select("-macAddress -updatedAt").sort({ createdAt: "asc" }).limit(Number(limit)).skip(skip),
    Contact.find(query).countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Contact request fetched successfully", data);
});
