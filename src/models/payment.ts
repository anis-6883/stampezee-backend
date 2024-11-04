import { Document, model, Schema, Types } from "mongoose";

interface IPayment extends Document {
  retailerId: Types.ObjectId;
  enrollSubscriptionId: Types.ObjectId;
  paymentIntentId: string;
  invoiceNumber: string;
  invoicePdf: string;
  amountTotal: number;
  paymentStatus: string;
  paymentMethodDetails: Record<string, any>;
}

const paymentSchema = new Schema<IPayment>(
  {
    retailerId: { type: "ObjectId", ref: "Retailer", required: true },
    enrollSubscriptionId: { type: "ObjectId", ref: "EnrollSubscription", required: true },
    paymentIntentId: { type: String, required: true },
    invoiceNumber: { type: String, required: true },
    invoicePdf: { type: String, required: true },
    amountTotal: { type: Number, required: true },
    paymentStatus: { type: String, required: true },
    paymentMethodDetails: { type: Schema.Types.Mixed, required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Payment = model<IPayment>("payments", paymentSchema);

export default Payment;
