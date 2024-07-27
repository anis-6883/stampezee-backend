import { Response } from "express";
import notification from "../../configs/fcm";
import { uploadFileToS3Bucket } from "../../configs/s3Bucket";
import { apiResponse, asyncHandler, fileValidation, makePaginate } from "../../helpers";
import { IApiRequest } from "../../types";
import Settings from "../settings/model";
import Customer from "../user/customer/model";
import Notification from "./model";
import { notificationBasedOnLocationSchema, notificationSchema } from "./validation";

/**
 * Create A Notification
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const createNotification = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await notificationSchema.validateAsync(req.body);
  const { title, description, imageType, image, address, radius } = result;
  const settings = await Settings.findOne().select("notification");

  let notificationObj = { title, description, image };
  // File Validation
  if (req.file) {
    const { status, message } = fileValidation(req.file, undefined, ["image/jpeg", "image/png", "image/jpg"]);
    if (!status) {
      return apiResponse(res, 400, false, "Invalid Request!", { image: message });
    }
  }

  // Upload File to S3 Bucket
  if (req.file) {
    const { status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "category");
    if (status) {
      notificationObj.image = key;
    }
  }
  if (imageType == "url") {
    notificationObj.image = image;
  }

  notification.sendNotification({
    title,
    description,
    imageUrl: notificationObj.image,
    data: { image: notificationObj.image },
    topic: settings.notification.firebaseTopics,
  });

  await Notification.create({
    title,
    description,
    image: notificationObj.image,
    retailerId: req?.user?._id,
    radius,
  });

  return apiResponse(res, 200, true, "Notification created successfully!");
});

export const createNotificationBasedOnLocation = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await notificationBasedOnLocationSchema.validateAsync(req.body);
  const { title, description, imageType, image, address, radius, longitude, latitude } = result;

  let notificationObj = { title, description, image };
  // File Validation
  if (req.file) {
    const { status, message } = fileValidation(req.file, undefined, ["image/jpeg", "image/png", "image/jpg"]);
    if (!status) {
      return apiResponse(res, 400, false, "Invalid Request!", { image: message });
    }
  }

  // Upload File to S3 Bucket
  if (req.file) {
    const { status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "category");
    if (status) {
      notificationObj.image = key;
    }
  }
  if (imageType == "url") {
    notificationObj.image = image;
  }
  const earthRadiusInMiles = 3959;
  const radiusInMiles = radius ** 0.621371;
  const deviceTokens = await Customer.aggregate([
    {
      $match: {
        "address.loc": {
          $geoWithin: {
            $centerSphere: [[Number(longitude), Number(latitude)], radiusInMiles / earthRadiusInMiles],
          },
        },
        isVerified: true,
        deviceToken: { $ne: null },
      },
    },
    {
      $project: {
        _id: 0,
        deviceToken: 1,
      },
    },
  ]);

  const tokens = deviceTokens.map((token) => token.deviceToken);

  notification.sendNotification({
    title,
    description,
    imageUrl: notificationObj.image,
    data: { image: notificationObj.image },
    tokens,
  });

  await Notification.create({
    title,
    description,
    image: notificationObj.image,
    address: {
      loc: { type: "Point", coordinates: [longitude, latitude] },
      name: address,
    },
    retailerId: req?.user?._id,
    radius,
  });

  return apiResponse(res, 200, true, "Notification created successfully!", deviceTokens);
});
/**
 * Get All Single Notificationes
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllNotificationsForRetailer = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = { retailerId: req?.user?._id };
  if (search) {
    query.$or = [{ title: { $regex: search, $options: "i" } }, { description: { $regex: search, $options: "i" } }];
  }

  const [docs, total] = await Promise.all([
    Notification.aggregate([
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
        $project: {
          retailerId: 0,
          updatedAt: 0,
        },
      },
    ]),
    Notification.find(query).countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Notificationes fetched successfully!", data);
});

export const getAllNotificationsForSuperAdmin = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = {};
  if (search) {
    query.$or = [{ title: { $regex: search, $options: "i" } }, { description: { $regex: search, $options: "i" } }];
  }

  const [docs, total] = await Promise.all([
    Notification.aggregate([
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
          from: "retailers",
          localField: "retailerId",
          foreignField: "_id",
          as: "retailers",
          pipeline: [
            {
              $project: {
                firstName: 1,
                lastName: 1,
                storeName: 1,
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
        $unwind: "$retailers",
      },
      {
        $project: {
          retailerId: 0,
          updatedAt: 0,
        },
      },
    ]),
    Notification.find(query).countDocuments(),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Notificationes fetched successfully!", data);
});
