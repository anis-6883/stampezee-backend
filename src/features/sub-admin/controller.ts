import bcrypt from "bcrypt";
import { Response } from "express";
import { deleteFileFromS3Bucket, uploadFileToS3Bucket } from "../../configs/s3Bucket";
import { apiResponse, asyncHandler, exclude, makePaginate } from "../../helpers";
import Branch from "../branch/model";
import SubAdmin from "../user/sub-admin/model";
import { subAdminSchema, subAdminSchema2, subAdminStatusSchema } from "./validation";

/**
 * Create A Sub Admin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const createSubAdmin = asyncHandler(async (req: any, res: Response) => {
  const result = await subAdminSchema.validateAsync(req.body);

  const { softDeleted, retailerId, password, ...createBody } = result;
  createBody.retailerId = req.user._id;

  const [branch, existingSubAdmin] = await Promise.all([
    Branch.findOne({ _id: createBody.branchId, retailerId: createBody.retailerId }),
    SubAdmin.findOne({ email: createBody.email }),
  ]);

  if (!branch) return apiResponse(res, 400, false, "Branch not found!");
  if (existingSubAdmin) return apiResponse(res, 400, false, "This sub admin already exists!");

  let imageKey = null;

  // Upload File to S3 Bucket
  if (req.file) {
    const { status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "users");
    if (status) {
      imageKey = key;
    }
  }

  createBody.password = await bcrypt.hash(password, 10);

  const subAdmin: any = await SubAdmin.create({
    ...createBody,
    image: imageKey,
    fullName: createBody?.lastName ? `${createBody.firstName} ${createBody.lastName}` : createBody.firstName,
  });

  // Remove Sensitive Data
  const data = exclude(subAdmin._doc, ["password", "createdAt", "updatedAt"]);

  return apiResponse(res, 201, true, "Sub Admin created successfully!", data);
});

/**
 * Get All Sub Admins
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllSubAdmins = asyncHandler(async (req: any, res: Response) => {
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = { retailerId: req.user._id, softDeleted: false };
  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); //case insensitive search. For sensitive remove i
    const orQuery = [{ fullName: regex }, { email: regex }];
    query.$or = orQuery;
  }

  const [docs, total] = await Promise.all([
    SubAdmin.aggregate([
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
        $match: query,
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
                name: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: "$branch",
      },
      {
        $project: {
          branchId: 0,
          password: 0,
        },
      },
    ]),

    SubAdmin.find({ retailerId: req.user._id, softDeleted: { $eq: false } }).countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Sub Admins fetched successfully!", data);
});

/**
 * Get Branches
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getBranches = asyncHandler(async (req: any, res: Response) => {
  const branches = await Branch.find({ retailerId: req.user._id, softDeleted: { $eq: false } }, { name: 1 }).sort({
    createdAt: "desc",
  });
  return apiResponse(res, 200, true, "Branches fetched successfully!", branches);
});

/**
 * Get A Single SubAdmin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getSingleSubAdmin = asyncHandler(async (req: any, res: Response) => {
  const { id } = req.params;

  const subAdmin = await SubAdmin.findOne({ _id: id }, { password: 0 });
  if (!SubAdmin) return apiResponse(res, 404, false, "Sub Admin not found!");

  return apiResponse(res, 201, true, "Sub Admin fetched successfully!", subAdmin);
});

/**
 * Update A Single Sub Admin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateSubAdmin = asyncHandler(async (req: any, res: Response) => {
  const result = await subAdminSchema2.validateAsync(req.body, { abortEarly: false });

  const { id } = req.params;
  const { softDeleted, password, ...updatedBody } = result;

  if (updatedBody.branchId) {
    const branch = await Branch.findOne({ _id: updatedBody.branchId, retailerId: req.user._id });
    if (!branch) return apiResponse(res, 400, false, "Branch not found!");
  }

  const existingSubAdmin = await SubAdmin.findOne({ email: updatedBody.email, _id: { $ne: id } });
  if (existingSubAdmin) return apiResponse(res, 400, false, "This sub admin already exists!");

  // Upload File to S3 Bucket
  if (req.file) {
    const { status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "users");
    if (status) {
      updatedBody.image = key;
    }
    // Delete Existing Image if have
    const prevImage = await SubAdmin.findById(id, { image: 1 });
    deleteFileFromS3Bucket(prevImage?.image);
  }

  const subAdmin: any = await SubAdmin.findOneAndUpdate({ _id: id }, updatedBody, {
    new: true,
    projection: { password: 0, createdAt: 0, updatedAt: 0 },
  });

  if (!subAdmin) {
    return apiResponse(res, 404, false, "Sub Admin not found!");
  }

  return apiResponse(res, 200, true, "Sub Admin updated successfully!", subAdmin);
});

/**
 * Update Status A Single Sub-Admin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateSubAdminStatus = asyncHandler(async (req: any, res: Response) => {
  const result = await subAdminStatusSchema.validateAsync(req.body, {
    abortEarly: false,
  });
  const { id } = req.params;
  const { status } = result;

  const subAdmin = await SubAdmin.findOneAndUpdate(
    { _id: id },
    {
      status,
    },
    {
      new: true,
    }
  );

  if (!subAdmin) return apiResponse(res, 404, false, "Sub admin not found!");

  return apiResponse(res, 200, true, "Sub admin status updated successfully!");
});

/**
 * Soft Delete A Sub Admin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const softDeleteSubAdmin = asyncHandler(async (req: any, res: Response) => {
  const { id } = req.params;

  const subAdmin = await SubAdmin.findById(id);
  if (!subAdmin) return apiResponse(res, 404, false, "Sub Admin not found!");

  await SubAdmin.findByIdAndUpdate(id, {
    email: `deleted-${new Date().toISOString()}-${subAdmin.email}`,
    softDeleted: true,
  });

  return apiResponse(res, 200, true, "Sub Admin deleted successfully!");
});

/**
 * Get All Deleted Sub Admins
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllDeletedSubAdmins = asyncHandler(async (req: any, res: Response) => {
  const { page = 1, limit = 10 } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const [docs, total] = await Promise.all([
    SubAdmin.find({ retailerId: req.user._id, softDeleted: { $eq: true } }, { password: 0 })
      .limit(Number(limit))
      .skip(skip)
      .sort({ createdAt: "desc" }),
    SubAdmin.find({ retailerId: req.user._id, softDeleted: { $eq: true } }).countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 201, true, "Deleted Branches fetched successfully!", data);
});

/**
 * Confirm Delete A Single Sub Admin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const confirmDeleteSubAdmin = asyncHandler(async (req: any, res: Response) => {
  const { id } = req.params;

  // Delete Existing Image if have
  const prevImage = await SubAdmin.findById(id, { image: 1 });
  deleteFileFromS3Bucket(prevImage?.image);

  const subAdmin = await SubAdmin.findOneAndDelete({ _id: id });
  if (!subAdmin) return apiResponse(res, 404, false, "Sub Admin not found!");

  return apiResponse(res, 200, true, "Sub Admin deleted successfully!");
});
