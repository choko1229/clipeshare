#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const root = process.cwd();
const processedRoot = path.join(root, "storage", "uploads", "processed");
const pollMs = Number(process.env.WORKER_POLL_MS ?? 5000);
const fallbackMaxVideoSeconds = Number(process.env.MAX_VIDEO_SECONDS ?? 30);
const originalVideoRetentionDays = 30;

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
      include: {
        post: {
          include: {
            user: {
              include: {
                accountLevel: true,
              },
            },
          },
        },
      },
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
    const maxVideoSeconds = await resolveMaxVideoSeconds(job);
    const metadata = await probeVideo(job.inputPath);
    const clipRange = resolveClipRange(job, metadata.durationSeconds);
    if (clipRange.durationSeconds > maxVideoSeconds) {
      throw new Error(`Video duration ${clipRange.durationSeconds}s exceeds ${maxVideoSeconds}s.`);
    }

    const hlsDir = path.join(processedRoot, "hls", job.post.publicId);
    const shareVideoDir = path.join(processedRoot, "videos");
    const thumbnailDir = path.join(processedRoot, "thumbnails");
    await Promise.all([mkdir(hlsDir, { recursive: true }), mkdir(shareVideoDir, { recursive: true }), mkdir(thumbnailDir, { recursive: true })]);

    const thumbnailPath = path.join(thumbnailDir, `${job.post.publicId}.webp`);
    const shareVideoPath = path.join(shareVideoDir, `${job.post.publicId}.mp4`);
    const playlistPath = path.join(hlsDir, "master.m3u8");
    const segmentPattern = path.join(hlsDir, "segment_%03d.ts");

    await run("ffmpeg", [
      "-y",
      ...ffmpegInputArgs(job.inputPath, clipRange),
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
      ...ffmpegInputArgs(job.inputPath, clipRange),
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

    await run("ffmpeg", [
      "-y",
      ...ffmpegInputArgs(job.inputPath, clipRange),
      "-vf",
      "scale='if(gte(iw,ih),min(1280,iw),-2)':'if(gte(iw,ih),-2,min(1280,ih))',scale='trunc(iw/2)*2:trunc(ih/2)*2'",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "26",
      "-maxrate",
      "2500k",
      "-bufsize",
      "5000k",
      "-profile:v",
      "main",
      "-pix_fmt",
      "yuv420p",
      "-tag:v",
      "avc1",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      shareVideoPath,
    ]);

    await prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id: job.postId },
        data: {
          status: job.post.visibility === "PUBLIC" ? "PUBLISHED" : "PRIVATE",
          thumbnailUrl: `/media/thumbnails/${job.post.publicId}.webp`,
          mediaUrl: `/media/hls/${job.post.publicId}/master.m3u8`,
          shareVideoUrl: `/media/videos/${job.post.publicId}.mp4`,
          hlsPath: playlistPath,
          durationSeconds: Math.round(clipRange.durationSeconds),
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
      await tx.mediaRetentionFile.create({
        data: {
          postId: job.postId,
          path: job.inputPath,
          reason: "ORIGINAL_VIDEO",
          deleteAfter: daysFromNow(originalVideoRetentionDays),
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

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function resolveClipRange(job, sourceDurationSeconds) {
  const startSeconds = normalizeClipSecond(job.clipStartSeconds, 0);
  const requestedEndSeconds = normalizeClipSecond(job.clipEndSeconds, sourceDurationSeconds);
  const safeStartSeconds = Math.min(startSeconds, Math.max(0, sourceDurationSeconds - 0.1));
  const safeEndSeconds = Math.min(Math.max(requestedEndSeconds, safeStartSeconds + 0.1), sourceDurationSeconds);
  const durationSeconds = safeEndSeconds - safeStartSeconds;

  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error("Invalid video clip range.");
  }

  return {
    durationSeconds,
    endSeconds: safeEndSeconds,
    startSeconds: safeStartSeconds,
  };
}

function normalizeClipSecond(value, fallback) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : fallback;
}

function ffmpegInputArgs(inputPath, clipRange) {
  const hasCustomRange = clipRange.startSeconds > 0 || clipRange.endSeconds < Number.POSITIVE_INFINITY;
  const args = [];

  if (clipRange.startSeconds > 0) {
    args.push("-ss", formatSecond(clipRange.startSeconds));
  }

  args.push("-i", inputPath);

  if (hasCustomRange) {
    args.push("-t", formatSecond(clipRange.durationSeconds));
  }

  return args;
}

function formatSecond(value) {
  return Math.max(0, value).toFixed(3).replace(/\.?0+$/, "");
}

async function resolveMaxVideoSeconds(job) {
  if (job.post.user.accountLevel?.maxVideoSeconds) {
    return job.post.user.accountLevel.maxVideoSeconds;
  }

  const defaultLevel = await prisma.accountLevel.findFirst({
    where: { isDefault: true },
    orderBy: { createdAt: "asc" },
  });

  return defaultLevel?.maxVideoSeconds ?? fallbackMaxVideoSeconds;
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
