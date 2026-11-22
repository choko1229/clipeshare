import { hasLocalMatch } from "next/dist/shared/lib/match-local-pattern";
import { describe, expect, it } from "vitest";
import { imageLocalPatterns } from "@/lib/images/local-patterns";

// Next.js 本体と同じ照合関数で確かめる
const allowed = (src: string) => hasLocalMatch(imageLocalPatterns, src);

describe("images.localPatterns", () => {
  it("allows the versioned profile images returned by lib/media/avatars.ts", () => {
    expect(allowed("/media/profile-headers/user123.webp?v=1763800000000")).toBe(true);
    expect(allowed("/media/avatars/user123.webp?v=1763800000000")).toBe(true);
    expect(allowed("/media/profile-backgrounds/user123.webp?v=1763800000000")).toBe(true);
  });

  it("keeps the default for every other local image: allowed without a query string", () => {
    expect(allowed("/media/posts/abc.webp")).toBe(true);
    expect(allowed("/discord.svg")).toBe(true);
    expect(allowed("/media/profile-headers/user123.webp")).toBe(true);
  });

  it("still rejects query strings on other local images", () => {
    expect(allowed("/media/posts/abc.webp?v=1")).toBe(false);
    expect(allowed("/api/anything?x=1")).toBe(false);
    expect(allowed("/media/profile-headers-evil/user.webp?v=1")).toBe(false);
  });
});
