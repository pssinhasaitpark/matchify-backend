// controllers/userAction/like.js
import mongoose from "mongoose";
import { User } from "../../models/user.js";
import { Like } from "../../models/userAction/like.js";
import { calculateAge, handleResponse } from "../../utils/helper.js";
import { getPlaceName } from "../../services/locationService.js";

const likeUser = async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return handleResponse(res, 400, "Invalid target user ID format.");
    }
    if (userId === targetUserId) {
      return handleResponse(res, 400, "You cannot like yourself.");
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return handleResponse(res, 404, "Target user not found.");
    }

    await Like.findOneAndUpdate(
      { userId, targetUserId },
      { $setOnInsert: { createdAt: new Date() } },
      { upsert: true, new: true }
    );

    return handleResponse(res, 201, "User liked successfully.");
  } catch (error) {
    console.error("Error in likeUser:", error);
    return handleResponse(res, 500, "Something went wrong.");
  }
};

const getAllLikedUsers = async (req, res) => {
  try {
    const userId = req.user.id;

    const currentUser = await User.findById(userId);
    if (!currentUser || !currentUser.location) {
      return handleResponse(res, 400, "User location not found.");
    }

    let { page = 0, limit = 20 } = req.query;
    page = Number(page);
    limit = Number(limit);
    if (isNaN(page) || page < 0) page = 0;
    if (isNaN(limit) || limit <= 0) limit = 20;
    const skip = page * limit;

    // Aggregate on users with geoNear first
    const likedUsersWithDistance = await User.aggregate([
      {
        $geoNear: {
          near: currentUser.location,
          distanceField: "distance",
          spherical: true,
        },
      },
      {
        $lookup: {
          from: "likes",
          let: { likedUserId: "$_id" },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ["$userId", new mongoose.Types.ObjectId(String(userId))] },
              { $eq: ["$targetUserId", "$$likedUserId"] }
            ]}}},
          ],
          as: "likeInfo",
        },
      },
      {
        $match: {
          likeInfo: { $ne: [] },
        },
      },
      { $sort: { "likeInfo.createdAt": -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          name: 1,
          gender: 1,
          mobile_number: 1,
          date_of_birth: 1,
          distance: 1
        },
      },
    ]);

    // Format distance and calculate age
   const results = likedUsersWithDistance.map(user => {
  const today = new Date();
  const dob = new Date(user.date_of_birth);
  let age = today.getFullYear() - dob.getFullYear(); // <-- let instead of const
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--; // now safe
  }

  return {
    _id: user._id,
    name: user.name,
    gender: user.gender,
    mobile_number: user.mobile_number,
    age: age.toString(),
    // distance: (user.distance / 1609.34).toFixed(2), //For gettign distance in miles
    distance: (user.distance / 1000).toFixed(2),    //For gettign distance in km

  };
});


    const totalItems = await Like.countDocuments({ userId });

    return handleResponse(res, 200, "Liked users fetched successfully", {
      results,
      totalItems,
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
    });
  } catch (error) {
    console.error("Error Getting Liked Users", error);
    return handleResponse(res, 500, "Internal Server Error or Something Went Wrong.");
  }
};

const getUsersWhoLikedMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, perPage = 4, minAge, maxAge } = req.query;
    const skip = (Number(page) - 1) * Number(perPage);

    const currentUser = await User.findById(userId);
    if (!currentUser || !currentUser.location?.coordinates) {
      return handleResponse(res, 400, "User location not set.");
    }

    // 1️⃣ Get all users who liked me
    const likes = await Like.find({
      targetUserId: new mongoose.Types.ObjectId(String(userId)),
    }).select("userId createdAt");

    if (!likes.length) {
      return handleResponse(res, 200, "No users liked you yet.", {
        results: [],
        totalItems: 0,
        currentPage: Number(page),
        totalPages: 0,
      });
    }

    const usersWhoLikedMeIds = likes.map((l) => l.userId);
    const userLikeTimeMap = {};
    likes.forEach((l) => {
      userLikeTimeMap[l.userId.toString()] = l.createdAt;
    });

    // 2️⃣ Find users you already liked (to exclude mutuals)
    const myLikes = await Like.find({
      userId: new mongoose.Types.ObjectId(String(userId)),
    }).select("targetUserId");

    const myLikedUserIds = new Set(myLikes.map((l) => l.targetUserId.toString()));

    // 3️⃣ Filter out mutual likes
    const oneSidedLikeUserIds = usersWhoLikedMeIds.filter(
      (id) => !myLikedUserIds.has(id.toString())
    );

    if (!oneSidedLikeUserIds.length) {
      return handleResponse(res, 200, "No one-sided likes found.", {
        results: [],
        totalItems: 0,
        currentPage: Number(page),
        totalPages: 0,
      });
    }

    // 4️⃣ Build match stage with filters
    const matchStage = {
      _id: { $in: oneSidedLikeUserIds.map((id) => new mongoose.Types.ObjectId(id)) },
      isVerified: true,
    };

    if (minAge || maxAge) {
      const today = new Date();
      const minDOB = maxAge
        ? new Date(today.getFullYear() - Number(maxAge), today.getMonth(), today.getDate())
        : null;
      const maxDOB = minAge
        ? new Date(today.getFullYear() - Number(minAge), today.getMonth(), today.getDate())
        : null;

      matchStage.date_of_birth = {};
      if (minDOB) matchStage.date_of_birth.$gte = minDOB;
      if (maxDOB) matchStage.date_of_birth.$lte = maxDOB;
    }

    const userLat = currentUser.location.coordinates[1];
    const userLng = currentUser.location.coordinates[0];

    // 5️⃣ Aggregation pipeline
    const pipeline = [
      {
        $geoNear: {
          near: { type: "Point", coordinates: [userLng, userLat] },
          distanceField: "distance",
          spherical: true,
          query: matchStage,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: Number(perPage) },
    ];

    let usersWhoLikedMe = await User.aggregate(pipeline);

    // 6️⃣ Format results — filter only required fields
    const formattedResults = [];
    for (const user of usersWhoLikedMe) {
      const formattedUser = {
        _id: user._id,
        name: user.name,
        gender: user.gender,
        age: calculateAge(user.date_of_birth),
        distance: user.distance ? (user.distance / 1000).toFixed(2) : null,
        location: user.location?.coordinates?.length === 2
          ? await getPlaceName(user.location.coordinates[1], user.location.coordinates[0])
          : "Unknown location",
        bio: user.bio,
        height: user.height,
        body_type: user.body_type,
        education: user.education,
        profession: user.profession,
        interest: user.interest,
        religion: user.religion,
        caste: user.caste,
        smoking: user.smoking,
        drinking: user.drinking,
        diet: user.diet,
        hasKids: user.hasKids,
        wantsKids: user.wantsKids,
        hasPets: user.hasPets,
        relationshipGoals: user.relationshipGoals,
        sexual_orientation: user.sexual_orientation,
        preferred_match_distance: user.preferred_match_distance,
        show_me: user.show_me,
        images: user.images,
        lastActiveAt: user.lastActiveAt,
      };

      formattedResults.push(formattedUser);
    }

    // 7️⃣ Count total
    const totalItems = oneSidedLikeUserIds.length;
    const totalPages = Math.ceil(totalItems / perPage);

    // ✅ Final Response
    return handleResponse(
      res,
      200,
      "Users who liked you fetched successfully.",
      {
        results: formattedResults,
        totalItems,
        currentPage: Number(page),
        totalPages,
        totalItemsOnCurrentPage: formattedResults.length,
      }
    );
  } catch (error) {
    console.error("Error in getUsersWhoLikedMe:", error);
    return handleResponse(res, 500, "Something went wrong.");
  }
};

