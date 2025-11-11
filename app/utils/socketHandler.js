/*
// app/utils/socketHandler.js
import { User } from "../models/user.js";
import { Like } from "../models/userAction/like.js";
import { Message } from "../models/chat/message.js";

// Maps to track connected sockets
export const connectedUsers = new Map(); // userId -> socketId

export const initializeSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("🔌 New client connected:", socket.id);

    let connectedUserId = null;

    // ✅ User joins socket (after login)
    socket.on("join-user", async ({ userId }) => {
      if (!userId) return;

      const user = await User.findById(userId);
      if (!user) return;

      connectedUserId = userId.toString();
      connectedUsers.set(connectedUserId, socket.id);
      socket.join(connectedUserId);

      console.log(`✅ User joined: ${user.name || userId} (${socket.id})`);
    });

     socket.on("send-like", async ({ likerId, targetId }) => {
      try {
        if (!likerId || !targetId) return;

        // Create or ignore existing like
        const like = await Like.findOneAndUpdate(
          { userId: likerId, targetUserId: targetId },
          { $setOnInsert: { createdAt: new Date() } },
          { upsert: true, new: true }
        );

        // Check for mutual like
        const isMutual = await Like.exists({
          userId: targetId,
          targetUserId: likerId,
        });

        // Notify target user they’ve been liked
        const targetSocketId = connectedUsers.get(targetId.toString());
        if (targetSocketId) {
          io.to(targetSocketId).emit("liked-you", {
            userId: likerId,
            isMutual,
          });
        }

        // If it’s a mutual like, notify both users
        if (isMutual) {
          const likerSocketId = connectedUsers.get(likerId.toString());
          if (likerSocketId) {
            io.to(likerSocketId).emit("mutual-like", { userId: targetId });
          }
          if (targetSocketId) {
            io.to(targetSocketId).emit("mutual-like", { userId: likerId });
          }
        }

      } catch (err) {
        console.error("❌ Error in send-like socket:", err);
      }
    });

    // ✅ Send message event
    socket.on("send-message", async ({ senderId, receiverId, text }) => {
      try {
        if (!senderId || !receiverId || !text) return;

        // Verify mutual like
        const likedBySender = await Like.findOne({
          userId: senderId,
          targetUserId: receiverId,
        });
        const likedByReceiver = await Like.findOne({
          userId: receiverId,
          targetUserId: senderId,
        });

        if (!likedBySender || !likedByReceiver) {
          return socket.emit("error", {
            message: "Chat not allowed without mutual like",
          });
        }

        // Find or create conversation
        let conversation = await Message.findOne({
          participants: { $all: [senderId, receiverId] },
        });

        const newMessage = {
          sender: senderId,
          text,
          read: false,
          createdAt: new Date(),
        };

        if (!conversation) {
          // create a new conversation
          conversation = await Message.create({
            participants: [senderId, receiverId],
            messages: [newMessage],
          });
        } else {
          // push to existing conversation
          conversation.messages.push(newMessage);
          conversation.updatedAt = new Date();
          await conversation.save();
        }

        // Emit real-time events
        const receiverSocketId = connectedUsers.get(receiverId.toString());
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("receive-message", newMessage);
        }
        socket.emit("message-sent", newMessage);
      } catch (err) {
        console.error("❌ Error sending message:", err);
        socket.emit("error", { message: "Error sending message." });
      }
    });

    // ✅ Mark messages as read
    socket.on("mark-read", async ({ userId, senderId }) => {
      try {
        await Message.updateMany(
          { receiver: userId, sender: senderId, read: false },
          { $set: { read: true } }
        );
        socket.emit("messages-marked-read", { senderId });
      } catch (err) {
        console.error("Error marking messages as read:", err);
      }
    });

    // ✅ Handle disconnect
    socket.on("disconnect", () => {
      if (connectedUserId) connectedUsers.delete(connectedUserId);
      console.log("❌ Client disconnected:", socket.id);
    });
  });
};
*/

// app/utils/socketHandler.js
import { User } from "../models/user.js";
import { Like } from "../models/userAction/like.js";
import { Message } from "../models/chat/message.js";
import mongoose from "mongoose";

// Maps to track connected sockets
export const connectedUsers = new Map(); // userId -> socketId

