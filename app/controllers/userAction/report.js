// controllers/userAction/report.js
import mongoose from "mongoose";
import { User } from "../../models/user.js";
import { Report } from "../../models/userAction/report.js";
import { reportUserValidator } from "../../validators/userAction/report.js";
import { handleResponse } from "../../utils/helper.js";
import { Like } from "../../models/userAction/like.js";

const reportUser = async (req, res) => {
  try {
    const { reportedUserId } = req.params;
    const { reason, details } = req.body;
    const reporterId = req.user.id;

    // Validate request body using Joi
    const { error } = reportUserValidator.validate({ reason, details });
    if (error) {
      const cleanMessage = error.details[0].message.replace(/\"/g, "");
      return handleResponse(res, 400, cleanMessage);
    }

    // Validate reportedUserId
    if (!mongoose.Types.ObjectId.isValid(reportedUserId)) {
      return handleResponse(res, 400, "Invalid reported user ID format.");
    }

    // // Check if reported user exists
    // const reportedUser = await User.findById(reportedUserId);
    // if (!reportedUser) {
    //   return handleResponse(res, 404, "Reported user not found.");
    // }

    // Prevent self-reporting
    if (reporterId === reportedUserId) {
      return handleResponse(res, 400, "You cannot report yourself.");
    }

    // Check if user exists
    const reportedUser = await User.findById(reportedUserId);
    if (!reportedUser) {
      return handleResponse(res, 404, "Reported user not found.");
    }



    // Check if report already exists
    const existingReport = await Report.findOne({
      reporterId,
      reportedUserId,
      reason,
    });

    if (existingReport) {
      return handleResponse(
        res,
        200,
        "You have already reported this user for the same reason."
      );
    }

    // Create a new report
    await Report.create({
      reporterId,
      reportedUserId,
      reason,
      details: details || "",
    });

     //Remove any existing "likes" in both directions
    await Like.deleteMany({
      $or: [
        { userId: reporterId, targetUserId: reportedUserId },
        { userId: reportedUserId, targetUserId: reporterId },
      ],
    });

    return handleResponse(res, 201, "User reported successfully.");
  } catch (error) {
    console.error("Error in reportUser:", error);
    return handleResponse(res, 500, "Something went wrong.");
  }
};

export const report = {
  reportUser,
};
