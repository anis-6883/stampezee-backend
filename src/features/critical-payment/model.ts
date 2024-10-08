import mongoose from "mongoose";

const CriticalPaymentSchema = new mongoose.Schema(
  {
    paymentId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "Payment",
      required: true,
    },
    stripeInvoiceId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const CriticalPayment = mongoose.model("CriticalPayment", CriticalPaymentSchema);

export default CriticalPayment;
