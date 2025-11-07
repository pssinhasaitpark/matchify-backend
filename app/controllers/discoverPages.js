//app/controllers/discoverPages.js
import { User } from "../models/user.js";
import { Block } from "../models/userAction/block.js";
import { Report } from "../models/userAction/report.js";
import { calculateAge, handleResponse } from "../utils/helper.js";
import { getPlaceName } from "../services/locationService.js";

const getSimilarInterestUsers = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { page = 1, perPage = 6 } = req.query;
    const skip = (page - 1) * perPage;

    // ✅ Blocked + Reported users
    const blockedUsers = await Block.find({ userId: currentUserId }).select("targetUserId");
    const reportedUsers = await Report.find({ reporterId: currentUserId }).select("reportedUserId");
    const blockedIds = blockedUsers.map((b) => b.targetUserId);
    const reportedIds = reportedUsers.map((r) => r.reportedUserId);

    // ✅ Current user
    const currentUser = await User.findById(currentUserId);
    if (!currentUser || !currentUser.isVerified)
      return handleResponse(res, 404, "User not found or not verified.");

    let { show_me, interest } = currentUser;

    // 🩹 Ensure interests are an array
    if (interest && !Array.isArray(interest)) interest = [interest];

    if (!interest || interest.length === 0)
      return handleResponse(res, 400, "No interests found for the current user.");

    // ✅ Gender filter
    let genderFilter = {};
    if (show_me === "men") genderFilter.gender = "male";
    else if (show_me === "women") genderFilter.gender = "female";

    // ✅ Query pipeline (no distance filter now)
    const pipeline = [
      {
        $match: {
          _id: { $ne: currentUser._id, $nin: [...blockedIds, ...reportedIds] },
          isVerified: true,
          interest: { $in: interest },
          ...genderFilter,
        },
      },
      { $addFields: { randomSort: { $rand: {} } } },
      { $sort: { randomSort: 1 } },
      { $skip: skip },
      { $limit: Number(perPage) },
      {
        $project: {
          _id: 1,
          name: 1,
          date_of_birth: 1,
          images: 1,
          interest: 1,
          location: 1,
        },
      },
    ];

    let users = await User.aggregate(pipeline);

    // ✅ Format response
    const formattedUsers = await Promise.all(
      users.map(async (user) => {
        const age = calculateAge(user.date_of_birth);

        let locationName = "Unknown Location";
        if (user.location?.coordinates) {
          const [lon, lat] = user.location.coordinates;
          locationName = await getPlaceName(lat, lon);
        }

        const commonInterest = user.interest.filter((i) => interest.includes(i));

        return {
          id: user._id,
          name: user.name,
          age,
          images: user.images?.[0] || null,
          commonInterest,
          location: locationName,
        };
      })
    );

    // ✅ Count total
    const countPipeline = [
      {
        $match: {
          _id: { $ne: currentUser._id, $nin: [...blockedIds, ...reportedIds] },
          isVerified: true,
          interest: { $in: interest },
          ...genderFilter,
        },
      },
      { $count: "total" },
    ];

    const count = await User.aggregate(countPipeline);
    const totalItems = count[0]?.total || 0;

    return handleResponse(res, 200, "Users with similar interests fetched successfully.", {
      results: formattedUsers,
      totalItems,
      currentPage: Number(page),
      totalPages: Math.ceil(totalItems / perPage),
      totalItemsOnCurrentPage: formattedUsers.length,
    });
  } catch (error) {
    console.error("Error in getSimilarInterestUsers:", error);
    return handleResponse(res, 500, "Something went wrong.");
  }
};

