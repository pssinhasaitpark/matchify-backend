//app/routes/index.js
import userRoutes from "./user.js";
import passport from "passport";
import socialAuthRoutes from "./socialAuth.js";

const setupRoutes = (app) => {
    app.use(passport.initialize());
    app.use("/api/v1/user", userRoutes);
    app.use("/auth", socialAuthRoutes);
};

export default setupRoutes;