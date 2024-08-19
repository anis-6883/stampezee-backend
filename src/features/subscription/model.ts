import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    descriptions: {
      type: [String],
    },
    productId: {
      type: String,
      required: true,
      trim: true,
    },
    originalPriceId: {
      type: String,
      required: true,
      trim: true,
    },
    originalPrice: {
      type: Number,
      required: true,
      trim: true,
    },
    taxPriceId: {
      type: String,
      required: true,
      trim: true,
    },
    taxPrice: {
      type: Number,
      required: true,
      trim: true,
    },
    duration: {
      type: Number,
      trim: true,
      default: 30,
    },
    type: {
      type: String,
      required: true,
      enum: ["addon", "subscription"],
    },
    limit: {
      type: Number,
      trim: true,
      default: null,
    },
    allowTotalBranch: {
      type: Number,
      trim: true,
      default: null,
    },
    allowTotalTeamMember: {
      type: Number,
      trim: true,
      default: null,
    },
    allowTotalStamp: {
      type: Number,
      trim: true,
      default: null,
    },
    image: {
      type: String,
      default: null,
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

const Subscription = mongoose.model("Subscription", schema);

export default Subscription;
