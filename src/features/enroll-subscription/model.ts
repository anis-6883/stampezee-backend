import mongoose from "mongoose";
import { schema as subscriptionSchema } from "../subscription/model";

const schema = new mongoose.Schema(
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
      enum: ["pending", "completed", "trial"],
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

const EnrollSubscription = mongoose.model("EnrollSubscription", schema);

export default EnrollSubscription;
