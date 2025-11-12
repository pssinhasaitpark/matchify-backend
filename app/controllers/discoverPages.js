//app/controllers/discoverPages.js
import { User } from "../models/user.js";
import { Block } from "../models/userAction/block.js";
import { Report } from "../models/userAction/report.js";
import { calculateAge, handleResponse } from "../utils/helper.js";
import { getPlaceName, calculateDistance } from "../services/locationService.js";
import { getUserPlan, incrementActionUsage, markUserAsShown, } from "../services/planService.js";

const getSimilarInterestUsers = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { page = 1, perPage = 6 } = req.query;

    // 1️⃣ Get user and plan
    const { user, plan } = await getUserPlan(currentUserId);
    const dailyLimit = plan.discoverLimitPerSection;
    const shownUsers = user.shownSimilarInterestUsers || [];

    // 2️⃣ Get all potential users
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

    // 3️⃣ Get all potential users
    const allUsers = await User.aggregate([
      {
        $match: {
          _id: { $ne: currentUser._id, $nin: [...blockedIds, ...reportedIds, ...shownUsers] },
          isVerified: true,
          interest: { $in: interest },
          ...genderFilter,
        },
      },
      { $addFields: { randomSort: { $rand: {} } } },
      { $sort: { randomSort: 1 } },
      { $limit: dailyLimit === -1 ? perPage : dailyLimit },
    ]);

    // 4️⃣ Format results
    const formattedUsers = await Promise.all(
      allUsers.map(async user => {
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

    // 5️⃣ Mark users as shown
    for (const user of formattedUsers) {
      await markUserAsShown(currentUserId, "SimilarInterest", user.id);
    }

    // 6️⃣ Increment daily usage
    await incrementActionUsage(currentUserId, "DISCOVER");

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

    // 1️⃣ Get user and plan
    const { user, plan } = await getUserPlan(currentUserId);
    const dailyLimit = plan.discoverLimitPerSection;
    const shownUsers = user.shownSameDatingGoalsUsers || [];

    // 2️⃣ Get all potential users
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

    // 3️⃣ Get all potential users
    const allUsers = await User.aggregate([
      {
        $match: {
          _id: { $ne: currentUser._id, $nin: [...blockedIds, ...reportedIds, ...shownUsers] },
          isVerified: true,
          relationshipGoals: { $in: relationshipGoals },
          ...genderFilter,
        },
      },
      { $addFields: { randomSort: { $rand: {} } } },
      { $sort: { randomSort: 1 } },
      { $limit: dailyLimit === -1 ? perPage : dailyLimit },
    ]);

    // 4️⃣ Format results
    const formattedUsers = await Promise.all(
      allUsers.map(async user => {
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

    // 5️⃣ Mark users as shown
    for (const user of formattedUsers) {
      await markUserAsShown(currentUserId, "SameDatingGoals", user.id);
    }

    // 6️⃣ Increment daily usage
    await incrementActionUsage(currentUserId, "DISCOVER");

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

    // 1️⃣ Get user and plan
    const { user, plan } = await getUserPlan(currentUserId);
    const dailyLimit = plan.discoverLimitPerSection;
    const shownUsers = user.shownCommunitiesInCommonUsers || [];

    // 2️⃣ Get all potential users
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

    // 3️⃣ Get all potential users
    const allUsers = await User.aggregate([
      {
        $match: {
          _id: { $ne: currentUser._id, $nin: [...blockedIds, ...reportedIds, ...shownUsers] },
          isVerified: true,
          religion: religion,
          ...genderFilter,
        },
      },
      { $addFields: { randomSort: { $rand: {} } } },
      { $sort: { randomSort: 1 } },
      { $limit: dailyLimit === -1 ? perPage : dailyLimit },
    ]);

    // 4️⃣ Format results
    const formattedUsers = await Promise.all(
      allUsers.map(async user => {
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

    // 5️⃣ Mark users as shown
    for (const user of formattedUsers) {
      await markUserAsShown(currentUserId, "CommunitiesInCommon", user.id);
    }

    // 6️⃣ Increment daily usage
    await incrementActionUsage(currentUserId, "DISCOVER");

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

    // 1️⃣ Get user and plan
    const { user, plan } = await getUserPlan(currentUserId);
    const dailyLimit = plan.discoverLimitPerSection;
    const shownUsers = user.shownRecommendedUsers || [];

    // 2️⃣ Get all potential users
    const blockedUsers = await Block.find({ userId: currentUserId }).select("targetUserId");
    const reportedUsers = await Report.find({ reporterId: currentUserId }).select("reportedUserId");
    const blockedIds = blockedUsers.map(b => b.targetUserId);
    const reportedIds = reportedUsers.map(r => r.reportedUserId);
    const currentUser = await User.findById(currentUserId);
    if (!currentUser || !currentUser.isVerified)
      return handleResponse(res, 404, "Current user not found or not verified.");
    let genderFilter = {};
    if (currentUser.show_me === "men") genderFilter.gender = "male";
    else if (currentUser.show_me === "women") genderFilter.gender = "female";

    // 3️⃣ Get all potential users
    const allUsers = await User.find({
      _id: { $ne: currentUserId, $nin: [...blockedIds, ...reportedIds, ...shownUsers] },
      isVerified: true,
      ...genderFilter,
    }).select("name date_of_birth images location interest relationshipGoals religion caste gender");

    // 4️⃣ Filter and score users
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

    // 5️⃣ Limit results based on plan
    const limitedUsers = dailyLimit === -1 ? recommendedUsers : recommendedUsers.slice(0, dailyLimit);

    // 6️⃣ Format results
    const formattedUsers = await Promise.all(
      limitedUsers.map(async ({ user, commonInterest, sameGoal, commonCommunities }) => {
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

    // 7️⃣ Mark users as shown
    for (const { user } of limitedUsers) {
      await markUserAsShown(currentUserId, "Recommended", user._id);
    }

    // 8️⃣ Increment daily usage
    await incrementActionUsage(currentUserId, "DISCOVER");

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

// below without plans 
/*
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
*/
export const discover = {
  getSimilarInterestUsers,
  getAllUsersWithSameDatingGoals,
  getUserWithCommunitiesInCommon,
  getRecommendedUsers,
};