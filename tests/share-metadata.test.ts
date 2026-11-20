import { describe, expect, it } from "vitest";
import { buildQuickShareMetadata } from "@/lib/quick-share/share-metadata";

const base = {
  publicId: "abc123XYZ0",
  kind: "IMAGE" as const,
  status: "READY" as const,
  mediaUrl: "/media/quick/images/abc123XYZ0.webp",
  thumbnailUrl: null,
  mimeType: "image/webp",
  width: 2000,
  height: 1125,
  expiresAt: new Date(Date.now() + 3600_000),
  deletedAt: null,
};
const options = { baseUrl: "https://clipshare.link/", retentionHours: 24 };

describe("share page OGP (screen 17)", () => {
  it("uses the image itself as og:image and keeps noindex", () => {
    const metadata = buildQuickShareMetadata(base, options);
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.title).toBe("クイック共有 · 画像");
    expect(metadata.description).toBe("24時間後に自動で削除されます。");
    expect(metadata.openGraph).toMatchObject({
      siteName: "Clipshare",
      url: "https://clipshare.link/q/abc123XYZ0",
      images: [{ url: "https://clipshare.link/media/quick/images/abc123XYZ0.webp", width: 2000, height: 1125 }],
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image", images: ["https://clipshare.link/media/quick/images/abc123XYZ0.webp"] });
  });

  it("uses the poster and og:video for a converted video", () => {
    const metadata = buildQuickShareMetadata(
      { ...base, kind: "VIDEO", mediaUrl: "/media/quick/videos/v.mp4", thumbnailUrl: "/media/quick/thumbnails/v.webp", mimeType: "video/mp4" },
      options,
    );
    expect(metadata.title).toBe("クイック共有 · 動画");
    expect(metadata.openGraph).toMatchObject({
      images: [{ url: "https://clipshare.link/media/quick/thumbnails/v.webp" }],
      videos: [{ url: "https://clipshare.link/media/quick/videos/v.mp4", type: "video/mp4" }],
    });
  });

  it("has no media tags while the video is still processing", () => {
    const metadata = buildQuickShareMetadata({ ...base, kind: "VIDEO", status: "PROCESSING", mediaUrl: null }, options);
    expect(metadata.openGraph).not.toHaveProperty("images");
    expect(metadata.openGraph).not.toHaveProperty("videos");
    expect(metadata.twitter).toMatchObject({ card: "summary" });
  });

  it("exposes nothing for expired or deleted items", () => {
    for (const gone of [{ ...base, expiresAt: new Date(Date.now() - 1) }, { ...base, deletedAt: new Date() }, null]) {
      const metadata = buildQuickShareMetadata(gone, options);
      expect(metadata.openGraph).toBeUndefined();
      expect(metadata.robots).toEqual({ index: false, follow: false });
    }
  });
});
