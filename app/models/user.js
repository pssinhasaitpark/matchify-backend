//app/models/user.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    name: { type: String, required: false },
    date_of_birth: { type: Date, required: false },
    gender: { type: String, enum: ["male", "female", "other"], required: false },

    sexual_orientation: { type: String, enum: ["straight", "gay", "bisexual", "other"], default: null },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
    },

    preferred_match_distance: { type: Number, default: 50 },
    show_me: { type: String, enum: ["men", "women", "everyone"], default: "everyone" },
    age_range: { type: [Number], default: [18, 30] },

    height: { type: Number, default: null },
    body_type: { type: String, default: null },
    education: { type: String, default: null },
    profession: { type: String, default: null },

    bio: { type: String, default: null },
    interest: { type: [String], default: [] },
    smoking: { type: String, enum: ["Yes", "No", "Sometimes"], default: "No" },
    drinking: { type: String, enum: ["Yes", "No", "Socially"], default: "No" },
    diet: { type: String, enum: ["None", "Vegan", "Vegetarian", "Non Vegetarian", "Halal", "Kosher", "Other"], default: "None" },
    religion: { type: String, default: null },
    caste: { type: String, default: null },
    hasKids: { type: String, enum: ["Yes", "No", "Prefer not to say"], default: "Prefer not to say" },
    wantsKids: { type: String, enum: ["Yes", "No", "Maybe"], default: "Maybe" },
    hasPets: { type: Boolean, default: false },
    relationshipGoals: {
      type: String,
      enum: ["CasualDating", "SeriousRelationship", "Marriage", "OpenToExplore"],
      default: "OpenToExplore",
    },

    images: { type: [String], required: false },
    mobile_number: { type: String, unique: true, },

    isVerified: { type: Boolean, default: false },
    otp: { type: String, default: null },
    isNewUser: { type: Boolean, default: true },

    profileCompleteness: { type: Number, default: 0 },
    lastActiveAt: { type: Date, default: Date.now },

    likedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    dislikedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    // googleId: { type: String, default: null },
  },
  { timestamps: true }
);

userSchema.index({ location: "2dsphere" });

export const User = mongoose.model("User", userSchema);

//Yeh ek GeoJSON "Point" type hai, jisme coordinates hote hain [longitude, latitude] ke format mein.
// userSchema.index({ location: "2dsphere" });
//MongoDB ko batane ke liye ki:
// Ye field special hai — ek geo-location point hai.
// Ispe distance-based search (like nearest users within 50km) karni hai.
// Toh ispe ek 2dsphere index bana do.

/*
userSchema.index({ location: "2dsphere" }) ka matlab hai:
→ MongoDB ko batana ki location ek geographical point hai,
→ jisme longitude-latitude hote hain,
→ aur is field pe tum location-based search karna chahte ho.
→ Isliye ek special 2dsphere index lagaya jaata hai.
*/