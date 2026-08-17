import { prisma } from "@/lib/db/prisma";
import { sendWebPushToUser } from "@/lib/notifications/web-push";
import type { LiveVisibility } from "@prisma/client";

export async function notifyFollowersOfLiveStart(params: {
  liveStreamId: string;
  streamerId: string;
  viewToken: string;
  visibility: LiveVisibility;
}) {
  if (params.visibility === "PRIVATE") {
    return;
  }

  const [streamer, followers] = await Promise.all([
    prisma.user.findUnique({
      where: { id: params.streamerId },
      select: { username: true, displayName: true, name: true },
    }),
    prisma.follow.findMany({
      where: { followingId: params.streamerId },
      select: { followerId: true },
    }),
  ]);

  if (followers.length === 0) {
    return;
  }

  const streamerName = streamer?.displayName ?? streamer?.username ?? streamer?.name ?? "ユーザー";
  const url = `/l/${params.viewToken}`;

  await prisma.notification.createMany({
    data: followers.map((follow) => ({
      userId: follow.followerId,
      actorId: params.streamerId,
      type: "LIVE_STREAM_STARTED" as const,
      targetType: "LIVE_STREAM" as const,
      targetId: params.liveStreamId,
    })),
  });

  await Promise.all(
    followers.map((follow) =>
      sendWebPushToUser(follow.followerId, {
        title: "ライブ配信が始まりました",
        body: `${streamerName} さんが配信を開始しました`,
        url,
      }),
    ),
  );
}
