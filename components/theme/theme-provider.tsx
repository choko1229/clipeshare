"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useTransition } from "react";
import { updateThemePreference, type ThemeValue } from "@/app/theme/actions";

type ThemeContextValue = {
  theme: ThemeValue;
  setTheme: (theme: ThemeValue) => void;
  isPending: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: ThemeValue) {
  const root = document.documentElement;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  root.dataset.theme = theme;
  root.classList.toggle("light", resolved === "light");
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

export function ThemeProvider({
  children,
  initialTheme,
  persistToDatabase,
}: {
  children: React.ReactNode;
  initialTheme: ThemeValue;
  persistToDatabase: boolean;
}) {
  const [theme, setThemeState] = useState<ThemeValue>(() => {
    if (persistToDatabase || typeof window === "undefined") {
      return initialTheme;
    }

    const stored = localStorage.getItem("clipeshare-theme");
    return stored === "dark" || stored === "light" || stored === "system" ? stored : initialTheme;
  });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    applyTheme(theme);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((document.documentElement.dataset.theme as ThemeValue | undefined) === "system") {
        applyTheme("system");
      }
    };
    media.addEventListener("change", onChange);

    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((nextTheme: ThemeValue) => {
    setThemeState(nextTheme);
    applyTheme(nextTheme);

    if (persistToDatabase) {
      startTransition(() => {
        void updateThemePreference(nextTheme);
      });
      return;
    }

    localStorage.setItem("clipeshare-theme", nextTheme);
  }, [persistToDatabase]);

  const value = useMemo(() => ({ theme, setTheme, isPending }), [isPending, setTheme, theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePreference() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useThemePreference must be used inside ThemeProvider.");
  }

  return context;
}
