#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const email = process.argv[2];
const role = process.argv[3] ?? "OWNER";

if (!email || !["MODERATOR", "ADMIN", "OWNER"].includes(role)) {
  console.error("Usage: node scripts/promote-admin.mjs user@example.com OWNER");
  process.exit(1);
}

try {
  const user = await prisma.user.update({
    where: { email },
    data: { role },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
    },
  });

  console.log(`Updated ${user.email ?? user.id} to ${user.role}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
