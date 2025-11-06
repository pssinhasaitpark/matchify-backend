//app/routes/discoverPages.js
import express from "express";
import { discover } from "../controllers/discoverPages.js";
import { verifyToken } from "../middlewares/jwtAuth.js";

const router = express.Router();

router.get("/similar-interests", verifyToken, discover.getSimilarInterestUsers);

router.get("/same-dating-goals", verifyToken, discover.getAllUsersWithSameDatingGoals);

router.get("/common-communities", verifyToken, discover.getUserWithCommunitiesInCommon);

router.get("/recommended", verifyToken, discover.getRecommendedUsers);

export default router;