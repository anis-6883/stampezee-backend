import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    enrollSubscriptionId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "EnrollSubscription",
      required: true,
    },
    refundAmount: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      required: true,
    },
    refundStatus: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    },
    refundedBy: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "SuperAdmin",
      default: null,
    },
    refundedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Refund = mongoose.model("Refund", schema);

export default Refund;
