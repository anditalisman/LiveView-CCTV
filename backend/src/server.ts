import http from "http";
import fs from "fs";
import { app } from "./app";
import { env } from "./config/env";
import { initSocket } from "./services/socket";
import { startStatusPoller } from "./services/cameraStatus.service";
import { startIdleSweeper } from "./services/streamManager";

fs.mkdirSync(env.hlsOutputDir, { recursive: true });

const httpServer = http.createServer(app);
initSocket(httpServer);

startStatusPoller();
startIdleSweeper();

httpServer.listen(env.port, () => {
  console.log(`LiveView CCTV backend berjalan di port ${env.port} (${env.nodeEnv})`);
  console.log(`HLS output dir: ${env.hlsOutputDir}`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM diterima, menutup server...");
  httpServer.close(() => process.exit(0));
});
