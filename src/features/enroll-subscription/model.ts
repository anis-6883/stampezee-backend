import mongoose from "mongoose";
import { schema as subscriptionSchema } from "../subscription/model";

const enrollSubscriptionSchema = new mongoose.Schema(
  {
    retailerId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "Retailer",
      required: true,
    },
    planSnapshot: {
      type: [subscriptionSchema],
      required: true,
      validate: {
        validator: (value: [string]) => Array.isArray(value) && value.length > 0,
        message: "At least one subscription is required!",
      },
    },
    paymentStatus: {
      type: String,
      enum: ["trial", "pending", "completed"],
      required: true,
    },
    validityFrom: {
      type: Date,
      default: null,
    },
    validityTo: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const enrollPaymentSchema = new mongoose.Schema(
  {
    enrollSubscriptionId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "EnrollSubscription",
      required: true,
    },
    paymentId: {
      type: String,
      required: true,
    },
    paymentIntentId: {
      type: String,
      required: true,
    },
    amountTotal: {
      type: Number,
      required: true,
    },
    paymentStatus: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const EnrollSubscription = mongoose.model("EnrollSubscription", enrollSubscriptionSchema);
const EnrollPayment = mongoose.model("EnrollPayment", enrollPaymentSchema);

export { EnrollPayment, EnrollSubscription };
