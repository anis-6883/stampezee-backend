import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    userId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      required: true,
    },
    ref: {
      type: String,
      enum: ["super_admin", "retailer"],
      default: "retailer",
    },
    enrollSubscriptionId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "EnrollSubscription",
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

const StampImage = mongoose.model("StampImage", schema);

export default StampImage;
