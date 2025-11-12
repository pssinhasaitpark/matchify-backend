// controllers/chat/chat.js
import mongoose from "mongoose";
import { Message } from "../../models/chat/message.js";
import { Like } from "../../models/userAction/like.js";
import { handleResponse } from "../../utils/helper.js";

/*
// 11 Nov 2025
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
*/

// 12 Nov 2025
const createChatMessage = async (req, res) => {
  try {
    const sender = req.user.id;
    const { receiverId } = req.params;
    const { text } = req.body;

    if (!mongoose.Types.ObjectId.isValid(receiverId))
      return handleResponse(res, 400, "Invalid receiver ID");

    if (!text?.trim()) return handleResponse(res, 400, "Message text is required");

    const likedByUser = await Like.findOne({ userId: sender, targetUserId: receiverId });
    const likedByReceiver = await Like.findOne({ userId: receiverId, targetUserId: sender });
    if (!likedByUser || !likedByReceiver)
      return handleResponse(res, 403, "Chat not allowed without mutual like");

    let conversation = await Message.findOne({
      participants: { $all: [sender, receiverId] },
    });

    const newMessage = { sender, text, read: false, delivered: false, createdAt: new Date() };

    if (!conversation) {
      conversation = await Message.create({
        participants: [sender, receiverId],
        messages: [newMessage],
      });
    } else {
      conversation.messages.push(newMessage);
      conversation.updatedAt = new Date();
      await conversation.save();
    }

    return handleResponse(res, 201, "Message stored successfully", newMessage);
  } catch (err) {
    console.error("Error sending message:", err);
    return handleResponse(res, 500, "Internal Server Error");
  }
};

const getChatHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { receiverId } = req.params;
    const { page = 1, limit = 20 } = req.query; 

    if (!mongoose.Types.ObjectId.isValid(receiverId))
      return handleResponse(res, 400, "Invalid receiver ID");

    // 🧠 Ensure mutual like exists before allowing chat
    const likedByUser = await Like.findOne({ userId, targetUserId: receiverId });
    const likedByReceiver = await Like.findOne({
      userId: receiverId,
      targetUserId: userId,
    }).sort({ createdAt: -1 });

    if (!likedByUser || !likedByReceiver)
      return handleResponse(res, 403, "Chat not allowed without mutual like");

    // 🔍 Fetch conversation between the two users
    const conversation = await Message.findOne({
      participants: { $all: [userId, receiverId] },
    }).lean();

    if (!conversation || !conversation.messages || conversation.messages.length === 0)
      return handleResponse(res, 200, "No messages yet", {
        results: [],
        totalItems: 0,
        currentPage: Number(page),
        totalPages: 0,
      });

    // 🧮 Pagination logic
    const totalMessages = conversation.messages.length;
    const totalPages = Math.ceil(totalMessages / limit);
    const skip = (page - 1) * limit;

    // ✅ Sort by createdAt (latest first) and paginate
    const sortedMessages = conversation.messages
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(skip, skip + Number(limit));

    // ✅ Add receiverId dynamically
    const results = sortedMessages.map((msg) => ({
      receiverId: msg.sender.toString() === userId ? receiverId : userId,
      ...msg,
    }));

    // ✅ Final response with pagination metadata
    return handleResponse(res, 200, "Chat history fetched successfully", {
      results,
      totalItems: totalMessages,
      currentPage: Number(page),
      totalPages,
    });
  } catch (err) {
    console.error("Error fetching chat:", err);
    return handleResponse(res, 500, "Internal Server Error");
  }
};

const getUserChats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find all conversations the user is part of
    const conversations = await Message.find({
      participants: userId,
    })
      .populate("participants", "name images") 
      .lean();

    if (!conversations || conversations.length === 0)
      return handleResponse(res, 200, "No conversations found", { results: [] });

    const results = conversations.map((conv) => {
      const otherUser = conv.participants.find(
        (p) => p._id.toString() !== userId
      );

      const lastMessage =
        conv.messages && conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null;

      const unreadCount = conv.messages.filter((m) => !m.read && m.sender.toString() !== userId).length;

      return {
        userId: otherUser?._id || null,
        name: otherUser?.name || "Unknown",
        lastMessage: lastMessage ? lastMessage.text : null,
        lastMessageTime: lastMessage ? lastMessage.createdAt : null,
        profilePic: otherUser?.images?.[0] || null,
        unreadCount,
      };
    });

    return handleResponse(res, 200, "Chat list fetched successfully", { results });
  } catch (err) {
    console.error("Error fetching user chat list:", err);
    return handleResponse(res, 500, "Internal Server Error");
  }
};

export const chat = {
  getChatHistory,
  createChatMessage,
  getUserChats
};