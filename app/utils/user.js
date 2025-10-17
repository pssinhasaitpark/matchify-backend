// app/utils/user.js

export const calculateProfileCompleteness = (user) => {
  let completeness = 0;
  const totalFields = 10;
  let filledFields = 0;
  if (user.name) filledFields++;
  if (user.date_of_birth) filledFields++;
  if (user.gender) filledFields++;
  if (user.height) filledFields++;
  if (user.body_type) filledFields++;
  if (user.education) filledFields++;
  if (user.profession) filledFields++;
  if (user.bio) filledFields++;
  if (user.interest && user.interest.length > 0) filledFields++;
  if (user.images && user.images.length === 6) filledFields++;
  completeness = Math.floor((filledFields / totalFields) * 100);
  return completeness;
};

export const safeJSONParse = (str) => {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
};

export const parseDateDMY = (dateStr) => {
  const [day, month, year] = dateStr.split("/");
  if (!day || !month || !year) return null;
  return new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
};

export const parseLocation = (locationStr) => {
  const coords = locationStr.split(",").map(Number);
  if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
    return { type: "Point", coordinates: coords };
  }
  return { type: "Point", coordinates: [0, 0] };
};

export const normalizeInterest = (interest) => {
  if (typeof interest === "string") {
    return interest.split(",").map((i) => i.trim()).filter((i) => i.length > 0);
  }
  return interest;
};

export const normalizeAgeRange = (ageRange) => {
  if (typeof ageRange === "string") {
    const parsed = safeJSONParse(ageRange);
    if (Array.isArray(parsed) && parsed.length === 2) return parsed;
    const match = ageRange.match(/\d+/g);
    if (match && match.length === 2) return [parseInt(match[0]), parseInt(match[1])];
  }
  return ageRange;
};

export const assignUserFields = (user, body, req) => {
  user.name = body.fullName;
  user.date_of_birth = parseDateDMY(body.dob) || null;
  user.gender = body.gender;
  user.sexual_orientation = body.sexual_orientation;
  user.location = parseLocation(body.location);
  user.preferred_match_distance = body.preferred_match_distance;
  user.show_me = body.show_me;
  user.age_range = normalizeAgeRange(body.age_range);
  user.height = body.height ? parseInt(body.height) : null;
  user.body_type = body.body_type;
  user.education = body.education;
  user.profession = body.profession;
  user.bio = body.bio;
  user.interest = normalizeInterest(body.interest);
  user.smoking = body.smoking;
  user.drinking = body.drinking;
  user.diet = body.diet;
  user.religion = body.religion;
  user.caste = body.caste;
  user.hasKids = body.hasKids;
  user.wantsKids = body.wantsKids;
  user.hasPets = body.hasPets === "true" || body.hasPets === true;
  user.relationshipGoals = body.relationshipGoals;
  user.images = req.convertedFiles?.images || [];
  user.mobile_number = body.mobile_number;
  user.isVerified = true;
  user.isNewUser = false;
  user.otp = "";
  user.profileCompleteness = calculateProfileCompleteness(user);
};
