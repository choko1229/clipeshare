"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function LoginActions() {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);

  return (
    <div>
      <Button className="mt-6 w-full" onClick={() => signIn("discord", { callbackUrl: "/" })} type="button">
        Discordでログイン
      </Button>

      <div className="my-6 h-px bg-border" />

      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setIsSending(true);
          await signIn("email", { email, callbackUrl: "/" });
          setIsSending(false);
        }}
      >
        <label className="block text-sm font-medium" htmlFor="email">
          メールアドレス
        </label>
        <input
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
          id="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
        <Button className="w-full" disabled={isSending} type="submit" variant="secondary">
          {isSending ? "送信中" : "メールリンクを送信"}
        </Button>
      </form>
    </div>
  );
}
