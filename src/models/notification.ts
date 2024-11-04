import { Document, Schema, Types, model } from "mongoose";

interface INotification extends Document {
  title: string;
  description: string;
  sentTo: string[];
  image?: string;
  type: "all" | "location";
  radius: number;
  address: {
    loc: {
      type: "Point";
      coordinates: number[];
    };
    name?: string;
  };
  retailerId?: Types.ObjectId;
  scheduleAt?: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    sentTo: { type: [String], default: [] },
    image: { type: String, default: null },
    type: { type: String, enum: ["all", "location"], default: "all" },
    radius: { type: Number, default: 0 },
    retailerId: { type: "ObjectId", ref: "Retailer", default: null },
    scheduleAt: { type: Date, default: null },
    address: {
      loc: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point",
        },
        coordinates: {
          type: [Number],
          default: [83.222195, -7.457475],
        },
      },
      name: { type: String, trim: true, default: null },
    },
  },
  { timestamps: true, versionKey: false }
);

notificationSchema.index({ "address.loc": "2dsphere" });
notificationSchema.index({ sentTo: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ type: 1 });

const Notification = model<INotification>("notifications", notificationSchema);

export default Notification;
