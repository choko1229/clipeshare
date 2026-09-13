import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db/prisma";
import { helpPages } from "@/lib/help/pages";
import { hasMeaningfulDescription } from "@/lib/posts/description";

// ビルド時の静的生成(=ビルド環境のDB接続に依存し、以降内容が固定化される)を避け、
// リクエストごとに最新の投稿一覧で生成する。
export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Googleのsitemap 1ファイル上限(5万URL)を踏まえた安全マージン。
const MAX_POSTS = 45_000;
const MAX_USERS = 5_000;
const MAX_TAGS = 5_000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, games, users, tags] = await Promise.all([
    prisma.post.findMany({
      where: {
        status: "PUBLISHED",
        visibility: "PUBLIC",
        isNsfw: false,
      },
      select: {
        description: true,
        publicId: true,
        updatedAt: true,
      },
      orderBy: {
        publishedAt: "desc",
      },
      take: MAX_POSTS,
    }),
    prisma.game.findMany({
      where: {
        isActive: true,
      },
      select: {
        slug: true,
        updatedAt: true,
      },
    }),
    prisma.user.findMany({
      where: {
        isBanned: false,
        username: { not: null },
        posts: {
          some: {
            status: "PUBLISHED",
            visibility: "PUBLIC",
            isNsfw: false,
          },
        },
      },
      select: {
        username: true,
        updatedAt: true,
      },
      take: MAX_USERS,
    }),
    prisma.tag.findMany({
      where: {
        isActive: true,
        posts: {
          some: {
            post: {
              status: "PUBLISHED",
              visibility: "PUBLIC",
              isNsfw: false,
            },
          },
        },
      },
      select: {
        slug: true,
        createdAt: true,
      },
      take: MAX_TAGS,
    }),
  ]);

  // 一覧系ページは投稿が増減・更新されたときに中身が変わるため、最新の投稿更新日を使う。
  const feedUpdatedAt = posts.reduce<Date | undefined>(
    (latest, post) => (!latest || post.updatedAt > latest ? post.updatedAt : latest),
    undefined,
  );
  const helpUpdatedAt = helpPages
    .map((page) => new Date(page.updatedAt))
    .reduce((latest, date) => (date > latest ? date : latest));

  // 固定ページのうち更新日を追跡していないものは lastmod を付けない。
  // 実態と合わない日付を返すと、Googleはそのサイトのlastmod自体を信用しなくなる。
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified: feedUpdatedAt, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE_URL}/?sort=week`, lastModified: feedUpdatedAt, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE_URL}/?sort=month`, lastModified: feedUpdatedAt, changeFrequency: "daily", priority: 0.5 },
    { url: `${BASE_URL}/?sort=popular`, lastModified: feedUpdatedAt, changeFrequency: "daily", priority: 0.5 },
    { url: `${BASE_URL}/v`, lastModified: feedUpdatedAt, changeFrequency: "hourly", priority: 0.7 },
    { url: `${BASE_URL}/about`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/help`, lastModified: helpUpdatedAt, changeFrequency: "monthly", priority: 0.5 },
    ...helpPages.map((page) => ({
      url: `${BASE_URL}/help/${page.slug}`,
      lastModified: new Date(page.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
    { url: `${BASE_URL}/guidelines`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE_URL}/contact`, changeFrequency: "yearly", priority: 0.2 },
  ];

  // 説明文が実質空の投稿は noindex にしているため、sitemapにも載せない。
  const postRoutes: MetadataRoute.Sitemap = posts
    .filter((post) => hasMeaningfulDescription(post.description))
    .map((post) => ({
      url: `${BASE_URL}/c/${post.publicId}`,
      lastModified: post.updatedAt,
      changeFrequency: "daily",
      priority: 0.8,
    }));

  const gameRoutes: MetadataRoute.Sitemap = games.map((game) => ({
    url: `${BASE_URL}/games/${game.slug}`,
    lastModified: game.updatedAt,
    changeFrequency: "daily",
    priority: 0.6,
  }));

  const userRoutes: MetadataRoute.Sitemap = users.map((user) => ({
    url: `${BASE_URL}/users/${user.username}`,
    lastModified: user.updatedAt,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const tagRoutes: MetadataRoute.Sitemap = tags.map((tag) => ({
    url: `${BASE_URL}/tags/${tag.slug}`,
    lastModified: tag.createdAt,
    changeFrequency: "daily",
    priority: 0.4,
  }));

  return [...staticRoutes, ...postRoutes, ...gameRoutes, ...userRoutes, ...tagRoutes];
}
