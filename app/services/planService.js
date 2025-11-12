// app/services/planService.js
import { User } from "../models/user.js";
import { Plan } from "../models/plan.js";

export const getUserPlan = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  // If plan is expired, downgrade to FREE
  if (user.plan !== "FREE" && user.planExpiry && user.planExpiry < new Date()) {
    user.plan = "FREE";
    user.planExpiry = null;
    await user.save();
  }

  const plan = await Plan.findOne({ name: user.plan });
  return { user, plan };
};

export const canPerformAction = async (userId, action) => {
  const { user, plan } = await getUserPlan(userId);

  // Check if action is allowed based on plan limits
  switch (action) {
    case "LIKE":
      return plan.dailyLikesLimit === -1 || (user.dailyLikesUsed || 0) < plan.dailyLikesLimit;
    case "WHO_LIKED_ME":
      return plan.dailyWhoLikedMeLimit === -1 || (user.dailyWhoLikedMeUsed || 0) < plan.dailyWhoLikedMeLimit;
    case "DISCOVER":
      return plan.discoverLimitPerSection === -1 || (user.dailyDiscoverUsed || 0) < plan.discoverLimitPerSection;
    default:
      return false;
  }
};

export const incrementActionUsage = async (userId, action) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  switch (action) {
    case "LIKE":
      user.dailyLikesUsed = (user.dailyLikesUsed || 0) + 1;
      break;
    case "WHO_LIKED_ME":
      user.dailyWhoLikedMeUsed = (user.dailyWhoLikedMeUsed || 0) + 1;
      break;
    case "DISCOVER":
      user.dailyDiscoverUsed = (user.dailyDiscoverUsed || 0) + 1;
      break;
  }

  await user.save();
};

export const resetDailyUsage = async () => {
  await User.updateMany(
    {},
    {
      $set: {
        dailyLikesUsed: 0,
        dailyWhoLikedMeUsed: 0,
        dailyDiscoverUsed: 0,
      },
    }
  );
};

export const canShowUser = async (userId, section, targetUserId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const shownUsersField = `shown${section}Users`;
  if (user[shownUsersField] && user[shownUsersField].includes(targetUserId)) {
    return false; 
  }
  return true;
};

export const markUserAsShown = async (userId, section, targetUserId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const shownUsersField = `shown${section}Users`;
  if (!user[shownUsersField].includes(targetUserId)) {
    user[shownUsersField].push(targetUserId);
    await user.save();
  }
};
