"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

type SettingsTab = {
  content: ReactNode;
  id: string;
  label: string;
};

type SettingsModalProps = {
  description?: string;
  errorMessage?: ReactNode;
  footer: ReactNode;
  tabs: SettingsTab[];
  title: string;
};

export function SettingsModal({ description, errorMessage, footer, tabs, title }: SettingsModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClose() {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
      role="dialog"
    >
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h1 className="text-lg font-bold">{title}</h1>
            {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
          </div>
          <button
            aria-label="閉じる"
            className="rounded-md p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            onClick={handleClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        {errorMessage ? <div className="px-5 pt-4">{errorMessage}</div> : null}

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-border p-2 sm:w-44 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r sm:p-3">
            {tabs.map((tab) => (
              <button
                className={`shrink-0 rounded-md px-3 py-2 text-left text-sm font-medium transition ${
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {tabs.map((tab) => (
              <div className={tab.id === activeTab ? "space-y-4" : "hidden"} key={tab.id}>
                {tab.content}
              </div>
            ))}
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">{footer}</footer>
      </div>
    </div>
  );
}
