import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    retailerId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "Retailer",
      required: true,
    },
    enrollSubscriptionId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "Retailer",
      required: true,
    },
    paymentIntentId: {
      type: String,
      required: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
    },
    invoicePdf: {
      type: String,
      required: true,
    },
    amountTotal: {
      type: Number,
      required: true,
    },
    paymentStatus: {
      type: String,
      required: true,
    },
    paymentMethodDetails: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Payment = mongoose.model("Payment", PaymentSchema);

export default Payment;
