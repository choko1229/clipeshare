/** ダウンロードページの更新履歴に出す件数・長さの上限 */
export const RELEASE_HISTORY_MAX_ENTRIES = 3;
export const RELEASE_NOTES_MAX_ITEMS = 5;
export const RELEASE_NOTE_ITEM_MAX_CHARS = 140;
/** 本文の先頭から何行まで見るか(長いリリースノートでも処理量を一定にする) */
export const RELEASE_NOTES_SCAN_MAX_LINES = 60;

const listItemPattern = /^\s{0,3}(?:[-*+]|\d{1,3}[.)])\s+(.+)$/;
const headingPattern = /^\s{0,3}#{1,6}\s/;

/**
 * GitHub Releases の本文(Markdown)を、更新履歴の「・変更点」の行に変換する。
 * - 戻り値は**プレーンテキスト**の配列。画面側は必ずテキストとして描画する(HTML として解釈しない)
 * - 箇条書きの行があればそれを、無ければ見出し以外の行を、先頭から上限まで使う
 * - Markdown の記法(リンク・画像・強調・コード・見出し)と HTML コメントは取り除く。それ以外の `<` などはそのまま文字として残す
 * - 1行の長さと行数を上限で切り詰める
 */
export function formatReleaseNotes(body: string | null | undefined): string[] {
  if (!body) {
    return [];
  }

  const withoutComments = body.replace(/<!--[\s\S]*?-->/g, "");
  const lines = withoutComments.split(/\r?\n/).slice(0, RELEASE_NOTES_SCAN_MAX_LINES);
  const listItems = lines.map((line) => listItemPattern.exec(line)?.[1]).filter((item): item is string => Boolean(item));
  const source = listItems.length > 0 ? listItems : lines.filter((line) => !headingPattern.test(line));

  const items: string[] = [];

  for (const raw of source) {
    const text = stripMarkdown(raw);

    if (!text) {
      continue;
    }

    items.push(truncate(text, RELEASE_NOTE_ITEM_MAX_CHARS));

    if (items.length >= RELEASE_NOTES_MAX_ITEMS) {
      break;
    }
  }

  return items;
}

function stripMarkdown(line: string) {
  return (
    line
      // 画像は消す、リンクは文字だけ残す
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      // 強調・取り消し線・インラインコード
      .replace(/(\*\*|__|~~)(.+?)\1/g, "$2")
      .replace(/`([^`]*)`/g, "$1")
      // チェックボックス
      .replace(/^\[[ xX]\]\s+/, "")
      // 制御文字と連続空白
      .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function truncate(text: string, max: number) {
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : text;
}

/** 更新履歴の日付表示(日本時間の YYYY/MM/DD) */
export function formatReleaseDate(iso: string) {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime()) || date.getTime() <= 0) {
    return null;
  }

  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
