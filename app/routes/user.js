//app/routes/user.js
import express from 'express';
import { user } from '../controllers/user.js';
import { verifyToken } from '../middlewares/jwtAuth.js';
import { imageConversionMiddlewareMultiple } from '../middlewares/fileUploader.js';

const router = express.Router();

// Route to verify email and send OTP (either for new user registration or existing user login)
router.post('/verify-email', user.verifyEmailForOTP);

// Route to complete registration after email verification (email and otp removed from the request)
router.post('/complete-registration', verifyToken, imageConversionMiddlewareMultiple, user.completeRegistrationAfterEmailVerification);

// Route to login with OTP (for existing users) and return isNewUser status
router.post('/login-with-otp', user.loginUserWithOTP);

router.get('/', verifyToken, user.getUserDetails);

router.get("/users", verifyToken, user.getAllUsers);

router.get("/filter", verifyToken, user.filterUsers);

router.post("/like", verifyToken, user.likeUser);

router.post("/dislike", verifyToken, user.dislikeUser);

export default router;