const getAllUsersWithSameDatingGoals = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { page = 1, perPage = 6 } = req.query;
    const skip = (page - 1) * perPage;

    const blockedUsers = await Block.find({ userId: currentUserId }).select("targetUserId");
    const reportedUsers = await Report.find({ reporterId: currentUserId }).select("reportedUserId");
    const blockedIds = blockedUsers.map((b) => b.targetUserId);
    const reportedIds = reportedUsers.map((r) => r.reportedUserId);

    const currentUser = await User.findById(currentUserId);
    if (!currentUser || !currentUser.isVerified)
      return handleResponse(res, 404, "User not found or not verified.");

    let { show_me, relationshipGoals } = currentUser;

    // 🩹 Ensure array
    if (relationshipGoals && !Array.isArray(relationshipGoals))
      relationshipGoals = [relationshipGoals];

    if (!relationshipGoals || relationshipGoals.length === 0)
      return handleResponse(res, 400, "No dating goals found for the current user.");

    let genderFilter = {};
    if (show_me === "men") genderFilter.gender = "male";
    else if (show_me === "women") genderFilter.gender = "female";

    // ✅ Aggregation without distance
    const pipeline = [
      {
        $match: {
          _id: { $ne: currentUser._id, $nin: [...blockedIds, ...reportedIds] },
          isVerified: true,
          relationshipGoals: { $in: relationshipGoals },
          ...genderFilter,
        },
      },
      { $addFields: { randomSort: { $rand: {} } } },
      { $sort: { randomSort: 1 } },
      { $skip: skip },
      { $limit: Number(perPage) },
      {
        $project: {
          _id: 1,
          name: 1,
          date_of_birth: 1,
          images: 1,
          relationshipGoals: 1,
          location: 1,
        },
      },
    ];

    const users = await User.aggregate(pipeline);

    const formattedUsers = await Promise.all(
      users.map(async (user) => {
        const age = user.date_of_birth
          ? Math.floor((Date.now() - new Date(user.date_of_birth)) / (1000 * 60 * 60 * 24 * 365.25))
          : null;

        let locationName = "Unknown Location";
        if (user.location?.coordinates) {
          const [lon, lat] = user.location.coordinates;
          locationName = await getPlaceName(lat, lon);
        }

        let commonRelationshipGoals = null;
        if (user.relationshipGoals) {
          const common = relationshipGoals.filter((goal) =>
            user.relationshipGoals.includes(goal)
          );
          commonRelationshipGoals = common.length > 0 ? common[0] : null;
        }

        return {
          id: user._id,
          name: user.name,
          age,
          images: user.images?.[0] || null,
          commonRelationshipGoals,
          location: locationName,
        };
      })
    );

    // ✅ Count total
    const countPipeline = [
      {
        $match: {
          _id: { $ne: currentUser._id, $nin: [...blockedIds, ...reportedIds] },
          isVerified: true,
          relationshipGoals: { $in: relationshipGoals },
          ...genderFilter,
        },
      },
      { $count: "total" },
    ];

    const count = await User.aggregate(countPipeline);
    const totalItems = count[0]?.total || 0;

    return handleResponse(res, 200, "Users with same dating goals fetched successfully.", {
      results: formattedUsers,
      totalItems,
      currentPage: Number(page),
      totalPages: Math.ceil(totalItems / perPage),
      totalItemsOnCurrentPage: formattedUsers.length,
    });
  } catch (error) {
    console.error("Error in getAllUsersWithSameDatingGoals:", error);
    return handleResponse(res, 500, "Something went wrong.");
  }
};

