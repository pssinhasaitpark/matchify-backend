// app/routes/socialAuth.js
import express from "express";
import passport from "passport";
import "../services/passport.js"; // ensure passport is configured
import { googleCallback } from "../controllers/socialAuth.js";

const router = express.Router();

// Step 1: Redirect user to Google for login
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// Step 2: Google callback
router.get("/google/callback", passport.authenticate("google", { failureRedirect: "/login" }), googleCallback);

export default router;
