import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

const bodySchema = z.object({
  path: z.string().min(1),
});

function streamKeyFromPath(path: string) {
  return path.replace(/^live\//, "");
}

/**
 * MediaMTXのrunOnOffline(配信ソースが切断された)フックから呼ばれる。
 * ここでは即座にOFFLINEへは倒さず、disconnectedAtを記録するだけに留める。
 * 実際のOFFLINE確定はscripts/live-chat-server.mjsの定期スイープ(猶予時間経過後)が行う。
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

  const streamKey = streamKeyFromPath(parsed.data.path);
  const stream = await prisma.liveStream.findUnique({
    where: { streamKey },
    select: { id: true, status: true },
  });

  if (!stream) {
    return NextResponse.json({ error: "invalid_stream_key" }, { status: 403 });
  }

  if (stream.status === "LIVE") {
    await prisma.liveStream.update({
      where: { id: stream.id },
      data: { disconnectedAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}
