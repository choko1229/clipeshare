"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThemePreference } from "@/components/theme/theme-provider";

const nextTheme = {
  system: "dark",
  dark: "light",
  light: "system",
} as const;

export function ThemeToggle() {
  const { theme, setTheme, isPending } = useThemePreference();
  const Icon = theme === "system" ? Monitor : theme === "dark" ? Moon : Sun;
  const label = theme === "system" ? "システムテーマ" : theme === "dark" ? "ダークテーマ" : "ライトテーマ";

  return (
    <Button
      aria-label={`${label}。クリックで切り替え`}
      className="size-10 px-0"
      disabled={isPending}
      onClick={() => setTheme(nextTheme[theme])}
      title={label}
      type="button"
      variant="ghost"
    >
      <Icon size={19} />
    </Button>
  );
}
