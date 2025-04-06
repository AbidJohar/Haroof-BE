import mongoose from "mongoose";
import argon2 from "argon2";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async (next) => {
  try {
    if (this.isModified(this.password)) {
      this.password = await argon2.hash(this.password);
    }
  } catch (error) {
    return next(error);
  }
});

userSchema.methods.comparePassword = async (userPassword) => {
  try {
    return await argon2.verify(this.password, userPassword);
  } catch (error) {
    throw error;
  }
};

userSchema.index({fullName: "text"});

const User = mongoose.model("User", userSchema);
export default User;
