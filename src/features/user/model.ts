import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      default: null,
    },
    status: {
      type: Boolean,
      default: true,
    },
    role: {
      type: String,
      enum: ["user", "admin", "retailer"],
      default: "user",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

schema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.__v;
  delete user.password;
  delete user.createdAt;
  delete user.updatedAt;
  return JSON.parse(JSON.stringify(user).replace(/_id/g, "id"));
};

const User = mongoose.model("User", schema);

export default User;
