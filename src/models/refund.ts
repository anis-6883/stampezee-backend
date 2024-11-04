import { Document, model, Schema, Types } from "mongoose";

interface IRefund extends Document {
  enrollSubscriptionId: Types.ObjectId;
  refundAmount: number;
  currency: string;
  refundStatus: "pending" | "completed";
  refundedBy?: Types.ObjectId;
  refundedAt?: Date;
}

const refundSchema = new Schema<IRefund>(
  {
    enrollSubscriptionId: { type: "ObjectId", ref: "EnrollSubscription", required: true },
    refundAmount: { type: Number, default: 0 },
    currency: { type: String, required: true },
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
