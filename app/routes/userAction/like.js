// routes/userAction/like.js
import express from "express";
import { likes } from "../../controllers/userAction/like.js";
import { verifyToken, checkPlan } from "../../middlewares/jwtAuth.js";
const router = express.Router();

router.post("/:targetUserId", verifyToken, checkPlan("LIKE"), likes.likeUser);

router.get("/all", verifyToken, likes.getAllLikedUsers);

router.get("/liked-me", verifyToken, likes.getUsersWhoLikedMe);

router.get("/mutual-likes", verifyToken, likes.getMutualLikes);

export default router;
