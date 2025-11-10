// routes/chatRoutes.js
import express from "express";
import { chat } from "../../controllers/chat/message.js";
import { verifyToken } from "../../middlewares/jwtAuth.js";

const router = express.Router();

router.post("/:receiverId", verifyToken, chat.createChatMessage);

router.get("/:receiverId", verifyToken, chat.getChatHistory);

export default router;
