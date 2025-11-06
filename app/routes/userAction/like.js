// routes/userAction/like.js
import express from "express";
import { likes } from "../../controllers/userAction/like.js";
import { verifyToken } from "../../middlewares/jwtAuth.js"; // assuming you have auth middleware

const router = express.Router();

router.post("/:targetUserId", verifyToken, likes.likeUser);

router.get("/all", verifyToken, likes.getAllLikedUsers);

router.get("/liked-me", verifyToken, likes.getUsersWhoLikedMe);

router.get("/mutual-likes", verifyToken, likes.getMutualLikes);

export default router;
