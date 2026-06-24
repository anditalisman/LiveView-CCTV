import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";

const userSelect = {
  id: true,
  username: true,
  fullName: true,
  role: true,
  isActive: true,
  createdAt: true,
};

export async function listUsers(_req: Request, res: Response) {
  const users = await prisma.user.findMany({
    select: userSelect,
    orderBy: { createdAt: "asc" },
  });
  res.json(users);
}

const createUserSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(8),
  fullName: z.string().min(1),
  role: z.enum(["ADMIN", "OPERATOR"]),
});

export async function createUser(req: Request, res: Response) {
  const data = createUserSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { username: data.username } });
  if (existing) throw new ApiError(409, "Username sudah digunakan");

  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({
    data: {
      username: data.username,
      passwordHash,
      fullName: data.fullName,
      role: data.role,
    },
    select: userSelect,
  });
  res.status(201).json(user);
}

const updateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "OPERATOR"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

export async function updateUser(req: Request, res: Response) {
  const { id } = req.params;
  const data = updateUserSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new ApiError(404, "User tidak ditemukan");

  const updated = await prisma.user.update({
    where: { id },
    data: {
      fullName: data.fullName,
      role: data.role,
      isActive: data.isActive,
      ...(data.password ? { passwordHash: await bcrypt.hash(data.password, 12) } : {}),
    },
    select: userSelect,
  });
  res.json(updated);
}

export async function deleteUser(req: Request, res: Response) {
  const { id } = req.params;
  if (id === req.user!.sub) {
    throw new ApiError(400, "Tidak bisa menghapus akun Anda sendiri");
  }
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new ApiError(404, "User tidak ditemukan");
  await prisma.user.delete({ where: { id } });
  res.status(204).send();
}
