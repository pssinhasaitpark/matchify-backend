// app/models/userInteraction.js
import mongoose from "mongoose";

const userInteractionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true,
        },
        likedUsers: [{
            _id: false,
            targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, },
            createdAt: { type: Date, default: Date.now, },
        },
        ],
        dislikedUsers: [{
            _id: false,
            targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, },
            createdAt: { type: Date, default: Date.now, },
        },
        ],
    },
    { timestamps: true }
);

export const UserInteraction = mongoose.model("UserInteraction", userInteractionSchema);


/*
// app/models/userInteraction.js
import mongoose from "mongoose";

const userInteractionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["like", "dislike"],
      required: true,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound index for faster queries
userInteractionSchema.index({ userId: 1, targetUserId: 1, type: 1 }, { unique: true });

export const UserInteraction = mongoose.model("UserInteraction", userInteractionSchema);
*/