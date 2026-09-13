export type HelpCategory = "投稿する" | "設定する" | "共有する" | "探す";

export type HelpPage = {
  slug: string;
  title: string;
  summary: string;
  category: HelpCategory;
  // sitemapのlastmodに使う。本文を書き換えたらこの日付も更新する。
  updatedAt: string;
};

const INITIAL_RELEASE = "2026-09-13";

export const helpPages: HelpPage[] = [
  {
    slug: "getting-started",
    title: "はじめかた",
    summary:
      "ログインなしでできること、3つのログイン方法の違い、プロフィールの初期設定から最初の投稿までの流れを説明します。",
    category: "投稿する",
    updatedAt: INITIAL_RELEASE,
  },
  {
    slug: "post-clip",
    title: "クリップ動画を投稿する",
    summary:
      "対応している動画形式、切り抜き範囲の指定、アップロード後の変換処理の流れ、変換に失敗したときの対処方法をまとめています。",
    category: "投稿する",
    updatedAt: INITIAL_RELEASE,
  },
  {
    slug: "post-screenshot",
    title: "スクリーンショットを投稿する",
    summary:
      "対応している画像形式、複数枚をまとめて投稿する方法、アップロード前の自動圧縮、投稿後の見え方を説明します。",
    category: "投稿する",
    updatedAt: INITIAL_RELEASE,
  },
  {
    slug: "writing-posts",
    title: "タイトル・説明文・タグの書き方",
    summary:
      "本文欄の1行目がタイトル、2行目以降が説明文になる仕組みと、投稿を見つけてもらいやすくする書き方のコツを紹介します。",
    category: "投稿する",
    updatedAt: INITIAL_RELEASE,
  },
  {
    slug: "game-info",
    title: "ゲーム・ランク・カスタム項目を設定する",
    summary:
      "ゲームを紐づけると何が起きるのか、ゲーム名の自動推定、ランク帯やDiscordサーバー名などの付随情報の使い方を説明します。",
    category: "投稿する",
    updatedAt: INITIAL_RELEASE,
  },
  {
    slug: "account-levels",
    title: "アカウントレベルと投稿上限",
    summary:
      "動画の長さや容量、画像の枚数、1日の投稿数の上限はアカウントレベルごとに決まります。現在の上限と昇格条件を確認できます。",
    category: "設定する",
    updatedAt: INITIAL_RELEASE,
  },
  {
    slug: "visibility-nsfw",
    title: "公開設定・NSFW・年齢確認",
    summary:
      "公開と非公開の違い、NSFWを付けるべきケース、年齢確認の手順と、NSFW投稿がどう表示されるかを説明します。",
    category: "設定する",
    updatedAt: INITIAL_RELEASE,
  },
  {
    slug: "sharing",
    title: "投稿を共有する",
    summary:
      "共有パネルの各ボタンの使い分け、DiscordやXに貼ったときの見え方、外部サイトへの埋め込み方法を説明します。",
    category: "共有する",
    updatedAt: INITIAL_RELEASE,
  },
  {
    slug: "quick-share",
    title: "クイック共有の使い方",
    summary:
      "ログインなしで画像や動画の共有URLを発行できるクイック共有について、上限・保存期限・削除方法をまとめています。",
    category: "共有する",
    updatedAt: INITIAL_RELEASE,
  },
  {
    slug: "search",
    title: "検索と絞り込みの使い方",
    summary:
      "7種類の検索演算子の書き方と組み合わせ、並び替えタブ、タグページやゲームページから目的の投稿へ辿り着く方法を説明します。",
    category: "探す",
    updatedAt: INITIAL_RELEASE,
  },
];

export const helpCategories: HelpCategory[] = ["投稿する", "設定する", "共有する", "探す"];

export function getHelpPage(slug: string) {
  return helpPages.find((page) => page.slug === slug);
}

export function getHelpPagesByCategory(category: HelpCategory) {
  return helpPages.filter((page) => page.category === category);
}

// 同じカテゴリを優先し、足りなければ他カテゴリで補って常に同じ件数を返す。
export function getRelatedHelpPages(slug: string, take = 3) {
  const current = getHelpPage(slug);
  const others = helpPages.filter((page) => page.slug !== slug);

  if (!current) {
    return others.slice(0, take);
  }

  const sameCategory = others.filter((page) => page.category === current.category);
  const rest = others.filter((page) => page.category !== current.category);

  return [...sameCategory, ...rest].slice(0, take);
}
