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
    validate: {
      validator: (value: [string]) => Array.isArray(value) && value.length > 0,
      message: "At least one description is required!",
    },
  },
  price: {
    type: Number,
    trim: true,
    required: true,
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
  allowTotalStamp: {
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

const couponSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    default: null,
  },
  code: {
    type: String,
    required: true,
    trim: true,
  },
  startedAt: {
    type: Date,
    default: null,
  },
  expiredAt: {
    type: Date,
    default: null,
  },
  discountType: {
    type: String,
    enum: ["percentage", "flat"],
    required: true,
  },
  discount: {
    type: Number,
    required: true,
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

// Main Schema
const enrollSubscriptionSchema = new mongoose.Schema(
  {
    retailerId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "Retailer",
      required: true,
    },
    stripe: {
      subscriptionId: {
        type: String,
        default: null,
      },
      customerId: {
        type: String,
        default: null,
      },
      paymentMethodId: {
        type: String,
        default: null,
      },
      renewCancelAt: {
        type: Date,
        default: null,
      },
      renewCanceledAtByCustomer: {
        type: Date,
        default: null,
      },
    },
    planSnapshot: {
      type: subscriptionSchema,
      required: true,
    },
    couponSnapshot: {
      type: couponSchema,
      default: null,
    },
    taxSnapshot: {
      taxTitle: {
        type: String,
        default: null,
      },
      taxCost: {
        type: Number,
        default: 0,
      },
    },
    balanceInfo: {
      currentBalance: {
        type: Number,
        default: 0,
      },
      planCurrentPrice: {
        type: Number,
        default: 0,
      },
      currency: {
        type: String,
        default: "USD",
      },
      currencyRate: {
        type: Number,
        default: 0,
      },
    },
    planChangeCost: {
      type: Number,
      default: 0,
    },
    refundAmount: {
      type: Number,
      default: 0,
    },
    paymentStatus: {
      type: String,
      enum: ["trial", "pending", "completed"],
      required: true,
    },
    enrollStatus: {
      type: String,
      enum: ["trial", "purchase", "upgrade", "downgrade"],
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
    status: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const EnrollSubscription = mongoose.model("EnrollSubscription", enrollSubscriptionSchema);

export default EnrollSubscription;
