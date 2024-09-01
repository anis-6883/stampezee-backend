import { Response } from "express";
import { apiResponse, asyncHandler, makePaginate } from "../../helpers";
import { IApiRequest } from "../../types";
import Settings from "../settings/model";
import CurrencyExchange from "./model";
import { currencyExchangeSchema, currencyExchangeStatusSchema, updateCurrencyExchangeSchema } from "./validation";

/**
 * Create A Currency Exchange
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const createCurrencyExchange = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await currencyExchangeSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { softDeleted, ...createBody } = result;

  createBody.superAdminId = req.user._id;

  const existingCurrencyExchange = await CurrencyExchange.findOne({ name: createBody.name });

  if (existingCurrencyExchange) {
    await CurrencyExchange.findByIdAndUpdate(existingCurrencyExchange._id, {
      exchangeRate: createBody.exchangeRate,
    });
  } else {
    await CurrencyExchange.create(createBody);
  }

  return apiResponse(res, 201, true, "Currency exchange created successfully!");
});

/**
 * Get All Currency Exchanges
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllCurrencyExchanges = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = {};

  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); //case insensitive search. For sensitive remove i
    query.name = regex;
  }

  const [docs, total] = await Promise.all([
    CurrencyExchange.find(query).limit(Number(limit)).skip(skip).sort({ baseCurrency: 1 }),
    CurrencyExchange.find(query).countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Currency exchanges fetched successfully!", data);
});

/**
 * Get A Single Currency Exchange
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getSingleCurrencyExchange = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const currencyExchange = await CurrencyExchange.findOne({ _id: id });
  if (!currencyExchange) return apiResponse(res, 404, false, "Currency exchange not found!");

  return apiResponse(res, 200, true, "Currency exchange fetched successfully!", currencyExchange);
});

/**
 * Update A Single Currency Exchange
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateCurrencyExchange = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await updateCurrencyExchangeSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { id } = req.params;
  const { softDeleted, image, ...updatedBody } = result;

  const currencyExchange = await CurrencyExchange.findOne({ _id: id });
  if (!currencyExchange) return apiResponse(res, 404, false, "Currency exchange not found!");

  const existingCurrencyExchange = await CurrencyExchange.findOne({ name: updatedBody.name, _id: { $ne: id } });
  if (existingCurrencyExchange) return apiResponse(res, 400, false, "This currency exchange name already exists!");

  const updatedData: any = await CurrencyExchange.findOneAndUpdate({ _id: id }, updatedBody, { new: true });

  return apiResponse(res, 200, true, "Currency exchange updated successfully!", updatedData);
});

/**
 * Update Status A Single Currency Exchange
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateCurrencyExchangeStatus = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await currencyExchangeStatusSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { id } = req.params;
  const { status } = result;

  const currencyExchange = await CurrencyExchange.findOneAndUpdate(
    { _id: id },
    {
      status,
    },
    {
      new: true,
    }
  );

  if (!currencyExchange) return apiResponse(res, 404, false, "Currency exchange not found!");

  return apiResponse(res, 200, true, "Currency exchange status updated successfully!");
});

/**
 * Confirm Delete A Single Currency Exchange
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const confirmDeleteCurrencyExchange = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const currencyExchange = await CurrencyExchange.findOneAndDelete({ _id: id });
  if (!currencyExchange) return apiResponse(res, 404, false, "Currency exchange not found!");

  return apiResponse(res, 200, true, "Currency exchange deleted successfully!");
});

/**
 * Get Default And Selected Currency Exchange Rate
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getTwoCurrencyExchangeRate = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { currency } = req.query;

  const settings = await Settings.findOne(
    {},
    {
      "stripe.defaultCurrency": 1,
    }
  );

  const currencyExchangeRates = await CurrencyExchange.find({
    $or: [{ name: currency }, { name: settings?.stripe?.defaultCurrency?.currency }],
  });

  // const currencyExchange = await CurrencyExchange.findOne({ name: currency });
  if (!currencyExchangeRates?.length) return apiResponse(res, 404, false, "Currency exchange not found!");

  return apiResponse(res, 200, true, "Currency exchange rates fetched successfully!", currencyExchangeRates);
});
