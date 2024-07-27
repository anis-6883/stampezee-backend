import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    collectStampId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "CollectStamp",
      required: true,
    },
    number: {
      type: Number,
      required: true,
    },
    customerId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "Customer",
      required: true,
    },
    subAdminId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "Retailer",
      required: true,
    },
    amount: {
      type: Number,
      default: 0,
    },
    invoice: {
      type: String,
      default: null,
    },
    rewardCollected: {
      type: Boolean,
      default: false,
    },
    stamp: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const OrderStamp = mongoose.model("OrderStamp", schema);

export default OrderStamp;
