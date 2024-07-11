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
    refundStatus: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
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
