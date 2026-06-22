"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <Button onClick={() => signOut({ callbackUrl: "/" })} type="button" variant="ghost">
      ログアウト
    </Button>
  );
}
