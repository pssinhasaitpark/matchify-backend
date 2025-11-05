// controllers/userAction/dislike.js
import mongoose from "mongoose";
import { User } from "../../models/user.js";
import { Dislike } from "../../models/userAction/dislike.js";
import { handleResponse } from "../../utils/helper.js";

const dislikeUser = async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const userId = req.user.id;

    // Validate targetUserId
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return handleResponse(res, 400, "Invalid target user ID format.");
    }
    if (userId === targetUserId) {
      return handleResponse(res, 400, "You cannot dislike yourself.");
    }

    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return handleResponse(res, 404, "Target user not found.");
    }

    // Add dislike or ignore if already exists
    await Dislike.findOneAndUpdate(
      { userId, targetUserId },
      { $setOnInsert: { createdAt: new Date() } },
      { upsert: true, new: true }
    );

    return handleResponse(res, 201, "User disliked successfully.");
  } catch (error) {
    console.error("Error in dislikeUser:", error);
    return handleResponse(res, 500, "Something went wrong.");
  }
};

export const dislike = {
    dislikeUser
}