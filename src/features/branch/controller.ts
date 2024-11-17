import { Response } from "express";
import { PACKAGES } from "../../configs/constants";
import { apiResponse, asyncHandler, makePaginate } from "../../helpers";
import Branch from "../../models/branch";
import EnrollSubscription from "../../models/enroll-subscription";
import Stamp from "../../models/stamp";
import SubAdmin from "../../models/sub-admin";
import { IApiRequest } from "../../types";
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

  if (!subscription) throw "No one is allowed to create a branch without a plan!";

  // const allowTotalBranch = (subscription?.planSnapshot?.allowTotalBranch ?? 0) + addons.length;
  const allowTotalBranch = 0;
  const branchWithoutSystemDisabled = retailerTotalBranch.filter((branch) => !branch.disabledBySystem).length;

  if (branchWithoutSystemDisabled >= allowTotalBranch) throw "Your branch limit is over. Take new Add-on!";

  const retailerAddonIds = retailerTotalBranch
    .filter((branch) => branch.source === "addon")
    .map((branch) => branch.enrollmentId.toString());
  const addonIds = addons.map((enroll) => enroll._id.toString());
  const unUsedIds = addonIds.filter((item) => !retailerAddonIds.includes(item));

  const subscriptionBranchSlot = retailerTotalBranch.filter(
    (branch) => branch.source === "subscription" && !branch.disabledBySystem
  ).length;

  // const source = subscriptionBranchSlot < subscription?.planSnapshot?.allowTotalBranch ? "subscription" : "addon";
  const source = "subscription";

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
 * Get All Branches
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
        $match: query,
      },
      {
        $sort: {
          disabledBySystem: 1,
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
          from: "enroll_subscriptions",
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
    Branch.countDocuments(query),
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
 * Activate System Disabled Branch
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const activateSystemDisabledBranch = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  // Check Subscription & Addon Enrollment
  const [subscription, retailerTotalActiveBranch] = await Promise.all([
    EnrollSubscription.findOne({
      retailerId: req.user._id,
      "planSnapshot.type": "subscription",
      paymentStatus: { $in: ["completed", "trial"] },
      validityTo: { $gt: new Date() },
      status: true,
    }),
    Branch.find({ retailerId: req.user._id, softDeleted: false, source: "subscription", disabledBySystem: false }),
  ]);

  if (!subscription) throw "No one is allowed to activate branch without a plan!";

  // const allowTotalBranch = subscription?.planSnapshot?.allowTotalBranch ?? 0;
  const allowTotalBranch = 0;
  if (retailerTotalActiveBranch.length >= allowTotalBranch) throw "Your branch limit is over to activate!";

  const updateBranch = await Branch.findByIdAndUpdate(id, { status: true, disabledBySystem: false }, { new: true });
  if (!updateBranch) throw "Branch not found!";

  return apiResponse(res, 200, true, "Branch activated successfully!");
});

/**
 * Convert to Ad-on Branch
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const convertToAddonBranch = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  // Check Addon Enrollment
  const [addons, retailerTotalBranch] = await Promise.all([
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

  const retailerAddonIds = retailerTotalBranch
    .filter((branch) => branch.source === "addon")
    .map((branch) => branch.enrollmentId.toString());
  const addonIds = addons.map((enroll) => enroll._id.toString());
  const unUsedIds = addonIds.filter((item) => !retailerAddonIds.includes(item));

  if (unUsedIds.length <= 0) {
    throw "You have to purchase another add-on to convert!";
  }

  const branch = await Branch.findOneAndUpdate(
    { _id: id },
    {
      enrollSubscriptionId: unUsedIds[0],
      source: "addon",
      disabledBySystem: false,
      status: true,
    },
    {
      new: true,
    }
  );

  if (!branch) return apiResponse(res, 404, false, "Branch not found!");

  return apiResponse(res, 200, true, "Branch source convert to add-on successfully!");
});

/**
 * Soft Delete A Single Branch
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const softDeleteBranch = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const branch = await Branch.findOneAndUpdate({ _id: id }, { softDeleted: true, status: false });
  if (!branch) return apiResponse(res, 404, false, "Branch not found!");

  // engaged sub-admin & stamp also deleted
  const subAdmin = await SubAdmin.findOne({ branchId: id });
  if (subAdmin) {
    await SubAdmin.findOneAndUpdate(
      { branchId: id },
      { email: `deleted-${new Date().toISOString()}-${subAdmin.email}`, status: false, softDeleted: true }
    );
  }

  await Stamp.findOneAndUpdate({ branchId: id }, { status: false, softDeleted: true });

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
