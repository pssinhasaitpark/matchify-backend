//app/utils/emailHandler.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create the transporter using Gmail's SMTP server
const transporter = nodemailer.createTransport({
  service: 'gmail',  // Use Gmail's service
  auth: {
    user: process.env.EMAIL_USER,  // Your Gmail email
    pass: process.env.EMAIL_PASS,  // Your Gmail App Password
  },
});

const sendEmail = async (to, subject, htmlContent, bcc = [], textContent = null) => {
  console.log("Sending email to:", to);
  
  if (!to || (Array.isArray(to) && to.length === 0)) {
    console.error("❌ Email not sent: No recipients defined");
    return;
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM,  // Email from which the message will be sent
    to,  // Recipient's email
    subject,  // Subject of the email
    html: htmlContent,  // HTML content of the email
    text: textContent,  // Plain text content (optional)
  };

  // If there are BCC recipients, include them
  if (bcc && bcc.length > 0) {
    mailOptions.bcc = bcc;
  }

  try {
    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully!");
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Email sending failed");
  }
};

export default sendEmail;
