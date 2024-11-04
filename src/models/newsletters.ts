import { Document, Schema, model } from "mongoose";

interface INewsletter extends Document {
  ip?: string;
  email: string;
}

const newsletterSchema = new Schema<INewsletter>(
  {
    ip: { type: String, default: null },
    email: { type: String, required: true, unique: true, trim: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Newsletter = model<INewsletter>("newsletters", newsletterSchema);

export default Newsletter;
