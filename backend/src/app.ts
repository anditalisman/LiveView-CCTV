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

// Fallback penyaji file HLS untuk dev/testing tanpa Nginx di depan.
// Di production, Nginx men-serve folder ini langsung (lihat nginx/liveview.conf)
// sehingga request tidak pernah sampai ke Node; route ini hanya jaring pengaman.
app.use(
  "/streams",
  express.static(env.hlsOutputDir, {
    setHeaders: (res, path) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      if (path.endsWith(".m3u8")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      } else {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  })
);

app.use(notFoundHandler);
app.use(errorHandler);
