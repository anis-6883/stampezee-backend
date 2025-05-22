import { Document, Schema, Types, model } from "mongoose";

interface ICollectStamp extends Document {
  customerId: Types.ObjectId;
  branchId: Types.ObjectId;
  stampId: Types.ObjectId;
  eligibleForReward: boolean;
  rewardCollected: boolean;
  status: boolean;
  softDeleted: boolean;
}

const collectStampSchema = new Schema<ICollectStamp>(
  {
    customerId: { type: "ObjectId", ref: "Customer", required: true },
    branchId: { type: "ObjectId", ref: "Branch", required: true },
    stampId: { type: "ObjectId", ref: "Stamp", required: true },
    eligibleForReward: { type: Boolean, default: false },
    rewardCollected: { type: Boolean, default: false },
    status: { type: Boolean, default: true },
    softDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

collectStampSchema.index({ customerId: 1, branchId: 1, stampId: 1, status: 1 });

const CollectStamp = model<ICollectStamp>("collect_stamps", collectStampSchema);

export default CollectStamp;
