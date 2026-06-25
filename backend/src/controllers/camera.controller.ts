import { Request, Response } from "express";
import { execFile } from "child_process";
import { z } from "zod";
import { CameraStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { ApiError } from "../middleware/errorHandler";
import { buildRtspUrl, maskRtspUrl } from "../utils/rtsp";
import { stopCameraStreams } from "../services/streamManager";

const cameraInclude = {
  device: {
    select: { id: true, name: true, type: true, brand: true, ipAddress: true, transport: true },
  },
};

export async function listCameras(req: Request, res: Response) {
  const { search, location, status, isActive, deviceId } = req.query as Record<string, string>;

  const cameras = await prisma.camera.findMany({
    where: {
      ...(deviceId ? { deviceId } : {}),
      ...(status ? { status: status as CameraStatus } : {}),
      ...(isActive !== undefined ? { isActive: isActive === "true" } : {}),
      ...(location ? { location: { contains: location, mode: "insensitive" } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { location: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: cameraInclude,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });

  res.json(cameras);
}

export async function listLocations(_req: Request, res: Response) {
  const rows = await prisma.camera.findMany({
    select: { location: true },
    distinct: ["location"],
    orderBy: { location: "asc" },
  });
  res.json(rows.map((r) => r.location));
}

export async function getCamera(req: Request, res: Response) {
  const camera = await prisma.camera.findUnique({
    where: { id: req.params.id },
    include: cameraInclude,
  });
  if (!camera) throw new ApiError(404, "Kamera tidak ditemukan");
  res.json(camera);
}

const cameraSchema = z.object({
  deviceId: z.string().uuid(),
  name: z.string().min(1),
  location: z.string().min(1),
  channelNo: z.number().int().min(1).default(1),
  mainStreamSuffix: z.number().int(),
  subStreamSuffix: z.number().int(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export async function createCamera(req: Request, res: Response) {
  const data = cameraSchema.parse(req.body);

  const device = await prisma.device.findUnique({ where: { id: data.deviceId } });
  if (!device) throw new ApiError(404, "Device tidak ditemukan");

  const camera = await prisma.camera.create({ data, include: cameraInclude });
  res.status(201).json(camera);
}

const updateCameraSchema = cameraSchema.partial();

export async function updateCamera(req: Request, res: Response) {
  const { id } = req.params;
  const data = updateCameraSchema.parse(req.body);

  const existing = await prisma.camera.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Kamera tidak ditemukan");

  const camera = await prisma.camera.update({ where: { id }, data, include: cameraInclude });

  // Jika channel/device berubah, hentikan stream lama supaya tidak nyangkut di URL RTSP lama.
  stopCameraStreams(id);
  res.json(camera);
}

export async function toggleCameraActive(req: Request, res: Response) {
  const { id } = req.params;
  const camera = await prisma.camera.findUnique({ where: { id } });
  if (!camera) throw new ApiError(404, "Kamera tidak ditemukan");

  const updated = await prisma.camera.update({
    where: { id },
    data: { isActive: !camera.isActive },
    include: cameraInclude,
  });

  if (!updated.isActive) stopCameraStreams(id);
  res.json(updated);
}

export async function deleteCamera(req: Request, res: Response) {
  const { id } = req.params;
  const existing = await prisma.camera.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Kamera tidak ditemukan");

  stopCameraStreams(id);
  await prisma.camera.delete({ where: { id } });
  res.status(204).send();
}

/**
 * Test koneksi kamera: jalankan ffprobe terhadap sub-stream RTSP dengan timeout singkat.
 * Tidak menyimpan/menampilkan password ke client, hanya hasil sukses/gagal + info stream.
 */
export async function testCameraConnection(req: Request, res: Response) {
  const { id } = req.params;
  const camera = await prisma.camera.findUnique({
    where: { id },
    include: { device: true },
  });
  if (!camera) throw new ApiError(404, "Kamera tidak ditemukan");

  const rtspUrl = buildRtspUrl(camera.device, camera, "sub");
  const startedAt = Date.now();

  const args = [
    "-v",
    "error",
    "-rtsp_transport",
    camera.device.transport,
    "-stimeout",
    "5000000", // microseconds (TCP socket timeout, client mode; "-timeout" implies RTSP listen mode on ffmpeg 4.x+)
    "-print_format",
    "json",
    "-show_streams",
    rtspUrl,
  ];

  execFile(env.ffprobePath, args, { timeout: 8000 }, async (error, stdout, stderr) => {
    const latencyMs = Date.now() - startedAt;
    const success = !error;

    await prisma.camera.update({
      where: { id },
      data: {
        status: success ? CameraStatus.ONLINE : CameraStatus.OFFLINE,
        lastCheckedAt: new Date(),
        ...(success ? { lastOnlineAt: new Date() } : {}),
      },
    });

    if (!success) {
      const reason = maskRtspUrl(stderr?.trim() || error.message);
      console.error(
        `[camera:test-connection] camera=${id} url=${maskRtspUrl(rtspUrl)} latencyMs=${latencyMs} code=${
          (error as NodeJS.ErrnoException).code ?? "unknown"
        } killed=${(error as { killed?: boolean }).killed ?? false} reason=${reason}`,
      );
      return res.json({
        success: false,
        message: "Gagal terhubung ke kamera. Periksa IP, port, kredensial, dan jaringan.",
        reason,
        rtspUrl: maskRtspUrl(rtspUrl),
        latencyMs,
      });
    }

    let streamInfo: unknown = null;
    try {
      streamInfo = JSON.parse(stdout).streams?.[0];
    } catch {
      // ignore parse error, koneksi tetap dianggap berhasil
    }

    res.json({
      success: true,
      message: "Koneksi kamera berhasil",
      rtspUrl: maskRtspUrl(rtspUrl),
      latencyMs,
      streamInfo,
    });
  });
}
