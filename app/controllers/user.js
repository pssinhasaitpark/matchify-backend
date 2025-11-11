//app/controllers/user.js
import { User } from "../models/user.js";
import { Block } from "../models/userAction/block.js";
import { Report } from "../models/userAction/report.js";
import { userRegistrationValidator, updateProfileValidator } from "../validators/user.js";
import { sendOTPEmail } from "../utils/helper.js";
import { handleResponse } from "../utils/helper.js";
import { formatDate } from "../utils/dateFormatter.js";
import { generateToken } from "../middlewares/jwtAuth.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { normalizeInterest, normalizeAgeRange, assignUserFields, calculateProfileCompleteness, parseDateDMY, parseLocation } from "../utils/user.js";
import { getPlaceName } from "../services/locationService.js";

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
      const cleanMessage = error.details[0].message.replace(/\"/g, "");
      return handleResponse(res, 400, cleanMessage);
    }

    // Verify token
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token)
      return handleResponse(res, 401, "Authorization token required.");

    let decodedToken;
    try {
      decodedToken = jwt.verify(
        token,
        process.env.JWT_SECRET || "your-secret-key"
      );
    } catch (err) {
      return handleResponse(res, 400, "Invalid or expired token.");
    }

    // Find user by token
    const user = await User.findById(decodedToken.userId);
    if (!user || !user.isNewUser) {
      return handleResponse(res, 404, "User not found or not a new user.");
    }

    // Check if mobile number is already in use (by another user)
    // const existingMobile = await User.findOne({
    //   mobile_number: body.mobile_number,
    //   _id: { $ne: user._id }, // Exclude current user
    // });

    // if (existingMobile) {
    //   return handleResponse(res, 400, "Mobile number already in use.");
    // }

    // Assign fields
    assignUserFields(user, body, req);

    // If location coordinates are set, fetch place name
    if (
      user.location &&
      user.location.coordinates &&
      user.location.coordinates.length === 2
    ) {
      const [lng, lat] = user.location.coordinates;

      if (
        !user.location.place_name ||
        user.location.place_name === "Location not set"
      ) {
        // ✅ placeData is a string like "Rau Tahsil"
        const placeData = await getPlaceName(lat, lng);
        console.log("Fetched City:", placeData);

        user.location.place_name = placeData || "Unknown";
      }
    }

    // app/controllers/user.js
    if (!req.convertedFiles?.images || req.convertedFiles.images.length === 0) {
      return handleResponse(res, 400, "At least one image is required for profile completion.");
    }

    await user.save();

    // Generate and return new token
    const updatedToken = generateToken(user._id, user.email);
    return handleResponse(
      res,
      201,
      "Email verified and registration complete.",
      {
        token: updatedToken,
        ...user.toObject(),
      }
    );
  } catch (error) {
    console.error("Complete Registration error:", error);
    return handleResponse(res, 500, "Something went wrong.", {
      error: error.message,
    });
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

      return handleResponse(
        res,
        200,
        "OTP sent to your email. Please verify OTP to log in."
      );
    }

    const newUser = new User({
      email,
      otp,
      isVerified: false,
      isNewUser: true,
    });

    await sendOTPEmail(email, otp);
    await newUser.save();

    return handleResponse(res, 200, "OTP sent to your email for verification.");
  } catch (error) {
    console.error("OTP email error : ", error);
    if (error.code === 11000) {
      return handleResponse(
        res,
        400,
        "This email is already registered. Please log in instead."
      );
    }
    return handleResponse(res, 500, "Something went wrong. Please try again.");
  }
};

const loginUserWithOTP = async (req, res) => {
  const { email, otp } = req.body;

  let user = await User.findOne({ email });

  if (!user) {
    return handleResponse(res, 404, "Email not found.");
  }

  if (user.otp !== otp) {
    return handleResponse(res, 400, "Invalid OTP. Please try again.");
  }

  // If user is new, mark them as verified and provide the token
  if (user.isNewUser) {
    user.isVerified = true;
    user.otp = "";
    await user.save();

    const token = generateToken(user._id, user.email);

    return handleResponse(res, 200, "Logged in successfully and verified as new user.",
        { token,  id: user._id, isNewUser: user.isNewUser }
    );
  }

  user.otp = "";
  await user.save();

  const token = generateToken(user._id, user.email);

  return handleResponse(res, 200, "Logged in successfully via OTP.", {
    token,
    id: user._id, 
    isNewUser: user.isNewUser,
  });
};

