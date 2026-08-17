import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { registerViewRelay } from "@/lib/live/media-control";
import { notifyFollowersOfLiveStart } from "@/lib/live/notify";
import { getLiveSettings } from "@/lib/live/settings";

const bodySchema = z.object({
  action: z.string(),
  path: z.string().optional().default(""),
});

function streamKeyFromPath(path: string) {
  return path.replace(/^live\//, "");
}

/**
 * MediaMTXの組み込み認証(authHTTPAddress)から、publish/read/api等すべてのアクションについて呼ばれる。
 * publish以外は無条件に許可し、publishのみストリームキーと同時配信数上限を検証する。
 * authHTTPAddressはカスタムヘッダーを付けられないため、共有シークレットはURLのクエリ文字列で渡す
 * (mediamtx.yml側で authHTTPAddress に ?secret=... を埋め込む。docs/vps-deployment.md参照)。
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  if (!process.env.LIVE_MEDIA_HOOK_SECRET || secret !== process.env.LIVE_MEDIA_HOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (parsed.data.action !== "publish") {
    return NextResponse.json({ ok: true });
  }

  const streamKey = streamKeyFromPath(parsed.data.path);
  const stream = await prisma.liveStream.findUnique({
    where: { streamKey },
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
