// app/services/passport.js
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { User } from "../models/user.js";
import dotenv from "dotenv";

dotenv.config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:8050/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists
        let user = await User.findOne({ email: profile.emails[0].value });

        if (!user) {
          // Create new user
          user = await User.create({
            name: profile.displayName,
            email: profile.emails[0].value,
            isVerified: true,
            isNewUser: false,
            images: [profile.photos[0]?.value],
          });
        }

        return done(null, user);
      } catch (err) {
        console.error("Google strategy error:", err);
        return done(err, null);
      }
    }
  )
);

export default passport;
