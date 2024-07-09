import { Response } from "express";
import mongoose from "mongoose";
import { apiResponse, asyncHandler, formatErrorMsg, makePaginateForMobile } from "../../../helpers";
import { IApiRequest } from "../../../types";
import Branch from "../../branch/model";
import Category from "../../category/model";
import Sorting from "../../sorting/model";
import Stamp from "../../stamp/model";
import CollectStamp from "./model";
import { collectStampSchema } from "./validation";

/**
 * Get All Stamp Categories
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllCategories = asyncHandler(async (req: IApiRequest, res: Response) => {
  const docs = await Category.find({ softDeleted: false, status: true }, { name: 1, image: 1 });

  const sorting = await Sorting.findOne({ title: "category" });
  const sortedIds = sorting ? sorting.sortedData : [];

  const categoryMap = new Map(docs.map((category) => [category._id.toString(), category]));
  const sortedList = sortedIds.map((id) => categoryMap.get(id)).filter(Boolean);

  return apiResponse(res, 200, true, "Stamp categories fetched successfully!", sortedList);
});

/**
 * Get All Stamps By Customer Location
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllStampsByLocation = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search, categoryId }: any = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);
  const long = req.user.address.loc.coordinates[0];
  const lat = req.user.address.loc.coordinates[1];

  if (!long || !lat) {
    throw "Latitude & Longitude must be set!";
  }

  const query: any = { status: true, softDeleted: false };
  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); //case insensitive search. For sensitive remove i
    query.name = regex;
  }

  const stampIds = (await CollectStamp.find({ customerId: req.user._id }, { stampId: 1, _id: 0 })).map(
    ({ stampId }) => stampId
  );

  const query2: any = {
    startedAt: { $lte: new Date() },
    expiredAt: { $gte: new Date() },
    status: true,
    softDeleted: false,
    _id: { $nin: stampIds },
  };

  if (categoryId) {
    query2.categoryId = mongoose.Types.ObjectId.createFromHexString(categoryId);
  }

  const [docs, total] = await Promise.all([
    Branch.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [Number(long), Number(lat)] },
          distanceField: "distance",
          spherical: true,
        },
      },
      {
        $match: query,
      },
      {
        $lookup: {
          from: "stamps",
          localField: "_id",
          foreignField: "branchId",
          as: "stamp",
          pipeline: [
            {
              $match: query2,
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
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "retailers",
          localField: "retailerId",
          foreignField: "_id",
          as: "retailer",
        },
      },
      {
        $unwind: "$stamp",
      },
      {
        $unwind: "$retailer",
      },
      {
        $project: {
          branch: {
            _id: "$_id",
            name: "$name",
            address: "$address.name",
          },
          "retailer.storeName": 1,
          "retailer.image": 1,
          stamp: 1,
          _id: 0,
        },
      },
      {
        $sort: {
          distance: 1,
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: Number(limit),
      },
    ]),
    Stamp.find(query2).countDocuments(),
  ]);

  const mobilePagination = makePaginateForMobile(Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Location by stamp fetched successfully!", docs, mobilePagination);
});

/**
 * Collect stamp by customer
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const collectStamp = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result: any = collectStampSchema.validate(req.body);
  if (result.error) return apiResponse(res, 400, false, formatErrorMsg(result));

  const { branchId, stampId } = result.value;

  const [alreadyCollected, branch, stamp] = await Promise.all([
    CollectStamp.find({
      branchId,
      stampId,
      customerId: req.user._id,
    }),
    Branch.findById(branchId),
    Stamp.findById(stampId),
  ]);

  if (alreadyCollected) {
    throw "This stamp already collected!";
  }

  if (!branch || !stamp) {
    throw "Branch or Stamp not found!";
  }

  await CollectStamp.create({
    branchId,
    stampId,
    customerId: req.user._id,
  });

  return apiResponse(res, 200, true, "Stamp collected successfully!");
});
