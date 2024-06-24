import { Response } from "express";
import { IApiRequest } from "types";
import { apiResponse, asyncHandler, makePaginate } from "../../../helpers";
import Branch from "../../branch/model";
import Category from "../../category/model";
import Sorting from "../../sorting/model";
import Stamp from "../../stamp/model";
import Customer from "../../user/customer/model";
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
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);
  const query: any = { status: true, softDeleted: false };

  const long = req.user.address.loc.coordinates[0];
  const lat = req.user.address.loc.coordinates[1];

  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); //case insensitive search. For sensitive remove i
    query.name = regex;
  }

  const stampIds = (await CollectStamp.find({ customerId: req.user._id }, { stampId: 1, _id: 0 })).map(
    ({ stampId }) => stampId
  );

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
          as: "stamps",
          pipeline: [
            {
              $match: {
                startedAt: { $lte: new Date() },
                expiredAt: { $gt: new Date() },
                status: true,
                softDeleted: false,
                _id: { $nin: stampIds },
              },
            },
          ],
        },
      },
      {
        $unwind: "$stamps",
      },
      {
        $project: {
          _id: 0,
          branch: {
            _id: "$_id",
            name: "$name",
            distance: "$distance",
          },
          stamp: {
            _id: "$stamps._id",
            title: "$stamps.title",
          },
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
    Stamp.find({
      startedAt: { $lte: new Date() },
      expiredAt: { $gt: new Date() },
      status: true,
      softDeleted: false,
    }).countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Location by stamp fetched successfully!", data);
});

/**
 * Collect stamp by customer
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const collectStamp = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await collectStampSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const [branch, stamp, customer] = await Promise.all([
    Branch.findById(result.branchId),
    Stamp.findById(result.stampId),
    Customer.findById(result.customerId),
  ]);

  if (!branch || !stamp || !customer) {
    throw "Branch, stamp or customer not found!";
  }

  await CollectStamp.create(result);

  return apiResponse(res, 200, true, "Stamp collected successfully!");
});
