import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
import { ensureStream, heartbeat } from "../services/streamManager";
import { StreamQuality } from "../utils/rtsp";

function parseQuality(value: string): StreamQuality {
  if (value !== "main" && value !== "sub") {
    throw new ApiError(400, 'quality harus "main" atau "sub"');
  }
  return value;
}

export async function startStream(req: Request, res: Response) {
  const { cameraId, quality } = req.params;
  const q = parseQuality(quality);

  const camera = await prisma.camera.findUnique({
    where: { id: cameraId },
    include: { device: true },
  });
  if (!camera) throw new ApiError(404, "Kamera tidak ditemukan");
  if (!camera.isActive) throw new ApiError(400, "Kamera sedang nonaktif");

  const { url, hlsUrl, preferHls } = await ensureStream(camera.device, camera, q);
  res.json({ url, hlsUrl, preferHls });
}

export async function streamHeartbeat(req: Request, res: Response) {
  const { cameraId, quality } = req.params;
  const q = parseQuality(quality);
  heartbeat(cameraId, q);
  res.status(204).send();
}
