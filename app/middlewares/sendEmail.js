//app/middlewares/sendEmail.js
import sendEmail from "../utils/emailHandler.js";
import path from "path";
import fs from "fs";
import ejs from "ejs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import User from "../models/user.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sendInquiryConfirmationEmail = async (req, res, next) => {
  try {
    const {
      name,
      email,
      message,
      subject,
      phone_number,
      school_organization_name,
      number_of_students,
    } = req.body;

    // Prepare the user email template
    const userTemplatePath = path.join(__dirname, "..", "public", "inquiryConfirmation.html");
    const userTemplate = fs.readFileSync(userTemplatePath, "utf-8");
    const userEmailContent = ejs.render(userTemplate, { name, message, subject });

    // Send email to the user
    await sendEmail(email, "Thank You for Your Inquiry", userEmailContent);

    // Prepare the admin email template
    const adminTemplatePath = path.join(__dirname, "..", "public", "adminNotification.html");
    const adminTemplate = fs.readFileSync(adminTemplatePath, "utf-8");
    const adminEmailContent = ejs.render(adminTemplate, {
      name,
      email,
      phone_number,
      school_organization_name,
      number_of_students,
      subject,
      message,
    });

    // Admin email address to be notified
    const adminEmail = process.env.ADMIN_EMAIL || "schoolware@parkhya.net";

    // Fetch the super admin details for BCC
    const superAdmin = await User.findOne({ role: "super_admin" });
    const bccEmails = superAdmin?.inquiry_bcc_emails || [];

    // Send email to the admin
    await sendEmail(adminEmail, "New Inquiry Alert", adminEmailContent, bccEmails);

    next();
  } catch (error) {
    console.error("Error sending inquiry emails:", error);
    next(error);
  }
};

export default sendInquiryConfirmationEmail;
