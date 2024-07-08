import { Response } from "express";
import { apiResponse, asyncHandler, makePaginate } from "../../helpers";
import { IApiRequest } from "../../types";
import EnrollSubscription from "../enroll-subscription/model";

/**
 * Get Subscription Payments
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getSubscriptionPayments = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, status }: any = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);
  const query: { paymentStatus: any } = { paymentStatus: { $in: ["pending", "completed"] } };

  if (status && ["pending", "completed"].includes(status)) {
    query.paymentStatus = status;
  }

  const [docs, total] = await Promise.all([
    EnrollSubscription.find(query, {
      retailerId: 1,
      paymentStatus: 1,
      "planSnapshot.title": 1,
      "planSnapshot.price": 1,
      validityFrom: 1,
      validityTo: 1,
      createdAt: 1,
    })
      .limit(Number(limit))
      .skip(skip)
      .sort({ createdAt: -1 }),
    EnrollSubscription.find({
      paymentStatus: { $in: ["pending", "completed"] },
    }).countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Subscription payments fetched successfully!", data);
});
