import mongoose from "mongoose";
import Subscription from "../subscription/model";

const schema = new mongoose.Schema(
  {
    retailerId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "Retailer",
      required: true,
    },
    planSnapshot: {
      type: Subscription,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
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
