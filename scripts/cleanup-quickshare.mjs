#!/usr/bin/env node
import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const root = process.cwd();
const dryRun = process.argv.includes("--dry-run");
const limit = Number(process.env.CLEANUP_QUICK_SHARE_LIMIT ?? 200);
const mediaRoot = path.resolve(process.env.MEDIA_ROOT ?? path.join(root, "storage", "uploads", "processed"));
// /api/v1/quick の受信途中の一時ファイル(異常終了で残ったもの)
const incomingRoot = path.join(root, "storage", "uploads", "originals", "quick", "incoming");
const incomingMaxAgeMs = 24 * 60 * 60 * 1000;

try {
  await cleanupIncomingTempFiles();

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
    const filePaths = [resolveMediaPath(item.mediaUrl), resolveMediaPath(item.thumbnailUrl), item.originalPath].filter(
      (value) => typeof value === "string" && value.length > 0,
    );

    if (dryRun) {
      for (const filePath of filePaths) {
        console.log(`[dry-run] quick-share ${filePath}`);
      }
      continue;
    }

    for (const filePath of filePaths) {
      await rm(filePath, { force: true });
    }

    await prisma.quickShare.update({
      where: { id: item.id },
      data: { deletedAt: new Date() },
    });
    console.log(`Deleted quick-share ${item.publicId} (${filePaths.length} file(s))`);
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

async function cleanupIncomingTempFiles() {
  const entries = await readdir(incomingRoot, { withFileTypes: true }).catch(() => []);
  const now = Date.now();

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".upload")) {
      continue;
    }

    const filePath = path.join(incomingRoot, entry.name);
    const info = await stat(filePath).catch(() => null);

    if (!info || now - info.mtimeMs < incomingMaxAgeMs) {
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] quick-share temp ${filePath}`);
      continue;
    }

    await rm(filePath, { force: true });
    console.log(`Deleted stale quick-share temp file ${entry.name}`);
  }
}
