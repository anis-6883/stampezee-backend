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
    price: {
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
