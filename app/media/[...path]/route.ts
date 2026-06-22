import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<unknown> }) {
  const params = await context.params;
  const segments = getPathSegments(params);
  const safeSegments = segments.filter((segment) => segment && segment !== ".." && !segment.includes("\\"));
  const root = getMediaRoot();
  const filePath = path.resolve(root, ...safeSegments);

  if (!filePath.startsWith(root)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const file = await readFile(filePath);
    return new NextResponse(file, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": contentType(filePath),
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

function getPathSegments(params: unknown) {
  if (
    typeof params === "object" &&
    params !== null &&
    "path" in params &&
    Array.isArray((params as { path: unknown }).path)
  ) {
    return (params as { path: string[] }).path;
  }

  return [];
}

function getMediaRoot() {
  const root = process.env.MEDIA_ROOT;

  if (!root) {
    throw new Error("MEDIA_ROOT is required for media file serving.");
  }

  return path.resolve(root);
}

function contentType(filePath: string) {
  if (filePath.endsWith(".webp")) {
    return "image/webp";
  }
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (filePath.endsWith(".png")) {
    return "image/png";
  }
  if (filePath.endsWith(".m3u8")) {
    return "application/vnd.apple.mpegurl";
  }
  if (filePath.endsWith(".ts")) {
    return "video/mp2t";
  }
  if (filePath.endsWith(".mp4")) {
    return "video/mp4";
  }
  return "application/octet-stream";
}
