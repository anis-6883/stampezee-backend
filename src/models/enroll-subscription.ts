import { Document, Schema, model } from "mongoose";

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

interface IEnrollSubscription extends Document {
  planSnapshot: ISubscription;
  subscriptionItemId?: string;
  currentBalance: number;
  planCurrentPrice: number;
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

const enrollSubscriptionSchema = new Schema<IEnrollSubscription>(
  {
    planSnapshot: { type: subscriptionSchema, required: true }, // array | add subscriptionItemId
    subscriptionItemId: { type: String, default: null },
    currentBalance: { type: Number, default: 0 },
    planCurrentPrice: { type: Number, default: 0 },
    status: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const EnrollSubscription = model<IEnrollSubscription>("enroll_subscriptions", enrollSubscriptionSchema);

export default EnrollSubscription;
