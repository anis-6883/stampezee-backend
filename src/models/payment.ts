import { Document, model, Schema, Types } from "mongoose";

interface IPayment extends Document {
  enrollmentId: Types.ObjectId;
  enrollSubscriptionIds: Types.ObjectId[];
  paymentIntentId: string;
  invoiceNumber: string;
  invoicePdf: string;
  amountTotal: number;
  currency: string;
  paymentStatus: string;
  paymentMethodDetails: Record<string, any>;
}

const paymentSchema = new Schema<IPayment>(
  {
    enrollmentId: { type: "ObjectId", ref: "Enrollment", required: true },
    enrollSubscriptionIds: { type: ["ObjectId"], ref: "EnrollSubscription", required: true },
    paymentIntentId: { type: String, required: true },
    invoiceNumber: { type: String, required: true },
    invoicePdf: { type: String, required: true },
    amountTotal: { type: Number, required: true },
    currency: { type: String, default: "CAD" },
    paymentStatus: { type: String, required: true },
    paymentMethodDetails: { type: Schema.Types.Mixed, required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

paymentSchema.index({ paymentIntentId: 1 });
paymentSchema.index({ invoiceNumber: 1 });

const Payment = model<IPayment>("payments", paymentSchema);

export default Payment;
