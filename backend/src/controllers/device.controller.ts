import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { encryptSecret } from "../utils/crypto";
import { ApiError } from "../middleware/errorHandler";

// rtspPasswordEnc TIDAK PERNAH disertakan di select agar tidak pernah sampai ke frontend.
const deviceSelect = {
  id: true,
  name: true,
  type: true,
  brand: true,
  ipAddress: true,
  port: true,
  rtspUsername: true,
  transport: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { cameras: true } },
};

export async function listDevices(_req: Request, res: Response) {
  const devices = await prisma.device.findMany({
    select: deviceSelect,
    orderBy: { createdAt: "asc" },
  });
  res.json(devices);
}

export async function getDevice(req: Request, res: Response) {
  const device = await prisma.device.findUnique({
    where: { id: req.params.id },
    select: deviceSelect,
  });
  if (!device) throw new ApiError(404, "Device tidak ditemukan");
  res.json(device);
}

const deviceSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["IP_CAMERA", "NVR"]),
  brand: z.string().min(1).default("Hikvision"),
  ipAddress: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(554),
  rtspUsername: z.string().min(1),
  rtspPassword: z.string().min(1),
  transport: z.enum(["tcp", "udp"]).default("tcp"),
  notes: z.string().optional(),
});

export async function createDevice(req: Request, res: Response) {
  const data = deviceSchema.parse(req.body);
  const device = await prisma.device.create({
    data: {
      name: data.name,
      type: data.type,
      brand: data.brand,
      ipAddress: data.ipAddress,
      port: data.port,
      rtspUsername: data.rtspUsername,
      rtspPasswordEnc: encryptSecret(data.rtspPassword),
      transport: data.transport,
      notes: data.notes,
    },
    select: deviceSelect,
  });
  res.status(201).json(device);
}

const updateDeviceSchema = deviceSchema.partial();

export async function updateDevice(req: Request, res: Response) {
  const { id } = req.params;
  const data = updateDeviceSchema.parse(req.body);

  const existing = await prisma.device.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Device tidak ditemukan");

  const device = await prisma.device.update({
    where: { id },
    data: {
      name: data.name,
      type: data.type,
      brand: data.brand,
      ipAddress: data.ipAddress,
      port: data.port,
      rtspUsername: data.rtspUsername,
      transport: data.transport,
      notes: data.notes,
      ...(data.rtspPassword ? { rtspPasswordEnc: encryptSecret(data.rtspPassword) } : {}),
    },
    select: deviceSelect,
  });
  res.json(device);
}

export async function deleteDevice(req: Request, res: Response) {
  const { id } = req.params;
  const existing = await prisma.device.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Device tidak ditemukan");
  // onDelete: Cascade pada relasi Camera akan menghapus semua channel terkait.
  await prisma.device.delete({ where: { id } });
  res.status(204).send();
}
