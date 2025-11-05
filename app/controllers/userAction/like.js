// controllers/userAction/like.js
import mongoose from "mongoose";
import { User } from "../../models/user.js";
import { Like } from "../../models/userAction/like.js";
import { handleResponse } from "../../utils/helper.js";
import { formatDate } from "../../utils/dateFormatter.js"; 
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

/*
//gettign lat long in reposen
const getUsersWhoLikedMe = async (req, res) => {
  try {
    const userId = req.user.id; // logged-in user

    let { page = 0, limit = 20 } = req.query;

    // Convert to numbers and validate
    page = Number(page);
    limit = Number(limit);
    if (isNaN(page) || page < 0) page = 0;
    if (isNaN(limit) || limit <= 0) limit = 20;

    const skip = page * limit;

    // Fetch likes where logged-in user is the target
    const likes = await Like.find({ targetUserId: userId })
      .populate("userId", "name email date_of_birth location images") // populate users who liked me
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }); // latest likes first

    // Map users and format date_of_birth
    const usersWhoLikedMe = likes.map((like) => {
      const user = like.userId.toObject(); // convert Mongoose doc to plain object
      if (user.date_of_birth) {
        user.date_of_birth = formatDate(user.date_of_birth);
      }
      return user;
    });

    // Get total count for pagination
    const totalItems = await Like.countDocuments({ targetUserId: userId });

    return handleResponse(res, 200, "Users who liked you fetched successfully", {
      results: usersWhoLikedMe,
      totalItems,
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
    });
  } catch (error) {
    console.error("Error Getting Users Who Liked Me", error);
    return handleResponse(res, 500, "Internal Server Error or Something Went Wrong.");
  }
};
*/

//location name get in repopsen by using lat long, time consuming
const getUsersWhoLikedMe = async (req, res) => {
  try {
    const userId = req.user.id; // logged-in user

    let { page = 0, limit = 20 } = req.query;

    // Convert to numbers and validate
    page = Number(page);
    limit = Number(limit);
    if (isNaN(page) || page < 0) page = 0;
    if (isNaN(limit) || limit <= 0) limit = 20;

    const skip = page * limit;

    // Fetch likes where logged-in user is the target
    const likes = await Like.find({ targetUserId: userId })
      .populate(
        "userId",
        "name email date_of_birth location images sexual_orientation show_me preferred_match_distance height body_type education profession bio interest smoking drinking diet religion caste hasKids wantsKids hasPets relationshipGoals lastActiveAt gender mobile_number"
      )
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }); // latest likes first

    // Map users and format fields
    const usersWhoLikedMe = await Promise.all(
      likes.map(async (like) => {
        const user = like.userId.toObject(); // convert Mongoose doc to plain object

        // Format date_of_birth
        if (user.date_of_birth) user.date_of_birth = formatDate(user.date_of_birth);

        // Replace location with place name
        if (user.location && user.location.coordinates && user.location.coordinates.length === 2) {
          const [lng, lat] = user.location.coordinates;
          user.location = await getPlaceName(lat, lng); // async reverse geocoding
        } else {
          user.location = "Location not set";
        }

        return user;
      })
    );

    // Get total count for pagination
    const totalItems = await Like.countDocuments({ targetUserId: userId });

    return handleResponse(res, 200, "Users who liked you fetched successfully", {
      results: usersWhoLikedMe,
      totalItems,
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
      totalItemsOnCurrentPage: usersWhoLikedMe.length,
    });
  } catch (error) {
    console.error("Error Getting Users Who Liked Me", error);
    return handleResponse(res, 500, "Internal Server Error or Something Went Wrong.");
  }
};

export const likes = {
  likeUser,
  getAllLikedUsers,
  getUsersWhoLikedMe
};