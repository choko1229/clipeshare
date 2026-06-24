"use client";

import { Check, Code2, Copy, MessageCircle, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type SharePanelProps = {
  embedUrl?: string;
  title: string;
  url: string;
};

export function SharePanel({ embedUrl, title, url }: SharePanelProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const embedCode = useMemo(
    () => `<iframe src="${embedUrl ?? url}" title="${escapeHtml(title)}" width="640" height="360" loading="lazy" allowfullscreen></iframe>`,
    [embedUrl, title, url],
  );
  const xShareUrl = `https://twitter.com/intent/tweet?${new URLSearchParams({ text: title, url }).toString()}`;

  async function copy(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1800);
  }

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">共有</h2>
      <div className="mt-4 grid gap-2">
        <Button className="w-full" type="button" variant="outline" onClick={() => copy(url, "url")}>
          {copied === "url" ? <Check size={18} /> : <Copy size={18} />}
          URLコピー
        </Button>
        <Button asChild className="w-full" variant="outline">
          <a href={xShareUrl} rel="noreferrer" target="_blank">
            <Share2 size={18} />
            Xで共有
          </a>
        </Button>
        <Button className="w-full" type="button" variant="outline" onClick={() => copy(url, "discord")}>
          {copied === "discord" ? <Check size={18} /> : <MessageCircle size={18} />}
          Discord用URLコピー
        </Button>
        <Button className="w-full" type="button" variant="outline" onClick={() => copy(embedCode, "embed")}>
          {copied === "embed" ? <Check size={18} /> : <Code2 size={18} />}
          埋め込みコードコピー
        </Button>
      </div>
      <textarea
        className="mt-3 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-muted-foreground"
        readOnly
        value={embedCode}
      />
    </section>
  );
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
