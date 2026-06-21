import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Clipeshare",
    short_name: "Clipeshare",
    description: "ゲームクリップとスクリーンショットを共有するメディアサイト",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#07080d",
    theme_color: "#07080d",
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
