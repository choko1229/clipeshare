/** リリースに添付する SHA256SUMS のファイル名(クライアントのリリースワークフローと合わせる) */
export const sha256SumsAssetNames = ["SHA256SUMS", "SHA256SUMS.txt"] as const;
export const SHA256SUMS_MAX_BYTES = 64 * 1024;
const MAX_LINES = 200;

export type Sha256SumsProblem =
  | "empty"
  | "too_many_lines"
  | "malformed_line"
  | "invalid_file_name"
  | "path_in_file_name"
  | "duplicate_entry";

export type Sha256SumsParseResult = { ok: true; sums: Map<string, string> } | { ok: false; reason: Sha256SumsProblem; line?: number };

export function isSha256Hex(value: string) {
  return /^[0-9a-f]{64}$/.test(value);
}

/**
 * SHA256SUMS(API_CONTRACT.md「SHA256SUMS の形式」)を解析する。
 * - 1行1ファイル: `<64桁の16進><空白1つ><空白 または *><ファイル名>`(GNU `sha256sum` の出力形式)
 * - 16進の大文字小文字は問わない(小文字に正規化)。改行は LF / CRLF、先頭の BOM、空行、行末の空白は無視
 * - ファイル名は GitHub のアセット名と完全一致で照合するため、パス(`/` `\`)を含めてはいけない
 * - 1行でも不正・同じファイル名の重複があれば、ファイル全体を不正とする(部分的に信用しない)
 */
export function parseSha256Sums(text: string): Sha256SumsParseResult {
  const BOM = String.fromCharCode(0xfeff);
  const lines = (text.startsWith(BOM) ? text.slice(1) : text).split(/\r?\n/);
  const sums = new Map<string, string>();
  let entries = 0;

  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.replace(/[ \t]+$/, "");
    const lineNumber = index + 1;

    if (line.length === 0) {
      continue;
    }

    entries += 1;

    if (entries > MAX_LINES) {
      return { ok: false, reason: "too_many_lines" };
    }

    const match = /^([0-9a-fA-F]{64}) [ *](.+)$/.exec(line);

    if (!match) {
      return { ok: false, reason: "malformed_line", line: lineNumber };
    }

    const name = match[2];

    if (/[/\\]/.test(name)) {
      return { ok: false, reason: "path_in_file_name", line: lineNumber };
    }

    if (name.length > 255 || /[\u0000-\u001f\u007f]/.test(name) || name !== name.trim()) {
      return { ok: false, reason: "invalid_file_name", line: lineNumber };
    }

    if (sums.has(name)) {
      return { ok: false, reason: "duplicate_entry", line: lineNumber };
    }

    sums.set(name, match[1].toLowerCase());
  }

  if (sums.size === 0) {
    return { ok: false, reason: "empty" };
  }

  return { ok: true, sums };
}