export const initializeSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("🔌 New client connected:", socket.id);

    let connectedUserId = null;

    // ✅ User joins socket (after login)
    socket.on("join-user", async ({ userId }) => {
      if (!userId) return;

      const user = await User.findById(userId);
      if (!user) return;

      connectedUserId = userId.toString();
      connectedUsers.set(connectedUserId, socket.id);
      socket.join(connectedUserId);

      console.log(`✅ User joined: ${user.name || userId} (${socket.id})`);
    });

    /*
    // ✅ Send message event
    socket.on("send-message", async ({ senderId, receiverId, text }) => {
      try {
        if (!senderId || !receiverId || !text) return;

        console.log(`💬 Message from ${senderId} → ${receiverId}: "${text}"`);

        // Verify mutual like
        const likedBySender = await Like.findOne({ userId: senderId, targetUserId: receiverId });
        const likedByReceiver = await Like.findOne({ userId: receiverId, targetUserId: senderId });

        if (!likedBySender || !likedByReceiver) {
          console.log(`⚠️ No mutual like between ${senderId} and ${receiverId}`);
          return socket.emit("error", { message: "Chat not allowed without mutual like" });
        }

        // Find or create conversation
        let conversation = await Message.findOne({
          participants: { $all: [senderId, receiverId] },
        });

        const newMessage = {
          sender: senderId,
          text,
          read: false,
          createdAt: new Date(),
        };

        if (!conversation) {
          conversation = await Message.create({
            participants: [senderId, receiverId],
            messages: [newMessage],
          });
          console.log(`🆕 New conversation started between ${senderId} and ${receiverId}`);
        } else {
          conversation.messages.push(newMessage);
          conversation.updatedAt = new Date();
          await conversation.save();
        }

        // Emit in real-time
        const receiverSocketId = connectedUsers.get(receiverId.toString());
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("receive-message", newMessage);
          console.log(`📨 Message delivered to ${receiverId}`);
        }
        socket.emit("message-sent", newMessage);
      } catch (err) {
        console.error("❌ Error sending message:", err);
        socket.emit("error", { message: "Error sending message." });
      }
    });
    */

    
    socket.on("send-message", async ({ senderId, receiverId, text }) => {
      try {
        if (!senderId || !receiverId || !text) return;

        console.log(`💬 Message from ${senderId} → ${receiverId}: "${text}"`);

        // Verify mutual like
        const likedBySender = await Like.findOne({
          userId: senderId,
          targetUserId: receiverId,
        });
        const likedByReceiver = await Like.findOne({
          userId: receiverId,
          targetUserId: senderId,
        });

        if (!likedBySender || !likedByReceiver) {
          return socket.emit("error", {
            message: "Chat not allowed without mutual like",
          });
        }

        // Find or create conversation
        let conversation = await Message.findOne({
          participants: { $all: [senderId, receiverId] },
        });

        const newMessage = {
          _id: new mongoose.Types.ObjectId(), // ✅ ADD THIS
          sender: senderId,
          text,
          read: false,
          createdAt: new Date(),
        };

        if (!conversation) {
          conversation = await Message.create({
            participants: [senderId, receiverId],
            messages: [newMessage],
          });
        } else {
          conversation.messages.push(newMessage);
          conversation.updatedAt = new Date();
          await conversation.save();
        }

        // ✅ Proper message payload
        const messagePayload = {
          _id: newMessage._id.toString(),
          senderId: senderId.toString(),
          receiverId: receiverId.toString(),
          sender: senderId.toString(), // For compatibility
          text: newMessage.text,
          read: false,
          createdAt: newMessage.createdAt,
        };

        // ✅ Emit ONCE to receiver
        const receiverSocketId = connectedUsers.get(receiverId.toString());
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("receive-message", messagePayload);
          console.log(`📨 Message delivered to receiver: ${receiverId}`);
        }

        // ✅ Emit ONCE to sender (confirmation)
        socket.emit("message-sent", messagePayload);
        console.log(`✅ Confirmation sent to sender: ${senderId}`);
      } catch (err) {
        console.error("❌ Error sending message:", err);
        socket.emit("error", { message: "Error sending message." });
      }
    });

    // ✅ LIKE system (real-time)
    socket.on("like-user", async ({ likerId, targetUserId }) => {
      try {
        if (!likerId || !targetUserId) return;

        console.log(`❤️ ${likerId} liked ${targetUserId}`);

        // Create like if not exists
        const existingLike = await Like.findOne({
          userId: likerId,
          targetUserId,
        });
        if (!existingLike) await Like.create({ userId: likerId, targetUserId });

        // Check for mutual like
        const mutual = await Like.findOne({
          userId: targetUserId,
          targetUserId: likerId,
        });

        // Notify target user about being liked
        const targetSocketId = connectedUsers.get(targetUserId.toString());
        if (targetSocketId) {
          io.to(targetSocketId).emit("liked-by-user", { likerId });
          console.log(
            `📩 Notified ${targetUserId} of new like from ${likerId}`
          );
        }

        // Notify both users on mutual like
        if (mutual) {
          const likerSocketId = connectedUsers.get(likerId.toString());
          const payload = { user1: likerId, user2: targetUserId };
          console.log(`💞 Mutual like between ${likerId} and ${targetUserId}`);
          if (likerSocketId) io.to(likerSocketId).emit("mutual-like", payload);
          if (targetSocketId)
            io.to(targetSocketId).emit("mutual-like", payload);
        }
      } catch (err) {
        console.error("❌ Error in like-user:", err);
        socket.emit("error", { message: "Error liking user." });
      }
    });

    // ✅ Unlike (remove like)
    socket.on("unlike-user", async ({ likerId, targetUserId }) => {
      try {
        await Like.deleteOne({ userId: likerId, targetUserId });
        console.log(`💔 ${likerId} unliked ${targetUserId}`);

        const targetSocketId = connectedUsers.get(targetUserId.toString());
        if (targetSocketId)
          io.to(targetSocketId).emit("user-unliked", { likerId });

        const likerSocketId = connectedUsers.get(likerId.toString());
        if (likerSocketId)
          io.to(likerSocketId).emit("unlike-success", { targetUserId });
      } catch (err) {
        console.error("❌ Error in unlike-user:", err);
      }
    });

    // ✅ Handle disconnect
    socket.on("disconnect", () => {
      if (connectedUserId) connectedUsers.delete(connectedUserId);
      console.log(`❌ User disconnected: ${socket.id}`);
    });
  });
};