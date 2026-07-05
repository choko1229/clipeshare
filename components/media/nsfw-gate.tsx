"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type NsfwAccess = "allowed" | "login" | "verify" | "blocked";

type NsfwGateProps = {
  access?: NsfwAccess;
  children: React.ReactNode;
  isNsfw: boolean;
};

export function NsfwGate({ access = "allowed", children, isNsfw }: NsfwGateProps) {
  const [revealed, setRevealed] = useState(false);

  if (!isNsfw || revealed) {
    return <>{children}</>;
  }

  if (access !== "allowed") {
    return (
      <div className="grid h-full place-items-center bg-background p-6 text-center">
        <div className="max-w-md rounded-md border border-border bg-card p-5">
          <p className="text-lg font-semibold">NSFWコンテンツ</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{accessMessage(access)}</p>
          {access === "login" ? (
            <Button asChild className="mt-4">
              <Link href="/login">ログインする</Link>
            </Button>
          ) : access === "verify" ? (
            <Button asChild className="mt-4">
              <Link href="/settings/age">年齢確認する</Link>
            </Button>
          ) : null}
        </div>
      </div>
    );
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

function accessMessage(access: NsfwAccess) {
  switch (access) {
    case "login":
      return "この投稿を表示するにはログインが必要です。";
    case "verify":
      return "この投稿を表示するには年齢確認が必要です。";
    case "blocked":
      return "18歳未満のアカウントではNSFW投稿を表示できません。";
    case "allowed":
    default:
      return "";
  }
}
