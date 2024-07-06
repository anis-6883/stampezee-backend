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
    firstName: {
      type: String, // FullName helps to Search
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
      default: null,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
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

schema.index({ email: 1 });

const SubAdmin = mongoose.model("SubAdmin", schema);

export default SubAdmin;
