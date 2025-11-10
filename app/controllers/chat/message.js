// controllers/chat/chat.js
import mongoose from "mongoose";
import { Message } from "../../models/chat/message.js";
import { Like } from "../../models/userAction/like.js";
import { handleResponse } from "../../utils/helper.js";

const createChatMessage = async (req, res) => {
  try {
    const sender = req.user.id;
    const { receiverId } = req.params;
    const { text } = req.body;

    if (!mongoose.Types.ObjectId.isValid(receiverId))
      return handleResponse(res, 400, "Invalid receiver ID");

    if (!text || text.trim() === "")
      return handleResponse(res, 400, "Message text is required");

    const likedByUser = await Like.findOne({ userId: sender, targetUserId: receiverId });
    const likedByReceiver = await Like.findOne({ userId: receiverId, targetUserId: sender });
    if (!likedByUser || !likedByReceiver)
      return handleResponse(res, 403, "Chat not allowed without mutual like");

    // Find or create conversation
    let conversation = await Message.findOne({
      participants: { $all: [sender, receiverId] },
    });

    const newMessage = { sender, receiverId, text, read: false, createdAt: new Date() };

    if (!conversation) {
      // Create a new conversation document
      conversation = await Message.create({
        participants: [sender, receiverId],
        messages: [newMessage],
      });
    } else {
      // Add new message to existing conversation
      conversation.messages.push(newMessage);
      conversation.updatedAt = new Date();
      await conversation.save();
    }

    // ✅ Emit socket events (if connected)
    if (req.io) {
      req.io.to(receiverId.toString()).emit("receive-message", newMessage);
      req.io.to(sender.toString()).emit("message-sent", newMessage);
    }

    return handleResponse(res, 201, "Message sent successfully", newMessage);
  } catch (err) {
    console.error("Error sending message:", err);
    return handleResponse(res, 500, "Internal Server Error");
  }
};

const getChatHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { receiverId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(receiverId))
      return handleResponse(res, 400, "Invalid receiver ID");

    // Ensure mutual like exists before allowing chat
    const likedByUser = await Like.findOne({ userId, targetUserId: receiverId });
    const likedByReceiver = await Like.findOne({ userId: receiverId, targetUserId: userId });

    if (!likedByUser || !likedByReceiver)
      return handleResponse(res, 403, "Chat not allowed without mutual like");

    // Fetch conversation between two users
    const conversation = await Message.findOne({
      participants: { $all: [userId, receiverId] },
    }).lean();

    if (!conversation)
      return handleResponse(res, 200, "No messages yet", { results: [] });

    // ✅ Add receiverId for each message dynamically
    const results = conversation.messages.map(msg => ({
      receiverId: msg.sender.toString() === userId ? receiverId : userId,
      ...msg,
    }));

    return handleResponse(res, 200, "Chat history fetched successfully", {
      results
    });
  } catch (err) {
    console.error("Error fetching chat:", err);
    return handleResponse(res, 500, "Internal Server Error");
  }
};

export const chat = {
  getChatHistory,
  createChatMessage,
};