const me = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select("-otp -__v");

    if (!user) {
      return handleResponse(res, 404, "User not found.");
    }

    const userObj = user.toObject();

    if (userObj.date_of_birth) {
      userObj.date_of_birth = formatDate(userObj.date_of_birth);
    }

    // Set location as human-readable place_name
    if (userObj.location && userObj.location.place_name) {
      userObj.location = userObj.location.place_name;
    } else {
      userObj.location = "Location not set";
    }

    return handleResponse(res, 200, "User details fetched successfully.", userObj );
  } catch (error) {
    console.error("Error in getUserDetails:", error);
    return handleResponse(res, 500, "Something went wrong.");
  }
};

const getUserDetailsByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    const currentUser = await User.findById(currentUserId);
    if (!currentUser || !currentUser.isVerified) {
      return handleResponse(res, 404, "User not found or not verified.");
    }

    const { location, preferred_match_distance, show_me } = currentUser;

    if (
      !location ||
      !location.coordinates ||
      location.coordinates.length !== 2
    ) {
      return handleResponse(res, 400, "User location not set.");
    }

    const maxDistance = (preferred_match_distance || 50) * 1000; // km → meters

    const pipeline = [
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: location.coordinates,
          },
          distanceField: "distance",
          spherical: true,
          maxDistance: maxDistance,
          query: {
            _id: new mongoose.Types.ObjectId(userId),
            isVerified: true,
          },
        },
      },
      {
        $project: {
          otp: 0,
          isNewUser: 0,
          __v: 0,
          createdAt: 0,
          updatedAt: 0,
          profileCompleteness: 0,
        },
      },
    ];

    const results = await User.aggregate(pipeline);
    if (!results.length) {
      return handleResponse(res, 404, "User not found or outside range.");
    }

    const requestedUser = results[0];

    // Convert distance to km
    requestedUser.distance = (requestedUser.distance / 1000).toFixed(2);

    // Format DOB
    if (requestedUser.date_of_birth) {
      requestedUser.date_of_birth = formatDate(requestedUser.date_of_birth);
    }

    // Add human-readable location name
    if (
      requestedUser.location &&
      requestedUser.location.coordinates &&
      requestedUser.location.coordinates.length === 2
    ) {
      const [lng, lat] = requestedUser.location.coordinates;
      requestedUser.location = await getPlaceName(lat, lng);
    } else {
      requestedUser.location = "Location not set";
    }

    return handleResponse(
      res,
      200,
      "User details fetched successfully.",
      requestedUser
    );
  } catch (error) {
    console.error("Error in getUserDetailsByUserId:", error);
    return handleResponse(res, 500, "Something went wrong.");
  }
};

