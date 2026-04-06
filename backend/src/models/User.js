import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String, unique: true, index: true, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "student"], default: "student" },
    createdAt: { type: String }
  },
  { versionKey: false }
);

export const User = mongoose.model("User", UserSchema);
