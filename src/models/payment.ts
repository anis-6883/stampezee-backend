import { Document, model, Schema } from "mongoose";

interface IPayment extends Document {
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

const Payment = model<IPayment>("payments", paymentSchema);

export default Payment;
