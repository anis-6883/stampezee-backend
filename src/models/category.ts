import { Document, Schema, Types, model } from "mongoose";

interface ICategory extends Document {
  superAdminId: Types.ObjectId;
  name: string;
  description?: string;
  image?: string;
  status: boolean;
  softDeleted: boolean;
}

const categorySchema = new Schema<ICategory>(
  {
    superAdminId: { type: "ObjectId", ref: "SuperAdmin", required: true },
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true },
    image: { type: String, default: null },
    status: { type: Boolean, default: true },
    softDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Category = model<ICategory>("categories", categorySchema);

export default Category;
