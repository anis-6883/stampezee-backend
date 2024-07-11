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
    required: true,
  },
  expiredAt: {
    type: Date,
    required: true,
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
  createdBy: {
    type: "ObjectId", // mongoose.Types.ObjectId
    ref: "Retailer",
    required: true,
  },
  deletedBy: {
    type: "ObjectId", // mongoose.Types.ObjectId
    ref: "Retailer",
    default: null,
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
    refundAmount: {
      type: Number,
      default: 0,
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
