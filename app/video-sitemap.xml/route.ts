import { prisma } from "@/lib/db/prisma";
import { escapeXml } from "@/lib/seo/xml";

// ビルド時の静的生成を避け、リクエストごとに最新の投稿一覧で生成する。
export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Google動画検索向けの video sitemap 拡張。Next.jsのsitemap()規約は
// video:namespaceを出力できないため、専用のRoute Handlerで生成する。
// https://developers.google.com/search/docs/crawling-indexing/sitemaps/video-sitemaps
const MAX_VIDEOS = 45_000;
const MIN_DURATION_SECONDS = 1;
const MAX_DURATION_SECONDS = 28_800;

function absoluteUrl(pathOrUrl: string) {
  return new URL(pathOrUrl, BASE_URL).toString();
}

async function getVideoPosts() {
  return prisma.post.findMany({
    where: {
      type: "CLIP",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      isNsfw: false,
      mediaUrl: { not: null },
    },
    select: {
      publicId: true,
      title: true,
      description: true,
      thumbnailUrl: true,
      shareVideoUrl: true,
      durationSeconds: true,
      viewCount: true,
      publishedAt: true,
      createdAt: true,
    },
    orderBy: {
      publishedAt: "desc",
    },
    take: MAX_VIDEOS,
  });
}

export async function GET() {
  const posts = await getVideoPosts();

  const entries = posts
    .map((post) => {
      const pageUrl = absoluteUrl(`/c/${post.publicId}`);
      const thumbnailUrl = absoluteUrl(post.thumbnailUrl);
      const playerLoc = absoluteUrl(`/embed/c/${post.publicId}`);
      const contentLoc = post.shareVideoUrl ? absoluteUrl(post.shareVideoUrl) : null;
      const title = escapeXml(post.title || "Clipshare clip");
      const description = escapeXml((post.description || post.title || "Clipshareのクリップ").slice(0, 2048));
      const publicationDate = (post.publishedAt ?? post.createdAt).toISOString();
      const duration =
        post.durationSeconds && post.durationSeconds >= MIN_DURATION_SECONDS && post.durationSeconds <= MAX_DURATION_SECONDS
          ? post.durationSeconds
          : null;

      return `  <url>
    <loc>${escapeXml(pageUrl)}</loc>
    <video:video>
      <video:thumbnail_loc>${escapeXml(thumbnailUrl)}</video:thumbnail_loc>
      <video:title>${title}</video:title>
      <video:description>${description}</video:description>
      ${contentLoc ? `<video:content_loc>${escapeXml(contentLoc)}</video:content_loc>` : ""}
      <video:player_loc>${escapeXml(playerLoc)}</video:player_loc>
      ${duration ? `<video:duration>${duration}</video:duration>` : ""}
      <video:publication_date>${publicationDate}</video:publication_date>
      <video:family_friendly>yes</video:family_friendly>
      <video:view_count>${Number(post.viewCount)}</video:view_count>
    </video:video>
  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${entries}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
