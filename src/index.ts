import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import path from "path";
import { initSocket } from "./socket";
import mongoose from "mongoose";
import cors from "cors";
import authRoutes from "./routes/auth";

const app = express();
app.use(cors());
app.use(express.json());

// Routes
import ridesRoutes from "./routes/rides";
import driverRoutes from "./routes/driver";
import adminRoutes from "./routes/admin";
import verificationRoutes from "./routes/verification";
import paymentRoutes from "./routes/payment";

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/rides", ridesRoutes);
app.use("/api/driver", driverRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/verification", verificationRoutes);
app.use("/api/payment", paymentRoutes);

app.get("/", (req: express.Request, res: express.Response) => {
  res.send("Uber Clone API is running");
});

// Keep-alive endpoint — ping this from a cron job to prevent cold starts
app.get("/keep-alive", (req: express.Request, res: express.Response) => {
  res.status(200).send("I am awake!");
});

const PORT = process.env.PORT || 5000;
const MONGO_URI =
  process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/uber-clone";

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");

    // Create HTTP Server and bind socket
    const httpServer = http.createServer(app);
    initSocket(httpServer);

    httpServer.listen(PORT as number, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });
// trigger restart
