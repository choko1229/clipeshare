"use client";

import { LoaderCircle, Send } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type PostSubmitButtonProps = {
  compact?: boolean;
};

export function PostSubmitButton({ compact = false }: PostSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <div className="space-y-3">
      <Button aria-disabled={pending} className={compact ? "min-w-28" : "min-w-32"} disabled={pending} type="submit">
        {pending ? <LoaderCircle className="animate-spin" size={18} /> : <Send size={18} />}
        {pending ? "投稿中" : "投稿する"}
      </Button>
      {pending && !compact ? (
        <div aria-live="polite" className="rounded-md border border-border bg-background p-3">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="submit-progress-bar h-full w-1/3 rounded-full bg-primary" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            アップロードと保存を実行しています。完了までこのままお待ちください。
          </p>
        </div>
      ) : null}
    </div>
  );
}
