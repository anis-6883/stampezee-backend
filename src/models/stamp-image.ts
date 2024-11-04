import { Document, model, Schema, Types } from "mongoose";

interface IStampImage extends Document {
  userId: Types.ObjectId;
  title: string;
  image: string;
  ref: "super_admin" | "retailer";
  enrollSubscriptionId?: Types.ObjectId | null;
  status?: boolean;
  softDeleted?: boolean;
}

const stampImageSchema = new Schema<IStampImage>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true, trim: true },
    image: { type: String, required: true },
    ref: { type: String, enum: ["super_admin", "retailer"], default: "retailer" },
    enrollSubscriptionId: { type: Schema.Types.ObjectId, ref: "EnrollSubscription", default: null },
    status: { type: Boolean, default: true },
    softDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const StampImage = model<IStampImage>("stamp_images", stampImageSchema);

export default StampImage;
