import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getHelpPagesByCategory, helpCategories } from "@/lib/help/pages";

export const metadata: Metadata = {
  title: "ヘルプセンター",
  description:
    "Clipshareの使い方をまとめたヘルプセンターです。動画やスクリーンショットの投稿方法、公開設定とNSFW、共有と埋め込み、クイック共有、検索演算子の使い方を解説しています。",
  alternates: {
    canonical: "/help",
  },
};

export default function HelpIndexPage() {
  return (
    <main className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <nav aria-label="パンくずリスト" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <Link className="hover:text-foreground" href="/">
            Clipshare
          </Link>
          <ChevronRight className="shrink-0" size={14} />
          <span aria-current="page" className="text-foreground">
            ヘルプ
          </span>
        </nav>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">ヘルプセンター</h1>
          <p className="mt-5 text-base leading-8 text-muted-foreground">
            Clipshareの使い方をまとめています。はじめて投稿する方は「はじめかた」から、投稿が見つけてもらえるようにしたい方は「タイトル・説明文・タグの書き方」から読むのがおすすめです。目的のページが見つからない場合は、お問い合わせフォームからご質問ください。
          </p>

          <div className="mt-10 space-y-10">
            {helpCategories.map((category) => (
              <section className="border-t border-border/70 pt-8 first:border-t-0 first:pt-0" key={category}>
                <h2 className="text-xl font-bold sm:text-2xl">{category}</h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {getHelpPagesByCategory(category).map((page) => (
                    <li key={page.slug}>
                      <Link
                        className="flex h-full flex-col rounded-md border border-border bg-background p-4 transition hover:border-primary/60 hover:bg-muted"
                        href={`/help/${page.slug}`}
                      >
                        <span className="font-semibold">{page.title}</span>
                        <span className="mt-2 text-sm leading-6 text-muted-foreground">{page.summary}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>

        <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-bold">関連ページ</h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            サービスの概要は
            <Link className="text-primary hover:underline" href="/about">
              Clipshareについて
            </Link>
            、投稿してよい内容の基準は
            <Link className="text-primary hover:underline" href="/guidelines">
              コミュニティガイドライン
            </Link>
            、利用条件は
            <Link className="text-primary hover:underline" href="/terms">
              利用規約
            </Link>
            をご確認ください。ヘルプで解決しない場合は
            <Link className="text-primary hover:underline" href="/contact">
              お問い合わせフォーム
            </Link>
            からご連絡いただけます。
          </p>
        </section>
      </div>
    </main>
  );
}
