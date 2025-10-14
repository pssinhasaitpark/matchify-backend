//app/controllers/user.js
import { User } from '../models/user.js';
import { userRegistrationValidator } from '../validators/user.js';
import { sendOTPEmail } from '../utils/helper.js';
import { handleResponse } from '../utils/helper.js';
import { formatDate } from '../utils/dateFormatter.js';
import { generateToken } from "../middlewares/jwtAuth.js";
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { normalizeInterest, normalizeAgeRange, assignUserFields } from '../utils/user.js';

const completeRegistrationAfterEmailVerification = async (req, res) => {
  try {
    const body = { ...req.body };
    delete body.images;

    // Normalize data
    body.interest = normalizeInterest(body.interest);
    body.age_range = normalizeAgeRange(body.age_range);

    // Validate using Joi
    const { error } = userRegistrationValidator.validate(body);
    if (error) {
      const cleanMessage = error.details[0].message.replace(/\"/g, '');
      return handleResponse(res, 400, cleanMessage);
    }

    // Verify token
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) return handleResponse(res, 401, "Authorization token required.");

    let decodedToken;
    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
    } catch (err) {
      return handleResponse(res, 400, "Invalid or expired token.");
    }

    // Find user by token
    const user = await User.findById(decodedToken.userId);
    if (!user || !user.isNewUser) {
      return handleResponse(res, 404, "User not found or not a new user.");
    }

    // Check if mobile number is already in use (by another user)
    const existingMobile = await User.findOne({
      mobile_number: body.mobile_number,
      _id: { $ne: user._id }, // Exclude current user
    });

    if (existingMobile) {
      return handleResponse(res, 400, "Mobile number already in use.");
    }

    // Assign fields
    assignUserFields(user, body, req);
    await user.save();

    // Generate and return new token
    const updatedToken = generateToken(user._id, user.email);
    return handleResponse(res, 201, "Email verified and registration complete.", {
      token: updatedToken,
      ...user.toObject(),
    });
  } catch (error) {
    console.error("Complete Registration error:", error);
    return handleResponse(res, 500, "Something went wrong.", { error: error.message });
  }
};

const verifyEmailForOTP = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });

    // const otp = crypto.randomBytes(3).toString('hex');   //Generate AlphaNumeric OTP
    // const otp = Math.floor(100000 + Math.random() * 900000).toString();  //Generate 6 Digit Numeric OTP
    const otp = "123456";

    if (user) {
      user.otp = otp;
      // user.isNewUser = false; // Mark as existing user

      await sendOTPEmail(email, otp);
      await user.save();

      return handleResponse(res, 200, 'OTP sent to your email. Please verify to log in.');
    }

    const newUser = new User({
      email,
      otp,
      isVerified: false,
      isNewUser: true,
    });

    await sendOTPEmail(email, otp);
    await newUser.save();

    return handleResponse(res, 200, 'OTP sent to your email for verification.');
  } catch (error) {
    console.error("OTP email error : ", error);
    if (error.code === 11000) {
      return handleResponse(res, 400, 'This email is already registered. Please log in instead.');
    }
    return handleResponse(res, 500, 'Something went wrong. Please try again.');
  };
};

const loginUserWithOTP = async (req, res) => {
  const { email, otp } = req.body;

  // Find the user by email
  let user = await User.findOne({ email });

  if (!user) {
    return handleResponse(res, 404, 'Email not found.');
  }

  // Check if OTP matches
  if (user.otp !== otp) {
    return handleResponse(res, 400, 'Invalid OTP. Please try again.');
  }

  // If user is new, mark them as verified and provide the token
  if (user.isNewUser) {
    user.isVerified = true;
    user.otp = ''; 
    await user.save(); 

    const token = generateToken(user._id, user.email);

    return handleResponse(res, 200, 'Logged in successfully and verified as new user.', { token, isNewUser: user.isNewUser });
  }

  // If existing user, clear OTP and log them in
  user.otp = ''; 
  await user.save();

  // Generate JWT token for the existing user
  const token = generateToken(user._id, user.email);

  return handleResponse(res, 200, 'Logged in successfully via OTP.', { token, isNewUser: user.isNewUser });
};

const getUserDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('-otp -__v');

    if (!user) {
      return handleResponse(res, 404, 'User not found.');
    }

    const userObj = user.toObject();

    if (userObj.date_of_birth) {
      userObj.date_of_birth = formatDate(userObj.date_of_birth);
    }

    return handleResponse(res, 200, 'User details fetched successfully.', userObj);
  } catch (error) {
    console.error('Error in getUserDetails:', error);
    return handleResponse(res, 500, 'Something went wrong.');
  }
};

const getMatches = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const currentUser = await User.findById(currentUserId);

    if (!currentUser) {
      return res.status(404).json({ status: false, message: "User not found." });
    }

    // Extract criteria from current user
    const {
      location,
      preferred_match_distance,
      show_me,
      age_range,
      sexual_orientation,
      relationshipGoals,
      interest: userInterests,
    } = currentUser;

    // Match genders based on "show_me"
    let gendersToMatch = [];
    if (show_me === "men") gendersToMatch = ["male"];
    else if (show_me === "women") gendersToMatch = ["female"];
    else gendersToMatch = ["male", "female", "other"];

    // Aggregation pipeline for matching
    const pipeline = [
      {
        $geoNear: {
          near: location,
          distanceField: "distance",
          maxDistance: preferred_match_distance * 1000, // convert km to meters
          spherical: true,
          query: {
            _id: { $ne: currentUserId }, // exclude self
            isVerified: true,
            gender: { $in: gendersToMatch },
            sexual_orientation: sexual_orientation, // match orientation (you can tweak)
            "age_range.0": { $lte: currentUser.age_range[1] },
            "age_range.1": { $gte: currentUser.age_range[0] },
          },
        },
      },
      {
        $addFields: {
          // Simple scoring example
          interestMatchCount: {
            $size: {
              $setIntersection: ["$interest", userInterests || []],
            },
          },
          relationshipGoalMatch: {
            $cond: [{ $eq: ["$relationshipGoals", relationshipGoals] }, 1, 0],
          },
          profileScore: {
            $add: [
              "$profileCompleteness",
              { $multiply: ["$interestMatchCount", 10] },
              { $multiply: ["$relationshipGoalMatch", 20] },
              { $subtract: [100, "$distance"] }, // closer better
            ],
          },
        },
      },
      {
        $sort: { profileScore: -1, lastActiveAt: -1 },
      },
      {
        $limit: 20,
      },
      {
        $project: {
          password: 0,
          otp: 0,
          __v: 0,
        },
      },
    ];

    const matches = await User.aggregate(pipeline);

    return res.status(200).json({ status: true, data: matches });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, perPage = 10 } = req.query;

    const skip = (page - 1) * perPage;

    const matchStage = {
      _id: { $ne: new mongoose.Types.ObjectId(String(userId)) },
      isVerified: true,
    };

    // Pipeline for aggregation
    // const pipeline = [
    //   { $match: matchStage },
    //   { $skip: skip },
    //   { $limit: Number(perPage) },
    //   {
    //     $project: {
    //       otp: 0,
    //       __v: 0,
    //       isNewUser: 0,
    //       isVerified: 0,
    //       email: 0,
    //     },
    //   },
    // ];

    const pipeline = [
      { $match: matchStage },
      { $addFields: { randomSort: { $rand: {} } } },
      { $sort: { randomSort: 1 } },
      { $skip: skip },
      { $limit: Number(perPage) },
      {
        $project: {
          otp: 0,
          __v: 0,
          isNewUser: 0,
          isVerified: 0,
          email: 0,
        },
      },
    ];


    const users = await User.aggregate(pipeline);

    const totalItems = await User.countDocuments(matchStage);
    const totalPages = Math.ceil(totalItems / perPage);

    return handleResponse(res, 200, "Users fetched successfully.", {
      results: users,
      totalItems,
      currentPage: Number(page),
      totalPages,
      totalItemsOnCurrentPage: users.length,
    });
  } catch (error) {
    console.error("Error in getAllUsers:", error);
    return handleResponse(res, 500, "Something went wrong.");
  }
};

