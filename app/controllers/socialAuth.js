// app/controllers/socialAuth.js
import jwt from "jsonwebtoken";
import { generateToken } from "../middlewares/jwtAuth.js";
import { handleResponse } from "../utils/helper.js";

export const googleCallback = async (req, res) => {
  try {
    const user = req.user;

    if (!user) return handleResponse(res, 400, "Google authentication failed");

    // Generate JWT
    const token = generateToken(user._id, user.email);

    // You can redirect frontend with token in URL
    // Example: res.redirect(`https://yourfrontend.com/login-success?token=${token}`);
    // or just send JSON
    return handleResponse(res, 200, "Google login successful", {
      token,
      user,
    });
  } catch (err) {
    console.error("Google callback error:", err);
    return handleResponse(res, 500, "Something went wrong during Google login");
  }
};
