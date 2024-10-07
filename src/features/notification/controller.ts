import { Response } from "express";
import { PACKAGES } from "../../configs/constants";
import notification from "../../configs/fcm";
import { uploadFileToS3Bucket } from "../../configs/s3Bucket";
import { apiResponse, asyncHandler, fileValidation, makePaginate } from "../../helpers";
import { IApiRequest } from "../../types";
import EnrollSubscription from "../enroll-subscription/model";
import Settings from "../settings/model";
import Customer from "../user/customer/model";
import Retailer from "../user/retailer/model";
import Notification from "./model";
import { notificationBasedOnLocationSchema, notificationSchema } from "./validation";

/**
 * Send A Notification to All Customers
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const sendNotification = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await notificationSchema.validateAsync(req.body);
  const { title, description, imageType, image } = result;
  let notificationObj = { title, description, image };

  // Check Subscription & Addon Enrollment
  const [subscription, addons, totalNotification, settings] = await Promise.all([
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
      "planSnapshot.slug": PACKAGES.PUSH_NOTIFICATION_USER,
      paymentStatus: "completed",
      validityTo: { $gt: new Date() },
      status: true,
    }),
    Notification.countDocuments({ retailerId: req.user._id, type: "all" }),
    Settings.findOne().select("notification"),
  ]);

  if (!subscription) throw "No one is allowed to send a notification without a plan!";

  let allowTotalNotification = 0;

  for (const addon of addons) {
    allowTotalNotification += addon.planSnapshot?.limit;
  }

  if (totalNotification >= allowTotalNotification) throw "Your notification limit is over. Take Another Add-on!";

  // File Validation
  if (req.file) {
    const { status, message } = fileValidation(req.file, undefined, ["image/jpeg", "image/png", "image/jpg"]);
    if (!status) return apiResponse(res, 400, false, "Invalid Request!", { image: message });
  }

  // Upload File to S3 Bucket
  if (req.file) {
    const { status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "notification");
    if (status) {
      notificationObj.image = `${process.env.S3_BASE_URL}/${key}`;
    }
  }

  if (imageType == "url" && image) {
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
  });

  return apiResponse(res, 200, true, "Notification sent successfully!");
});

/**
 * Send Location Based Notification to All Customers
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const sendNotificationBasedOnLocation = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await notificationBasedOnLocationSchema.validateAsync(req.body);
  const { title, description, imageType, image, address, radius, longitude, latitude } = result;
  let notificationObj = { title, description, image };

  // Check Subscription & Addon Enrollment
  const [subscription, addons, totalNotification] = await Promise.all([
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
      "planSnapshot.slug": PACKAGES.PUSH_NOTIFICATION_LOCATION,
      paymentStatus: "completed",
      validityTo: { $gt: new Date() },
      status: true,
    }),
    Notification.countDocuments({ retailerId: req.user._id, type: "location" }),
  ]);

  if (!subscription) throw "No one is allowed to send a notification without a plan!";

  let allowTotalNotification = 0;

  for (const addon of addons) {
    allowTotalNotification += addon.planSnapshot?.limit;
  }

  if (totalNotification >= allowTotalNotification) throw "Your notification limit is over. Take Another Add-on!";

  // File Validation
  if (req.file) {
    const { status, message } = fileValidation(req.file, undefined, ["image/jpeg", "image/png", "image/jpg"]);
    if (!status) {
      return apiResponse(res, 400, false, "Invalid Request!", { image: message });
    }
  }

  // Upload File to S3 Bucket
  if (req.file) {
    const { status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "notification");
    if (status) {
      notificationObj.image = `${process.env.S3_BASE_URL}/${key}`;
    }
  }

  if (imageType == "url" && image) {
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
        deviceToken: 1,
      },
    },
  ]);

  const tokens: string[] = [];
  const ids: string[] = [];

  deviceTokens.forEach(({ _id, deviceToken }) => {
    tokens.push(deviceToken);
    ids.push(_id);
  });

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
    sentTo: ids,
    type: "location",
    image: notificationObj.image,
    address: {
      loc: { type: "Point", coordinates: [longitude, latitude] },
      name: address,
    },
    retailerId: req?.user?._id,
    radius,
  });

  return apiResponse(res, 200, true, "Location based notification sent successfully!");
});

/**
 * Get All Single Notifications for Retailer
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllNotificationsForRetailer = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search, type } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = { retailerId: req?.user?._id };
  if (type) {
    query.type = type;
  }
  if (search) {
    query.$or = [{ title: { $regex: search, $options: "i" } }, { description: { $regex: search, $options: "i" } }];
  }

  const [docs, total, addons, totalNotification] = await Promise.all([
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
    Notification.countDocuments(query),
    EnrollSubscription.find({
      retailerId: req.user._id,
      "planSnapshot.type": "addon",
      "planSnapshot.slug": type === "location" ? PACKAGES.PUSH_NOTIFICATION_LOCATION : PACKAGES.PUSH_NOTIFICATION_USER,
      paymentStatus: "completed",
      validityTo: { $gt: new Date() },
      status: true,
    }),
    Notification.countDocuments({ retailerId: req.user._id, type }),
  ]);

  const data: any = makePaginate(docs, Number(page), Number(limit), skip, total);

  let allowTotalNotification = 0;

  for (const addon of addons) {
    allowTotalNotification += addon.planSnapshot?.limit;
  }

  data.notificationLimit =
    allowTotalNotification - totalNotification < 0 ? 0 : allowTotalNotification - totalNotification;

  return apiResponse(res, 200, true, "Notification fetched successfully!", data);
});

/**
 * Get All Single Notifications for Super Admin
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllNotificationsForSuperAdmin = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search, type } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  const query: any = {};
  if (type) {
    query.type = type;
  }
  if (search) {
    const retailerIds = (await Retailer.find({ storeName: { $regex: search, $options: "i" } }, { _id: 1 })).map(
      (store) => store._id
    );
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { retailerId: { $in: retailerIds } },
    ];
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
          as: "retailer",
          pipeline: [
            {
              $project: {
                storeName: 1,
                image: 1,
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
          retailerId: 0,
          updatedAt: 0,
        },
      },
    ]),
    Notification.countDocuments(query),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Notifications fetched successfully!", data);
});
