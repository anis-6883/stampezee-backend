import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  slug: {
    type: String,
    required: true,
    trim: true,
  },
  descriptions: {
    type: [String],
  },
  price: {
    type: Number,
    required: true,
    trim: true,
  },
  duration: {
    type: Number,
    trim: true,
    default: 30,
  },
  type: {
    type: String,
    required: true,
    enum: ["addon", "subscription"],
  },
  limit: {
    type: Number,
    trim: true,
    default: null,
  },
  allowTotalBranch: {
    type: Number,
    trim: true,
    default: null,
  },
  allowTotalTeamMember: {
    type: Number,
    trim: true,
    default: null,
  },
  image: {
    type: String,
    default: null,
  },
  status: {
    type: Boolean,
    default: true,
  },
  softDeleted: {
    type: Boolean,
    default: false,
  },
});

const enrollSubscriptionSchema = new mongoose.Schema(
  {
    retailerId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "Retailer",
      required: true,
    },
    planSnapshot: {
      type: subscriptionSchema,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["trial", "pending", "completed"],
      required: true,
    },
    validityFrom: {
      type: Date,
      default: null,
    },
    validityTo: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const enrollPaymentSchema = new mongoose.Schema(
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

const EnrollSubscription = mongoose.model("EnrollSubscription", enrollSubscriptionSchema);
const EnrollPayment = mongoose.model("EnrollPayment", enrollPaymentSchema);

export { EnrollPayment, EnrollSubscription };
