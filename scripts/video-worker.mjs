#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const root = process.cwd();
const processedRoot = path.join(root, "storage", "uploads", "processed");
const pollMs = Number(process.env.WORKER_POLL_MS ?? 5000);
const maxVideoSeconds = Number(process.env.MAX_VIDEO_SECONDS ?? 180);

let isProcessing = false;

console.log("Clipeshare video worker started.");

async function tick() {
  if (isProcessing) {
    return;
  }

  isProcessing = true;
  try {
    const job = await prisma.uploadJob.findFirst({
      where: { status: "QUEUED" },
      include: { post: true },
      orderBy: { createdAt: "asc" },
    });

    if (!job) {
      return;
    }

    await processJob(job);
  } catch (error) {
    console.error(error);
  } finally {
    isProcessing = false;
  }
}

async function processJob(job) {
  console.log(`Processing upload job ${job.id} for post ${job.post.publicId}`);

  await prisma.uploadJob.update({
    where: { id: job.id },
    data: { status: "PROCESSING", startedAt: new Date(), errorMessage: null },
  });

  try {
    const metadata = await probeVideo(job.inputPath);
    if (metadata.durationSeconds > maxVideoSeconds) {
      throw new Error(`Video duration ${metadata.durationSeconds}s exceeds ${maxVideoSeconds}s.`);
    }

    const hlsDir = path.join(processedRoot, "hls", job.post.publicId);
    const thumbnailDir = path.join(processedRoot, "thumbnails");
    await Promise.all([mkdir(hlsDir, { recursive: true }), mkdir(thumbnailDir, { recursive: true })]);

    const thumbnailPath = path.join(thumbnailDir, `${job.post.publicId}.webp`);
    const playlistPath = path.join(hlsDir, "master.m3u8");
    const segmentPattern = path.join(hlsDir, "segment_%03d.ts");

    await run("ffmpeg", [
      "-y",
      "-i",
      job.inputPath,
      "-vf",
      "thumbnail,scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720",
      "-frames:v",
      "1",
      "-c:v",
      "libwebp",
      "-quality",
      "82",
      thumbnailPath,
    ]);

    await run("ffmpeg", [
      "-y",
      "-i",
      job.inputPath,
      "-vf",
      "scale='min(1280,iw)':-2",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-f",
      "hls",
      "-hls_time",
      "4",
      "-hls_playlist_type",
      "vod",
      "-hls_segment_filename",
      segmentPattern,
      playlistPath,
    ]);

    await prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id: job.postId },
        data: {
          status: job.post.visibility === "PUBLIC" ? "PUBLISHED" : "PRIVATE",
          thumbnailUrl: `/media/thumbnails/${job.post.publicId}.webp`,
          mediaUrl: `/media/hls/${job.post.publicId}/master.m3u8`,
          hlsPath: playlistPath,
          durationSeconds: Math.round(metadata.durationSeconds),
          width: metadata.width,
          height: metadata.height,
          publishedAt: job.post.visibility === "PUBLIC" ? new Date() : null,
        },
      });
      await tx.uploadJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          outputPath: playlistPath,
          finishedAt: new Date(),
        },
      });
    });

    console.log(`Completed upload job ${job.id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed upload job ${job.id}: ${message}`);
    await prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id: job.postId },
        data: { status: "FAILED" },
      });
      await tx.uploadJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          errorMessage: message,
          finishedAt: new Date(),
        },
      });
    });
  }
}

async function probeVideo(inputPath) {
  const raw = await run("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,duration",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    inputPath,
  ]);
  const parsed = JSON.parse(raw);
  const stream = parsed.streams?.[0] ?? {};
  const duration = Number(stream.duration ?? parsed.format?.duration ?? 0);

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Could not read video duration.");
  }

  return {
    durationSeconds: duration,
    width: Number.isFinite(Number(stream.width)) ? Number(stream.width) : null,
    height: Number.isFinite(Number(stream.height)) ? Number(stream.height) : null,
  };
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(`${command} exited with ${code}: ${stderr}`));
    });
  });
}

setInterval(tick, pollMs);
await tick();
