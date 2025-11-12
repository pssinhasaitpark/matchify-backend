//12 Nov 2025
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

    // ✅ User joins socket after login
    // socket.on("join-user", async ({ userId }) => {
    //   if (!userId) return;

    //   const user = await User.findById(userId);
    //   if (!user) return;

    //   connectedUserId = userId.toString();
    //   connectedUsers.set(connectedUserId, socket.id);
    //   socket.join(connectedUserId);

    //   console.log(`✅ User joined: ${user.name || userId} (${socket.id})`);
    // });

    // ✅ User joins socket after login
    socket.on("join-user", async ({ userId }) => {
      if (!userId) return;

      const user = await User.findById(userId);
      if (!user) return;

      connectedUserId = userId.toString();
      connectedUsers.set(connectedUserId, socket.id);
      socket.join(connectedUserId);

      console.log(`✅ User joined: ${user.name || userId} (${socket.id})`);

      // ✅ Deliver any pending (offline) messages
      try {
        const conversations = await Message.find({ participants: userId });
        for (const convo of conversations) {
          let changed = false;
          convo.messages.forEach((msg) => {
            if (
              msg.sender.toString() !== userId && // message sent by others
              !msg.delivered // not yet delivered
            ) {
              msg.delivered = true;
              changed = true;

              // Notify sender if online
              const senderSocketId = connectedUsers.get(msg.sender.toString());
              if (senderSocketId) {
                io.to(senderSocketId).emit("message-delivered", {
                  messageId: msg._id,
                  receiverId: userId,
                });
              }
            }
          });
          if (changed) await convo.save();
        }
        console.log(`📬 Delivered pending messages for ${userId}`);
      } catch (err) {
        console.error("❌ Error delivering pending messages:", err);
      }
    });

    // ✅ SEND MESSAGE (with delivery + read system)
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
          _id: new mongoose.Types.ObjectId(),
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

        const messagePayload = {
          _id: newMessage._id.toString(),
          senderId: senderId.toString(),
          receiverId: receiverId.toString(),
          text: newMessage.text,
          read: newMessage.read,
          createdAt: newMessage.createdAt,
        };

        // ✅ Deliver message to receiver if online
        const receiverSocketId = connectedUsers.get(receiverId.toString());
        if (receiverSocketId) {
          // Mark message as delivered in DB
          const conversation = await Message.findOne({
            participants: { $all: [senderId, receiverId] },
          });

          if (conversation) {
            const msg = conversation.messages.id(newMessage._id);
            if (msg && !msg.delivered) {
              msg.delivered = true;
              await conversation.save();
              console.log(`✅ Marked as delivered in DB for ${receiverId}`);
            }
          }

          io.to(receiverSocketId).emit("receive-message", messagePayload);
          io.to(senderId.toString()).emit("message-delivered", {
            messageId: newMessage._id,
            receiverId,
          });
          console.log(`📨 Message delivered to ${receiverId}`);

          // ✅ Emit unread count update for receiver
          const updatedConversation = await Message.findOne({
            participants: { $all: [senderId, receiverId] },
          }).lean();

          const unreadCountForReceiver = updatedConversation.messages.filter(
            (m) => !m.read && m.sender.toString() !== receiverId.toString()
          ).length;

          io.to(receiverSocketId).emit("unread-count-update", {
            chatWith: senderId,
            unreadCount: unreadCountForReceiver,
          });
        } else {
          // Receiver offline → single tick
          io.to(senderId.toString()).emit("message-sent", messagePayload);
          console.log(`📩 Receiver offline, message stored`);
        }
      } catch (err) {
        console.error("❌ Error sending message:", err);
        socket.emit("error", { message: "Error sending message." });
      }
    });

    // ✅ RECEIVER OPENS CHAT (mark messages as read)
    // socket.on("chat-opened", async ({ userId, withUserId }) => {
    //   try {
    //     const conversation = await Message.findOne({
    //       participants: { $all: [userId, withUserId] },
    //     });
    //     if (!conversation) return;

    //     let updated = false;
    //     conversation.messages.forEach((msg) => {
    //       if (msg.sender.toString() === withUserId && !msg.read) {
    //         msg.read = true;
    //         updated = true;
    //       }
    //     });

    //     if (updated) {
    //       await conversation.save();

    //       // Notify sender about read status
    //       const senderSocketId = connectedUsers.get(withUserId.toString());
    //       if (senderSocketId) {
    //         io.to(senderSocketId).emit("message-read", { readerId: userId });
    //         console.log(
    //           `✅ Messages marked read by ${userId} for ${withUserId}`
    //         );
    //       }
    //     }
    //   } catch (err) {
    //     console.error("❌ Error in chat-opened:", err);
    //   }
    // });
    socket.on("chat-opened", async ({ userId, withUserId }) => {
      try {
        const conversation = await Message.findOne({
          participants: { $all: [userId, withUserId] },
        });
        if (!conversation) return;

        let updated = false;
        conversation.messages.forEach((msg) => {
          if (msg.sender.toString() === withUserId && !msg.read) {
            msg.read = true;
            updated = true;
          }
        });

        if (updated) {
          await conversation.save();

          // Notify sender about read status
          const senderSocketId = connectedUsers.get(withUserId.toString());
          if (senderSocketId) {
            io.to(senderSocketId).emit("message-read", { readerId: userId });
            console.log(
              `✅ Messages marked read by ${userId} for ${withUserId}`
            );
          }

          // ✅ Reset unread count for this chat on receiver’s side
          io.to(userId.toString()).emit("unread-count-update", {
            chatWith: withUserId,
            unreadCount: 0,
          });
        }
      } catch (err) {
        console.error("❌ Error in chat-opened:", err);
      }
    });

    // ✅ LIKE system (real-time)
    socket.on("like-user", async ({ likerId, targetUserId }) => {
      try {
        if (!likerId || !targetUserId) return;

        console.log(`❤️ ${likerId} liked ${targetUserId}`);

        const existingLike = await Like.findOne({
          userId: likerId,
          targetUserId,
        });
        if (!existingLike) await Like.create({ userId: likerId, targetUserId });

        const mutual = await Like.findOne({
          userId: targetUserId,
          targetUserId: likerId,
        });

        const targetSocketId = connectedUsers.get(targetUserId.toString());
        if (targetSocketId)
          io.to(targetSocketId).emit("liked-by-user", { likerId });

        if (mutual) {
          const likerSocketId = connectedUsers.get(likerId.toString());
          const payload = { user1: likerId, user2: targetUserId };
          if (likerSocketId) io.to(likerSocketId).emit("mutual-like", payload);
          if (targetSocketId)
            io.to(targetSocketId).emit("mutual-like", payload);
        }
      } catch (err) {
        console.error("❌ Error in like-user:", err);
      }
    });

    // ✅ UNLIKE system
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

    // ✅ DISCONNECT HANDLER
    socket.on("disconnect", () => {
      if (connectedUserId) connectedUsers.delete(connectedUserId);
      console.log(`❌ User disconnected: ${socket.id}`);
    });
  });
};

