import { Document, model, Schema } from "mongoose";

interface IRetailer extends Document {
  firstName: string;
  lastName?: string;
  fullName: string;
  email: string;
  otp?: number;
  otpExpiry?: Date;
  isVerified: boolean;
  verifiedAt?: Date;
  password: string;
  image?: string;
  status: boolean;
  ref: "self" | "super_admin";
  storeName: string;
  dialCode: string;
  phone: string;
  country: string;
  city: string;
  province: string;
  postalCode: string;
  address: string;
  longitude: string;
  latitude: string;
  about?: string;
  website?: string;
  takeFreeTrial: boolean;
  businessCurrency: string;
  softDeleted: boolean;
}

const retailerSchema = new Schema<IRetailer>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true, default: null },
    fullName: { type: String, required: true, trim: true }, // FullName helps to search
    email: { type: String, required: true, unique: true, trim: true },
    otp: { type: Number, trim: true, default: null },
    otpExpiry: { type: Date, default: null },
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },
    password: { type: String, required: true },
    image: { type: String, default: null },
    status: { type: Boolean, default: true },
    ref: { type: String, enum: ["self", "super_admin"], default: "self" },
    storeName: { type: String, required: true, trim: true },
    dialCode: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    province: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    longitude: { type: String, required: true, trim: true },
    latitude: { type: String, required: true, trim: true },
    about: { type: String, trim: true, default: null },
    website: { type: String, trim: true, default: null },
    takeFreeTrial: { type: Boolean, default: false },
    businessCurrency: { type: String, default: "CAD" },
    softDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

retailerSchema.index({ email: 1 });

const Retailer = model<IRetailer>("retailers", retailerSchema);

export default Retailer;
