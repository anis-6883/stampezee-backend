import { Document, model, Schema, Types } from "mongoose";

export interface ICoupon extends Document {
  title: string;
  description?: string;
  code: string;
  discountType: string;
  discount: number;
  totalUserLimit: number;
  perUserLimit: number;
  startedAt: Date;
  expiredAt: Date;
  allowFor: string;
  allowedRetailers: Types.ObjectId[];
  applicablePackages: Types.ObjectId[];
  status: boolean;
  createdBy: Types.ObjectId;
  deletedBy?: Types.ObjectId | null;
  softDeleted: boolean;
}

const couponSchema = new Schema<ICoupon>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: null },
    code: { type: String, required: true, trim: true },
    discountType: { type: String, enum: ["percentage", "flat"], required: true },
    discount: { type: Number, required: true },
    totalUserLimit: { type: Number, default: 0 },
    perUserLimit: { type: Number, default: 1 },
    startedAt: { type: Date, required: true },
    expiredAt: { type: Date, required: true },
    allowFor: { type: String, enum: ["all", "specific"], default: "all" },
    allowedRetailers: { type: ["ObjectId"], default: [] },
    applicablePackages: { type: ["ObjectId"], required: true },
    status: { type: Boolean, default: true },
    createdBy: { type: "ObjectId", ref: "Retailer", required: true },
    deletedBy: { type: "ObjectId", ref: "Retailer", default: null },
    softDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

couponSchema.index({ title: 1 });

const Coupon = model<ICoupon>("coupons", couponSchema);

export default Coupon;
