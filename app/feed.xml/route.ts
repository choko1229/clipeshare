import { prisma } from "@/lib/db/prisma";
import { escapeXml } from "@/lib/seo/xml";

// ビルド時の静的生成を避け、リクエストごとに最新の投稿一覧で生成する。
export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const FEED_ITEMS_TAKE = 50;

function absoluteUrl(pathOrUrl: string) {
  return new URL(pathOrUrl, BASE_URL).toString();
}

async function getFeedPosts() {
  return prisma.post.findMany({
    where: {
      status: "PUBLISHED",
      visibility: "PUBLIC",
      isNsfw: false,
    },
    select: {
      publicId: true,
      title: true,
      description: true,
      thumbnailUrl: true,
      type: true,
      publishedAt: true,
      createdAt: true,
      game: {
        select: {
          name: true,
        },
      },
      user: {
        select: {
          displayName: true,
          name: true,
          username: true,
        },
      },
    },
    orderBy: {
      publishedAt: "desc",
    },
    take: FEED_ITEMS_TAKE,
  });
}

export async function GET() {
  const posts = await getFeedPosts();
  const now = new Date().toUTCString();
  const feedUrl = absoluteUrl("/feed.xml");

  const items = posts
    .map((post) => {
      const pageUrl = absoluteUrl(`/c/${post.publicId}`);
      const authorName = post.user.displayName ?? post.user.name ?? post.user.username ?? "Unknown";
      const pubDate = (post.publishedAt ?? post.createdAt).toUTCString();
      const description = escapeXml(`[${post.game.name}] ${authorName}が${post.type === "CLIP" ? "クリップ" : "スクリーンショット"}を投稿しました。${post.description || ""}`.trim());

      return `  <item>
    <title>${escapeXml(post.title)}</title>
    <link>${escapeXml(pageUrl)}</link>
    <guid isPermaLink="true">${escapeXml(pageUrl)}</guid>
    <pubDate>${pubDate}</pubDate>
    <description>${description}</description>
    <enclosure url="${escapeXml(absoluteUrl(post.thumbnailUrl))}" type="image/jpeg" />
  </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Clipshare - 新着クリップ・スクリーンショット</title>
    <link>${BASE_URL}/</link>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />
    <description>Clipshareに投稿された新着のゲームクリップ・スクリーンショット</description>
    <language>ja</language>
    <lastBuildDate>${now}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
