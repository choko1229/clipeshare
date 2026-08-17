import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { registerViewRelay } from "@/lib/live/media-control";
import { notifyFollowersOfLiveStart } from "@/lib/live/notify";
import { getLiveSettings } from "@/lib/live/settings";

const bodySchema = z.object({
  streamKey: z.string().min(1),
});

/**
 * MediaMTXのrunOnPublish(配信開始)フックから呼ばれる。
 * ストリームキーを検証し、同時配信数上限を超えていなければLIVEへ遷移させる。
 * 401/403以外を返すとMediaMTXはpublishを拒否する(具体的な連携方法はdocs/vps-deployment.md参照)。
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-live-hook-secret");
  if (!process.env.LIVE_MEDIA_HOOK_SECRET || secret !== process.env.LIVE_MEDIA_HOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const stream = await prisma.liveStream.findUnique({
    where: { streamKey: parsed.data.streamKey },
  });

  if (!stream) {
    return NextResponse.json({ error: "invalid_stream_key" }, { status: 403 });
  }

  if (stream.status !== "LIVE") {
    const settings = await getLiveSettings();
    const liveCount = await prisma.liveStream.count({ where: { status: "LIVE" } });

    if (liveCount >= settings.maxConcurrentStreams) {
      return NextResponse.json({ error: "capacity_exceeded" }, { status: 503 });
    }
  }

  const isNewSession = await prisma.$transaction(async (tx) => {
    await tx.liveStream.update({
      where: { id: stream.id },
      data: { status: "LIVE", disconnectedAt: null },
    });

    const activeSession = await tx.liveSession.findFirst({
      where: { liveStreamId: stream.id, endedAt: null },
    });

    if (activeSession) {
      return false;
    }

    await tx.liveSession.create({
      data: { liveStreamId: stream.id },
    });
    return true;
  });

  void registerViewRelay(stream.streamKey, stream.viewToken);

  if (isNewSession) {
    void notifyFollowersOfLiveStart({
      liveStreamId: stream.id,
      streamerId: stream.userId,
      viewToken: stream.viewToken,
      visibility: stream.visibility,
    });
  }

  return NextResponse.json({ ok: true });
}
