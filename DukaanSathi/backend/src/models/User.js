import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    shopName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    ownerName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    preferredLanguage: {
      type: String,
      enum: ["hi-IN", "en-IN"],
      default: "hi-IN"
    }
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
