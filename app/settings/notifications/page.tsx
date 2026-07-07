import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { Button } from "@/components/ui/button";
import { PushNotificationSettings } from "@/components/notifications/push-notification-settings";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function NotificationSettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const activeSubscriptions = await prisma.pushSubscription.count({
    where: {
      userId: session.user.id,
      revokedAt: null,
    },
  });

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">設定</p>
            <h1 className="mt-1 text-3xl font-bold">通知設定</h1>
          </div>
          <Button asChild variant="outline">
            <Link href="/notice">通知一覧へ</Link>
          </Button>
        </div>

        <div className="grid gap-4">
          <section className="rounded-md border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">アプリ内通知</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              コメント、返信、いいね、フォローはClipshare内の通知一覧に保存されます。現在は常に有効です。
            </p>
          </section>

          <PushNotificationSettings publicKey={process.env.WEB_PUSH_VAPID_PUBLIC_KEY} />

          <section className="rounded-md border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">登録済み端末</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              現在このアカウントで有効な端末通知: <span className="font-semibold text-foreground">{activeSubscriptions}</span> 件
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
