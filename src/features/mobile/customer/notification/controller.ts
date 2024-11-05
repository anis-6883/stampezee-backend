import { Response } from "express";
import { apiResponse, asyncHandler, makePaginateForMobile } from "../../../../helpers/index";
import Notification from "../../../../models/notification";
import { IApiRequest } from "../../../../types/index";

/**
 * Get All Single Notifications
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllNotificationsForCustomer = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10 } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query = {
    createdAt: { $gte: req?.user.createdAt },
    $or: [{ type: "all" }, { sentTo: { $in: [req?.user?._id.toString()] } }],
  };

  const [docs, total] = await Promise.all([
    Notification.aggregate([
      {
        $match: query,
      },
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
        $project: {
          retailerId: 0,
          updatedAt: 0,
        },
      },
    ]),
    Notification.countDocuments(query),
  ]);

  const mobilePagination = makePaginateForMobile(Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Notifications fetched successfully!", docs, mobilePagination);
});
