// models/userAction/block.js
import mongoose from "mongoose";

const blockSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Prevent duplicate blocks
blockSchema.index({ userId: 1, targetUserId: 1 }, { unique: true });

export const Block = mongoose.model("Block", blockSchema);
