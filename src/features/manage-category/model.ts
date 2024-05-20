import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    superAdminId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "SuperAdmin",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
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

const Branch = mongoose.model("Branch", schema);

export default Branch;
