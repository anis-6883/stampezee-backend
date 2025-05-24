import { Document, model, Schema, Types } from "mongoose";

interface IRefund extends Document {
  enrollmentId: Types.ObjectId;
  prevEnrollmentId: Types.ObjectId;
  stripeRefundId: string;
  refundAmount: number;
  usageAmount: number;
  currency: string;
  currencyRate: number;
  plan: "basic" | "pro" | "advanced";
  refundStatus: "pending" | "completed";
  reason: "cancelled" | "downgrade";
  refundedBy?: Types.ObjectId;
  refundedAt?: Date;
}

const refundSchema = new Schema<IRefund>(
  {
    enrollmentId: { type: "ObjectId", ref: "Enrollment", required: true },
    prevEnrollmentId: { type: "ObjectId", ref: "Enrollment", default: null },
    stripeRefundId: { type: String, default: null },
    refundAmount: { type: Number, default: 0 },
    usageAmount: { type: Number, default: 0 },
    currency: { type: String, required: true },
    currencyRate: { type: Number, default: 0 },
    plan: { type: String, required: true, enum: ["basic", "pro", "advanced"] },
    refundStatus: { type: String, enum: ["pending", "completed"], default: "pending" },
    reason: { type: String, enum: ["cancelled", "downgrade"], required: true },
    refundedBy: { type: "ObjectId", ref: "SuperAdmin", default: null },
    refundedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Refund = model<IRefund>("refunds", refundSchema);

export default Refund;
