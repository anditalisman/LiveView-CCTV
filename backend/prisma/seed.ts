import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminUsername = process.env.SEED_ADMIN_USERNAME || "admin";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin123!";

  const existing = await prisma.user.findUnique({ where: { username: adminUsername } });
  if (existing) {
    console.log(`User "${adminUsername}" sudah ada, skip seeding.`);
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.create({
    data: {
      username: adminUsername,
      passwordHash,
      fullName: "Administrator",
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log(`Admin user dibuat: ${adminUsername} / ${adminPassword}`);
  console.log("SEGERA ganti password ini setelah login pertama kali.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
