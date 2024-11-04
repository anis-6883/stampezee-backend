import { Response } from "express";
import { apiResponse, asyncHandler, makePaginate } from "../../helpers";
import Faq from "../../models/faq";
import Sorting from "../../models/sorting";
import { IApiRequest } from "../../types";
import { faqSchema, faqStatusSchema, updateFaqSchema } from "./validation";

/**
 * Create A Faq
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const createFaq = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await faqSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { softDeleted, ...createBody } = result;

  createBody.superAdminId = req.user._id;

  const faq: any = await Faq.create({
    ...createBody,
  });

  await Sorting.updateOne({ title: "faq" }, { $push: { sortedData: faq._id.toString() } }, { upsert: true });

  return apiResponse(res, 201, true, "Faq created successfully!", faq);
});

/**
 * Get All Faqs
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllFaqs = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = { softDeleted: false };

  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); //case insensitive search. For sensitive remove i
    query.title = regex;
  }

  const [docs, total] = await Promise.all([
    Faq.find(query).limit(Number(limit)).skip(skip),
    Faq.find(query).countDocuments(),
  ]);

  const sorting = await Sorting.findOne({ title: "faq" });
  const sortedIds = sorting ? sorting.sortedData : [];

  const faqMap = new Map(docs.map((faq) => [faq._id.toString(), faq]));
  const sortedList = sortedIds.map((id) => faqMap.get(id)).filter(Boolean);

  const data = makePaginate(sortedList, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Faqs fetched successfully!", data);
});

/**
 * Get All Faqs for Web
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllFaqsForWeb = asyncHandler(async (req: IApiRequest, res: Response) => {
  const docs = await Faq.find({ softDeleted: false, status: true }, { title: 1, description: 1 });

  const sorting = await Sorting.findOne({ title: "faq" });
  const sortedIds = sorting ? sorting.sortedData : [];

  const faqMap = new Map(docs.map((faq) => [faq._id.toString(), faq]));
  const sortedList = sortedIds.map((id) => faqMap.get(id)).filter(Boolean);

  return apiResponse(res, 200, true, "Faqs fetched successfully!", sortedList);
});

/**
 * Get A Single Faq
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getSingleFaq = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const faq = await Faq.findOne({ _id: id });
  if (!faq) return apiResponse(res, 404, false, "Faq not found!");

  return apiResponse(res, 200, true, "Faq fetched successfully!", faq);
});

/**
 * Update A Single Faq
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateFaq = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await updateFaqSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { id } = req.params;
  const { softDeleted, image, ...updatedBody } = result;

  const faq = await Faq.findOne({ _id: id });
  if (!faq) return apiResponse(res, 404, false, "Faq not found!");

  const updatedData: any = await Faq.findOneAndUpdate({ _id: id }, updatedBody, { new: true });

  return apiResponse(res, 200, true, "Faq updated successfully!", updatedData);
});

/**
 * Update Status A Single Faq
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateFaqStatus = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await faqStatusSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { id } = req.params;
  const { status } = result;

  const faq = await Faq.findOneAndUpdate(
    { _id: id },
    {
      status,
    },
    {
      new: true,
    }
  );

  if (!faq) return apiResponse(res, 404, false, "Faq not found!");

  return apiResponse(res, 200, true, "Faq status updated successfully!");
});

/**
 * Soft Delete A Faq
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const softDeleteFaq = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const faq = await Faq.findOneAndUpdate(
    { _id: id },
    {
      softDeleted: true,
    }
  );

  if (!faq) return apiResponse(res, 404, false, "Faq not found!");

  await Sorting.updateOne({ title: "faq" }, { $pull: { sortedData: id } });

  return apiResponse(res, 200, true, "Faq deleted successfully!");
});

/**
 * Get All Deleted Faqs
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllDeletedFaqs = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = { softDeleted: true };

  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); //case insensitive search. For sensitive remove i
    query.title = regex;
  }

  const [docs, total] = await Promise.all([
    Faq.find(query).limit(Number(limit)).skip(skip).sort({ createdAt: "desc" }),
    Faq.find(query).countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Deleted faqs fetched successfully!", data);
});

/**
 * Confirm Delete A Single Faq
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const confirmDeleteFaq = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const faq = await Faq.findOneAndDelete({ _id: id });
  if (!faq) return apiResponse(res, 404, false, "Faq not found!");

  return apiResponse(res, 200, true, "Faq deleted successfully!");
});
