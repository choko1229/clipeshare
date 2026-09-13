const TAG_TOKEN = /[#＃][^\s#＃]+/g;

// タグの羅列だけ、または空の説明文はページの中身にならないため、
// 検索エンジン向けには「薄いコンテンツ」として扱う。
export function hasMeaningfulDescription(description: string) {
  return description.replace(TAG_TOKEN, "").replace(/\s+/g, " ").trim().length > 0;
}

export function buildPostFallbackDescription({
  authorName,
  gameName,
  isClip,
  tagNames,
  title,
}: {
  authorName: string;
  gameName: string;
  isClip: boolean;
  tagNames: string[];
  title: string;
}) {
  const mediaLabel = isClip ? "クリップ動画" : "スクリーンショット";
  const tagPart = tagNames.length > 0 ? ` タグ: ${tagNames.join("、")}` : "";

  return `${gameName}の${mediaLabel}「${title}」。${authorName}さんが投稿しました。${tagPart}`.slice(0, 160);
}
