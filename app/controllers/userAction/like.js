// controllers/userAction/like.js
import mongoose from "mongoose";
import { User } from "../../models/user.js";
import { Like } from "../../models/userAction/like.js";
import { calculateAge, handleResponse } from "../../utils/helper.js";
import { getPlaceName } from "../../services/locationService.js";
import { connectedUsers } from "../../utils/socketHandler.js";
import { Message } from "../../models/chat/message.js";
import { canPerformAction, getUserPlan, incrementActionUsage } from "../../services/planService.js";

/*
//without sockets
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
*/

/*
//with sockets but not plans 
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

    const like = await Like.findOneAndUpdate(
      { userId, targetUserId },
      { $setOnInsert: { createdAt: new Date() } },
      { upsert: true, new: true }
    );

    // 🔥 SOCKET EVENT — notify target in real-time
    const isMutual = await Like.exists({
      userId: targetUserId,
      targetUserId: userId,
    });

    const io = req.io;
    // const { connectedUsers } = await import("../../utils/socketHandler.js");

    const targetSocketId = connectedUsers.get(targetUserId.toString());
    if (targetSocketId && io) {
      io.to(targetSocketId).emit("liked-you", {
        userId,
        isMutual,
      });
    }

    // If mutual, notify both users
    if (isMutual) {
      const userSocketId = connectedUsers.get(userId.toString());
      if (userSocketId) {
        io.to(userSocketId).emit("mutual-like", { userId: targetUserId });
      }
      if (targetSocketId) {
        io.to(targetSocketId).emit("mutual-like", { userId });
      }
    }

    return handleResponse(res, 201, "User liked successfully.");
  } catch (error) {
    console.error("Error in likeUser:", error);
    return handleResponse(res, 500, "Something went wrong.");
  }
};
*/
//with sockets and plans
const likeUser = async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const userId = req.user.id;

    // 1️⃣ Validate target user ID
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return handleResponse(res, 400, "Invalid target user ID format.");
    }

    // 2️⃣ Prevent self-liking
    if (userId === targetUserId) {
      return handleResponse(res, 400, "You cannot like yourself.");
    }

    // 3️⃣ Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return handleResponse(res, 404, "Target user not found.");
    }

    // 4️⃣ Check if user can perform the LIKE action (plan limit)
    const canLike = await canPerformAction(userId, "LIKE");
    if (!canLike) {
      return handleResponse(res, 403, "You have reached your daily like limit. Upgrade your plan.");
    }

    // 5️⃣ Proceed with like logic
    const like = await Like.findOneAndUpdate(
      { userId, targetUserId },
      { $setOnInsert: { createdAt: new Date() } },
      { upsert: true, new: true }
    );

    // 6️⃣ Increment like usage
    await incrementActionUsage(userId, "LIKE");

    // 7️⃣ SOCKET EVENT — notify target in real-time
    const isMutual = await Like.exists({
      userId: targetUserId,
      targetUserId: userId,
    });
    const io = req.io;
    const targetSocketId = connectedUsers.get(targetUserId.toString());

    if (targetSocketId && io) {
      io.to(targetSocketId).emit("liked-you", {
        userId,
        isMutual,
      });
    }

    // 8️⃣ If mutual, notify both users
    if (isMutual) {
      const userSocketId = connectedUsers.get(userId.toString());
      if (userSocketId) {
        io.to(userSocketId).emit("mutual-like", { userId: targetUserId });
      }
      if (targetSocketId) {
        io.to(targetSocketId).emit("mutual-like", { userId });
      }
    }

    // 9️⃣ Success response
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
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: [
                        "$userId",
                        new mongoose.Types.ObjectId(String(userId)),
                      ],
                    },
                    { $eq: ["$targetUserId", "$$likedUserId"] },
                  ],
                },
              },
            },
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
          distance: 1,
        },
      },
    ]);

    // Format distance and calculate age
    const results = likedUsersWithDistance.map((user) => {
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
        distance: (user.distance / 1000).toFixed(2), //For gettign distance in km
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
    return handleResponse(
      res,
      500,
      "Internal Server Error or Something Went Wrong."
    );
  }
};

/*
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

    const myLikedUserIds = new Set(
      myLikes.map((l) => l.targetUserId.toString())
    );

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
      _id: {
        $in: oneSidedLikeUserIds.map((id) => new mongoose.Types.ObjectId(id)),
      },
      isVerified: true,
    };

    if (minAge || maxAge) {
      const today = new Date();
      const minDOB = maxAge
        ? new Date(
            today.getFullYear() - Number(maxAge),
            today.getMonth(),
            today.getDate()
          )
        : null;
      const maxDOB = minAge
        ? new Date(
            today.getFullYear() - Number(minAge),
            today.getMonth(),
            today.getDate()
          )
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
        location:
          user.location?.coordinates?.length === 2
            ? await getPlaceName(
                user.location.coordinates[1],
                user.location.coordinates[0]
              )
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

    //shivam
    // // Step 1: Get mutual like IDs
    // let mutualLikesIds = myLikedUserIds.filter((id) =>
    //   usersWhoLikedMeIds.includes(id)
    // );

    // // Step 2: Exclude users with an existing chat
    // const existingChats = await Message.find({
    //   participants: userId,
    // }).select("participants");

    // const usersWithChats = new Set();
    // existingChats.forEach((chat) => {
    //   chat.participants.forEach((p) => {
    //     if (p.toString() !== userId) usersWithChats.add(p.toString());
    //   });
    // });

    // // Step 3: Filter out users who already have chats
    // mutualLikesIds = mutualLikesIds.filter((id) => !usersWithChats.has(id));

    //shivam

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
        ? new Date(
            today.getFullYear() - Number(maxAge),
            today.getMonth(),
            today.getDate()
          )
        : null;
      const maxDOB = minAge
        ? new Date(
            today.getFullYear() - Number(minAge),
            today.getMonth(),
            today.getDate()
          )
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
*/

