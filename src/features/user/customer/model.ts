import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
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
    provider: {
      type: String,
      required: true,
      enum: ["email", "google", "apple"],
    },
    password: {
      type: String,
      required: true,
    },
    otp: {
      type: Number,
      trim: true,
      default: null,
    },
    otpExpiry: {
      type: Date,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    address: {
      loc: {
        type: {
          type: String,
          default: "Point",
          enum: ["Point"],
        },
        coordinates: {
          type: [Number],
        },
      },
      name: {
        type: String,
        trim: true,
        default: null,
      },
    },
    deviceToken: {
      type: String,
      trim: true,
      default: null,
    },
    dialCode: {
      type: String,
      trim: true,
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    country: {
      type: String,
      trim: true,
      default: null,
    },
    ref: {
      type: "String",
      enum: ["self", "super_admin"],
      default: "self",
    },
    status: {
      type: Boolean,
      default: true,
    },
    token: {
      type: String,
      trim: true,
      default: null,
    },
    softDeleted: {
      type: Boolean,
      default: false,
    },
    deletionRequest: {
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

const Customer = mongoose.model("Customer", schema);

export default Customer;
