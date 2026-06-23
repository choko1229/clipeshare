"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type NsfwGateProps = {
  children: React.ReactNode;
  isNsfw: boolean;
};

export function NsfwGate({ children, isNsfw }: NsfwGateProps) {
  const [revealed, setRevealed] = useState(false);

  if (!isNsfw || revealed) {
    return <>{children}</>;
  }

  return (
    <div className="relative h-full">
      <div className="h-full blur-xl">{children}</div>
      <div className="absolute inset-0 grid place-items-center bg-background/75 p-6 text-center">
        <div className="max-w-md rounded-md border border-border bg-card p-5">
          <p className="text-lg font-semibold">NSFWコンテンツ</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            この投稿はNSFWとして設定されています。表示する場合のみ開いてください。
          </p>
          <Button className="mt-4" onClick={() => setRevealed(true)} type="button">
            表示する
          </Button>
        </div>
      </div>
    </div>
  );
}
