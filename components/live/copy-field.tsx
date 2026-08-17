"use client";

import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type CopyFieldProps = {
  value: string;
  maskable?: boolean;
};

export function CopyField({ value, maskable = false }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(!maskable);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const displayValue = revealed ? value : "•".repeat(Math.min(value.length, 20));

  return (
    <div className="flex items-center gap-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs">{displayValue}</span>
      {maskable ? (
        <Button
          aria-label={revealed ? "隠す" : "表示"}
          className="size-7 shrink-0 p-0"
          onClick={() => setRevealed((current) => !current)}
          type="button"
          variant="ghost"
        >
          {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
        </Button>
      ) : null}
      <Button aria-label="コピー" className="size-7 shrink-0 p-0" onClick={() => void copy()} type="button" variant="ghost">
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </Button>
    </div>
  );
}
