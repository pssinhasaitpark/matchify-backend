import jwt from "jsonwebtoken";
import { User } from '../models/user.js';
import { handleResponse } from "../utils/helper.js";

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
