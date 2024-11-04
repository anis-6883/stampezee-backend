import { Document, model, Schema } from "mongoose";

interface ISorting extends Document {
  title: string;
  sortedData?: string[];
}

const sortingSchema = new Schema<ISorting>(
  {
    title: { type: String, required: true },
    sortedData: { type: [String], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Sorting = model<ISorting>("sortings", sortingSchema);

export default Sorting;
