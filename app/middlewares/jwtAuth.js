//app/middlewares/jwtAuth.js
import jwt from "jsonwebtoken";
import { User } from '../models/user.js';
import { handleResponse } from "../utils/helper.js";
import { canPerformAction } from "../services/planService.js";

export const generateToken = (userId, email) => {
  const payload = { userId, email };
  const secret = process.env.JWT_SECRET || 'your-secret-key';
  // const options = { expiresIn: '1h' };
   const expiresIn = process.env.JWT_EXPIRATION || '7d';

   const options = { expiresIn };
   
  return jwt.sign(payload, secret, options);
};

export const verifyToken = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return handleResponse(res, 403, "Access Denied. No token provided.");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { userId, user_role } = decoded;

    const user = await User.findById(userId);
    if (!user) {
      return handleResponse(res, 403, "User not found or not authorized.");
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role
    };

    next();
  } catch (error) {
    console.error("Token verification error:", error);

    if (error instanceof jwt.JsonWebTokenError) {
      return handleResponse(res, 403, "Invalid token. Please log in again.");
    }
    if (error instanceof jwt.TokenExpiredError) {
      return handleResponse(res, 403, "Token has expired. Please log in again.");
    }

    return handleResponse(res, 500, "Internal server error.");
  }
};

// app/middlewares/checkPlan.js
export const checkPlan = (action) => async (req, res, next) => {
  try {
    const userId = req.user.id;
    const canPerform = await canPerformAction(userId, action);
    if (!canPerform) {
      return handleResponse(res, 403, `You have reached your daily ${action.toLowerCase()} limit. Upgrade your plan.`);
    }
    next();
  } catch (error) {
    console.error("Error in checkPlan:", error);
    return handleResponse(res, 500, "Something went wrong.");
  }
};
