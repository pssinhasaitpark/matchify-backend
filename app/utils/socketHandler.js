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
