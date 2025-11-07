//app/routes/user.js
import express from 'express';
import { user } from '../controllers/user.js';
import { verifyToken } from '../middlewares/jwtAuth.js';
import { imageConversionMiddlewareMultiple } from '../middlewares/fileUploader.js';

const router = express.Router();

router.get("/get", verifyToken, user.getAllUsers);

router.post('/verify-email', user.verifyEmailForOTP);

router.post('/complete-registration', verifyToken, imageConversionMiddlewareMultiple, user.completeRegistrationAfterEmailVerification);

router.post('/login-with-otp', user.loginUserWithOTP);

router.get('/me', verifyToken, user.me);

// router.get("/all", verifyToken, user.getAllUsers);

// router.get("/filter", verifyToken, user.filterUsers);

router.get('/:userId', verifyToken, user.getUserDetailsByUserId);

export default router;
