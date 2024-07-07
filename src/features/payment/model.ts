import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    enrollSubscriptionId: {
      type: [mongoose.Types.ObjectId],
      validate: {
        validator: (value: [string]) => Array.isArray(value) && value.length > 0,
        message: "At least one id is required!",
      },
      required: true,
    },
    paymentId: {
      type: String,
      required: true,
    },
    paymentIntentId: {
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
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Payment = mongoose.model("Payment", PaymentSchema);

export default Payment;
