//app/routes/user.js
import express from 'express';
import { user } from '../controllers/user.js';
import { verifyToken } from '../middlewares/jwtAuth.js';
import { imageConversionMiddlewareMultiple } from '../middlewares/fileUploader.js';

const router = express.Router();

router.get("/get", verifyToken, user.getUsers);

router.post('/verify-email', user.verifyEmailForOTP);

router.post('/complete-registration', verifyToken, imageConversionMiddlewareMultiple, user.completeRegistrationAfterEmailVerification);

router.post('/login-with-otp', user.loginUserWithOTP);

router.get('/me', verifyToken, user.me);

router.get('/:userId', verifyToken, user.getUserDetailsByUserId);

router.patch("/update",verifyToken, imageConversionMiddlewareMultiple, user.updateProfile);

export default router;
