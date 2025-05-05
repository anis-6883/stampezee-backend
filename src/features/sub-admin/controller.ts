import bcrypt from "bcrypt";
import { Response } from "express";
import { deleteFileFromS3Bucket, uploadFileToS3Bucket } from "../../configs/s3Bucket";
import { apiResponse, asyncHandler, exclude, makePaginate } from "../../helpers";
import Branch from "../../models/branch";
import SubAdmin from "../../models/sub-admin";
import { IApiRequest } from "../../types";
import { generateUniqueSubAdminEmail, isValidEmail, sendRegistrationMail } from "./service";
import { subAdminSchema, subAdminSchema2, subAdminStatusSchema } from "./validation";

export const nextSubAdminEmail = asyncHandler(async (req: IApiRequest, res: Response) => {
  const lastSubAdmin: any = await SubAdmin.findOne({ retailerId: req.user._id }).sort({ createdAt: -1 });

  let number = 1;
  if (lastSubAdmin) {
    // Extract number after @s
    const match = lastSubAdmin.email.match(/@s(\d+)/);
    number = match ? parseInt(match[1]) : 0;
    // console.log({ number });
    number = number + 1;
  }
  const email = generateUniqueSubAdminEmail(req.user.email, `s${number}`);

  return apiResponse(res, 200, true, "Next sub-admin email fetched successfully!", email);
});

/**
 * Create A Sub Admin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const createSubAdmin = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await subAdminSchema.validateAsync(req.body);

  const { softDeleted, retailerId, password, email, ...createBody } = result;
  createBody.retailerId = req.user._id;

  if (!isValidEmail(email)) {
    return apiResponse(res, 400, false, "Invalid email format!");
  }

  const isEmailExist: any = await SubAdmin.findOne({ email });

  if (isEmailExist) {
    return apiResponse(res, 400, false, "Username is not available!");
  }

  const [branch, existingSubAdmin]: any = await Promise.all([
    Branch.findOne({ _id: createBody.branchId, retailerId: createBody.retailerId }),
    SubAdmin.findOne({ email }),
  ]);

  if (!branch) return apiResponse(res, 400, false, "Branch not found!");
  if (existingSubAdmin) return apiResponse(res, 400, false, "This email already exists!");

  let imageKey = null;

  // Upload File to S3 Bucket
  if (req.file) {
    const { status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "users");
    if (status) {
      imageKey = key;
    }
  }

  createBody.password = await bcrypt.hash(password, 10);
  createBody.email = email;
  const fullName = createBody?.lastName ? `${createBody.firstName} ${createBody.lastName}` : createBody.firstName;

  const subAdmin: any = await SubAdmin.create({
    ...createBody,
    image: imageKey,
    fullName,
  });
  console.log(createBody.contactEmail, createBody.email, fullName, password, req.user.storeName, branch.name);
  await sendRegistrationMail(
    createBody.contactEmail,
    createBody.email,
    fullName,
    password,
    req.user.storeName,
    branch.name
  );

  // Remove Sensitive Data
  const data = exclude(subAdmin._doc, ["password", "createdAt", "updatedAt"]);

  return apiResponse(res, 201, true, "Sub Admin created successfully & sent mail!", data);
});

/**
 * Get All Sub Admins
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllSubAdmins = asyncHandler(async (req: IApiRequest, res: Response) => {
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
        $unwind: {
          path: "$branch",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          branchId: 0,
          password: 0,
        },
      },
    ]),
    SubAdmin.countDocuments(query),
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
export const getBranches = asyncHandler(async (req: IApiRequest, res: Response) => {
  const branches = await Branch.find(
    { retailerId: req.user._id, softDeleted: false, disabledBySystem: false },
    { name: 1 }
  ).sort({
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
export const getSingleSubAdmin = asyncHandler(async (req: IApiRequest, res: Response) => {
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
export const updateSubAdmin = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await subAdminSchema2.validateAsync(req.body, { abortEarly: false });

  const { id } = req.params;
  const { softDeleted, password, ...updatedBody } = result;

  if (updatedBody.branchId) {
    const branch = await Branch.findOne({ _id: updatedBody.branchId, retailerId: req.user._id });
    if (!branch) return apiResponse(res, 400, false, "Branch not found!");
  }

  const isExist = await SubAdmin.findOne({ email: updatedBody.email, _id: { $ne: id } });
  if (isExist) return apiResponse(res, 400, false, "This email already exists!");

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

  if (updatedBody?.deleteImageOnUpdate) {
    const prevImage = await SubAdmin.findById(id, { image: 1 });
    deleteFileFromS3Bucket(prevImage?.image);

    updatedBody.image = null;
  }

  const subAdmin: any = await SubAdmin.findOneAndUpdate({ _id: id }, updatedBody, {
    new: true,
    projection: { password: 0, createdAt: 0, updatedAt: 0 },
  });

  if (!subAdmin) return apiResponse(res, 404, false, "Sub Admin not found!");

  return apiResponse(res, 200, true, "Sub Admin updated successfully!", subAdmin);
});

/**
 * Update Status A Single Sub-Admin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateSubAdminStatus = asyncHandler(async (req: IApiRequest, res: Response) => {
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
export const softDeleteSubAdmin = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const subAdmin = await SubAdmin.findById(id);
  if (!subAdmin) return apiResponse(res, 404, false, "Sub Admin not found!");

  await SubAdmin.findByIdAndUpdate(id, {
    email: `deleted-${new Date().toISOString()}-${subAdmin.email}`,
    softDeleted: true,
    status: false,
  });

  return apiResponse(res, 200, true, "Sub Admin deleted successfully!");
});

/**
 * Get All Deleted Sub Admins
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllDeletedSubAdmins = asyncHandler(async (req: IApiRequest, res: Response) => {
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
export const confirmDeleteSubAdmin = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  // Delete Existing Image if have
  const prevImage = await SubAdmin.findById(id, { image: 1 });
  deleteFileFromS3Bucket(prevImage?.image);

  const subAdmin = await SubAdmin.findOneAndDelete({ _id: id });
  if (!subAdmin) return apiResponse(res, 404, false, "Sub Admin not found!");

  return apiResponse(res, 200, true, "Sub Admin deleted successfully!");
});
