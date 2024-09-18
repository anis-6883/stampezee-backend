import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    code: {
      type: String,
      required: true,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ["percentage", "flat"],
      required: true,
    },
    discount: {
      type: Number,
      required: true,
    },
    minPurchaseAmount: {
      type: Number,
      default: 0,
    },
    limit: {
      type: Number,
      default: 1,
    },
    startedAt: {
      type: Date,
      required: true,
    },
    expiredAt: {
      type: Date,
      required: true,
    },
    allowedRetailers: {
      type: [mongoose.Types.ObjectId],
      default: [],
    },
    status: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "Retailer",
      required: true,
    },
    deletedBy: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "Retailer",
      default: null,
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

const Coupon = mongoose.model("Coupon", schema);

export default Coupon;
