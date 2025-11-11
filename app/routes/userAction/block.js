// routes/userAction/block.js
import express from "express";
import { block } from "../../controllers/userAction/block.js";
import { verifyToken } from "../../middlewares/jwtAuth.js";

const router = express.Router();

router.post("/:targetUserId", verifyToken, block.blockUser);

export default router;
