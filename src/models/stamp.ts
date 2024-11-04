import { Document, model, Schema, Types } from "mongoose";

interface IStamp extends Document {
  title: string;
  description?: string | null;
  rules?: string | null;
  noOfStampsToCollect: number;
  minPurchaseAmount: number;
  rewardType: "promotion" | "discount";
  hasValidity: boolean;
  isPublished?: boolean;
  promotionReward?: string | null;
  discountReward?: number;
  startedAt: Date;
  expiredAt: Date;
  status?: boolean;
  softDeleted?: boolean;

  // Relations
  retailerId: Types.ObjectId;
  branchId: Types.ObjectId;
  stampImageId: Types.ObjectId;
  categoryId: Types.ObjectId;
}

const stampSchema = new Schema<IStamp>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null, trim: true },
    rules: { type: String, default: null },
    noOfStampsToCollect: { type: Number, required: true, default: 0 },
    minPurchaseAmount: { type: Number, default: 0 },
    rewardType: { type: String, enum: ["promotion", "discount"], required: true },
    hasValidity: { type: Boolean, required: true },
    isPublished: { type: Boolean, default: false },
    promotionReward: { type: String, trim: true, default: null },
    discountReward: { type: Number, trim: true, default: 0 },
    startedAt: { type: Date, required: true },
    expiredAt: { type: Date, required: true },
    status: { type: Boolean, default: true },
    softDeleted: { type: Boolean, default: false },

    // Relations
    retailerId: { type: "ObjectId", ref: "Retailer", required: true },
    branchId: { type: "ObjectId", ref: "Branch", required: true },
    stampImageId: { type: "ObjectId", ref: "StampImage", required: true },
    categoryId: { type: "ObjectId", ref: "Category", required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Stamp = model<IStamp>("stamps", stampSchema);

export default Stamp;
