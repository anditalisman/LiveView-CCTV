import { execFile } from "child_process";
import { Camera, CameraStatus, Device } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { buildRtspUrl } from "../utils/rtsp";
import { broadcastCameraStatus } from "./socket";

const MAX_CONCURRENT_CHECKS = 5;

function probeOnline(camera: Camera, device: Device): Promise<boolean> {
  return new Promise((resolve) => {
    const rtspUrl = buildRtspUrl(device, camera, "sub");
    const args = [
      "-v",
      "error",
      "-rtsp_transport",
      device.transport,
      "-stimeout", // "-timeout" implies RTSP listen mode on ffmpeg 4.x+, causing instant EADDRNOTAVAIL
      "4000000",
      "-show_entries",
      "stream=codec_type",
      "-of",
      "csv=p=0",
      rtspUrl,
    ];
    execFile(env.ffprobePath, args, { timeout: 6000 }, (error) => resolve(!error));
  });
}

async function runBatches<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let cursor = 0;
  async function next(): Promise<void> {
    const index = cursor++;
    if (index >= items.length) return;
    await worker(items[index]);
    return next();
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()));
}

async function checkAllCameras() {
  const cameras = await prisma.camera.findMany({
    where: { isActive: true },
    include: { device: true },
  });

  await runBatches(cameras, MAX_CONCURRENT_CHECKS, async (camera) => {
    const online = await probeOnline(camera, camera.device);
    const newStatus: CameraStatus = online ? "ONLINE" : "OFFLINE";

    if (newStatus !== camera.status) {
      broadcastCameraStatus(camera.id, newStatus);
    }

    await prisma.camera.update({
      where: { id: camera.id },
      data: {
        status: newStatus,
        lastCheckedAt: new Date(),
        ...(online ? { lastOnlineAt: new Date() } : {}),
      },
    });
  });
}

export function startStatusPoller() {
  // Jalankan sekali di awal, lalu berkala sesuai STATUS_CHECK_INTERVAL_SEC.
  checkAllCameras().catch((err) => console.error("Status poller error:", err));
  setInterval(() => {
    checkAllCameras().catch((err) => console.error("Status poller error:", err));
  }, env.statusCheckIntervalSec * 1000);
}
