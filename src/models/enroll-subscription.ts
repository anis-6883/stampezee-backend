import { Document, Schema, Types, model } from "mongoose";

interface ISubscription {
  title: string;
  slug: string;
  descriptions: string[];
  price: number;
  duration: number;
  type: "addon" | "subscription";
  limit?: number;
  allowTotalBranch?: number;
  allowTotalTeamMember?: number;
  allowTotalStamp?: number;
  image?: string;
  status: boolean;
  softDeleted: boolean;
}

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

interface IEnrollSubscription extends Document {
  retailerId: Types.ObjectId;
  stripe: {
    subscriptionId?: string;
    customerId?: string;
    paymentMethodId?: string;
    renewCancelAt?: Date;
    renewCanceledAtByCustomer?: Date;
  };
  planSnapshot: ISubscription;
  couponSnapshot?: ICoupon;
  taxSnapshot: {
    taxTitle?: string;
    taxCost: number;
  };
  balanceInfo: {
    currentBalance: number;
    planCurrentPrice: number;
    currency: string;
    currencyRate: number;
  };
  planChangeCost: number;
  refundAmount: number;
  paymentStatus: "trial" | "pending" | "completed";
  enrollStatus: "trial" | "purchase" | "upgrade" | "downgrade";
  validityFrom?: Date;
  validityTo?: Date;
  status: boolean;
}

const subscriptionSchema = new Schema<ISubscription>({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true },
  descriptions: {
    type: [String],
    validate: {
      validator: (value: string[]) => Array.isArray(value) && value.length > 0,
      message: "At least one description is required!",
    },
  },
  price: { type: Number, trim: true, required: true },
  duration: { type: Number, trim: true, default: 30 },
  type: { type: String, required: true, enum: ["addon", "subscription"] },
  limit: { type: Number, trim: true, default: null },
  allowTotalBranch: { type: Number, trim: true, default: null },
  allowTotalTeamMember: { type: Number, trim: true, default: null },
  allowTotalStamp: { type: Number, trim: true, default: null },
  image: { type: String, default: null },
  status: { type: Boolean, default: true },
  softDeleted: { type: Boolean, default: false },
});

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

const enrollSubscriptionSchema = new Schema<IEnrollSubscription>(
  {
    retailerId: { type: "ObjectId", ref: "Retailer", required: true },
    stripe: {
      subscriptionId: { type: String, default: null },
      customerId: { type: String, default: null },
      paymentMethodId: { type: String, default: null },
      renewCancelAt: { type: Date, default: null },
      renewCanceledAtByCustomer: { type: Date, default: null },
    },
    planSnapshot: { type: subscriptionSchema, required: true },
    couponSnapshot: { type: couponSchema, default: null },
    taxSnapshot: {
      taxTitle: { type: String, default: null },
      taxCost: { type: Number, default: 0 },
    },
    balanceInfo: {
      currentBalance: { type: Number, default: 0 },
      planCurrentPrice: { type: Number, default: 0 },
      currency: { type: String, default: "CAD" },
      currencyRate: { type: Number, default: 0 },
    },
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

const EnrollSubscription = model<IEnrollSubscription>("enroll_subscriptions", enrollSubscriptionSchema);

export default EnrollSubscription;
