import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import http from "http";
import { Server as SocketIO } from "socket.io";

import connectDB from "./app/dbConfig/dbConfig.js";
import setupRoutes from "./app/routes/index.js";
import mediasetup from "./app/routes/media.js";
import { initializeSocket } from "./app/utils/socketHandler.js";
import { attachSocket } from "./app/middlewares/attachSocket.js";

dotenv.config();

const app = express();
const host = process.env.HOST || "localhost";
const port = process.env.PORT || 8080;

app.use(
  cors({
    origin: [
      "http://localhost:8081",
      "http://localhost:8082",
      "https://matchify-backend-puce.vercel.app",
    ],
    methods: ["GET", "POST", "HEAD", "PUT", "PATCH", "DELETE"],
    optionsSuccessStatus: 200,
    credentials: true,
  })
);

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

connectDB();

const server = http.createServer(app);

const io = new SocketIO(server, {
  cors: {
    // origin: [
    //   "http://localhost:8081",
    //   "http://localhost:8082",
    //   "https://matchify-backend-puce.vercel.app",
    // ],
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

initializeSocket(io);

app.use(attachSocket(io));

setupRoutes(app);
mediasetup(app);

app.get("/", (req, res) => {
  res.status(200).send({
    error: false,
    message: "🚀 Welcome to the Dating App with Real-Time Chat!",
  });
});


server.listen(port, () => {
  console.log(`✅ Server running at http://${host}:${port}`);
});