const filterUsers = async (req, res) => {
  try {
    const userId = req.user.id;

    const query = { q: "", page: 1, perPage: 10, ...req.query, };

    const { q, gender, sexual_orientation, show_me, minAge, maxAge, preferred_match_distance, height, hasPets, interests, page, perPage, } = query;

    const normalizeValue = (val) => {
      if (typeof val === "string") {
        return val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
      }
      return val;
    };

    const matchStage = {
      _id: { $ne: new mongoose.Types.ObjectId(String(userId)) },
      isVerified: true,
    };

    if (q) {
      const regex = new RegExp(q, "i");
      matchStage.$or = [
        { name: regex },
        { bio: regex },
        { profession: regex },
        { education: regex },
        { interest: { $in: [regex] } },
      ];
    }

    const exactFilters = ["gender", "sexual_orientation", "show_me", "smoking", "drinking", "diet", "hasKids", "wantsKids", "relationshipGoals",];

    exactFilters.forEach((field) => {
      if (query[field]) {
        if (field === "show_me" || field === "sexual_orientation" || field === "gender") {
          // lowercase for these enum fields to match schema
          matchStage[field] = query[field].toLowerCase();
        } else {
          // capitalize first letter for other enum-like fields e.g. smoking, drinking
          matchStage[field] = normalizeValue(query[field]);
        }
      }
    });

    const regexFilters = ["body_type", "religion", "caste", "profession", "education"];

    regexFilters.forEach((field) => {
      if (query[field]) {
        matchStage[field] = new RegExp(`^${query[field]}$`, "i");
      }
    });

    if (preferred_match_distance) {
      matchStage.preferred_match_distance = { $lte: Number(preferred_match_distance) };
    }

    if (height) {
      const h = Number(height);
      matchStage.height = { $gte: h - 5, $lte: h + 5 };
    }

    if (hasPets !== undefined) {
      matchStage.hasPets = hasPets === "true";
    }

    if (minAge || maxAge) {
      const today = new Date();
      const minDOB = minAge
        ? new Date(today.getFullYear() - Number(minAge), today.getMonth(), today.getDate())
        : null;
      const maxDOB = maxAge
        ? new Date(today.getFullYear() - Number(maxAge), today.getMonth(), today.getDate())
        : null;

      matchStage.date_of_birth = {};
      if (maxDOB) matchStage.date_of_birth.$gte = maxDOB;
      if (minDOB) matchStage.date_of_birth.$lte = minDOB;
    }

    if (interests) {
      const interestArray = interests
        .split(",")
        .map((i) => i.trim().toLowerCase());

      matchStage.interest = {
        $in: interestArray,
      };
    }

    const skip = (Number(page) - 1) * Number(perPage);

    const pipeline = [
      { $match: matchStage },
      { $skip: skip },
      { $limit: Number(perPage) },
      {
        $project: {
          otp: 0,
          __v: 0,
          isNewUser: 0,
          isVerified: 0,
          email: 0,
        },
      },
    ];

    const users = await User.aggregate(pipeline);

    const totalItems = await User.countDocuments(matchStage);
    const totalPages = Math.ceil(totalItems / perPage);

    return handleResponse(res, 200, "Filtered users fetched successfully.", {
      results: users,
      totalItems,
      currentPage: Number(page),
      totalPages,
      totalItemsOnCurrentPage: users.length,
    });

  } catch (error) {
    console.error("Error in filterUsers:", error);
    return handleResponse(res, 500, "Something went wrong.");
  }
};

const likeUser = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return handleResponse(res, 404, "User not found.");
    }

    if (!user.likedUsers.includes(targetUserId)) {
      user.likedUsers.push(targetUserId);
      await user.save();
    }

    return handleResponse(res, 200, "User liked successfully.");
  } catch (error) {
    console.error("Error in likeUser:", error);
    return handleResponse(res, 500, "Something went wrong.");
  }
};

const dislikeUser = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return handleResponse(res, 404, "User not found.");
    }

    if (!user.dislikedUsers.includes(targetUserId)) {
      user.dislikedUsers.push(targetUserId);
      await user.save();
    }

    return handleResponse(res, 200, "User disliked successfully.");
  } catch (error) {
    console.error("Error in dislikeUser:", error);
    return handleResponse(res, 500, "Something went wrong.");
  }
};

export const user = {
  verifyEmailForOTP,
  completeRegistrationAfterEmailVerification,
  loginUserWithOTP,
  getUserDetails,
  getMatches,
  getAllUsers,
  filterUsers,
  likeUser,
  dislikeUser
};
