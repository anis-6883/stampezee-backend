import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    customerId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "Customer",
      required: true,
    },
    branchId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "Branch",
      required: true,
    },
    stampId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "Stamp",
      required: true,
    },
    eligibleForReward: {
      type: Boolean,
      default: false,
    },
    rewardCollected: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

schema.index({ customerId: 1, branchId: 1, stampId: 1 }, { unique: true });

const CollectStamp = mongoose.model("CollectStamp", schema);

export default CollectStamp;
