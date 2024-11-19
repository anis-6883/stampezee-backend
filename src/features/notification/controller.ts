import { Response } from "express";
import schedule from "node-schedule";
import { PACKAGES } from "../../configs/constants";
import notification from "../../configs/fcm";
import { uploadFileToS3Bucket } from "../../configs/s3Bucket";
import { apiResponse, asyncHandler, fileValidation, getUTC, makePaginate } from "../../helpers";
import Customer from "../../models/customer";
import Enrollment from "../../models/enrollment";
import Notification from "../../models/notification";
import Retailer from "../../models/retailer";
import Settings from "../../models/settings";
import { IApiRequest } from "../../types";
import { notificationBasedOnLocationSchema, notificationSchema, superAdminNotificationSchema } from "./validation";

/**
 * Send A Notification to All Customers (Retailer)
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const sendNotification = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await notificationSchema.validateAsync(req.body);
  const { title, description, imageType, image } = result;
  let notificationObj = { title, description, image };

  // Check Subscription & Addon Enrollment
  const [addons, totalNotification, settings] = await Promise.all([
    Enrollment.aggregate([
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
          "enrollSubscription.planSnapshot.slug": PACKAGES.PUSH_NOTIFICATION_USER,
        },
      },
      {
        $replaceRoot: { newRoot: "$enrollSubscription" }, // Replace root with enrollSubscription
      },
    ]),
    Notification.countDocuments({ retailerId: req.user._id, type: "all" }),
    Settings.findOne().select("notification"),
  ]);

  if (addons.length === 0) throw "No one is allowed to create a branch without a plan!";
  if (totalNotification >= addons.length) throw "Your notification limit is over. Take Another Add-on!";

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
 * Send Location Based Notification to All Customers (Retailer)
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const sendNotificationBasedOnLocation = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await notificationBasedOnLocationSchema.validateAsync(req.body);
  const { title, description, imageType, image, address, radius, longitude, latitude } = result;
  let notificationObj = { title, description, image };

  const [addons, totalNotification] = await Promise.all([
    Enrollment.aggregate([
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
          "enrollSubscription.planSnapshot.slug": PACKAGES.PUSH_NOTIFICATION_LOCATION,
        },
      },
      {
        $replaceRoot: { newRoot: "$enrollSubscription" }, // Replace root with enrollSubscription
      },
    ]),
    Notification.countDocuments({ retailerId: req.user._id, type: "location" }),
  ]);

  if (addons.length === 0) throw "No one is allowed to send a notification without a plan!";
  if (totalNotification >= addons.length) throw "Your notification limit is over. Take Another Add-on!";

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
    Enrollment.aggregate([
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
          "enrollSubscription.planSnapshot.slug":
            type === "location" ? PACKAGES.PUSH_NOTIFICATION_LOCATION : PACKAGES.PUSH_NOTIFICATION_USER,
        },
      },
      {
        $replaceRoot: { newRoot: "$enrollSubscription" }, // Replace root with enrollSubscription
      },
    ]),
    Notification.countDocuments({ retailerId: req.user._id, type }),
  ]);

  const data: any = makePaginate(docs, Number(page), Number(limit), skip, total);

  data.notificationLimit = addons.length - totalNotification < 0 ? 0 : addons.length - totalNotification;

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
        $unwind: {
          path: "$retailer",
          preserveNullAndEmptyArrays: true, // Keeps documents where the retailer is null
        },
      },
      {
        $project: {
          retailer: {
            $ifNull: ["$retailer", null], // If retailer is not found, set to null
          },
          createdAt: 1, // Include other fields as necessary
          title: 1,
          description: 1,
          scheduleAt: 1,
          image: 1,
          type: 1,
        },
      },
    ]),
    Notification.countDocuments(query),
  ]);

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Notifications fetched successfully!", data);
});

/**
 * Send A Notification to Customers (Super Admin)
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const sendNotificationBySuperAdmin = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await superAdminNotificationSchema.validateAsync(req.body);
  const { title, description, imageType, image, radius, longitude, latitude, address, type, scheduleAt } = result;
  let notificationObj: any = { title, description, image };

  const settings = await Settings.findOne({}, { notification: 1, "general.timezone": 1 });
  if (!settings?.general?.timezone) throw "Setup TimeZone First!";

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

  // Function to send notifications
  const sendNotification = async (tokens: string[] = []) => {
    await notification.sendNotification({
      title,
      description,
      imageUrl: notificationObj.image,
      data: { image: notificationObj.image },
      topic: settings.notification.firebaseTopics,
      tokens, // Will be empty if not using location-based notifications
    });
  };

  // Scheduling logic for notifications
  const scheduleNotification = async (tokens: string[] = []) => {
    if (scheduleAt) {
      const isoDateString = `${scheduleAt.replace(" ", "T")}:00.000Z`;
      const localTime = new Date(isoDateString);
      const scheduleAtUTC = getUTC(localTime, Number(settings.general.timezone.value));
      notificationObj.scheduleAt = scheduleAtUTC;

      schedule.scheduleJob(scheduleAtUTC, async () => await sendNotification(tokens));
    } else {
      await sendNotification(tokens);
    }
  };

  if (type === "location") {
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

    await scheduleNotification(tokens);

    await Notification.create({
      title,
      description,
      type,
      image: notificationObj.image,
      sentTo: ids,
      address: {
        loc: { type: "Point", coordinates: [longitude, latitude] },
        name: address,
      },
      radius,
      scheduleAt: notificationObj.scheduleAt ?? null,
      retailerId: null,
    });
  } else {
    await scheduleNotification();

    await Notification.create({
      title,
      description,
      image: notificationObj.image,
      scheduleAt: notificationObj.scheduleAt ?? null,
      retailerId: null,
    });
  }

  return apiResponse(res, 200, true, "Notification sent successfully!");
});