const getUsers = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const { page = 1, perPage = 7, q,
      gender, sexual_orientation, show_me, minAge, maxAge, preferred_match_distance, height, hasPets, interests, lat, lng,
      smoking, drinking, diet, hasKids, wantsKids, relationshipGoals, body_type, religion, caste, profession, education,
     } = req.query;

    const skip = (Number(page) - 1) * Number(perPage);

    const blockedUsers = await Block.find({ userId: currentUserId }).select(
      "targetUserId"
    );
    const blockedUserIds = blockedUsers.map((b) => b.targetUserId);

    const reportedUsers = await Report.find({
      reporterId: currentUserId,
    }).select("reportedUserId");
    const reportedUserIds = reportedUsers.map((r) => r.reportedUserId);

    const currentUser = await User.findById(currentUserId);
    if (!currentUser || !currentUser.isVerified) {
      return handleResponse(res, 404, "User not found or not verified.");
    }

    const matchStage = {
      _id: {
        $ne: currentUser._id,
        $nin: [...blockedUserIds, ...reportedUserIds],
      },
      isVerified: true,
    };

    if (gender) {
      matchStage.gender = gender.toLowerCase();
    } else if (show_me) {
      if (show_me.toLowerCase() === "men") matchStage.gender = "male";
      else if (show_me.toLowerCase() === "women") matchStage.gender = "female";
    } else if (currentUser.show_me) {
      if (currentUser.show_me.toLowerCase() === "men")
        matchStage.gender = "male";
      else if (currentUser.show_me.toLowerCase() === "women")
        matchStage.gender = "female";
    }

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

    const multiValue = (val) =>
      typeof val === "string" && val.includes(",")
        ? val.split(",").map((v) => v.trim())
        : val
        ? [val]
        : [];

    const multiValueFilters = {
      sexual_orientation, smoking, drinking, diet, hasKids, wantsKids, relationshipGoals, body_type, religion,
      caste, profession, education };

    for (const [key, val] of Object.entries(multiValueFilters)) {
      const arr = multiValue(val);
      if (arr.length > 0) {
        matchStage[key] = { $in: arr.map((v) => new RegExp(`^${v}$`, "i")) };
      }
    }

    if (height) matchStage.height = { $lte: Number(height) };

    if (hasPets !== undefined) matchStage.hasPets = hasPets === "true";

    if (minAge || maxAge) {
      const today = new Date();
      const minDOB = maxAge ? new Date(today.getFullYear() - Number(maxAge), today.getMonth(), today.getDate()) : null;
      const maxDOB = minAge ? new Date(today.getFullYear() - Number(minAge), today.getMonth(), today.getDate()) : null;

      matchStage.date_of_birth = {};
      if (minDOB) matchStage.date_of_birth.$gte = minDOB;
      if (maxDOB) matchStage.date_of_birth.$lte = maxDOB;
    }

    if (interests) {
      const interestArray = interests.split(",").map((i) => i.trim().toLowerCase());
      matchStage.interest = { $in: interestArray };
    }

    const userLat = lat ? parseFloat(lat) : currentUser.location?.coordinates[1];
    const userLng = lng ? parseFloat(lng) : currentUser.location?.coordinates[0];
    const maxDistance = preferred_match_distance ? Number(preferred_match_distance) * 1000 : (currentUser.preferred_match_distance || 50) * 1000;

    if (!userLat || !userLng) {
      return handleResponse(res, 400, "User location not set properly.");
    }

    const pipeline = [
      {
        $geoNear: {
          near: { type: "Point", coordinates: [userLng, userLat] },
          distanceField: "distance",
          maxDistance: maxDistance,
          spherical: true,
          query: matchStage,
        },
      },
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
          preferred_match_distance: 0,
          profileCompleteness: 0,
          age_range: 0,
          randomSort: 0,
          createdAt: 0,
          updatedAt: 0,
        },
      },
    ];

    let users = await User.aggregate(pipeline);

    for (let user of users) {
      if (user.date_of_birth)
        user.date_of_birth = formatDate(user.date_of_birth);
      if (user.distance) user.distance = (user.distance / 1000).toFixed(2); // km
      if (user.location?.coordinates?.length === 2) {
        const [lon, lat] = user.location.coordinates;
        // user.location = await getPlaceName(lat, lon);
        user.location =
          user.location?.city || user.location?.place_name || "Unknown";
      } else {
        user.location = "Unknown location";
      }

      if (currentUser.gender === "male" && user.gender === "female") {
        user.name = user.name.charAt(0) + "";
      }
    }

    const countPipeline = [
      {
        $geoNear: {
          near: { type: "Point", coordinates: [userLng, userLat] },
          distanceField: "distance",
          maxDistance: maxDistance,
          spherical: true,
          query: matchStage,
        },
      },
      { $count: "total" },
    ];

    const countResult = await User.aggregate(countPipeline);
    const totalItems = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalItems / perPage);

    return handleResponse(res, 200, "Users fetched successfully.", {
      results: users,
      totalItems,
      currentPage: Number(page),
      totalPages,
      totalItemsOnCurrentPage: users.length,
    });
  } catch (error) {
    console.error("Error in getUsers:", error);
    return handleResponse(res, 500, "Something went wrong.");
  }
};