const getUserWithCommunitiesInCommon = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { page = 1, perPage = 6 } = req.query;
    const skip = (page - 1) * perPage;

    // ✅ Fetch blocked and reported users
    const blockedUsers = await Block.find({ userId: currentUserId }).select("targetUserId");
    const reportedUsers = await Report.find({ reporterId: currentUserId }).select("reportedUserId");
    const blockedIds = blockedUsers.map((b) => b.targetUserId);
    const reportedIds = reportedUsers.map((r) => r.reportedUserId);

    // ✅ Fetch current user
    const currentUser = await User.findById(currentUserId);
    if (!currentUser || !currentUser.isVerified)
      return handleResponse(res, 404, "User not found or not verified.");

    let { show_me, religion } = currentUser;

    // 🩹 Ensure religion is present
    if (!religion)
      return handleResponse(res, 400, "Religion not found for the current user.");

    // ✅ Gender filter
    let genderFilter = {};
    if (show_me === "men") genderFilter.gender = "male";
    else if (show_me === "women") genderFilter.gender = "female";

    // ✅ Aggregation pipeline (no distance)
    const pipeline = [
      {
        $match: {
          _id: { $ne: currentUser._id, $nin: [...blockedIds, ...reportedIds] },
          isVerified: true,
          religion: religion,
          ...genderFilter,
        },
      },
      { $addFields: { randomSort: { $rand: {} } } },
      { $sort: { randomSort: 1 } },
      { $skip: skip },
      { $limit: Number(perPage) },
      {
        $project: {
          _id: 1,
          name: 1,
          date_of_birth: 1,
          images: 1,
          religion: 1,
          location: 1,
        },
      },
    ];

    const users = await User.aggregate(pipeline);

    // ✅ Format result
    const formattedUsers = await Promise.all(
      users.map(async (user) => {
        const age = user.date_of_birth
          ? Math.floor((Date.now() - new Date(user.date_of_birth)) / (1000 * 60 * 60 * 24 * 365.25))
          : null;

        let locationName = "Unknown Location";
        if (user.location?.coordinates) {
          const [lon, lat] = user.location.coordinates;
          locationName = await getPlaceName(lat, lon);
        }

        return {
          id: user._id,
          name: user.name,
          age,
          images: user.images?.[0] || null,
          commonCommunity: user.religion,
          location: locationName,
        };
      })
    );

    // ✅ Count total for pagination
    const countPipeline = [
      {
        $match: {
          _id: { $ne: currentUser._id, $nin: [...blockedIds, ...reportedIds] },
          isVerified: true,
          religion: religion,
          ...genderFilter,
        },
      },
      { $count: "total" },
    ];

    const count = await User.aggregate(countPipeline);
    const totalItems = count[0]?.total || 0;

    return handleResponse(res, 200, "Users with communities in common fetched successfully.", {
      results: formattedUsers,
      totalItems,
      currentPage: Number(page),
      totalPages: Math.ceil(totalItems / perPage),
      totalItemsOnCurrentPage: formattedUsers.length,
    });
  } catch (error) {
    console.error("Error in getUserWithCommunitiesInCommon:", error);
    return handleResponse(res, 500, "Something went wrong.");
  }
};

const getRecommendedUsers = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // 1️⃣ Fetch current user
    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        error: true,
        message: "Current user not found.",
      });
    }

    // 2️⃣ Fetch other users
    const users = await User.find({
      _id: { $ne: currentUserId },
      isVerified: true,
    }).select("name date_of_birth images location interest relationshipGoals religion caste");

    // 3️⃣ Process each user
    const recommendedUsers = users.map((user) => {
      const userInterests = Array.isArray(user.interest) ? user.interest : [];
      const userRelationshipGoal = user.relationshipGoals || "";
      const userCommunities = [user.religion, user.caste].filter(Boolean);

      const currentUserInterests = Array.isArray(currentUser.interest) ? currentUser.interest : [];
      const currentUserRelationshipGoal = currentUser.relationshipGoals || "";
      const currentUserCommunities = [currentUser.religion, currentUser.caste].filter(Boolean);

      // Compare
      const commonInterest = userInterests.filter((i) => currentUserInterests.includes(i));
      const commonRelationshipGoals =
        userRelationshipGoal === currentUserRelationshipGoal ? [userRelationshipGoal] : [];
      const commonCommunities = userCommunities.filter((c) => currentUserCommunities.includes(c));

      const totalCommonCount =
        commonInterest.length +
        commonRelationshipGoals.length +
        commonCommunities.length;

      return {
        _id: user._id,
        name: user.name,
        age: user.date_of_birth ? calculateAge(user.date_of_birth) : null,
        images: user.images || [],
        location: user.location || null,
        commonInterest,
        commonRelationshipGoals,
        commonCommunities,
        totalCommonCount,
      };
    });

    // 4️⃣ Sort by relevance
    const sortedRecommendations = recommendedUsers.sort(
      (a, b) => b.totalCommonCount - a.totalCommonCount
    );

    // 5️⃣ Send response
    res.status(200).json({
      success: true,
      error: false,
      message: "Recommended users fetched successfully.",
      results: sortedRecommendations,
    });
  } catch (error) {
    console.error("Error in getRecommendedUsers:", error);
    res.status(500).json({
      success: false,
      error: true,
      message: "Something went wrong while fetching recommended users.",
    });
  }
};

