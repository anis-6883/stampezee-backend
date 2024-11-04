import { Document, Schema, Types, model } from "mongoose";

interface IOrderStamp extends Document {
  collectStampId: Types.ObjectId;
  number: number;
  retailerId: Types.ObjectId;
  customerId: Types.ObjectId;
  branchId: Types.ObjectId;
  subAdminId: Types.ObjectId;
  amount: number;
  amountCurrency: string;
  exchangeRate: number;
  invoice?: string;
  rewardCollected: boolean;
  stamp?: string;
}

const orderStampSchema = new Schema<IOrderStamp>(
  {
    number: { type: Number, required: true },
    collectStampId: { type: "ObjectId", ref: "CollectStamp", required: true },
    retailerId: { type: "ObjectId", ref: "Retailer", required: true },
    customerId: { type: "ObjectId", ref: "Customer", required: true },
    branchId: { type: "ObjectId", ref: "Branch", required: true },
    subAdminId: { type: "ObjectId", ref: "Retailer", required: true },
    amount: { type: Number, default: 0 },
    amountCurrency: { type: String, default: "CAD" },
    exchangeRate: { type: Number, default: 1 },
    invoice: { type: String, default: null },
    rewardCollected: { type: Boolean, default: false },
    stamp: { type: String, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

orderStampSchema.index({ collectStampId: 1, number: 1 });
orderStampSchema.index({ customerId: 1 });
orderStampSchema.index({ subAdminId: 1 });
orderStampSchema.index({ rewardCollected: 1 });

const OrderStamp = model<IOrderStamp>("order_stamps", orderStampSchema);

export default OrderStamp;
