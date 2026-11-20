import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Download, Link2 } from "lucide-react";
import { revokeConnectedApp } from "@/app/settings/apps/actions";
import { authOptions } from "@/auth";
import { ConnectedAppRow } from "@/components/settings/connected-app-row";
import { Button } from "@/components/ui/button";
import { listActiveApiTokensForUser } from "@/lib/api-auth/tokens";
import { formatRelativeTimeJa } from "@/lib/format/relative-time";
import { startOfQuickShareDay } from "@/lib/quick-share/rate-limit";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "連携アプリ",
  robots: {
    index: false,
    follow: false,
  },
};

const settingsTabs = [
  { href: "/settings/profile", label: "プロフィール" },
  { href: "/settings/age", label: "年齢確認" },
  { href: "/settings/apps", label: "連携アプリ" },
];

export default async function ConnectedAppsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/settings/apps")}`);
  }

  const now = new Date();
  const tokens = await listActiveApiTokensForUser(session.user.id, startOfQuickShareDay(now));

  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-7 px-4 pb-14 pt-10">
      <h1 className="text-2xl font-extrabold leading-snug">設定</h1>
      <nav className="flex gap-5 border-b border-border">
        {settingsTabs.map((tab) => {
          const active = tab.href === "/settings/apps";
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "border-b-2 border-primary px-1 py-2.5 text-sm font-bold"
                  : "border-b-2 border-transparent px-1 py-2.5 text-sm text-muted-foreground hover:text-foreground"
              }
              href={tab.href}
              key={tab.href}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="w-full max-w-3xl">
        {tokens.length > 0 ? (
          <section className="rounded-md border border-border bg-card">
            <h2 className="px-4 pb-1 pt-4 text-base font-extrabold leading-snug">連携中のアプリ</h2>
            <p className="px-4 pb-3 text-[13px] leading-relaxed text-muted-foreground">
              Clipshareにアクセスできるアプリです。使っていないものは解除してください。
            </p>
            <div className="divide-y divide-border border-t border-border">
              {tokens.map((token) => (
                <ConnectedAppRow
                  deviceName={token.name}
                  detail={[token.name, token.platform, token.clientVersion ? `v${token.clientVersion}` : null].filter(Boolean).join(" · ")}
                  key={token.id}
                  lastUsedLabel={formatRelativeTimeJa(token.lastUsedAt ?? token.createdAt, now)}
                  revokeAction={revokeConnectedApp}
                  todayCount={token.todayCount}
                  tokenId={token.id}
                />
              ))}
            </div>
          </section>
        ) : (
          <section className="flex flex-col items-center rounded-md border border-border bg-card p-6 text-center">
            <div className="grid size-14 place-items-center rounded-full bg-muted">
              <Link2 aria-hidden="true" className="text-muted-foreground" size={26} />
            </div>
            <p className="mt-3 text-sm font-extrabold leading-relaxed">連携しているアプリはありません</p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
              Windows用アプリを使うと、VRChatの写真を撮るだけで共有URLをコピーできます。
            </p>
            <Button asChild className="mt-3.5 font-bold">
              <Link href="/qick/download">
                <Download aria-hidden="true" size={16} />
                アプリをダウンロード
              </Link>
            </Button>
          </section>
        )}
      </div>
    </main>
  );
}
