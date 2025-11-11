import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
  {
    name: { type: String, enum: ["FREE", "BOOST", "PREMIUM"], required: true, unique: true },
    dailyLikesLimit: { type: Number, default: 5 },
    dailyWhoLikedMeLimit: { type: Number, default: 2 },
    discoverLimitPerSection: { type: Number, default: 2 },
    voiceCallEnabled: { type: Boolean, default: false },
    videoCallEnabled: { type: Boolean, default: false },
    description: { type: String, default: "" },
    price: { type: Number }, 
  },
  { timestamps: true }
);

export const Plan = mongoose.model("Plan", planSchema);
