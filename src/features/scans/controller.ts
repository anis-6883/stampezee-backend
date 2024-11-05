import { Response } from "express";
import { apiResponse, asyncHandler, makePaginate } from "../../helpers";
import Customer from "../../models/customer";
import OrderStamp from "../../models/order-stamp";
import Retailer from "../../models/retailer";
import { IApiRequest, IRetailerScanQuery, ISuperAdminScanQuery } from "../../types";

/**
 * Stamp scan details for retailer
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const stampScanDetailsForRetailer = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search }: any = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);
  const query: IRetailerScanQuery = { retailerId: req?.user?._id };

  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); // case insensitive search. For sensitive remove 'i'
    const customers = await Customer.find({
      $or: [{ fullName: regex }, { email: regex }],
    }).select("_id");

    // Extract array of _id values
    const customerIds = customers.map((customer) => customer._id);
    query.customerId = { $in: customerIds };
  }
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
          "scan.amountCurrency": "$amountCurrency",
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

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Scans fetched successfully!", data);
});

export const stampScanDetailsForSuperAdmin = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search }: any = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);
  const query: ISuperAdminScanQuery = {};

  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); // case insensitive search. For sensitive remove 'i'
    const [customers, retailers] = await Promise.all([
      Customer.find({
        $or: [{ fullName: regex }, { email: regex }],
      }).select("_id"),
      Retailer.find({
        $or: [{ fullName: regex }, { email: regex }, { storeName: regex }],
      }).select("_id"),
    ]);

    // Extract array of _id values
    const customerIds = customers.map((customer) => customer._id);
    const retailerIds = retailers.map((retailer) => retailer._id);
    query.$or = [{ customerId: { $in: customerIds } }, { retailerId: { $in: retailerIds } }];
  }

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
        $lookup: {
          from: "retailers",
          localField: "retailerId",
          foreignField: "_id",
          as: "retailer",
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
                city: 1,
                address: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: "$retailer",
      },
      {
        $project: {
          "scan.time": "$createdAt",
          "scan.rewardCollected": "$rewardCollected",
          "scan.stampNumber": "$number",
          "scan.amount": "$amount",
          "scan.amountCurrency": "$amountCurrency",
          "scan.invoice": "$invoice",
          branch: "$collectstamp.branch",
          offer: "$collectstamp.stamp",
          subAdmin: 1,
          customer: 1,
          retailer: 1,
        },
      },
    ]),
    OrderStamp.countDocuments(query),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Scans fetched successfully!", data);
});
