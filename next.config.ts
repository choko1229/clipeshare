import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    // Clipshare Quick の認可・連携管理画面は他サイトの iframe に埋め込ませない(クリックジャッキング対策)
    const noFraming = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
      { key: "Referrer-Policy", value: "no-referrer" },
    ];

    return [
      { source: "/qick/authorize/:path*", headers: noFraming },
      { source: "/settings/apps", headers: noFraming },
    ];
  },
  // next build内蔵の型チェックは別ワーカープロセスで動き、NODE_OPTIONSのヒープ上限指定が
  // 引き継がれず低メモリVPSでOOMしやすい。scripts/deploy-server.shでtscを単一プロセスとして
  // 事前に実行しているため、ビルド本体側では二重チェックしない。
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "512mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
      },
      {
        protocol: "https",
        hostname: "media.discordapp.net",
      },
      {
        protocol: "https",
        hostname: "store.akamai.steamstatic.com",
      },
      {
        protocol: "https",
        hostname: "cdn.akamai.steamstatic.com",
      },
      {
        protocol: "https",
        hostname: "media.rawg.io",
      },
      {
        protocol: "https",
        hostname: "images.igdb.com",
      },
    ],
  },
};

export default nextConfig;
