type LogLevel = "info" | "warn" | "error";

export type ApiLogFields = {
  event: string;
  requestId?: string;
  route?: string;
  method?: string;
  status?: number;
  code?: string;
  userId?: string | null;
  /** トークンの DB 上の ID のみ。トークン値・ハッシュは絶対に入れない */
  tokenId?: string | null;
  ipHash?: string | null;
  durationMs?: number;
  reason?: string;
  [key: string]: string | number | boolean | null | undefined;
};

const forbiddenKeys = new Set(["token", "authorization", "code", "code_verifier", "codeVerifier", "csrf", "csrfToken", "deleteToken", "cookie"]);

/**
 * 1行 JSON の構造化ログ。値に秘密情報を入れない前提だが、念のため既知の危険なキーは落とす
 * (`code` だけはエラーコード用に許可するため、文字列が大文字スネークケースのときだけ残す)。
 */
export function logApi(level: LogLevel, fields: ApiLogFields) {
  const safe: Record<string, string | number | boolean | null> = { ts: new Date().toISOString(), level };

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) {
      continue;
    }

    if (forbiddenKeys.has(key)) {
      if (key === "code" && typeof value === "string" && /^[A-Z_]{2,40}$/.test(value)) {
        safe[key] = value;
      }
      continue;
    }

    safe[key] = typeof value === "string" ? value.slice(0, 300) : value;
  }

  const line = JSON.stringify(safe);

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

/**
 * 例外をログ用の短い文字列にする(スタックは含めない)。
 * Prisma のエラーメッセージはクエリの引数(ハッシュ値など)を含むことがあるため、名前とエラーコードだけにする。
 */
export function describeError(error: unknown) {
  if (!(error instanceof Error)) {
    return "non-error thrown";
  }

  if (error.name.startsWith("PrismaClient")) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? `${error.name}(${code})` : error.name;
  }

  const firstLine = error.message.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
  return `${error.name}: ${firstLine}`.slice(0, 200);
}
