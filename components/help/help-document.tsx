import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { getRelatedHelpPages } from "@/lib/help/pages";

export { LegalArticle as HelpSection } from "@/components/legal/legal-document";

type HelpDocumentProps = {
  slug: string;
  title: string;
  lead: ReactNode;
  children: ReactNode;
};

export function HelpDocument({ slug, title, lead, children }: HelpDocumentProps) {
  const related = getRelatedHelpPages(slug);

  return (
    <main className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <nav aria-label="パンくずリスト" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <Link className="hover:text-foreground" href="/">
            Clipshare
          </Link>
          <ChevronRight className="shrink-0" size={14} />
          <Link className="hover:text-foreground" href="/help">
            ヘルプ
          </Link>
          <ChevronRight className="shrink-0" size={14} />
          <span aria-current="page" className="text-foreground">
            {title}
          </span>
        </nav>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-5 text-base leading-8 text-muted-foreground">{lead}</p>
          <div className="mt-10 space-y-10">{children}</div>
        </div>

        <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-bold">関連するヘルプ</h2>
          <ul className="mt-4 space-y-3">
            {related.map((page) => (
              <li key={page.slug}>
                <Link
                  className="flex items-start gap-3 rounded-md border border-border bg-background p-4 transition hover:border-primary/60 hover:bg-muted"
                  href={`/help/${page.slug}`}
                >
                  <ChevronRight className="mt-1 shrink-0 text-primary" size={16} />
                  <span className="min-w-0">
                    <span className="block font-semibold">{page.title}</span>
                    <span className="mt-1 block text-sm leading-6 text-muted-foreground">{page.summary}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm leading-7 text-muted-foreground">
            解決しない場合は
            <Link className="text-primary hover:underline" href="/contact">
              お問い合わせフォーム
            </Link>
            からご連絡ください。ヘルプの一覧は
            <Link className="text-primary hover:underline" href="/help">
              ヘルプセンター
            </Link>
            から確認できます。
          </p>
        </section>
      </div>
    </main>
  );
}
