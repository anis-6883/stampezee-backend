import { Response } from "express";
import { apiResponse, asyncHandler, makePaginate } from "../../helpers";
import { IApiRequest } from "../../types";
import Notification from "./model";
import { notificationSchema } from "./validation";

/**
 * Create A Notification
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const createNotification = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await notificationSchema.validateAsync(req.body);

  const { title, description, address, radius, longitude, latitude } = result;

  await Notification.create({
    title,
    description,
    address: {
      loc: { type: "Point", coordinates: [longitude, latitude] },
      name: address,
    },
    radius,
  });

  return apiResponse(res, 201, true, "Notification created successfully!");
});

/**
 * Get All Single Notificationes
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllNotificationes = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = { retailerId: req.user._id, softDeleted: false };
  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); //case insensitive search. For sensitive remove i
    query.name = regex;
  }

  const [docs, total] = await Promise.all([
    Notification.aggregate([
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: Number(limit),
      },
      {
        $match: query,
      },
      {
        $lookup: {
          from: "enrollsubscriptions",
          localField: "enrollSubscriptionId",
          foreignField: "_id",
          as: "enrollSubscription",
          pipeline: [
            {
              $project: {
                validityFrom: 1,
                validityTo: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$enrollSubscription",
          preserveNullAndEmptyArrays: true,
        },
      },
    ]),
    Notification.find(query).countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Notificationes fetched successfully!", data);
});
