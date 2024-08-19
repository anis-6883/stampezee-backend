import { Response } from "express";
import moment from "moment";
import Stripe from "stripe";
import { PACKAGES, ROLE } from "../../configs/constants";
import { deleteFileFromS3Bucket, uploadFileToS3Bucket } from "../../configs/s3Bucket";
import { apiResponse, asyncHandler, fileValidation, makePaginate } from "../../helpers";
import { IApiRequest, IEnrollPayment } from "../../types";
import EnrollSubscription from "../enroll-subscription/model";
import Payment from "../payment/model";
import Settings from "../settings/model";
import Sorting from "../sorting/model";
import Subscription from "../subscription/model";
import StampImage from "./model";
import { stampImageSchema, stampImageStatusSchema, stampImageUpdateSchema } from "./validation";

/**
 * Create A Stamp Image
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const createStampImage = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await stampImageSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { softDeleted, ...createBody } = result;
  createBody.userId = req.user._id;
  createBody.ref = req.role;

  if (req.role === ROLE.RETAILER) {
    const [addons, retailerTotalStamp] = await Promise.all([
      EnrollSubscription.find({
        retailerId: req.user._id,
        "planSnapshot.type": "addon",
        "planSnapshot.slug": PACKAGES.STAMP,
        paymentStatus: "completed",
        validityTo: { $gt: new Date() },
        status: true,
      }),
      StampImage.find({
        userId: req.user._id,
        ref: "retailer",
        softDeleted: false,
      }),
    ]);

    const addonIds = addons.map((stamp) => stamp._id.toString());
    const retailerAddonIds = retailerTotalStamp.map((stamp) => stamp.enrollSubscriptionId.toString());
    const unUsedIds = addonIds.filter((item) => !retailerAddonIds.includes(item));

    if (unUsedIds.length === 0) {
      throw "Your stamp image limit is over. Take new Add-on!";
    }

    createBody.enrollSubscriptionId = unUsedIds[0];
  }

  if (!req?.file) {
    return apiResponse(res, 400, false, "Invalid Request!", { image: "image file is required!" });
  }

  // File Validation
  const { status, message } = fileValidation(req.file, undefined, ["image/jpeg", "image/png", "image/jpg"]);
  if (!status) {
    return apiResponse(res, 400, false, "Invalid Request!", { image: message });
  }

  // Upload File to S3 Bucket
  let imageKey = null;

  const { status: s3Status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "stamp_image");
  if (s3Status) {
    imageKey = key;
  }

  const stampImage: any = await StampImage.create({
    ...createBody,
    image: imageKey,
  });

  if (req.role === ROLE.SUPER_ADMIN) {
    await Sorting.updateOne(
      { title: "default_stamp_image" },
      { $push: { sortedData: stampImage._id.toString() } },
      { upsert: true }
    );
  }

  return apiResponse(res, 201, true, "Stamp image created successfully!");
});

/**
 * Get All Stamp Images
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllStampImages = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10, search } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  let docs: any[] = [];
  let total: number = 0;

  const commonQuery: any = { softDeleted: false };
  let roleSpecificQuery = {};

  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); //case insensitive search. For sensitive remove i
    commonQuery.title = regex;
  }

  if (req.role === ROLE.SUPER_ADMIN) {
    roleSpecificQuery = { ref: ROLE.SUPER_ADMIN };
  } else if (req.role === ROLE.RETAILER) {
    roleSpecificQuery = { userId: req.user._id, ref: ROLE.RETAILER };
  }

  if (Object.keys(roleSpecificQuery).length > 0) {
    const finalQuery = { ...commonQuery, ...roleSpecificQuery };

    [docs, total] = await Promise.all([
      StampImage.aggregate([
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
          $match: finalQuery,
        },
        {
          $skip: skip,
        },
        {
          $limit: Number(limit),
        },
        {
          $project: {
            enrollSubscriptionId: 0,
            userId: 0,
            ref: 0,
          },
        },
      ]),
      StampImage.countDocuments(finalQuery),
    ]);
  }

  if (req.role === ROLE.SUPER_ADMIN) {
    const sorting = await Sorting.findOne({ title: "default_stamp_image" });
    const sortedIds = sorting ? sorting.sortedData : [];

    const stampImageMap = new Map(docs.map((stampImage) => [stampImage._id.toString(), stampImage]));
    docs = sortedIds.map((id) => stampImageMap.get(id)).filter(Boolean);
  }

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Stamp images fetched successfully!", data);
});

/**
 * Get A Single Stamp Image
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getSingleStampImage = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const stampImage = await StampImage.findOne({ _id: id });
  if (!stampImage) return apiResponse(res, 404, false, "Stamp image not found!");

  return apiResponse(res, 200, true, "Stamp image fetched successfully!", stampImage);
});

/**
 * Update A Single Stamp Image
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateStampImage = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await stampImageUpdateSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const { id } = req.params;
  const { softDeleted, image, ...updatedBody } = result;

  const stampImage = await StampImage.findOne({ _id: id, userId: req.user._id });
  if (!stampImage) return apiResponse(res, 404, false, "Stamp image not found!");

  // File Validation
  if (req.file) {
    const { status, message } = fileValidation(req.file, undefined, ["image/jpeg", "image/png", "image/jpg"]);
    if (!status) {
      return apiResponse(res, 400, false, "Invalid Request!", { image: message });
    }
  }

  // Upload File to S3 Bucket
  if (req.file) {
    const { status, key } = await uploadFileToS3Bucket(req.file.buffer, req.file.mimetype, "stamp_image");
    if (status) {
      updatedBody.image = key;
    }

    // Delete Existing Image if have
    const prevImage = await StampImage.findById(id, { image: 1 });
    deleteFileFromS3Bucket(prevImage?.image);
  }

  const updatedData: any = await StampImage.findOneAndUpdate({ _id: id }, updatedBody, { new: true });

  return apiResponse(res, 200, true, "Stamp image updated successfully!", updatedData);
});

/**
 * Update Status A Stamp Image
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const updateStampImageStatus = asyncHandler(async (req: IApiRequest, res: Response) => {
  const result = await stampImageStatusSchema.validateAsync(req.body, {
    abortEarly: false,
  });
  const { id } = req.params;
  const { status } = result;

  const stampImage = await StampImage.findOneAndUpdate(
    { _id: id, userId: req?.user?._id },
    {
      status,
    },
    {
      new: true,
    }
  );

  if (!stampImage) return apiResponse(res, 404, false, "Stamp image not found!");

  return apiResponse(res, 200, true, "Stamp image status updated successfully!");
});

/**
 * Custom Stamp Renew
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const customStampRenew = asyncHandler(async (req: IApiRequest, res: Response) => {
  if (req.role === ROLE.SUPER_ADMIN) throw "You are not authorized to perform this action!";

  const { id } = req.params;

  const [stripeMetadata, addOnStamp, enrollCheck] = await Promise.all([
    Settings.findOne(
      {},
      { "stripe.stripeSecretKey": 1, "stripe.taxTitle": 1, "stripe.taxCost": 1, "stripe.taxStatus": 1 }
    ),
    Subscription.findOne({ slug: PACKAGES.STAMP }),
    EnrollSubscription.findOne({ _id: id, paymentStatus: "completed" }),
  ]);

  if (!stripeMetadata) throw "Something went wrong in Stripe settings!";
  if (!addOnStamp) throw "No add-on stamp found!";
  if (!enrollCheck) throw "No enroll add-on stamp found!";

  const { stripeSecretKey, taxTitle, taxCost, taxStatus } = stripeMetadata?.stripe || {};
  const stripe = new Stripe(stripeSecretKey);
  const line_items = [];

  // line_items.push({
  //   price_data: {
  //     currency: "cad",
  //     product_data: {
  //       name: `${addOnStamp.title} (Renewal)`,
  //     },
  //     unit_amount: Math.round(Number(addOnStamp.price) * 100), // convert into cent
  //   },
  //   quantity: 1,
  // });

  // Add Tax in (%)
  // if (taxStatus === "on") {
  //   line_items.push({
  //     price_data: {
  //       currency: "cad",
  //       product_data: {
  //         name: `${taxTitle} (${taxCost}%)`,
  //       },
  //       unit_amount: Math.round(((Number(addOnStamp.price) * taxCost) / 100) * 100), // convert into cent
  //     },
  //     quantity: 1,
  //   });
  // }

  // const session = await stripe.checkout.sessions.create({
  //   line_items,
  //   mode: "payment",
  //   metadata: {
  //     enrollId: id,
  //     duration: addOnStamp.duration,
  //   },
  //   success_url: `${process.env.BACKEND_URL}/renew-custom-stamp/payment/complete?session_id={CHECKOUT_SESSION_ID}&stripe_success_token=${process.env.STRIPE_SUCCESS_TOKEN}&_id=${req.user._id}`,
  //   cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
  // });

  return apiResponse(res, 200, true, "Send to Payment Page!");
});

/**
 * Success Renew Custom Stamp
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const successRenewCustomStamp = asyncHandler(async (req: IApiRequest, res: Response) => {
  if (req.query.stripe_success_token === process.env.STRIPE_SUCCESS_TOKEN && req?.query?.session_id) {
    const stripeMetadata = await Settings.findOne({}, { "stripe.stripeSecretKey": 1 });
    const { stripeSecretKey } = stripeMetadata?.stripe || {};

    if (!stripeSecretKey) throw "Something went wrong in Stripe settings!";
    const stripe = new Stripe(stripeSecretKey);

    const payment: IEnrollPayment = await stripe.checkout.sessions.retrieve(String(req.query.session_id), {
      expand: ["payment_intent.payment_method"],
    });

    if (payment.payment_intent.status === "succeeded") {
      await Promise.all([
        EnrollSubscription.findByIdAndUpdate(payment.metadata.enrollId, {
          validityFrom: moment(),
          validityTo: moment().add(payment.metadata.duration, "days"),
          status: true,
        }),
        Payment.create({
          retailerId: req.query._id,
          enrollSubscriptionId: [payment.metadata.enrollId],
          paymentId: payment.id,
          paymentIntentId: payment.payment_intent.id,
          paymentStatus: payment.payment_intent.status,
          amountTotal: payment.amount_total,
        }),
      ]);

      return res.redirect(`${process.env.FRONTEND_URL}/payment/complete`);
    } else {
      throw "Something went wrong in payment!";
    }
  } else {
    throw "Something went wrong in payment!";
  }
});

/**
 * Soft Delete A Stamp Image
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const softDeleteStampImage = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;
  let stampImage = null;

  if (req.role === ROLE.SUPER_ADMIN) {
    stampImage = await StampImage.findOneAndUpdate(
      { _id: id },
      {
        softDeleted: true,
      }
    );
  }

  if (req.role === ROLE.RETAILER) {
    stampImage = await StampImage.findOneAndUpdate(
      { _id: id, userId: req.user._id, ref: ROLE.RETAILER },
      {
        softDeleted: true,
      }
    );
  }

  if (!stampImage) return apiResponse(res, 404, false, "Stamp image not found!");

  if (req.role === ROLE.SUPER_ADMIN) {
    await Sorting.updateOne({ title: "default_stamp_image" }, { $pull: { sortedData: id } });
  }

  return apiResponse(res, 200, true, "Stamp image deleted successfully!");
});

/**
 * Get All Deleted Stamp Images
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const getAllDeletedStampImages = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { page = 1, limit = 10 } = req.query;
  const skip: number = (Number(page) - 1) * Number(limit);

  let docs: any[] = [];
  let total: number = 0;

  const commonQuery = { softDeleted: { $eq: true } };
  let roleSpecificQuery = {};

  if (req.role === ROLE.SUPER_ADMIN) {
    roleSpecificQuery = { ref: ROLE.SUPER_ADMIN };
  } else if (req.role === ROLE.RETAILER) {
    roleSpecificQuery = { userId: req.user._id, ref: ROLE.RETAILER };
  }

  if (Object.keys(roleSpecificQuery).length > 0) {
    const finalQuery = { ...commonQuery, ...roleSpecificQuery };

    [docs, total] = await Promise.all([
      StampImage.find(finalQuery).limit(Number(limit)).skip(skip).sort({ createdAt: "desc" }),
      StampImage.countDocuments(finalQuery),
    ]);
  }

  const data = makePaginate(docs, Number(page), Number(limit), skip, total);

  return apiResponse(res, 200, true, "Deleted stamp images fetched successfully!", data);
});

/**
 * Confirm Delete A Single Stamp Image
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const confirmDeleteStampImage = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  // Delete Existing Image if have
  const prevImage = await StampImage.findById(id, { image: 1 });
  deleteFileFromS3Bucket(prevImage?.image);

  const stampImage = await StampImage.findOneAndDelete({ _id: id });
  if (!stampImage) return apiResponse(res, 404, false, "Stamp image not found!");

  return apiResponse(res, 200, true, "Stamp image deleted successfully!");
});
