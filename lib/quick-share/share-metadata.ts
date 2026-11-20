import type { Metadata } from "next";
import type { QuickShare } from "@prisma/client";

type ShareMetadataInput = Pick<
  QuickShare,
  "publicId" | "kind" | "status" | "mediaUrl" | "thumbnailUrl" | "mimeType" | "width" | "height" | "expiresAt" | "deletedAt"
>;

const noindex: Metadata["robots"] = {
  index: false,
  follow: false,
};

/**
 * 共有ページ(/q/{id}/view)の OGP / Twitter Card(画面17)。
 * 画像は og:image としてそのまま、動画は変換後のサムネイルを og:image、mp4 を og:video にする。
 * 検索エンジンには出さない(noindex は従来どおり)。
 */
export function buildQuickShareMetadata(quickShare: ShareMetadataInput | null, options: { baseUrl: string; retentionHours: number; now?: Date }): Metadata {
  const now = options.now ?? new Date();
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const isGone = !quickShare || quickShare.deletedAt !== null || quickShare.expiresAt <= now;

  if (isGone) {
    return {
      title: "有効期限切れです",
      robots: noindex,
    };
  }

  const kindLabel = quickShare.kind === "IMAGE" ? "画像" : "動画";
  const title = `クイック共有 · ${kindLabel}`;
  const description = `${options.retentionHours}時間後に自動で削除されます。`;
  const pageUrl = `${baseUrl}/q/${quickShare.publicId}`;
  const absolute = (value: string | null) => (value ? `${baseUrl}${value.startsWith("/") ? "" : "/"}${value}` : null);

  const isReadyImage = quickShare.kind === "IMAGE" && quickShare.status === "READY";
  const isReadyVideo = quickShare.kind === "VIDEO" && quickShare.status === "READY";
  const imageUrl = isReadyImage ? absolute(quickShare.mediaUrl) : isReadyVideo ? absolute(quickShare.thumbnailUrl) : null;
  const videoUrl = isReadyVideo ? absolute(quickShare.mediaUrl) : null;

  const images = imageUrl
    ? [
        {
          url: imageUrl,
          ...(isReadyImage && quickShare.width && quickShare.height ? { width: quickShare.width, height: quickShare.height } : {}),
          ...(isReadyVideo ? { width: 1280, height: 720 } : {}),
          type: "image/webp",
          alt: title,
        },
      ]
    : undefined;

  return {
    title,
    description,
    robots: noindex,
    openGraph: {
      type: videoUrl ? "video.other" : "website",
      siteName: "Clipshare",
      title,
      description,
      url: pageUrl,
      ...(images ? { images } : {}),
      ...(videoUrl
        ? {
            videos: [
              {
                url: videoUrl,
                secureUrl: videoUrl,
                type: "video/mp4",
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
}
