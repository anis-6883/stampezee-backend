import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    superAdminId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "SuperAdmin",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
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

const Faq = mongoose.model("Faq", schema);

export default Faq;
