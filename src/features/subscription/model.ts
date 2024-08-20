import mongoose from "mongoose";

const priceSchema = new mongoose.Schema({
  country: {
    type: String,
    required: true,
    trim: true,
  },
  currency: {
    type: String,
    required: true,
    trim: true,
  },
  amount: {
    type: Number,
    required: true,
    trim: true,
  },
});

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
      validate: {
        validator: (value: [string]) => Array.isArray(value) && value.length > 0,
        message: "At least one description is required!",
      },
    },
    price: {
      type: [priceSchema],
      validate: {
        validator: (value: [string]) => Array.isArray(value) && value.length > 0,
        message: "At least one price is required!",
      },
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
