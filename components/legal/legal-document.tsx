import type { ReactNode } from "react";

type LegalDocumentProps = {
  title: string;
  lead: ReactNode;
  updatedNote?: string;
  children: ReactNode;
};

export function LegalDocument({ title, lead, updatedNote, children }: LegalDocumentProps) {
  return (
    <main className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
          {updatedNote ? <p className="mt-2 text-xs text-muted-foreground">{updatedNote}</p> : null}
          <p className="mt-5 text-base leading-8 text-muted-foreground">{lead}</p>
          <div className="mt-10 space-y-10">{children}</div>
        </div>
      </div>
    </main>
  );
}

type LegalArticleProps = {
  index?: string;
  title: string;
  children: ReactNode;
};

export function LegalArticle({ index, title, children }: LegalArticleProps) {
  return (
    <section className="border-t border-border/70 pt-8 first:border-t-0 first:pt-0">
      <h2 className="flex items-center gap-3 text-xl font-bold sm:text-2xl">
        {index ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
            {index}
          </span>
        ) : null}
        <span>{title}</span>
      </h2>
      <div className="mt-4 space-y-4 pl-0 text-base leading-8 text-foreground/90 sm:pl-12 [&_li]:leading-7 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
        {children}
      </div>
    </section>
  );
}
