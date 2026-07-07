import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#07080d",
    categories: ["games", "photo", "video", "social"],
    description: "ゲームクリップとスクリーンショットを共有するメディアサイト",
    display: "standalone",
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
    id: "/",
    name: "Clipeshare",
    scope: "/",
    short_name: "Clipeshare",
    shortcuts: [
      {
        icons: [{ src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" }],
        name: "投稿する",
        short_name: "投稿",
        url: "/posts/new",
      },
      {
        icons: [{ src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" }],
        name: "通知",
        short_name: "通知",
        url: "/notice",
      },
      {
        icons: [{ src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" }],
        name: "縦動画",
        short_name: "動画",
        url: "/v",
      },
    ],
    start_url: "/",
    theme_color: "#07080d",
  };
}
