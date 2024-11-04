import { Document, model, Schema } from "mongoose";

interface ISuperAdmin extends Document {
  firstName: string;
  lastName?: string | null;
  email: string;
  password: string;
  image?: string | null;
  status: boolean;
}

const superAdminSchema = new Schema<ISuperAdmin>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true, default: null },
    email: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    image: { type: String, default: null },
    status: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

superAdminSchema.index({ email: 1 });

const SuperAdmin = model<ISuperAdmin>("super_admins", superAdminSchema);

export default SuperAdmin;
