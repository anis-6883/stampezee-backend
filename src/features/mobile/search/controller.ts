import { Response } from "express";
import { IApiRequest } from "types";
import { apiResponse, asyncHandler } from "../../../helpers";
import Branch from "../../branch/model";
import Category from "../../category/model";
import Sorting from "../../sorting/model";

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
  const long = req.user.address.loc.coordinates[0];
  const lat = req.user.address.loc.coordinates[1];

  const branches = await Branch.aggregate([
    {
      $geoNear: {
        near: { type: "Point", coordinates: [Number(long), Number(lat)] },
        distanceField: "distance",
        spherical: true,
      },
    },
    {
      $lookup: {
        from: "stamps",
        localField: "_id",
        foreignField: "branchId",
        as: "stamps",
      },
    },
    {
      $unwind: "$stamps",
    },
    {
      $project: {
        branch: {
          _id: "$_id",
          name: "$name",
          distance: "$distance",
        },
        stamp: {
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
      $skip: 0,
    },
    {
      $limit: 10,
    },
  ]);

  return apiResponse(res, 200, true, "Location by stamp fetched successfully!", branches);
});