export const discover = {
  getSimilarInterestUsers,
  getAllUsersWithSameDatingGoals,
  getUserWithCommunitiesInCommon,
  getRecommendedUsers
};






/*
import { User } from "../models/user.js";
import { Block } from "../models/userAction/block.js";
import { Report } from "../models/userAction/report.js";
import { calculateAge, handleResponse } from "../utils/helper.js";
import { getPlaceName } from "../services/locationService.js";

const getSimilarInterestUsers = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { page = 1, perPage = 6 } = req.query;
    const skip = (page - 1) * perPage;

    // ✅ Blocked + Reported users
    const blockedUsers = await Block.find({ userId: currentUserId }).select("targetUserId");
    const reportedUsers = await Report.find({ reporterId: currentUserId }).select("reportedUserId");
    const blockedIds = blockedUsers.map((b) => b.targetUserId);
    const reportedIds = reportedUsers.map((r) => r.reportedUserId);

    // ✅ Current user
    const currentUser = await User.findById(currentUserId);
    if (!currentUser || !currentUser.isVerified)
      return handleResponse(res, 404, "User not found or not verified.");

    let { show_me, preferred_match_distance, location, interest } = currentUser;

    // 🩹 Ensure interests are an array
    if (interest && !Array.isArray(interest)) interest = [interest];

    if (!interest || interest.length === 0)
      return handleResponse(res, 400, "No interests found for the current user.");

    // ✅ Gender filter
    let genderFilter = {};
    if (show_me === "men") genderFilter.gender = "male";
    else if (show_me === "women") genderFilter.gender = "female";

    // ✅ Validate location
    if (!location?.coordinates || location.coordinates.length !== 2)
      return handleResponse(res, 400, "User location is not set properly.");

    const distanceInMeters = (preferred_match_distance || 50) * 1000;

    // ✅ Query pipeline
    const pipeline = [
      {
        $geoNear: {
          near: { type: "Point", coordinates: location.coordinates },
          distanceField: "distance",
          maxDistance: distanceInMeters,
          spherical: true,
          query: {
            _id: { $ne: currentUser._id, $nin: [...blockedIds, ...reportedIds] },
            isVerified: true,
            interest: { $in: interest },
            ...genderFilter,
          },
        },
      },
      { $addFields: { randomSort: { $rand: {} } } },
      { $sort: { randomSort: 1 } },
      { $skip: skip },
      { $limit: Number(perPage) },
      {
        $project: {
          _id: 1,
          name: 1,
          date_of_birth: 1,
          images: 1,
          interest: 1,
          distance: 1,
          location: 1,
        },
      },
    ];

    let users = await User.aggregate(pipeline);

    // ✅ Format response
    const formattedUsers = await Promise.all(
      users.map(async (user) => {
        const age = calculateAge(user.date_of_birth);

        const distance = user.distance ? (user.distance / 1000).toFixed(2) : null;

        let locationName = "Unknown Location";
        if (user.location?.coordinates) {
          const [lon, lat] = user.location.coordinates;
          locationName = await getPlaceName(lat, lon);
        }

        const commonInterest = user.interest.filter((i) => interest.includes(i));

        return {
          id: user._id,
          name: user.name,
          age,
          images: user.images?.[0] || null,
          commonInterest,
          distance,
          location: locationName,
        };
      })
    );

    // ✅ Count total
    const countPipeline = [
      {
        $geoNear: {
          near: { type: "Point", coordinates: location.coordinates },
          distanceField: "distance",
          maxDistance: distanceInMeters,
          spherical: true,
          query: {
            _id: { $ne: currentUser._id, $nin: [...blockedIds, ...reportedIds] },
            isVerified: true,
            interest: { $in: interest },
            ...genderFilter,
          },
        },
      },
      { $count: "total" },
    ];

    const count = await User.aggregate(countPipeline);
    const totalItems = count[0]?.total || 0;

    return handleResponse(res, 200, "Users with similar interests fetched successfully.", {
      results: formattedUsers,
      totalItems,
      currentPage: Number(page),
      totalPages: Math.ceil(totalItems / perPage),
      totalItemsOnCurrentPage: formattedUsers.length,
    });
  } catch (error) {
    console.error("Error in getSimilarInterestUsers:", error);
    return handleResponse(res, 500, "Something went wrong.");
  }
};

const getAllUsersWithSameDatingGoals = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { page = 1, perPage = 6 } = req.query;
    const skip = (page - 1) * perPage;

    const blockedUsers = await Block.find({ userId: currentUserId }).select("targetUserId");
    const reportedUsers = await Report.find({ reporterId: currentUserId }).select("reportedUserId");
    const blockedIds = blockedUsers.map((b) => b.targetUserId);
    const reportedIds = reportedUsers.map((r) => r.reportedUserId);

    const currentUser = await User.findById(currentUserId);
    if (!currentUser || !currentUser.isVerified)
      return handleResponse(res, 404, "User not found or not verified.");

    let { show_me, preferred_match_distance, location, relationshipGoals } = currentUser;

    // 🩹 Ensure array
    if (relationshipGoals && !Array.isArray(relationshipGoals))
      relationshipGoals = [relationshipGoals];

    if (!relationshipGoals || relationshipGoals.length === 0)
      return handleResponse(res, 400, "No dating goals found for the current user.");

    let genderFilter = {};
    if (show_me === "men") genderFilter.gender = "male";
    else if (show_me === "women") genderFilter.gender = "female";

    if (!location?.coordinates || location.coordinates.length !== 2)
      return handleResponse(res, 400, "User location is not set properly.");

    const distanceInMeters = (preferred_match_distance || 50) * 1000;

    // ✅ Aggregation
    const pipeline = [
      {
        $geoNear: {
          near: { type: "Point", coordinates: location.coordinates },
          distanceField: "distance",
          maxDistance: distanceInMeters,
          spherical: true,
          query: {
            _id: { $ne: currentUser._id, $nin: [...blockedIds, ...reportedIds] },
            isVerified: true,
            relationshipGoals: { $in: relationshipGoals },
            ...genderFilter,
          },
        },
      },
      { $addFields: { randomSort: { $rand: {} } } },
      { $sort: { randomSort: 1 } },
      { $skip: skip },
      { $limit: Number(perPage) },
      {
        $project: {
          _id: 1,
          name: 1,
          date_of_birth: 1,
          images: 1,
          relationshipGoals: 1,
          distance: 1,
          location: 1,
        },
      },
    ];

    const users = await User.aggregate(pipeline);

    const formattedUsers = await Promise.all(
      users.map(async (user) => {
        const age = user.date_of_birth
          ? Math.floor((Date.now() - new Date(user.date_of_birth)) / (1000 * 60 * 60 * 24 * 365.25))
          : null;

        const distance = user.distance ? (user.distance / 1000).toFixed(2) : null;

        let locationName = "Unknown Location";
        if (user.location?.coordinates) {
          const [lon, lat] = user.location.coordinates;
          locationName = await getPlaceName(lat, lon);
        }

        let commonRelationshipGoals = null;
        if (user.relationshipGoals) {
          const common = relationshipGoals.filter((goal) =>
            user.relationshipGoals.includes(goal)
          );
          commonRelationshipGoals = common.length > 0 ? common[0] : null;
        }

        return {
          id: user._id,
          name: user.name,
          age,
          images: user.images?.[0] || null,
          commonRelationshipGoals,
          distance,
          location: locationName,
        };
      })
    );

    // ✅ Count total
    const countPipeline = [
      {
        $geoNear: {
          near: { type: "Point", coordinates: location.coordinates },
          distanceField: "distance",
          maxDistance: distanceInMeters,
          spherical: true,
          query: {
            _id: { $ne: currentUser._id, $nin: [...blockedIds, ...reportedIds] },
            isVerified: true,
            relationshipGoals: { $in: relationshipGoals },
            ...genderFilter,
          },
        },
      },
      { $count: "total" },
    ];

    const count = await User.aggregate(countPipeline);
    const totalItems = count[0]?.total || 0;

    return handleResponse(res, 200, "Users with same dating goals fetched successfully.", {
      results: formattedUsers,
      totalItems,
      currentPage: Number(page),
      totalPages: Math.ceil(totalItems / perPage),
      totalItemsOnCurrentPage: formattedUsers.length,
    });
  } catch (error) {
    console.error("Error in getAllUsersWithSameDatingGoals:", error);
    return handleResponse(res, 500, "Something went wrong.");
  }
};

const getUserWithCommunitiesInCommon = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { page = 1, perPage = 6 } = req.query;
    const skip = (page - 1) * perPage;

    // ✅ Fetch blocked and reported users
    const blockedUsers = await Block.find({ userId: currentUserId }).select("targetUserId");
    const reportedUsers = await Report.find({ reporterId: currentUserId }).select("reportedUserId");
    const blockedIds = blockedUsers.map((b) => b.targetUserId);
    const reportedIds = reportedUsers.map((r) => r.reportedUserId);

    // ✅ Fetch current user
    const currentUser = await User.findById(currentUserId);
    if (!currentUser || !currentUser.isVerified)
      return handleResponse(res, 404, "User not found or not verified.");

    let { show_me, preferred_match_distance, location, religion } = currentUser;

    // 🩹 Ensure religion is present
    if (!religion)
      return handleResponse(res, 400, "Religion not found for the current user.");

    // ✅ Gender filter
    let genderFilter = {};
    if (show_me === "men") genderFilter.gender = "male";
    else if (show_me === "women") genderFilter.gender = "female";

    // ✅ Location validation
    if (!location?.coordinates || location.coordinates.length !== 2)
      return handleResponse(res, 400, "User location is not set properly.");

    const distanceInMeters = (preferred_match_distance || 50) * 1000;

    // ✅ Aggregation pipeline
    const pipeline = [
      {
        $geoNear: {
          near: { type: "Point", coordinates: location.coordinates },
          distanceField: "distance",
          maxDistance: distanceInMeters,
          spherical: true,
          query: {
            _id: { $ne: currentUser._id, $nin: [...blockedIds, ...reportedIds] },
            isVerified: true,
            religion: religion, // ✅ Match same religion
            ...genderFilter,
          },
        },
      },
      { $addFields: { randomSort: { $rand: {} } } },
      { $sort: { randomSort: 1 } },
      { $skip: skip },
      { $limit: Number(perPage) },
      {
        $project: {
          _id: 1,
          name: 1,
          date_of_birth: 1,
          images: 1,
          religion: 1,
          distance: 1,
          location: 1,
        },
      },
    ];

    const users = await User.aggregate(pipeline);

    // ✅ Format result
    const formattedUsers = await Promise.all(
      users.map(async (user) => {
        const age = user.date_of_birth
          ? Math.floor((Date.now() - new Date(user.date_of_birth)) / (1000 * 60 * 60 * 24 * 365.25))
          : null;

        const distance = user.distance ? (user.distance / 1000).toFixed(2) : null;

        let locationName = "Unknown Location";
        if (user.location?.coordinates) {
          const [lon, lat] = user.location.coordinates;
          locationName = await getPlaceName(lat, lon);
        }

        return {
          id: user._id,
          name: user.name,
          age,
          images: user.images?.[0] || null, // ✅ Only first image
          commonCommunity: user.religion,   // ✅ Common religion
          distance,
          location: locationName,
        };
      })
    );

    // ✅ Count total for pagination
    const countPipeline = [
      {
        $geoNear: {
          near: { type: "Point", coordinates: location.coordinates },
          distanceField: "distance",
          maxDistance: distanceInMeters,
          spherical: true,
          query: {
            _id: { $ne: currentUser._id, $nin: [...blockedIds, ...reportedIds] },
            isVerified: true,
            religion: religion,
            ...genderFilter,
          },
        },
      },
      { $count: "total" },
    ];

    const count = await User.aggregate(countPipeline);
    const totalItems = count[0]?.total || 0;

    return handleResponse(res, 200, "Users with communities in common fetched successfully.", {
      results: formattedUsers,
      totalItems,
      currentPage: Number(page),
      totalPages: Math.ceil(totalItems / perPage),
      totalItemsOnCurrentPage: formattedUsers.length,
    });
  } catch (error) {
    console.error("Error in getUserWithCommunitiesInCommon:", error);
    return handleResponse(res, 500, "Something went wrong.");
  }
};

export const discover = {
    getSimilarInterestUsers,
    getAllUsersWithSameDatingGoals,
    getUserWithCommunitiesInCommon
};
*/