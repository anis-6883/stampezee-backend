import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    retailerID: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "Retailer",
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
          type: [Number],
          required: true,
        },
      },
      name: {
        type: String,
        trim: true,
        required: true,
      },
    },
    status: {
      type: Boolean,
      default: true,
    },
    softDeleted: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Branch = mongoose.model("Branch", schema);

export default Branch;
