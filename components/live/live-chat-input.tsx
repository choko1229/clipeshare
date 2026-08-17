"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type LiveChatInputProps = {
  onSend: (body: string) => void;
};

export function LiveChatInput({ onSend }: LiveChatInputProps) {
  const [value, setValue] = useState("");

  function submit() {
    const body = value.trim();
    if (!body) {
      return;
    }

    onSend(body.slice(0, 300));
    setValue("");
  }

  return (
    <form
      className="mt-3 flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <input
        className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
        maxLength={300}
        onChange={(event) => setValue(event.currentTarget.value)}
        placeholder="コメントを入力…"
        value={value}
      />
      <Button aria-label="送信" className="h-9 w-9 shrink-0 p-0" type="submit">
        <Send size={16} />
      </Button>
    </form>
  );
}
