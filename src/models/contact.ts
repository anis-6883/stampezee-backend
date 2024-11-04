import { Document, Schema, model } from "mongoose";

interface IContact extends Document {
  ip?: string | null;
  macAddress?: string | null;
  name: string;
  email: string;
  dialCode?: string | null;
  phone?: string | null;
  message: string;
}

const contactSchema = new Schema<IContact>(
  {
    ip: { type: String, default: null },
    macAddress: { type: String, default: null },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    dialCode: { type: String, trim: true, default: null },
    phone: { type: String, trim: true, default: null },
    message: { type: String, required: true, trim: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

contactSchema.index({ macAddress: 1, ip: 1 });
contactSchema.index({ createdAt: 1 });

const Contact = model<IContact>("contacts", contactSchema);

export default Contact;
