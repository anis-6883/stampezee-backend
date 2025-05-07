import { Response } from "express";
import { apiResponse, asyncHandler, makePaginateForMobile } from "../../../../helpers/index";
import OrderStamp from "../../../../models/order-stamp";
import Settings from "../../../../models/settings";
import { IApiRequest, IRetailerScanQuery } from "../../../../types/index";

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

/**
 * Customer Scan History
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const customerScanHistory = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10 } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);
  const query: IRetailerScanQuery = { customerId: req?.user?._id };

  const [docs, total] = await Promise.all([
    OrderStamp.aggregate([
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
        $lookup: {
          from: "collect_stamps",
          localField: "collectStampId",
          foreignField: "_id",
          as: "collectstamp",
          pipeline: [
            {
              $lookup: {
                from: "stamps",
                localField: "stampId",
                foreignField: "_id",
                as: "stamp",
                pipeline: [
                  {
                    $lookup: {
                      from: "categories",
                      localField: "categoryId",
                      foreignField: "_id",
                      as: "category",
                      pipeline: [
                        {
                          $project: {
                            name: 1,
                          },
                        },
                      ],
                    },
                  },
                  {
                    $unwind: {
                      path: "$category",
                      preserveNullAndEmptyArrays: true,
                    },
                  },
                  {
                    $project: {
                      title: 1,
                      description: 1,
                      rules: 1,
                      noOfStampsToCollect: 1,
                      minPurchaseAmount: 1,
                      rewardType: 1,
                      promotionReward: 1,
                      discountReward: 1,
                      category: "$category.name",
                    },
                  },
                ],
              },
            },
            {
              $unwind: {
                path: "$stamp",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $lookup: {
                from: "branches",
                localField: "branchId",
                foreignField: "_id",
                as: "branch",
                pipeline: [
                  {
                    $project: {
                      _id: 0,
                      name: 1,
                      address: "$address.name",
                    },
                  },
                ],
              },
            },
            {
              $unwind: {
                path: "$branch",
                preserveNullAndEmptyArrays: true,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$collectstamp",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "sub_admins",
          localField: "subAdminId",
          foreignField: "_id",
          as: "subAdmin",
          pipeline: [
            {
              $project: {
                _id: 0,
                fullName: 1,
                email: 1,
                image: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$subAdmin",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "customers",
          localField: "customerId",
          foreignField: "_id",
          as: "customer",
          pipeline: [
            {
              $project: {
                _id: 0,
                fullName: 1,
                email: 1,
                contactEmail: 1,
                image: 1,
                dialCode: 1,
                phone: 1,
                country: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$customer",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          "scan.time": "$createdAt",
          "scan.rewardCollected": "$rewardCollected",
          "scan.stampNumber": "$number",
          "scan.amount": "$amount",
          "scan.invoice": "$invoice",
          branch: "$collectstamp.branch",
          offer: "$collectstamp.stamp",
          subAdmin: 1,
          customer: 1,
        },
      },
    ]),
    OrderStamp.countDocuments(query),
  ]);

  const mobilePagination = makePaginateForMobile(Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Customer scan history fetched successfully!", docs, mobilePagination);
});

/**
 * Customer Already Collected Reward History
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const customerCollectedRewardHistory = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10 } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);
  const query: IRetailerScanQuery = { customerId: req?.user?._id, rewardCollected: true };

  const [docs, total] = await Promise.all([
    OrderStamp.aggregate([
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
        $lookup: {
          from: "collect_stamps",
          localField: "collectStampId",
          foreignField: "_id",
          as: "collectstamp",
          pipeline: [
            {
              $lookup: {
                from: "stamps",
                localField: "stampId",
                foreignField: "_id",
                as: "stamp",
                pipeline: [
                  {
                    $lookup: {
                      from: "categories",
                      localField: "categoryId",
                      foreignField: "_id",
                      as: "category",
                      pipeline: [
                        {
                          $project: {
                            name: 1,
                          },
                        },
                      ],
                    },
                  },
                  {
                    $unwind: {
                      path: "$category",
                      preserveNullAndEmptyArrays: true,
                    },
                  },
                  {
                    $project: {
                      title: 1,
                      description: 1,
                      rules: 1,
                      noOfStampsToCollect: 1,
                      minPurchaseAmount: 1,
                      rewardType: 1,
                      promotionReward: 1,
                      discountReward: 1,
                      category: "$category.name",
                    },
                  },
                ],
              },
            },
            {
              $unwind: {
                path: "$stamp",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $lookup: {
                from: "branches",
                localField: "branchId",
                foreignField: "_id",
                as: "branch",
                pipeline: [
                  {
                    $project: {
                      _id: 0,
                      name: 1,
                      address: "$address.name",
                    },
                  },
                ],
              },
            },
            {
              $unwind: {
                path: "$branch",
                preserveNullAndEmptyArrays: true,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$collectstamp",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "sub_admins",
          localField: "subAdminId",
          foreignField: "_id",
          as: "subAdmin",
          pipeline: [
            {
              $project: {
                _id: 0,
                fullName: 1,
                email: 1,
                image: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$subAdmin",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "customers",
          localField: "customerId",
          foreignField: "_id",
          as: "customer",
          pipeline: [
            {
              $project: {
                _id: 0,
                fullName: 1,
                email: 1,
                contactEmail: 1,
                image: 1,
                dialCode: 1,
                phone: 1,
                country: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$customer",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          "scan.time": "$createdAt",
          "scan.rewardCollected": "$rewardCollected",
          "scan.stampNumber": "$number",
          "scan.amount": "$amount",
          "scan.invoice": "$invoice",
          branch: "$collectstamp.branch",
          offer: "$collectstamp.stamp",
          subAdmin: 1,
          customer: 1,
        },
      },
    ]),
    OrderStamp.countDocuments(query),
  ]);

  const mobilePagination = makePaginateForMobile(Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Customer collected reward fetched successfully!", docs, mobilePagination);
});
