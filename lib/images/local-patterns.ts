import type { NextConfig } from "next";

type LocalPatterns = NonNullable<NonNullable<NextConfig["images"]>["localPatterns"]>;

/**
 * next/image で使えるローカル画像。Next.js の既定は「クエリ文字列なしのみ」で、
 * `search` は完全一致でしか照合できないため、キャッシュ更新用の `?v=<時刻>` を付けるディレクトリは
 * `search` を省略して(任意のクエリを許可して)個別に足す。
 */
export const imageLocalPatterns: LocalPatterns = [
  // 既定と同じ: クエリ文字列なしのローカル画像
  { pathname: "**", search: "" },
  // lib/media/avatars.ts が `?v=<時刻>` 付きで返すプロフィール画像
  { pathname: "/media/avatars/**" },
  { pathname: "/media/profile-headers/**" },
  { pathname: "/media/profile-backgrounds/**" },
];
