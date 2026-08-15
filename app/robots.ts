import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
          "/login",
          "/settings",
          "/settings/",
          "/notice",
          "/bookmarks",
          "/following",
          "/theme",
          "/offline",
          "/c/*/edit",
        ],
      },
    ],
    sitemap: [`${BASE_URL}/sitemap.xml`, `${BASE_URL}/video-sitemap.xml`],
    host: BASE_URL,
  };
}
