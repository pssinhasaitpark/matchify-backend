// models/userAction/like.js
import mongoose from "mongoose";

const likeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

likeSchema.index({ userId: 1, targetUserId: 1 }, { unique: true });

export const Like = mongoose.model("Like", likeSchema);
