#!/usr/bin/env node
import { rm } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const root = process.cwd();
const dryRun = process.argv.includes("--dry-run");
const limit = Number(process.env.CLEANUP_QUICK_SHARE_LIMIT ?? 200);
const mediaRoot = path.resolve(process.env.MEDIA_ROOT ?? path.join(root, "storage", "uploads", "processed"));

try {
  const items = await prisma.quickShare.findMany({
    where: {
      deletedAt: null,
      expiresAt: {
        lte: new Date(),
      },
    },
    orderBy: {
      expiresAt: "asc",
    },
    take: limit,
  });

  if (items.length === 0) {
    console.log("No quick shares to clean up.");
    process.exit(0);
  }

  for (const item of items) {
    const filePath = resolveMediaPath(item.mediaUrl);

    if (!filePath) {
      console.warn(`Skipping quick share with invalid mediaUrl: ${item.mediaUrl}`);
      if (!dryRun) {
        await prisma.quickShare.update({
          where: { id: item.id },
          data: { deletedAt: new Date() },
        });
      }
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] quick-share ${filePath}`);
      continue;
    }

    await rm(filePath, { force: true });
    await prisma.quickShare.update({
      where: { id: item.id },
      data: { deletedAt: new Date() },
    });
    console.log(`Deleted quick-share ${filePath}`);
  }
} finally {
  await prisma.$disconnect();
}

function resolveMediaPath(mediaUrl) {
  if (!mediaUrl?.startsWith("/media/")) {
    return null;
  }

  const relativePath = mediaUrl.slice("/media/".length);
  const resolved = path.resolve(mediaRoot, relativePath);

  if (resolved !== mediaRoot && !resolved.startsWith(`${mediaRoot}${path.sep}`)) {
    return null;
  }

  return resolved;
}
