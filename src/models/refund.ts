import { Document, model, Schema, Types } from "mongoose";

interface IRefund extends Document {
  enrollmentId: Types.ObjectId;
  refundAmount: number;
  currency: string;
  plan: "basic" | "pro" | "advanced";
  refundStatus: "pending" | "completed";
  refundedBy?: Types.ObjectId;
  refundedAt?: Date;
}

const refundSchema = new Schema<IRefund>(
  {
    enrollmentId: { type: "ObjectId", ref: "Enrollment", required: true },
    refundAmount: { type: Number, default: 0 },
    currency: { type: String, required: true },
    plan: { type: String, required: true, enum: ["basic", "pro", "advanced"] },
    refundStatus: { type: String, enum: ["pending", "completed"], default: "pending" },
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
