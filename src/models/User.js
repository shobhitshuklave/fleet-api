const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      select: false, // never return the hash by default
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema, "users");
