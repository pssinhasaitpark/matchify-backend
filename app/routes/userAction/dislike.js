// routes/userAction/dislike.js
import express from "express";
import { dislike } from "../../controllers/userAction/dislike.js";
import { verifyToken } from "../../middlewares/jwtAuth.js";
const router = express.Router();

router.post("/:targetUserId", verifyToken, dislike.dislikeUser);

export default router;
