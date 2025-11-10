//app/routes/index.js
import userRoutes from "./user.js";
import passport from "passport";
import socialAuthRoutes from "./socialAuth.js";
import likeRoutes from "./userAction/like.js";
import dislikeRoutes from "./userAction/dislike.js";
import blockRoutes from "./userAction/block.js";
import reportRoutes from "./userAction/report.js";
import discoverPagesRoutes from "./discoverPages.js";
import chatRoutes from "./chat/message.js";
import planRoutes from "./plan.js";

const setupRoutes = (app) => {
  app.use(passport.initialize());
  app.use("/api/v1/user", userRoutes);
  app.use("/auth", socialAuthRoutes);
  app.use("/api/v1/user-action/like", likeRoutes);
  app.use("/api/v1/user-action/dislike", dislikeRoutes);
  app.use("/api/v1/user-action/block", blockRoutes);
  app.use("/api/v1/user-action/report", reportRoutes);
  app.use("/api/v1/discover", discoverPagesRoutes)
  app.use("/api/v1/chat", chatRoutes);
  app.use("/api/v1/plans", planRoutes);
};

export default setupRoutes;
