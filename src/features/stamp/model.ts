import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    retailerId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "Retailer",
      required: true,
    },
    branchId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "Branch",
      required: true,
    },
    stampImageId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "StampImage",
      required: true,
    },
    categoryId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "Category",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: null,
      trim: true,
    },
    rules: {
      type: String,
      default: null,
    },
    noOfStampsToCollect: {
      type: Number,
      required: true,
      default: 0,
    },
    minPurchaseAmount: {
      type: Number,
      default: 0,
    },
    rewardType: {
      type: String,
      enum: ["promotion", "discount"],
      required: true,
    },
    promotionReward: {
      type: String,
      trim: true,
      default: null,
    },
    discountReward: {
      type: Number,
      trim: true,
      default: 0,
    },
    startedAt: {
      type: Date,
      required: true,
    },
    expiredAt: {
      type: Date,
      required: true,
    },
    status: {
      type: Boolean,
      default: true,
    },
    softDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Stamp = mongoose.model("Stamp", schema);

export default Stamp;
