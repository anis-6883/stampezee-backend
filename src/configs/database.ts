import mongoose from "mongoose";

const connectToDatabase = async (databaseURL: string) => {
  try {
    await mongoose.connect(databaseURL);
    console.log("Connected to MongoDB Database!");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
};

export default connectToDatabase;
