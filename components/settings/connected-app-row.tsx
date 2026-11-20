"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

type ConnectedAppRowProps = {
  tokenId: string;
  deviceName: string;
  detail: string;
  lastUsedLabel: string;
  todayCount: number;
  revokeAction: (formData: FormData) => void | Promise<void>;
};

export function ConnectedAppRow({ tokenId, deviceName, detail, lastUsedLabel, todayCount, revokeAction }: ConnectedAppRowProps) {
  const [confirming, setConfirming] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirming) {
      return;
    }

    cancelRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setConfirming(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [confirming]);

  return (
    <div className="flex flex-wrap items-center gap-3.5 px-4 py-3.5">
      <span
        aria-hidden="true"
        className="inline-grid size-10 shrink-0 place-items-center rounded-[10px] bg-primary text-[22px] font-extrabold leading-none text-primary-foreground"
      >
        C
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold leading-relaxed">Clipshare Quick</p>
        <p className="break-all text-xs leading-relaxed text-muted-foreground">{detail}</p>
      </div>
      <div className="flex flex-wrap justify-end gap-1.5">
        <span className="inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-full bg-muted px-2 text-xs font-bold text-muted-foreground">
          <Clock aria-hidden="true" size={12} />
          最終利用 {lastUsedLabel}
        </span>
        <span className="inline-flex h-[22px] items-center whitespace-nowrap rounded-full bg-primary/15 px-2 text-xs font-bold text-primary">
          今日 {todayCount}件
        </span>
      </div>
      <Button className="h-9 text-[13px] font-bold text-destructive" onClick={() => setConfirming(true)} type="button" variant="outline">
        解除
      </Button>

      {confirming ? (
        <div
          aria-labelledby={`revoke-title-${tokenId}`}
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              setConfirming(false);
            }
          }}
          role="dialog"
        >
          <div className="w-full max-w-[420px] rounded-md border border-border bg-card p-5 shadow-2xl">
            <h2 className="text-base font-extrabold leading-snug" id={`revoke-title-${tokenId}`}>
              このPCの連携を解除しますか？
            </h2>
            <p className="mt-2 break-all text-[13px] leading-relaxed text-muted-foreground">
              {deviceName} のアプリは、アップロードできなくなります。アップロード済みの写真は、期限まで残ります。
            </p>
            <form action={revokeAction} className="mt-4 flex items-center justify-end gap-2">
              <input name="tokenId" type="hidden" value={tokenId} />
              <Button className="font-bold" onClick={() => setConfirming(false)} ref={cancelRef} type="button" variant="ghost">
                やめる
              </Button>
              <Button className="font-bold" type="submit" variant="destructive">
                解除する
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
