import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    paymentId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "Payment",
      required: true,
    },
    enrollSubscriptionId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "EnrollSubscription",
      required: true,
    },
    stripeInvoiceId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "resolved"],
      default: "pending",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

schema.index({ stripeInvoiceId: 1 });

const CriticalPayment = mongoose.model("CriticalPayment", schema);

export default CriticalPayment;