/* 
//11 Nov 2025
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

    
    // ✅ Send message event
    // socket.on("send-message", async ({ senderId, receiverId, text }) => {
    //   try {
    //     if (!senderId || !receiverId || !text) return;

    //     console.log(`💬 Message from ${senderId} → ${receiverId}: "${text}"`);

    //     // Verify mutual like
    //     const likedBySender = await Like.findOne({ userId: senderId, targetUserId: receiverId });
    //     const likedByReceiver = await Like.findOne({ userId: receiverId, targetUserId: senderId });

    //     if (!likedBySender || !likedByReceiver) {
    //       console.log(`⚠️ No mutual like between ${senderId} and ${receiverId}`);
    //       return socket.emit("error", { message: "Chat not allowed without mutual like" });
    //     }

    //     // Find or create conversation
    //     let conversation = await Message.findOne({
    //       participants: { $all: [senderId, receiverId] },
    //     });

    //     const newMessage = {
    //       sender: senderId,
    //       text,
    //       read: false,
    //       createdAt: new Date(),
    //     };

    //     if (!conversation) {
    //       conversation = await Message.create({
    //         participants: [senderId, receiverId],
    //         messages: [newMessage],
    //       });
    //       console.log(`🆕 New conversation started between ${senderId} and ${receiverId}`);
    //     } else {
    //       conversation.messages.push(newMessage);
    //       conversation.updatedAt = new Date();
    //       await conversation.save();
    //     }

    //     // Emit in real-time
    //     const receiverSocketId = connectedUsers.get(receiverId.toString());
    //     if (receiverSocketId) {
    //       io.to(receiverSocketId).emit("receive-message", newMessage);
    //       console.log(`📨 Message delivered to ${receiverId}`);
    //     }
    //     socket.emit("message-sent", newMessage);
    //   } catch (err) {
    //     console.error("❌ Error sending message:", err);
    //     socket.emit("error", { message: "Error sending message." });
    //   }
    // });
    

    
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
*/
