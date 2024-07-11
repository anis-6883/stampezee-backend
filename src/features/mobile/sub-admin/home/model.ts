import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    collectStampId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "CollectStamp",
      required: true,
    },
    subAdminId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "Retailer",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    invoice: {
      type: String,
      required: true,
    },
    stamp: {
      noOfStampsToCollect: Number,
      minPurchaseAmount: Number,
      rewardType: String,
      promotionReward: Number,
      discountReward: Number,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const OrderStamp = mongoose.model("OrderStamp", schema);

export default OrderStamp;
