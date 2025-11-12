// models/userAction/report.js
import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reportedUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reason: { type: String, enum: ["spam", "harassment", "fake_profile", "inappropriate_content", "scam", "other"], required: true },
    details: { type: String, default: "" },
  },
  { timestamps: true }
);

reportSchema.index({ reporterId: 1, reportedUserId: 1, reason: 1 }, { unique: true });

export const Report = mongoose.model("Report", reportSchema);
