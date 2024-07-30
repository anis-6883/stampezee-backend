import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    ip: {
      type: String,
      default: null,
    },
    macAddress: {
      type: String,
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    dialCode: {
      type: String,
      trim: true,
      required: false,
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

schema.index({ macAddress: 1, ip: 1 });
schema.index({ createdAt: 1 });

const Contact = mongoose.model("Contact", schema);

export default Contact;
