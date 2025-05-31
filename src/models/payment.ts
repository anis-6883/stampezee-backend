import { Document, model, Schema, Types } from "mongoose";

interface IPayment extends Document {
  enrollmentId: Types.ObjectId;
  enrollSubscriptions: {
    title: string;
    slug: string;
    type: "addon" | "subscription";
    price: number;
  }[];
  coupon: {
    _id: Types.ObjectId | null;
    discountType: "percentage" | "flat";
    discount: number;
    discountAmount: number;
  };
  paymentIntentId: string;
  invoiceNumber: string;
  invoicePdf: string;
  amountTotal: number;
  balanceAmount: number;
  currency: string;
  currencyRate: number;
  taxCost: number;
  paymentStatus: string;
  paymentMethodDetails: Record<string, any>;
}

const paymentSchema = new Schema<IPayment>(
  {
    enrollmentId: { type: "ObjectId", ref: "Enrollment", required: true },
    enrollSubscriptions: {
      type: [
        {
          title: { type: String, required: true },
          slug: { type: String, required: true },
          type: { type: String, enum: ["addon", "subscription"], required: true },
          price: { type: Number, required: true },
        },
      ],
      required: true,
    },
    coupon: {
      _id: { type: "ObjectId", ref: "Coupon", default: null },
      discountType: { type: String, enum: ["percentage", "flat", null], default: null },
      discount: { type: Number, default: 0 },
      discountAmount: { type: Number, default: 0 },
    },
    paymentIntentId: { type: String, required: true },
    invoiceNumber: { type: String, required: true },
    invoicePdf: { type: String, required: true },
    amountTotal: { type: Number, required: true },
    balanceAmount: { type: Number, default: 0 },
    currency: { type: String, default: "CAD" },
    currencyRate: { type: Number, default: 0 },
    taxCost: { type: Number, default: 0 },
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
