import Link from "next/link";
import { Bell, CheckCheck, Heart, MessageCircle, UserPlus, UserRound } from "lucide-react";
import { markAllNotificationsRead } from "@/app/notice/actions";
import { toggleFollow } from "@/app/users/[username]/actions";
import { Button } from "@/components/ui/button";
import { requireActiveUser } from "@/lib/auth/active-user";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function NoticePage() {
  const user = await requireActiveUser();
  const notifications = await prisma.notification.findMany({
    where: {
      userId: user.id,
    },
    include: {
      actor: {
        select: {
          displayName: true,
          id: true,
          name: true,
          username: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 80,
  });
  const actorIds = notifications.map((notification) => notification.actorId).filter((actorId): actorId is string => Boolean(actorId));
  const followingActorIds = new Set(
    actorIds.length > 0
      ? (
          await prisma.follow.findMany({
            where: {
              followerId: user.id,
              followingId: {
                in: actorIds,
              },
            },
            select: {
              followingId: true,
            },
          })
        ).map((follow) => follow.followingId)
      : [],
  );
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  if (unreadCount > 0) {
    await prisma.notification.updateMany({
      where: {
        userId: user.id,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });
  }

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">通知</p>
            <h1 className="mt-1 text-3xl font-bold">お知らせ</h1>
          </div>
          <form action={markAllNotificationsRead}>
            <Button type="submit" variant="outline">
              <CheckCheck size={18} />
              すべて既読
            </Button>
          </form>
        </div>

        <section className="mt-6 overflow-hidden rounded-md border border-border bg-card">
          {notifications.length > 0 ? (
            notifications.map((notification) => {
              const actorName = notification.actor?.displayName ?? notification.actor?.name ?? notification.actor?.username ?? "ユーザー";
              const unread = !notification.readAt;

              return (
                <article
                  className={`flex items-start gap-3 border-b border-border p-4 transition last:border-b-0 hover:bg-muted ${
                    unread ? "bg-primary/5" : "bg-card"
                  }`}
                  key={notification.id}
                >
                  <Link className="mt-1 grid size-10 shrink-0 place-items-center rounded-full bg-muted text-primary" href={`/notice/${notification.id}`}>
                    {notification.type === "COMMENT_ON_POST" || notification.type === "COMMENT_REPLY" ? (
                      <MessageCircle size={18} />
                    ) : notification.type === "FOLLOW" ? (
                      <UserRound size={18} />
                    ) : notification.type === "LIKE_ON_POST" ? (
                      <Heart size={18} />
                    ) : (
                      <Bell size={18} />
                    )}
                  </Link>
                  <Link className="min-w-0 flex-1" href={`/notice/${notification.id}`}>
                    <span className="block text-sm font-semibold">{notificationTitle(notification.type, actorName)}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {notification.createdAt.toLocaleString("ja-JP")}
                      {unread ? " / 未読" : ""}
                    </span>
                  </Link>
                  {notification.type === "FOLLOW" && notification.actor?.username ? (
                    followingActorIds.has(notification.actor.id) ? (
                      <Button className="h-9 shrink-0 px-3 text-xs" disabled type="button" variant="outline">
                        フォロー中
                      </Button>
                    ) : (
                      <form action={toggleFollow} className="shrink-0">
                        <input name="username" type="hidden" value={notification.actor.username} />
                        <Button className="h-9 px-3 text-xs" type="submit" variant="outline">
                          <UserPlus size={16} />
                          フォローバック
                        </Button>
                      </form>
                    )
                  ) : null}
                </article>
              );
            })
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">通知はまだありません。</div>
          )}
        </section>
      </div>
    </main>
  );
}

function notificationTitle(type: string, actorName: string) {
  if (type === "COMMENT_ON_POST") {
    return `${actorName} さんがあなたの投稿にコメントしました`;
  }

  if (type === "COMMENT_REPLY") {
    return `${actorName} さんがあなたのコメントに返信しました`;
  }

  if (type === "LIKE_ON_POST") {
    return `${actorName} さんがあなたの投稿にいいねしました`;
  }

  if (type === "FOLLOW") {
    return `${actorName} さんがあなたをフォローしました`;
  }

  return "新しい通知があります";
}
