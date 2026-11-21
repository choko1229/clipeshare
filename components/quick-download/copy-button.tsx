"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type CopyButtonProps = {
  value: string;
};

/** フィンガープリントのコピー。コピー後は既存のクイック共有画面と同じ「コピーしました」を一時的に出す */
export function CopyButton({ value }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    },
    [],
  );

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // クリップボードが使えない環境では何もしない(値は画面に表示されているので手で選択できる)
      setCopied(false);
    }
  }

  return (
    <Button aria-live="polite" className="h-8 shrink-0 text-xs font-bold" data-copy-value={value} onClick={handleCopy} type="button" variant="outline">
      {copied ? "コピーしました" : "コピー"}
    </Button>
  );
}
