//app/controllers/discoverPages.js
import { User } from "../models/user.js";
import { Block } from "../models/userAction/block.js";
import { Report } from "../models/userAction/report.js";
import { calculateAge, handleResponse } from "../utils/helper.js";
import { getPlaceName, calculateDistance } from "../services/locationService.js";

const getSimilarInterestUsers = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { page = 1, perPage = 6 } = req.query;
    const skip = (page - 1) * perPage;

    const blockedUsers = await Block.find({ userId: currentUserId }).select("targetUserId");
    const reportedUsers = await Report.find({ reporterId: currentUserId }).select("reportedUserId");
    const blockedIds = blockedUsers.map(b => b.targetUserId);
    const reportedIds = reportedUsers.map(r => r.reportedUserId);

    const currentUser = await User.findById(currentUserId);
    if (!currentUser || !currentUser.isVerified)
      return handleResponse(res, 404, "User not found or not verified.");

    let { show_me, interest } = currentUser;
    if (interest && !Array.isArray(interest)) interest = [interest];
    if (!interest || interest.length === 0)
      return handleResponse(res, 400, "No interests found for the current user.");

    let genderFilter = {};
    if (show_me === "men") genderFilter.gender = "male";
    else if (show_me === "women") genderFilter.gender = "female";

    const users = await User.aggregate([
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
    ]);

    const formattedUsers = await Promise.all(
      users.map(async user => {
        const age = calculateAge(user.date_of_birth);
        let locationName = "Unknown";
        let distance = null;

        if (user.location?.coordinates && currentUser.location?.coordinates) {
          const [lon, lat] = user.location.coordinates;
          locationName = await getPlaceName(lat, lon);
          distance = calculateDistance(currentUser.location, user.location);
        }

        const commonInterest = (user.interest || []).filter(i => interest.includes(i));

        return {
          id: user._id,
          name: user.name,
          age,
          images: user.images?.[0] || null,
          location: locationName,
          distance: distance !== null ? `${distance} km` : null,
          commonInterest,
        };
      })
    );

    return handleResponse(res, 200, "Users with similar interests fetched successfully.", {
      results: formattedUsers,
      currentPage: Number(page),
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
    const blockedIds = blockedUsers.map(b => b.targetUserId);
    const reportedIds = reportedUsers.map(r => r.reportedUserId);

    const currentUser = await User.findById(currentUserId);
    if (!currentUser || !currentUser.isVerified)
      return handleResponse(res, 404, "User not found or not verified.");

    let { show_me, relationshipGoals } = currentUser;
    if (relationshipGoals && !Array.isArray(relationshipGoals)) relationshipGoals = [relationshipGoals];

    let genderFilter = {};
    if (show_me === "men") genderFilter.gender = "male";
    else if (show_me === "women") genderFilter.gender = "female";

    const users = await User.aggregate([
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
    ]);

    const formattedUsers = await Promise.all(
      users.map(async user => {
        const age = user.date_of_birth ? calculateAge(user.date_of_birth) : null;
        let locationName = "Unknown";
        let distance = null;

        if (user.location?.coordinates && currentUser.location?.coordinates) {
          const [lon, lat] = user.location.coordinates;
          locationName = await getPlaceName(lat, lon);
          distance = calculateDistance(currentUser.location, user.location);
        }

        const sameGoal = relationshipGoals.includes(user.relationshipGoals)
          ? user.relationshipGoals
          : null;

        return {
          id: user._id,
          name: user.name,
          age,
          images: user.images?.[0] || null,
          location: locationName,
          distance: distance !== null ? `${distance} km` : null,
          commonRelationshipGoals: sameGoal,
        };
      })
    );

    return handleResponse(res, 200, "Users with same dating goals fetched successfully.", {
      results: formattedUsers,
      currentPage: Number(page),
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

    const blockedUsers = await Block.find({ userId: currentUserId }).select("targetUserId");
    const reportedUsers = await Report.find({ reporterId: currentUserId }).select("reportedUserId");
    const blockedIds = blockedUsers.map(b => b.targetUserId);
    const reportedIds = reportedUsers.map(r => r.reportedUserId);

    const currentUser = await User.findById(currentUserId);
    if (!currentUser || !currentUser.isVerified)
      return handleResponse(res, 404, "User not found or not verified.");

    let { show_me, religion } = currentUser;
    if (!religion) return handleResponse(res, 400, "Religion not found for the current user.");

    let genderFilter = {};
    if (show_me === "men") genderFilter.gender = "male";
    else if (show_me === "women") genderFilter.gender = "female";

    const users = await User.aggregate([
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
    ]);

    const formattedUsers = await Promise.all(
      users.map(async user => {
        const age = user.date_of_birth ? calculateAge(user.date_of_birth) : null;
        let locationName = "Unknown";
        let distance = null;

        if (user.location?.coordinates && currentUser.location?.coordinates) {
          const [lon, lat] = user.location.coordinates;
          locationName = await getPlaceName(lat, lon);
          distance = calculateDistance(currentUser.location, user.location);
        }

        return {
          id: user._id,
          name: user.name,
          age,
          images: user.images?.[0] || null,
          location: locationName,
          distance: distance !== null ? `${distance} km` : null,
          commonCommunity: religion,
        };
      })
    );

    return handleResponse(res, 200, "Users with communities in common fetched successfully.", {
      results: formattedUsers,
      currentPage: Number(page),
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
    const { page = 1, perPage = 6 } = req.query;
    const skip = (page - 1) * perPage;

    const currentUser = await User.findById(currentUserId);
    if (!currentUser || !currentUser.isVerified)
      return handleResponse(res, 404, "Current user not found or not verified.");

    const blockedUsers = await Block.find({ userId: currentUserId }).select("targetUserId");
    const reportedUsers = await Report.find({ reporterId: currentUserId }).select("reportedUserId");
    const blockedIds = blockedUsers.map(b => b.targetUserId);
    const reportedIds = reportedUsers.map(r => r.reportedUserId);

    let genderFilter = {};
    if (currentUser.show_me === "men") genderFilter.gender = "male";
    else if (currentUser.show_me === "women") genderFilter.gender = "female";

    const allUsers = await User.find({
      _id: { $ne: currentUserId, $nin: [...blockedIds, ...reportedIds] },
      isVerified: true,
      ...genderFilter,
    }).select("name date_of_birth images location interest relationshipGoals religion caste gender");

    const recommendedUsers = allUsers
      .map(user => {
        const userInterests = Array.isArray(user.interest) ? user.interest : [];
        const userCommunities = [user.religion, user.caste].filter(Boolean);

        const currentUserInterests = Array.isArray(currentUser.interest) ? currentUser.interest : [];
        const currentUserCommunities = [currentUser.religion, currentUser.caste].filter(Boolean);

        const commonInterest = userInterests.filter(i => currentUserInterests.includes(i));
        const sameGoal = user.relationshipGoals === currentUser.relationshipGoals;
        const commonCommunities = userCommunities.filter(c => currentUserCommunities.includes(c));

        const score = commonInterest.length * 2 + (sameGoal ? 3 : 0) + commonCommunities.length;

        return {
          user,
          score,
          commonInterest,
          sameGoal,
          commonCommunities,
        };
      })
      .filter(u => u.score > 0)
      .sort(() => Math.random() - 0.5);

    const formattedUsers = await Promise.all(
      recommendedUsers.slice(skip, skip + perPage).map(async ({ user, commonInterest, sameGoal, commonCommunities }) => {
        const age = user.date_of_birth ? calculateAge(user.date_of_birth) : null;
        let locationName = "Unknown";
        let distance = null;

        if (user.location?.coordinates && currentUser.location?.coordinates) {
          const [lon, lat] = user.location.coordinates;
          locationName = await getPlaceName(lat, lon);
          distance = calculateDistance(currentUser.location, user.location);
        }

        return {
          id: user._id,
          name: user.name,
          age,
          images: user.images?.[0] || null,
          location: locationName,
          distance: distance !== null ? `${distance} km` : null,
          commonInterest,
          commonRelationshipGoals: sameGoal ? [user.relationshipGoals] : [],
          commonCommunities,
        };
      })
    );

    return handleResponse(res, 200, "Recommended users fetched successfully.", {
      results: formattedUsers,
      currentPage: Number(page),
      totalItemsOnCurrentPage: formattedUsers.length,
    });
  } catch (error) {
    console.error("Error in getRecommendedUsers:", error);
    return handleResponse(res, 500, "Something went wrong while fetching recommended users.");
  }
};

export const discover = {
  getSimilarInterestUsers,
  getAllUsersWithSameDatingGoals,
  getUserWithCommunitiesInCommon,
  getRecommendedUsers,
};




/*
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
    const { page = 1, perPage = 6 } = req.query;
    const skip = (page - 1) * perPage;

    // 1. Fetch current user
    const currentUser = await User.findById(currentUserId);
    if (!currentUser || !currentUser.isVerified) {
      return handleResponse(res, 404, "Current user not found or not verified.");
    }

    // 2. Fetch blocked and reported users
    const blockedUsers = await Block.find({ userId: currentUserId }).select("targetUserId");
    const reportedUsers = await Report.find({ reporterId: currentUserId }).select("reportedUserId");
    const blockedIds = blockedUsers.map((b) => b.targetUserId);
    const reportedIds = reportedUsers.map((r) => r.reportedUserId);

    // 3. Gender filter
    let genderFilter = {};
    if (currentUser.show_me === "men") genderFilter.gender = "male";
    else if (currentUser.show_me === "women") genderFilter.gender = "female";

    // 4. Fetch all potential matches (excluding blocked/reported users)
    const allUsers = await User.find({
      _id: { $ne: currentUserId, $nin: [...blockedIds, ...reportedIds] },
      isVerified: true,
      ...genderFilter,
    }).select("name date_of_birth images location interest relationshipGoals religion caste gender");

    // 5. Calculate compatibility scores and filter out users with score = 0
    let recommendedUsers = allUsers
      .map((user) => {
        const userInterests = Array.isArray(user.interest) ? user.interest : [];
        const userRelationshipGoal = user.relationshipGoals || "";
        const userCommunities = [user.religion, user.caste].filter(Boolean);
        const currentUserInterests = Array.isArray(currentUser.interest) ? currentUser.interest : [];
        const currentUserRelationshipGoal = currentUser.relationshipGoals || "";
        const currentUserCommunities = [currentUser.religion, currentUser.caste].filter(Boolean);

        // Calculate commonalities
        const commonInterest = userInterests.filter((i) => currentUserInterests.includes(i));
        const commonRelationshipGoals = userRelationshipGoal === currentUserRelationshipGoal ? 1 : 0;
        const commonCommunities = userCommunities.filter((c) => currentUserCommunities.includes(c));

        // Assign weights
        const interestScore = commonInterest.length * 2;
        const relationshipScore = commonRelationshipGoals * 3;
        const communityScore = commonCommunities.length * 1;

        // Total compatibility score
        const totalCommonCount = interestScore + relationshipScore + communityScore;

        return {
          _id: user._id,
          name: user.name,
          age: user.date_of_birth ? calculateAge(user.date_of_birth) : null,
          images: user.images?.[0] || null,
          location: user.location,
          commonInterest,
          commonRelationshipGoals: commonRelationshipGoals ? [userRelationshipGoal] : [],
          commonCommunities,
          totalCommonCount,
        };
      })
      .filter((user) => user.totalCommonCount > 0); // Exclude users with score = 0

    // 6. Shuffle the recommendations to display in random order
    const shuffledRecommendations = recommendedUsers.sort(() => Math.random() - 0.5);

    // 7. Resolve location names and format response
    const formattedUsers = await Promise.all(
      shuffledRecommendations.slice(skip, skip + perPage).map(async (user) => {
        let locationName = "Unknown Location";
        if (user.location?.coordinates?.length === 2) {
          const [lng, lat] = user.location.coordinates;
          locationName = await getPlaceName(lat, lng);
        }
        return { ...user, location: locationName };
      })
    );

    // 8. Send paginated response
    return handleResponse(res, 200, "Recommended users fetched successfully.", {
      results: formattedUsers,
      totalItems: shuffledRecommendations.length,
      currentPage: Number(page),
      totalPages: Math.ceil(shuffledRecommendations.length / perPage),
      totalItemsOnCurrentPage: formattedUsers.length,
    });
  } catch (error) {
    console.error("Error in getRecommendedUsers:", error);
    return handleResponse(res, 500, "Something went wrong while fetching recommended users.");
  }
};

export const discover = {
  getSimilarInterestUsers,
  getAllUsersWithSameDatingGoals,
  getUserWithCommunitiesInCommon,
  getRecommendedUsers
};
*/