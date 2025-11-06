// models/userAction/dislike.js
import mongoose from "mongoose";

const dislikeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Prevent duplicate dislikes
dislikeSchema.index({ userId: 1, targetUserId: 1 }, { unique: true });

export const Dislike = mongoose.model("Dislike", dislikeSchema);
