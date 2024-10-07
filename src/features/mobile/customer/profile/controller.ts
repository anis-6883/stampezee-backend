import { Response } from "express";
import { apiResponse, asyncHandler, makePaginateForMobile } from "../../../../helpers/index";
import { IApiRequest, IRetailerScanQuery } from "../../../../types/index";
import Settings from "../../../settings/model";
import OrderStamp from "../../sub-admin/home/model";

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
          from: "collectstamps",
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
                    $unwind: "$category",
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
              $unwind: "$stamp",
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
              $unwind: "$branch",
            },
          ],
        },
      },
      {
        $unwind: "$collectstamp",
      },
      {
        $lookup: {
          from: "subadmins",
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
        $unwind: "$subAdmin",
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
        $unwind: "$customer",
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
          from: "collectstamps",
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
                    $unwind: "$category",
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
              $unwind: "$stamp",
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
              $unwind: "$branch",
            },
          ],
        },
      },
      {
        $unwind: "$collectstamp",
      },
      {
        $lookup: {
          from: "subadmins",
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
        $unwind: "$subAdmin",
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
        $unwind: "$customer",
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
