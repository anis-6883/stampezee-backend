import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    sortedData: [String],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Sorting = mongoose.model("Sorting", schema);

export default Sorting;
