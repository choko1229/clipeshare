/** リリースに添付する SHA256SUMS のファイル名(クライアントのリリースワークフローと合わせる) */
export const sha256SumsAssetNames = ["SHA256SUMS", "SHA256SUMS.txt"] as const;
export const SHA256SUMS_MAX_BYTES = 64 * 1024;
const MAX_LINES = 200;

export type Sha256SumsParseResult = { ok: true; sums: Map<string, string> } | { ok: false; reason: string };

export function isSha256Hex(value: string) {
  return /^[0-9a-f]{64}$/.test(value);
}

/**
 * `sha256sum` の出力形式(`<64桁の16進> <空白|*><ファイル名>`)を解析する。
 * 1行でも形式が違えばファイル全体を不正とする(部分的に信用しない)。ファイル名はパスを除いた名前で照合する。
 */
export function parseSha256Sums(text: string): Sha256SumsParseResult {
  const content = text.replace(/^﻿/, "");
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { ok: false, reason: "empty" };
  }

  if (lines.length > MAX_LINES) {
    return { ok: false, reason: "too_many_lines" };
  }

  const sums = new Map<string, string>();

  for (const line of lines) {
    const match = /^([0-9a-fA-F]{64}) [ *](.+)$/.exec(line.trimEnd());

    if (!match) {
      return { ok: false, reason: "malformed_line" };
    }

    const name = match[2].replace(/^\.\//, "").split("/").pop() ?? "";

    if (!name || name.length > 255 || /[\u0000-\u001f\\]/.test(name)) {
      return { ok: false, reason: "invalid_file_name" };
    }

    const hash = match[1].toLowerCase();
    const existing = sums.get(name);

    if (existing && existing !== hash) {
      return { ok: false, reason: "conflicting_entries" };
    }

    sums.set(name, hash);
  }

  return { ok: true, sums };
}
