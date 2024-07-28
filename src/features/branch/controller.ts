import { Response } from "express";
import moment from "moment";
import Stripe from "stripe";
import { PACKAGES } from "../../configs/constants";
import { apiResponse, asyncHandler, makePaginate } from "../../helpers";
import { IApiRequest, IEnrollPayment } from "../../types";
import EnrollSubscription from "../enroll-subscription/model";
import Payment from "../payment/model";
import Settings from "../settings/model";
import Subscription from "../subscription/model";
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
  const branchWithoutSystemDisabled = retailerTotalBranch.filter((branch) => !branch.disabledBySystem).length;

  if (branchWithoutSystemDisabled >= allowTotalBranch) {
    throw "Your branch limit is over!";
  }

  const retailerAddonIds = retailerTotalBranch
    .filter((branch) => branch.source === "addon")
    .map((branch) => branch.enrollSubscriptionId.toString());
  const addonIds = addons.map((enroll) => enroll._id.toString());
  const unUsedIds = addonIds.filter((item) => !retailerAddonIds.includes(item));

  const subscriptionBranchSlot = retailerTotalBranch.filter(
    (branch) => branch.source === "subscription" && !branch.disabledBySystem
  ).length;

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
          disabledBySystem: 1,
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

  const allowTotalBranch = subscription?.planSnapshot?.allowTotalBranch ?? 0;
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
    .map((branch) => branch.enrollSubscriptionId.toString());
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
 * Branch Renew
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const branchRenew = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const [stripeMetadata, addOnBranch, enrollCheck] = await Promise.all([
    Settings.findOne(
      {},
      { "stripe.stripeSecretKey": 1, "stripe.taxTitle": 1, "stripe.taxCost": 1, "stripe.taxStatus": 1 }
    ),
    Subscription.findOne({ slug: PACKAGES.BRANCH }),
    EnrollSubscription.findOne({ _id: id, paymentStatus: "completed" }),
  ]);

  if (!stripeMetadata) throw "Something went wrong in Stripe settings!";
  if (!addOnBranch) throw "No add-on branch found!";
  if (!enrollCheck) throw "No enroll add-on branch found!";

  const { stripeSecretKey, taxTitle, taxCost, taxStatus } = stripeMetadata?.stripe || {};
  const stripe = new Stripe(stripeSecretKey);
  const line_items = [];

  line_items.push({
    price_data: {
      currency: "cad",
      product_data: {
        name: `${addOnBranch.title} (Renewal)`,
      },
      unit_amount: Math.round(Number(addOnBranch.price) * 100), // convert into cent
    },
    quantity: 1,
  });

  // Add Tax in (%)
  if (taxStatus === "on") {
    line_items.push({
      price_data: {
        currency: "cad",
        product_data: {
          name: `${taxTitle} (${taxCost}%)`,
        },
        unit_amount: Math.round(((Number(addOnBranch.price) * taxCost) / 100) * 100), // convert into cent
      },
      quantity: 1,
    });
  }

  const session = await stripe.checkout.sessions.create({
    line_items,
    mode: "payment",
    metadata: {
      enrollId: id,
      duration: addOnBranch.duration,
    },
    success_url: `${process.env.BACKEND_URL}/renew-branch/payment/complete?session_id={CHECKOUT_SESSION_ID}&stripe_success_token=${process.env.STRIPE_SUCCESS_TOKEN}&_id=${req.user._id}`,
    cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
  });

  return apiResponse(res, 200, true, "Send to Payment Page!", { url: session?.url });
});

/**
 * Success Renew Branch
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const successRenewBranch = asyncHandler(async (req: IApiRequest, res: Response) => {
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
 * Soft Delete A Single Branch
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const softDeleteBranch = asyncHandler(async (req: IApiRequest, res: Response) => {
  const { id } = req.params;

  const branch = await Branch.findOneAndUpdate({ _id: id }, { softDeleted: true, status: false });
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
