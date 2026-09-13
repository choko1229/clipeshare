import type { Metadata } from "next";
import Link from "next/link";
import { CircleHelp, House, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "ページが見つかりません",
  robots: {
    index: false,
    follow: true,
  },
};

export default function NotFound() {
  return (
    <main className="grid min-h-[calc(100dvh-12rem)] place-items-center px-4 py-12">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-sm sm:p-10">
        <p className="text-6xl font-extrabold tracking-tight text-primary">404</p>
        <h1 className="mt-4 text-2xl font-bold">ページが見つかりません</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          お探しのページは、URLが間違っているか、投稿が削除・非公開になった可能性があります。
        </p>
        <div className="mt-8 grid gap-2 sm:grid-cols-3">
          <Button asChild>
            <Link href="/">
              <House size={18} />
              ホーム
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/search">
              <Search size={18} />
              検索
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/help">
              <CircleHelp size={18} />
              ヘルプ
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
