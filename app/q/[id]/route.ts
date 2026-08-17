import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { mediaUrlToProcessedPath } from "@/lib/media/retention";
import { serveMediaFile } from "@/lib/media/serve-file";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const acceptHeader = request.headers.get("accept") ?? "";
  const isBrowserNavigation = acceptHeader.includes("text/html");

  const quickShare = await prisma.quickShare.findUnique({ where: { publicId: id } });
  const isGone = !quickShare || quickShare.deletedAt !== null || quickShare.expiresAt <= new Date();

  if (isBrowserNavigation) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const target = isGone ? "/qick?expired=1" : `/q/${id}/view`;
    return NextResponse.redirect(new URL(target, baseUrl));
  }

  if (isGone || quickShare.status === "FAILED") {
    return new NextResponse("Not found", { status: 404 });
  }

  const filePath =
    quickShare.status === "PROCESSING" ? quickShare.originalPath : mediaUrlToProcessedPath(quickShare.mediaUrl);

  if (!filePath) {
    return new NextResponse("Not found", { status: 404 });
  }

  return serveMediaFile(request, filePath);
}
