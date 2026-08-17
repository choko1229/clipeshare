import { prisma } from "@/lib/db/prisma";
import { kickPublisher, unregisterViewRelay } from "@/lib/live/media-control";
import { generateStreamKey, generateViewToken } from "@/lib/live/tokens";

export async function getOrCreateLiveStream(userId: string) {
  const existing = await prisma.liveStream.findUnique({
    where: { userId },
  });

  if (existing) {
    return existing;
  }

  return prisma.liveStream.create({
    data: {
      userId,
      streamKey: generateStreamKey(),
      viewToken: generateViewToken(),
    },
  });
}

export async function getCurrentLiveSession(liveStreamId: string) {
  return prisma.liveSession.findFirst({
    where: {
      liveStreamId,
      endedAt: null,
    },
    orderBy: {
      startedAt: "desc",
    },
  });
}

/**
 * BANされたユーザーの配信を即時に止める。ユーザーBAN(通報経由/直接BAN問わず)の後処理として呼び出す。
 */
export async function stopUserLiveStream(userId: string) {
  const stream = await prisma.liveStream.findUnique({ where: { userId } });

  if (!stream || stream.status !== "LIVE") {
    return;
  }

  const session = await getCurrentLiveSession(stream.id);

  await prisma.$transaction(async (tx) => {
    await tx.liveStream.update({
      where: { id: stream.id },
      data: { status: "OFFLINE", disconnectedAt: null },
    });

    if (session) {
      await tx.liveSession.update({
        where: { id: session.id },
        data: { endedAt: new Date() },
      });
    }
  });

  await kickPublisher(stream.streamKey);
  await unregisterViewRelay(stream.viewToken);
}
