import { Document, Schema, Types, model } from "mongoose";

interface IFaq extends Document {
  superAdminId: Types.ObjectId;
  title: string;
  description: string;
  status: boolean;
  softDeleted: boolean;
}

const faqSchema = new Schema<IFaq>(
  {
    superAdminId: { type: "ObjectId", ref: "SuperAdmin", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    status: { type: Boolean, default: true },
    softDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Faq = model<IFaq>("faqs", faqSchema);

export default Faq;
