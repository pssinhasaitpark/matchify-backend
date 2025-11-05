// controllers/userAction/block.js
import mongoose from "mongoose";
import { User } from "../../models/user.js";
import { Block } from "../../models/userAction/block.js";
import { handleResponse } from "../../utils/helper.js";

const blockUser = async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const userId = req.user.id;

    // Validate targetUserId
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return handleResponse(res, 400, "Invalid target user ID format.");
    }
    if (userId === targetUserId) {
      return handleResponse(res, 400, "You cannot block yourself.");
    }

    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return handleResponse(res, 404, "Target user not found.");
    }

    // Add block or ignore if already exists
    await Block.findOneAndUpdate(
      { userId, targetUserId },
      { $setOnInsert: { createdAt: new Date() } },
      { upsert: true, new: true }
    );

    return handleResponse(res, 201, "User blocked successfully.");
  } catch (error) {
    console.error("Error in blockUser:", error);
    return handleResponse(res, 500, "Something went wrong.");
  }
};

export const block = {
    blockUser
}