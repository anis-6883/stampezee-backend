import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    retailerId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "Retailer",
      required: true,
    },
    enrollSubscriptionId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "EnrollSubscription",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      loc: {
        type: {
          type: String,
          default: "Point",
          enum: ["Point"],
        },
        coordinates: {
          type: [Number], // [Number(long), Number(lat)]
          required: true,
        },
      },
      name: {
        type: String,
        trim: true,
        required: true,
      },
    },
    source: {
      type: String,
      enum: ["subscription", "addon"],
      required: true,
    },
    status: {
      type: Boolean,
      default: true,
    },
    disabledBySystem: {
      type: Boolean, // Handle downgrade disable branch by system
      default: false,
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

schema.index({ name: 1 });
schema.index({ "address.loc": "2dsphere" });

const Branch = mongoose.model("Branch", schema);

export default Branch;
