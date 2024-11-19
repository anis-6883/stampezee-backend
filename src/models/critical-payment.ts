import { Document, model, Schema, Types } from "mongoose";

interface ICriticalPayment extends Document {
  paymentId: Types.ObjectId;
  enrollmentId: Types.ObjectId;
  stripeInvoiceId: string;
  status: string;
}

const criticalPaymentSchema = new Schema<ICriticalPayment>(
  {
    paymentId: { type: "ObjectId", ref: "Payment", required: true },
    enrollmentId: { type: "ObjectId", ref: "Enrollment", required: true },
    stripeInvoiceId: { type: String, required: true },
    status: { type: String, enum: ["pending", "resolved"], default: "pending" },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

criticalPaymentSchema.index({ stripeInvoiceId: 1 });

const CriticalPayment = model<ICriticalPayment>("critical_payments", criticalPaymentSchema);

export default CriticalPayment;
