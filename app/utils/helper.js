// app/utils/helper.js
import nodemailer from 'nodemailer';

export const handleResponse = (res, statusCode, message, data = {}) => {
  const isSuccess = statusCode >= 200 && statusCode < 300;

  return res.status(statusCode).json({
    success: isSuccess,
    error: !isSuccess,
    message,
    ...data,
  });
};

// Send OTP Email to the user
export const sendOTPEmail = async (email, otp) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your OTP Code',
    text: `Your OTP code is ${otp}`,
  };

  await transporter.sendMail(mailOptions);
};