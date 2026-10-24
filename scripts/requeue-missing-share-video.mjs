#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");
const limit = Number(process.env.REQUEUE_LIMIT ?? 500);

try {
  const posts = await prisma.post.findMany({
    where: {
      type: "CLIP",
      status: "PUBLISHED",
      shareVideoUrl: null,
      originalFilePath: {
        not: null,
      },
      uploadJobs: {
        none: {
          status: {
            in: ["QUEUED", "PROCESSING"],
          },
        },
      },
    },
    select: {
      id: true,
      publicId: true,
      originalFilePath: true,
    },
    take: limit,
  });

  if (posts.length === 0) {
    console.log("No posts need a share video re-encode.");
    process.exit(0);
  }

  console.log(`Found ${posts.length} post(s) missing shareVideoUrl.`);

  for (const post of posts) {
    if (dryRun) {
      console.log(`[dry-run] would queue re-encode for ${post.publicId}`);
      continue;
    }

    await prisma.uploadJob.create({
      data: {
        postId: post.id,
        inputPath: post.originalFilePath,
        status: "QUEUED",
      },
    });
    console.log(`Queued re-encode for ${post.publicId}`);
  }

  console.log("");
  console.log(dryRun ? "Dry run complete. Re-run without --dry-run to queue jobs." : "Run the video worker (npm run worker) to process the queue.");
} finally {
  await prisma.$disconnect();
}
