import { Document, Schema, Types, model } from "mongoose";

interface ICoupon {
  title: string;
  description?: string;
  code: string;
  startedAt?: Date;
  expiredAt?: Date;
  discountType: "percentage" | "flat";
  discount: number;
  status: boolean;
  softDeleted: boolean;
}

interface IEnrollment extends Document {
  retailerId: Types.ObjectId;
  planSnapshots: Types.ObjectId[];
  payments: Types.ObjectId[];
  stripe: {
    subscriptionId?: string;
    customerId?: string;
    paymentMethodId?: string;
    renewCancelAt?: Date;
    renewCanceledAtByCustomer?: Date;
  };
  couponSnapshot?: ICoupon;
  taxSnapshot: {
    taxTitle?: string;
    taxCost: number;
  };
  currency: string;
  currencyRate: number;
  planChangeCost: number;
  refundAmount: number;
  paymentStatus: "trial" | "pending" | "completed";
  enrollStatus: "trial" | "purchase" | "upgrade" | "downgrade";
  validityFrom?: Date;
  validityTo?: Date;
  status: boolean;
}

const couponSchema = new Schema<ICoupon>({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: null },
  code: { type: String, required: true, trim: true },
  startedAt: { type: Date, default: null },
  expiredAt: { type: Date, default: null },
  discountType: { type: String, enum: ["percentage", "flat"], required: true },
  discount: { type: Number, required: true },
  status: { type: Boolean, default: true },
  softDeleted: { type: Boolean, default: false },
});

const enrollmentSchema = new Schema<IEnrollment>(
  {
    retailerId: { type: "ObjectId", ref: "Retailer", required: true },
    planSnapshots: { type: ["ObjectId"], ref: "EnrollSubscription", required: true },
    payments: { type: ["ObjectId"], ref: "Payment", required: true },
    stripe: {
      subscriptionId: { type: String, default: null },
      customerId: { type: String, default: null },
      paymentMethodId: { type: String, default: null },
      renewCancelAt: { type: Date, default: null },
      renewCanceledAtByCustomer: { type: Date, default: null },
    },
    couponSnapshot: { type: couponSchema, default: null }, // move to payment
    taxSnapshot: {
      taxTitle: { type: String, default: null },
      taxCost: { type: Number, default: 0 },
    },
    currency: { type: String, default: "CAD" },
    currencyRate: { type: Number, default: 0 },
    planChangeCost: { type: Number, default: 0 },
    refundAmount: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ["trial", "pending", "completed"], required: true },
    enrollStatus: { type: String, enum: ["trial", "purchase", "upgrade", "downgrade"], required: true },
    validityFrom: { type: Date, default: null },
    validityTo: { type: Date, default: null },
    status: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Enrollment = model<IEnrollment>("enroll_subscriptions", enrollmentSchema);

export default Enrollment;
