import { Document, model, Schema } from "mongoose";

export interface ISubscription extends Document {
  title: string;
  slug: string;
  descriptions: string[];
  price: number;
  duration?: number;
  type: "addon" | "subscription";
  limit?: number | null;
  allowTotalBranch?: number | null;
  allowTotalTeamMember?: number | null;
  allowTotalStamp?: number | null;
  image?: string | null;
  status?: boolean;
  softDeleted?: boolean;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, unique: true },
    descriptions: {
      type: [String],
      validate: {
        validator: (value: string[]) => Array.isArray(value) && value.length > 0,
        message: "At least one description is required!",
      },
    },
    price: { type: Number, required: true, trim: true },
    duration: { type: Number, trim: true, default: 30 },
    type: { type: String, required: true, enum: ["addon", "subscription"] },
    limit: { type: Number, trim: true, default: null },
    allowTotalBranch: { type: Number, trim: true, default: null },
    allowTotalTeamMember: { type: Number, trim: true, default: null },
    allowTotalStamp: { type: Number, trim: true, default: null },
    image: { type: String, default: null },
    status: { type: Boolean, default: true },
    softDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Subscription = model<ISubscription>("subscriptions", subscriptionSchema);

export default Subscription;
