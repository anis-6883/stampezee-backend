import { Document, Schema, Types, model } from "mongoose";

interface IBranch extends Document {
  retailerId: Types.ObjectId;
  enrollmentId: Types.ObjectId;
  name: string;
  address: {
    loc: {
      type: string;
      coordinates: [number, number]; // [longitude, latitude]
    };
    name: string;
  };
  source: string;
  status: boolean;
  disabledBySystem: boolean;
  softDeleted: boolean;
}

const branchSchema = new Schema<IBranch>(
  {
    retailerId: { type: "ObjectId", ref: "Retailer", required: true },
    enrollmentId: { type: "ObjectId", ref: "Enrollment", required: true },
    name: { type: String, required: true, trim: true },
    address: {
      loc: {
        type: { type: String, default: "Point", enum: ["Point"] },
        coordinates: { type: [Number], required: true }, // [Number(long), Number(lat)]
      },
      name: { type: String, trim: true, required: true },
    },
    source: { type: String, enum: ["subscription", "addon"], required: true },
    status: { type: Boolean, default: true },
    disabledBySystem: { type: Boolean, default: false }, // Handle downgrade disable branch by system
    softDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

branchSchema.index({ name: 1 });
branchSchema.index({ "address.loc": "2dsphere" });

const Branch = model<IBranch>("branches", branchSchema);

export default Branch;
