import { Response } from "express";
import { apiResponse, asyncHandler, makePaginate } from "../../helpers";
import { IApiRequest } from "../../types";
import Customer from "../user/customer/model";

/**
 * Get All Customers
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllCustomers = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = { softDeleted: false };

  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); //case insensitive search. For sensitive remove i
    const orQuery = [{ fullName: regex }, { email: regex }];
    query.$or = orQuery;
  }

  const [docs, total] = await Promise.all([
    Customer.find(query, { password: 0 }).limit(Number(limit)).skip(skip).sort({ createdAt: "desc" }),
    Customer.find(query).countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Customers fetched successfully!", data);
});
