import express from "express";
import { plan } from "../controllers/plan.js";

const router = express.Router();

router.post("/upsert", plan.upsertPlan);

router.get("/", plan.getAllPlans);

router.get("/:name", plan.getPlanByName);

export default router;
