import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    sentTo: {
      type: [String],
      default: [],
    },
    image: { type: String, default: null },
    type: {
      type: String,
      enum: ["all", "location"],
      default: "all",
    },
    radius: {
      type: Number,
      default: 0,
    },
    address: {
      loc: {
        type: {
          type: String,
          default: "Point",
          enum: ["Point"],
        },
        coordinates: {
          type: [Number],
          default: [83.222195, -7.457475],
        },
      },
      name: {
        type: String,
        trim: true,
        default: null,
      },
    },
    retailerId: {
      type: "ObjectId", // mongoose.Types.ObjectId
      ref: "Retailer",
      default: null,
    },
    scheduleAtUTC: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, versionKey: false }
);

schema.index({ "address.loc": "2dsphere" });
schema.index({ sentTo: 1 });
schema.index({ createdAt: -1 });
schema.index({ type: 1 });

const Notification = mongoose.model("Notification", schema);

export default Notification;
