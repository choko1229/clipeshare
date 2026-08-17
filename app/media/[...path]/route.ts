import path from "node:path";
import { NextResponse } from "next/server";
import { serveMediaFile } from "@/lib/media/serve-file";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<unknown> }) {
  const params = await context.params;
  const segments = getPathSegments(params);
  const safeSegments = segments.filter((segment) => segment && segment !== ".." && !segment.includes("\\"));
  const root = getMediaRoot();
  const filePath = path.resolve(root, ...safeSegments);

  if (!filePath.startsWith(root)) {
    return new NextResponse("Not found", { status: 404 });
  }

  return serveMediaFile(request, filePath);
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
