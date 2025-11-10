import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      enum: ["FREE", "BOOST", "PREMIUM"],
      required: true,
      unique: true,
    },

    // Limit configurations
    dailyLikesLimit: { type: Number, default: 5 },
    dailyWhoLikedMeLimit: { type: Number, default: 2 },
    discoverLimitPerSection: { type: Number, default: 2 },

    // Feature flags
    voiceCallEnabled: { type: Boolean, default: false },
    videoCallEnabled: { type: Boolean, default: false },

    // Description for frontend display
    description: { type: String, default: "" },

    price: { type: Number, default: 0 }, // optional if you’ll monetize later
  },
  { timestamps: true }
);

export const Plan = mongoose.model("Plan", planSchema);
