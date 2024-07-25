import { Response } from "express";
import { PACKAGES } from "../../configs/constants";
import { apiResponse, asyncHandler, makePaginate } from "../../helpers";
import { IApiRequest } from "../../types";
import EnrollSubscription from "../enroll-subscription/model";
import Branch from "./model";
import { branchSchema, branchStatusSchema, updateBranchSchema } from "./validation";

/**
 * Create A Branch
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const createBranch = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await branchSchema.validateAsync(req.body);

  const { name, address, longitude, latitude } = result;

  // Check Subscription & Addon Enrollment
  const [subscription, addons, retailerTotalBranch] = await Promise.all([
    EnrollSubscription.findOne({
      retailerId: req.user._id,
      "planSnapshot.type": "subscription",
      paymentStatus: { $in: ["completed", "trial"] },
      validityTo: { $gt: new Date() },
      status: true,
    }),
    EnrollSubscription.find({
      retailerId: req.user._id,
      "planSnapshot.type": "addon",
      "planSnapshot.slug": PACKAGES.BRANCH,
      paymentStatus: "completed",
      validityTo: { $gt: new Date() },
      status: true,
    }),
    Branch.find({ retailerId: req.user._id, softDeleted: false }),
  ]);

  if (!subscription) {
    throw "No one is allowed to create a branch without a plan!";
  }

  const allowTotalBranch = (subscription?.planSnapshot?.allowTotalBranch ?? 0) + addons.length;

  if (retailerTotalBranch.length >= allowTotalBranch) {
    throw "Your branch limit is over!";
  }

  const retailerAddonIds = retailerTotalBranch
    .filter((branch) => branch.source === "addon")
    .map((branch) => branch.enrollSubscriptionId.toString());
  const addonIds = addons.map((branch) => branch._id.toString());
  const unUsedIds = addonIds.filter((item) => !retailerAddonIds.includes(item));

  const subscriptionBranchSlot = retailerTotalBranch.filter((branch) => branch.source === "subscription").length;
  const source = subscriptionBranchSlot < subscription?.planSnapshot?.allowTotalBranch ? "subscription" : "addon";

  await Branch.create({
    name,
    address: {
      loc: { type: "Point", coordinates: [longitude, latitude] },
      name: address,
    },
    retailerId: req.user._id,
    source,
    enrollSubscriptionId: source === "subscription" ? subscription._id : unUsedIds[0],
  });

  return apiResponse(res, 201, true, "Branch created successfully!");
});

/**
 * Get All Single Branches
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllBranches = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = { retailerId: req.user._id, softDeleted: false };
  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); //case insensitive search. For sensitive remove i
    query.name = regex;
  }

  const [docs, total] = await Promise.all([
    Branch.aggregate([
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
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $match: query,
      },
      {
        $skip: skip,
      },
      {
        $limit: Number(limit),
      },
    ]),
    Branch.find(query).countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Branches fetched successfully!", data);
});

/**
 * Get A Single Branch
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getSingleBranch = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const branch = await Branch.findOne({ _id: id });
  if (!branch) return apiResponse(res, 404, false, "Branch not found!");

  return apiResponse(res, 201, true, "Branch fetched successfully!", branch);
});

/**
 * Update A Single Branch
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateBranch = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await updateBranchSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { id } = req.params;
  const { name, address, longitude, latitude } = result;

  const branch = await Branch.findOneAndUpdate(
    { _id: id },
    {
      name,
      ...(address && {
        address: {
          loc: { type: "Point", coordinates: [longitude, latitude] },
          name: address,
        },
      }),
    },
    {
      new: true,
    }
  );

  if (!branch) return apiResponse(res, 404, false, "Branch not found!");

  return apiResponse(res, 200, true, "Branch updated successfully!", branch);
});

/**
 * Update Status A Single Branch
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateBranchStatus = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await branchStatusSchema.validateAsync(req.body, {
    abortEarly: false,
  });
  const { id } = req.params;
  const { status } = result;

  const branch = await Branch.findOneAndUpdate(
    { _id: id },
    {
      status,
    },
    {
      new: true,
    }
  );

  if (!branch) return apiResponse(res, 404, false, "Branch not found!");

  return apiResponse(res, 200, true, "Branch status updated successfully!");
});

/**
 * Soft Delete A Single Branch
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const softDeleteBranch = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const branch = await Branch.findOneAndUpdate({ _id: id }, { $set: { softDeleted: true } });
  if (!branch) return apiResponse(res, 404, false, "Branch not found!");

  return apiResponse(res, 200, true, "Branch deleted successfully!");
});

/**
 * Get All Deleted Branches
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllDeletedBranches = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = { retailerId: req.user._id, softDeleted: true };
  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); //case insensitive search. For sensitive remove i
    query.name = regex;
  }

  const [docs, total] = await Promise.all([
    Branch.find(query).limit(Number(limit)).skip(skip).sort({ createdAt: "desc" }),
    Branch.find(query).countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 201, true, "Deleted Branches fetched successfully!", data);
});

/**
 * Confirm Delete A Single Branch
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const confirmDeleteBranch = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const branch = await Branch.findOneAndDelete({ _id: id });
  if (!branch) return apiResponse(res, 404, false, "Branch not found!");

  return apiResponse(res, 200, true, "Branch deleted successfully!");
});