const getMutualLikes = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, perPage = 4, minAge, maxAge } = req.query;
    const skip = (Number(page) - 1) * Number(perPage);

    const currentUser = await User.findById(userId);
    if (!currentUser || !currentUser.location?.coordinates) {
      return handleResponse(res, 400, "User location not set.");
    }

    const usersLikedByMe = await Like.find({
      userId: new mongoose.Types.ObjectId(String(userId)),
    }).select("targetUserId createdAt");

    const usersWhoLikedMe = await Like.find({
      targetUserId: new mongoose.Types.ObjectId(String(userId)),
    }).select("userId createdAt");

    const myLikedUserIds = usersLikedByMe.map((l) => l.targetUserId.toString());
    const usersWhoLikedMeIds = usersWhoLikedMe.map((l) => l.userId.toString());

    const mutualLikesIds = myLikedUserIds.filter((id) => usersWhoLikedMeIds.includes(id));

    if (mutualLikesIds.length === 0) {
      return handleResponse(res, 200, "No mutual likes found.", {
        results: [],
        totalItems: 0,
        currentPage: Number(page),
        totalPages: 0,
      });
    }

    const matchStage = {
      _id: { $in: mutualLikesIds.map((id) => new mongoose.Types.ObjectId(id)) },
      isVerified: true,
    };

    if (minAge || maxAge) {
      const today = new Date();
      const minDOB = maxAge
        ? new Date(today.getFullYear() - Number(maxAge), today.getMonth(), today.getDate())
        : null;
      const maxDOB = minAge
        ? new Date(today.getFullYear() - Number(minAge), today.getMonth(), today.getDate())
        : null;

      matchStage.date_of_birth = {};
      if (minDOB) matchStage.date_of_birth.$gte = minDOB;
      if (maxDOB) matchStage.date_of_birth.$lte = maxDOB;
    }

    const userLat = currentUser.location.coordinates[1];
    const userLng = currentUser.location.coordinates[0];

    const pipeline = [
      {
        $geoNear: {
          near: { type: "Point", coordinates: [userLng, userLat] },
          distanceField: "distance",
          spherical: true,
          query: matchStage,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: Number(perPage) },
      {
        $project: {
          name: 1,
          date_of_birth: 1,
          images: 1,
          location: 1,
          distance: 1,
        },
      },
    ];

    let mutualLikes = await User.aggregate(pipeline);

    for (const user of mutualLikes) {
      user.age = calculateAge(user.date_of_birth);
      delete user.date_of_birth;
      if (user.distance) user.distance = (user.distance / 1000).toFixed(2);
      if (user.location?.coordinates?.length === 2) {
        const [lng, lat] = user.location.coordinates;
        user.location = await getPlaceName(lat, lng);
      } else {
        user.location = "Unknown location";
      }
      user.images = user.images?.[0] || null;
    }

    const totalItems = mutualLikesIds.length;
    const totalPages = Math.ceil(totalItems / perPage);

    return handleResponse(res, 200, "Mutual likes fetched successfully.", {
      results: mutualLikes,
      totalItems,
      currentPage: Number(page),
      totalPages,
      totalItemsOnCurrentPage: mutualLikes.length,
    });
  } catch (error) {
    console.error("Error in getMutualLikes:", error);
    return handleResponse(res, 500, "Something went wrong.");
  }
};

export const likes = {
  likeUser,
  getAllLikedUsers,
  getUsersWhoLikedMe,
  getMutualLikes
};