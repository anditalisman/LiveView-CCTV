import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import deviceRoutes from "./routes/device.routes";
import cameraRoutes from "./routes/camera.routes";
import streamRoutes from "./routes/stream.routes";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json());

// Batasi rate khusus endpoint login untuk mencegah brute-force.
app.use(
  "/api/auth/login",
  rateLimit({ windowMs: 5 * 60 * 1000, max: 20, standardHeaders: true })
);

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/cameras", cameraRoutes);
app.use("/api/streams", streamRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
