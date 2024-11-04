import { Document, Schema, model } from "mongoose";

interface ICustomer extends Document {
  fullName: string;
  email: string;
  provider: "email" | "google" | "apple";
  password: string;
  otp?: number;
  otpExpiry?: Date;
  isVerified: boolean;
  verifiedAt?: Date;
  address: {
    loc: {
      type: "Point";
      coordinates: number[];
    };
    name?: string;
  };
  deviceToken?: string;
  dialCode?: string;
  phone?: string;
  country?: string;
  ref: "self" | "super_admin";
  status: boolean;
  token?: string;
  softDeleted: boolean;
  deletionRequest: boolean;
}

const customerSchema = new Schema<ICustomer>(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true },
    provider: { type: String, required: true, enum: ["email", "google", "apple"] },
    password: { type: String, required: true },
    otp: { type: Number, trim: true, default: null },
    otpExpiry: { type: Date, default: null },
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },
    address: {
      loc: {
        type: { type: String, default: "Point", enum: ["Point"] },
        coordinates: { type: [Number] },
      },
      name: { type: String, trim: true, default: null },
    },
    deviceToken: { type: String, trim: true, default: null },
    dialCode: { type: String, trim: true, default: null },
    phone: { type: String, trim: true, default: null },
    country: { type: String, trim: true, default: null },
    ref: { type: String, enum: ["self", "super_admin"], default: "self" },
    status: { type: Boolean, default: true },
    token: { type: String, trim: true, default: null },
    softDeleted: { type: Boolean, default: false },
    deletionRequest: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

customerSchema.index({ email: 1 });

const Customer = model<ICustomer>("customers", customerSchema);

export default Customer;
