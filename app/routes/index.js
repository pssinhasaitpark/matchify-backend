//app/routes/index.js
import userRoutes from "./user.js";

const setupRoutes = (app) => {
    app.use("/api/v1/user", userRoutes);
};

export default setupRoutes;