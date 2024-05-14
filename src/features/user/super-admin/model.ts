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
      trim: true,
      default: null,
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
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// schema.methods.toJSON = function () {
//     const user = this.toObject();
//     delete user.__v;
//     delete user.password;
//     delete user.createdAt;
//     delete user.updatedAt;
//     return JSON.parse(JSON.stringify(user).replace(/_id/g, "id"));
// };

const Admin = mongoose.model("Admin", schema);

export default Admin;
