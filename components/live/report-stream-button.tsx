"use client";

import { Flag } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { reportLiveStream } from "@/app/l/[token]/actions";

type ReportStreamButtonProps = {
  viewToken: string;
  isLoggedIn: boolean;
};

export function ReportStreamButton({ viewToken, isLoggedIn }: ReportStreamButtonProps) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  return (
    <div className="relative">
      <Button aria-label="通報" onClick={() => setOpen((current) => !current)} type="button" variant="outline">
        <Flag size={16} />
      </Button>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-md border border-border bg-card p-4 shadow-lg">
          {!isLoggedIn ? (
            <p className="text-sm text-muted-foreground">
              通報するにはログインしてください。
            </p>
          ) : sent ? (
            <p className="text-sm text-muted-foreground">通報を送信しました。ご協力ありがとうございます。</p>
          ) : (
            <form
              action={async (formData) => {
                await reportLiveStream(formData);
                setSent(true);
              }}
              className="space-y-3"
            >
              <input name="viewToken" type="hidden" value={viewToken} />
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs outline-none ring-ring transition focus:ring-2"
                name="reason"
                required
              >
                <option value="spam">スパム</option>
                <option value="harassment">嫌がらせ</option>
                <option value="nsfw_missing">NSFW未設定</option>
                <option value="illegal">犯罪系コンテンツ</option>
                <option value="other">その他</option>
              </select>
              <textarea
                className="min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-xs outline-none ring-ring transition focus:ring-2"
                maxLength={1000}
                name="detail"
                placeholder="補足があれば入力(任意)"
              />
              <Button className="w-full" type="submit" variant="outline">
                通報する
              </Button>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
