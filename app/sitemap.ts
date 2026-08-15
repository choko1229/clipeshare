import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db/prisma";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Googleのsitemap 1ファイル上限(5万URL)を踏まえた安全マージン。
const MAX_POSTS = 45_000;
const MAX_USERS = 5_000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, games, users] = await Promise.all([
    prisma.post.findMany({
      where: {
        status: "PUBLISHED",
        visibility: "PUBLIC",
        isNsfw: false,
      },
      select: {
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
  ]);

  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE_URL}/v`, lastModified: now, changeFrequency: "hourly", priority: 0.7 },
    { url: `${BASE_URL}/search`, lastModified: now, changeFrequency: "daily", priority: 0.5 },
    { url: `${BASE_URL}/guidelines`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  const postRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
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

  return [...staticRoutes, ...postRoutes, ...gameRoutes, ...userRoutes];
}