//according to the plan users have
const getUsersWhoLikedMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, perPage = 4, minAge, maxAge } = req.query;

    // 1️⃣ Get user and plan
    const { user, plan } = await getUserPlan(userId);

    // 2️⃣ Check if user can perform this action (plan limit)
    if (plan.dailyWhoLikedMeLimit !== -1 && (user.dailyWhoLikedMeUsed || 0) >= plan.dailyWhoLikedMeLimit) {
      return handleResponse(res, 403, "You have reached your daily 'Who Liked Me' limit. Upgrade your plan.");
    }

    const skip = (Number(page) - 1) * Number(perPage);
    const currentUser = await User.findById(userId);
    if (!currentUser || !currentUser.location?.coordinates) {
      return handleResponse(res, 400, "User location not set.");
    }

    // 3️⃣ Get all users who liked me
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

    // 4️⃣ Find users you already liked (to exclude mutuals)
    const myLikes = await Like.find({
      userId: new mongoose.Types.ObjectId(String(userId)),
    }).select("targetUserId");
    const myLikedUserIds = new Set(myLikes.map((l) => l.targetUserId.toString()));

    // 5️⃣ Filter out mutual likes
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

    // 6️⃣ Build match stage with filters
    const matchStage = {
      _id: {
        $in: oneSidedLikeUserIds.map((id) => new mongoose.Types.ObjectId(id)),
      },
      isVerified: true,
    };

    if (minAge || maxAge) {
      const today = new Date();
      const minDOB = maxAge
        ? new Date(
            today.getFullYear() - Number(maxAge),
            today.getMonth(),
            today.getDate()
          )
        : null;
      const maxDOB = minAge
        ? new Date(
            today.getFullYear() - Number(minAge),
            today.getMonth(),
            today.getDate()
          )
        : null;
      matchStage.date_of_birth = {};
      if (minDOB) matchStage.date_of_birth.$gte = minDOB;
      if (maxDOB) matchStage.date_of_birth.$lte = maxDOB;
    }

    const userLat = currentUser.location.coordinates[1];
    const userLng = currentUser.location.coordinates[0];

    // 7️⃣ Aggregation pipeline
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

    // 8️⃣ Format results
    const formattedResults = [];
    for (const user of usersWhoLikedMe) {
      const formattedUser = {
        _id: user._id,
        name: user.name,
        gender: user.gender,
        age: calculateAge(user.date_of_birth),
        distance: user.distance ? (user.distance / 1000).toFixed(2) : null,
        location:
          user.location?.coordinates?.length === 2
            ? await getPlaceName(
                user.location.coordinates[1],
                user.location.coordinates[0]
              )
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

    // 9️⃣ Enforce FREE plan limit: Only return 2 users per day
    if (plan.name === "FREE") {
      const limitedResults = formattedResults.slice(0, 2);
      return handleResponse(
        res,
        200,
        "Users who liked you fetched successfully.",
        {
          results: limitedResults,
          totalItems: limitedResults.length,
          currentPage: Number(page),
          totalPages: 1,
          totalItemsOnCurrentPage: limitedResults.length,
        }
      );
    }

    // 10️⃣ Increment daily usage
    await incrementActionUsage(userId, "WHO_LIKED_ME");

    // 11️⃣ Count total
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

//according to the plan users have
const getMutualLikes = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, perPage = 4, minAge, maxAge } = req.query;

    // 1️⃣ Get user and plan
    const { user, plan } = await getUserPlan(userId);

    // 2️⃣ Check if user can perform this action (plan limit)
    if (plan.dailyWhoLikedMeLimit !== -1 && (user.dailyWhoLikedMeUsed || 0) >= plan.dailyWhoLikedMeLimit) {
      return handleResponse(
        res,
        403,
        "You have reached your daily 'Who Liked Me' limit. Upgrade your plan."
      );
    }

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
        ? new Date(
            today.getFullYear() - Number(maxAge),
            today.getMonth(),
            today.getDate()
          )
        : null;
      const maxDOB = minAge
        ? new Date(
            today.getFullYear() - Number(minAge),
            today.getMonth(),
            today.getDate()
          )
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

    // 3️⃣ Enforce FREE plan limit: Only return 2 users per day
    if (plan.name === "FREE") {
      const limitedResults = mutualLikes.slice(0, 2);
      return handleResponse(res, 200, "Mutual likes fetched successfully.", {
        results: limitedResults,
        totalItems: limitedResults.length,
        currentPage: Number(page),
        totalPages: 1,
        totalItemsOnCurrentPage: limitedResults.length,
      });
    }

    // 4️⃣ Increment daily usage
    await incrementActionUsage(userId, "WHO_LIKED_ME");

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
  getMutualLikes,
};
