import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AuthTokenPayload } from "../types";

let io: SocketIOServer | null = null;

export function initSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: env.corsOrigin },
    path: "/socket.io",
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Token tidak ditemukan"));
    try {
      jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
      next();
    } catch {
      next(new Error("Token tidak valid"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("disconnect", () => {});
  });

  return io;
}

/** Broadcast perubahan status kamera (ONLINE/OFFLINE) secara real-time ke semua dashboard yang terbuka. */
export function broadcastCameraStatus(cameraId: string, status: "ONLINE" | "OFFLINE") {
  io?.emit("camera:status", { cameraId, status, at: new Date().toISOString() });
}
