// routes/userAction/report.js
import express from "express";
import { report } from "../../controllers/userAction/report.js";
import { verifyToken } from "../../middlewares/jwtAuth.js";

const router = express.Router();

router.post("/:reportedUserId", verifyToken, report.reportUser);

export default router;
