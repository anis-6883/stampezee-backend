import { Response } from "express";
import { PACKAGES } from "../../configs/constants";
import { apiResponse, asyncHandler, makePaginate } from "../../helpers";
import Branch from "../../models/branch";
import { IEnrollSubscription } from "../../models/enroll-subscription";
import Enrollment from "../../models/enrollment";
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

  const enrollments = await Enrollment.aggregate([
    {
      $match: {
        retailerId: req.user._id,
        paymentStatus: { $in: ["completed", "trial"] },
        validityTo: { $gt: new Date() },
      },
    },
    {
      $lookup: {
        from: "enroll_subscriptions",
        localField: "_id",
        foreignField: "enrollmentId",
        as: "enrollSubscription",
        pipeline: [
          {
            $match: {
              $or: [
                { status: true, deletedByRetailerAt: null },
                { status: false, validAtAfterCancel: { $gt: new Date() } },
              ],
            },
          },
        ],
      },
    },
    {
      $unwind: "$enrollSubscription",
    },
    {
      $match: {
        $or: [
          { "enrollSubscription.planSnapshot.type": "subscription" },
          { "enrollSubscription.planSnapshot.slug": PACKAGES.BRANCH },
          { "enrollSubscription.planSnapshot.slug": PACKAGES.TRIAL },
        ],
      },
    },
    {
      $replaceRoot: { newRoot: "$enrollSubscription" }, // Replace root with enrollSubscription
    },
  ]);

  if (enrollments.length === 0)
    return apiResponse(res, 400, false, "No one is allowed to create a branch without a plan!");

  const subscription: IEnrollSubscription = enrollments.find((enrollment: IEnrollSubscription) => {
    return enrollment.planSnapshot.type === "subscription";
  });

  const addons = enrollments
    .filter((enrollment: IEnrollSubscription) => {
      return enrollment.planSnapshot.type === "addon";
    })
    .map((enrollment: IEnrollSubscription) => enrollment._id);

  const createdTotalBranch = await Branch.find({ retailerId: req.user._id, softDeleted: false });
  const allowTotalBranch = subscription?.planSnapshot?.allowTotalBranch + addons.length;

  const branchWithoutSystemDisabled = createdTotalBranch.filter((branch) => !branch.disabledBySystem).length;

  if (branchWithoutSystemDisabled >= allowTotalBranch)
    return apiResponse(res, 400, false, "Your branch limit is over. Take new Add-on!");

  const subscriptionBranchSlot = createdTotalBranch.filter(
    (branch) => branch.source === "subscription" && !branch.disabledBySystem
  ).length;

  const source = subscriptionBranchSlot < subscription?.planSnapshot?.allowTotalBranch ? "subscription" : "addon";

  const retailerAddonIds = createdTotalBranch
    .filter((branch) => branch.source === "addon")
    .map((branch) => branch.enrollSubscriptionId.toString());

  const addonIds = addons.map((enrollSubscription: IEnrollSubscription) => enrollSubscription._id.toString());
  const unUsedIds = addonIds.filter((id) => !retailerAddonIds.includes(id));

  await Branch.create({
    name,
    address: {
      loc: { type: "Point", coordinates: [longitude, latitude] },
      name: address,
    },
    retailerId: req.user._id,
    enrollSubscriptionId: source === "subscription" ? subscription?._id : unUsedIds[0],
    source,
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
              $lookup: {
                from: "enrollments",
                localField: "enrollmentId",
                foreignField: "_id",
                as: "enrollment",
              },
            },
            {
              $unwind: "$enrollment",
            },
            {
              $project: {
                validityFrom: "$enrollment.validityFrom",
                validityTo: "$enrollment.validityTo",
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

  const enrollments = await Enrollment.aggregate([
    {
      $match: {
        retailerId: req.user._id,
        paymentStatus: { $in: ["completed", "trial"] },
        validityTo: { $gt: new Date() },
        status: true,
      },
    },
    {
      $lookup: {
        from: "enroll_subscriptions",
        localField: "_id",
        foreignField: "enrollmentId",
        as: "enrollSubscription",
        pipeline: [
          {
            $match: {
              status: true,
            },
          },
        ],
      },
    },
    {
      $unwind: "$enrollSubscription",
    },
    {
      $match: {
        "enrollSubscription.planSnapshot.type": "subscription",
      },
    },
    {
      $replaceRoot: { newRoot: "$enrollSubscription" }, // Replace root with enrollSubscription
    },
  ]);

  if (enrollments.length === 0)
    return apiResponse(res, 400, false, "No one is allowed to create a branch without a plan!");

  const subscription: IEnrollSubscription = enrollments.find((enrollment: IEnrollSubscription) => {
    return enrollment.planSnapshot.type === "subscription";
  });

  const retailerTotalActiveBranch = await Branch.find({
    retailerId: req.user._id,
    softDeleted: false,
    source: "subscription",
    disabledBySystem: false,
  });
  const allowTotalBranch = subscription?.planSnapshot?.allowTotalBranch ?? 0;

  if (retailerTotalActiveBranch.length >= allowTotalBranch)
    return apiResponse(res, 400, false, "Your branch limit is over to activate!");

  const updateBranch = await Branch.findByIdAndUpdate(id, { status: true, disabledBySystem: false }, { new: true });
  if (!updateBranch) return apiResponse(res, 400, false, "Branch not found!");

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

  const enrollments = await Enrollment.aggregate([
    {
      $match: {
        retailerId: req.user._id,
        paymentStatus: { $in: ["completed", "trial"] },
        validityTo: { $gt: new Date() },
        status: true,
      },
    },
    {
      $lookup: {
        from: "enroll_subscriptions",
        localField: "_id",
        foreignField: "enrollmentId",
        as: "enrollSubscription",
        pipeline: [
          {
            $match: {
              status: true,
            },
          },
        ],
      },
    },
    {
      $unwind: "$enrollSubscription",
    },
    {
      $match: {
        $or: [
          { "enrollSubscription.planSnapshot.type": "subscription" },
          { "enrollSubscription.planSnapshot.slug": "branch" },
        ],
      },
    },
    {
      $replaceRoot: { newRoot: "$enrollSubscription" }, // Replace root with enrollSubscription
    },
  ]);

  const createdTotalBranch = await Branch.find({ retailerId: req.user._id, softDeleted: false });

  const addons = enrollments
    .filter((enrollment: IEnrollSubscription) => {
      return enrollment.planSnapshot.type === "addon";
    })
    .map((enrollment: IEnrollSubscription) => enrollment._id);

  const retailerAddonIds = createdTotalBranch
    .filter((branch) => branch.source === "addon")
    .map((branch) => branch.enrollSubscriptionId.toString());

  const addonIds = addons.map((enrollSubscription: IEnrollSubscription) => enrollSubscription._id.toString());
  const unUsedIds = addonIds.filter((id) => !retailerAddonIds.includes(id));

  if (unUsedIds.length <= 0) return apiResponse(res, 400, false, "You have to purchase another add-on to convert!");

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
  const subAdmins = await SubAdmin.find({ branchId: id });
  if (subAdmins?.length > 0) {
    await Promise.all(
      subAdmins.map((subAdmin) =>
        SubAdmin.findByIdAndUpdate(subAdmin._id, {
          email: `deleted-${new Date().toISOString()}-${subAdmin.email}`,
          status: false,
          softDeleted: true,
        })
      )
    );
  }

  await Stamp.updateMany({ branchId: id }, { $set: { status: false, softDeleted: true } });

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