const updateProfile = async (req, res) => {
  try {
    const body = { ...req.body };

    const { error } = updateProfileValidator.validate(body);
    if (error) {
      const cleanMessage = error.details[0].message.replace(/\"/g, "");
      return handleResponse(res, 400, cleanMessage);
    }

    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token)
      return handleResponse(res, 401, "Authorization token required.");

    let decodedToken;
    try {
      decodedToken = jwt.verify(
        token,
        process.env.JWT_SECRET || "your-secret-key"
      );
    } catch (err) {
      return handleResponse(res, 400, "Invalid or expired token.");
    }

    const user = await User.findById(decodedToken.userId);
    if (!user || !user.isVerified) {
      return handleResponse(res, 404, "User not found or not verified.");
    }

    // Sirf un fields ko update karo jo request me hain
    if (body.fullName !== undefined) user.name = body.fullName;
    if (body.dob !== undefined)
      user.date_of_birth = parseDateDMY(body.dob) || user.date_of_birth;
    if (body.gender !== undefined) user.gender = body.gender;
    if (body.sexual_orientation !== undefined)
      user.sexual_orientation = body.sexual_orientation;
    if (body.location !== undefined)
      user.location = parseLocation(body.location) || user.location;
    if (body.preferred_match_distance !== undefined)
      user.preferred_match_distance = body.preferred_match_distance;
    if (body.show_me !== undefined) user.show_me = body.show_me;
    if (body.age_range !== undefined)
      user.age_range = normalizeAgeRange(body.age_range) || user.age_range;
    if (body.height !== undefined)
      user.height = body.height ? parseInt(body.height) : user.height;
    if (body.body_type !== undefined) user.body_type = body.body_type;
    if (body.education !== undefined) user.education = body.education;
    if (body.profession !== undefined) user.profession = body.profession;
    if (body.bio !== undefined) user.bio = body.bio;
    if (body.interest !== undefined)
      user.interest = normalizeInterest(body.interest) || user.interest;
    if (body.smoking !== undefined) user.smoking = body.smoking;
    if (body.drinking !== undefined) user.drinking = body.drinking;
    if (body.diet !== undefined) user.diet = body.diet;
    if (body.religion !== undefined) user.religion = body.religion;
    if (body.caste !== undefined) user.caste = body.caste;
    if (body.hasKids !== undefined) user.hasKids = body.hasKids;
    if (body.wantsKids !== undefined) user.wantsKids = body.wantsKids;
    if (body.hasPets !== undefined)
      user.hasPets = body.hasPets === "true" || body.hasPets === true;
    if (body.relationshipGoals !== undefined)
      user.relationshipGoals = body.relationshipGoals;
    if (body.mobile_number !== undefined)
      user.mobile_number = body.mobile_number;
    // if (req.convertedFiles?.images !== undefined)
    //   user.images = req.convertedFiles.images || user.images;
    if (req.convertedFiles?.images && Array.isArray(req.convertedFiles.images) && req.convertedFiles.images.length > 0) 
      {  user.images = req.convertedFiles.images ; }

    user.profileCompleteness = calculateProfileCompleteness(user);

     if (
      user.location &&
      user.location.coordinates &&
      user.location.coordinates.length === 2
    ) {
      const [lng, lat] = user.location.coordinates;

      if (
        !user.location.place_name ||
        user.location.place_name === "Location not set"
      ) {
        const placeData = await getPlaceName(lat, lng);
        console.log("Fetched Cities :", placeData);

        user.location.place_name = placeData || "Unknown";
      }
    }
    await user.save();

    const updatedToken = generateToken(user._id, user.email);
    return handleResponse(res, 200, "Profile updated successfully.", {
      token: updatedToken,
      ...user.toObject(),
    });
  } catch (error) {
    console.error("Update Profile error:", error);
    return handleResponse(res, 500, "Something went wrong.", {
      error: error.message,
    });
  }
};

export const user = {
  verifyEmailForOTP,
  completeRegistrationAfterEmailVerification,
  loginUserWithOTP,
  me,
  getUserDetailsByUserId,
  getUsers,
  updateProfile,
};
