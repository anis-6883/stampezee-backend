import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    retailerId: {
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
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Create a 2dsphere index on the address.loc field
schema.index({ "address.loc": "2dsphere" });

const Branch = mongoose.model("Branch", schema);

export default Branch;
