#!/usr/bin/env node
import { rm } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const root = process.cwd();
const dryRun = process.argv.includes("--dry-run");
const limit = Number(process.env.CLEANUP_MEDIA_LIMIT ?? 200);
const storageRoots = [
  path.resolve(process.env.MEDIA_ROOT ?? path.join(root, "storage", "uploads", "processed")),
  path.resolve(process.env.ORIGINAL_UPLOAD_ROOT ?? path.join(root, "storage", "uploads", "originals")),
  path.resolve(process.env.DELETED_UPLOAD_ROOT ?? path.join(root, "storage", "deleted")),
];

try {
  const files = await prisma.mediaRetentionFile.findMany({
    where: {
      deletedAt: null,
      deleteAfter: {
        lte: new Date(),
      },
    },
    orderBy: {
      deleteAfter: "asc",
    },
    take: limit,
  });

  if (files.length === 0) {
    console.log("No media files to clean up.");
    process.exit(0);
  }

  for (const file of files) {
    const filePath = path.resolve(file.path);

    if (!isInsideStorage(filePath)) {
      console.warn(`Skipping path outside storage roots: ${file.path}`);
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] ${file.reason} ${filePath}`);
      continue;
    }

    await rm(filePath, { force: true, recursive: false });
    await prisma.$transaction(async (tx) => {
      await tx.mediaRetentionFile.update({
        where: { id: file.id },
        data: { deletedAt: new Date() },
      });

      if (file.reason === "ORIGINAL_VIDEO" && file.postId) {
        await tx.post.updateMany({
          where: {
            id: file.postId,
            originalFilePath: file.path,
          },
          data: {
            originalFilePath: null,
          },
        });
      }
    });
    console.log(`Deleted ${file.reason} ${filePath}`);
  }
} finally {
  await prisma.$disconnect();
}

function isInsideStorage(filePath) {
  return storageRoots.some((storageRoot) => filePath === storageRoot || filePath.startsWith(`${storageRoot}${path.sep}`));
}
