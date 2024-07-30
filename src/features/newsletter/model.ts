import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    ip: {
      type: String,
      default: null,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Newsletter = mongoose.model("Newsletter", schema);

export default Newsletter;
