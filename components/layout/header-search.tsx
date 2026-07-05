"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function HeaderSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  function openSearch() {
    setIsOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();

    if (!trimmed) {
      openSearch();
      return;
    }

    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form className="relative flex items-center justify-end" onSubmit={submit}>
      <input
        aria-label="検索"
        className={[
          "h-10 rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none ring-ring transition-all duration-200 focus:ring-2",
          isOpen ? "w-48 opacity-100 sm:w-64" : "w-10 cursor-pointer opacity-0",
        ].join(" ")}
        onBlur={() => {
          if (!query.trim()) {
            setIsOpen(false);
          }
        }}
        onChange={(event) => setQuery(event.currentTarget.value)}
        onFocus={() => setIsOpen(true)}
        placeholder="検索"
        ref={inputRef}
        type="search"
        value={query}
      />
      <button
        aria-label="検索を開く"
        className="absolute left-0 grid size-10 place-items-center text-muted-foreground transition hover:text-foreground"
        onClick={openSearch}
        type={isOpen ? "submit" : "button"}
      >
        <Search size={19} />
      </button>
    </form>
  );
}
