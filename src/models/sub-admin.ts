import { Document, model, Schema, Types } from "mongoose";

interface ISubAdmin extends Document {
  firstName: string;
  lastName?: string | null;
  fullName: string;
  email: string;
  password: string;
  image?: string | null;
  otp?: number | null;
  otpExpiry?: Date | null;
  token?: string | null;
  status?: boolean;
  softDeleted?: boolean;

  // Relations
  retailerId: Types.ObjectId;
  branchId: Types.ObjectId;
}

const subAdminSchema = new Schema<ISubAdmin>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true, default: null },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    image: { type: String, default: null },
    otp: { type: Number, trim: true, default: null },
    otpExpiry: { type: Date, default: null },
    token: { type: String, default: null },
    status: { type: Boolean, default: true },
    softDeleted: { type: Boolean, default: false },

    // Relations
    retailerId: { type: "ObjectId", ref: "Retailer", required: true },
    branchId: { type: "ObjectId", ref: "Branch", required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

subAdminSchema.index({ email: 1 });

const SubAdmin = model<ISubAdmin>("sub_admins", subAdminSchema);

export default SubAdmin;
