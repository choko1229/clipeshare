/**
 * ログイン後の戻り先として安全な同一オリジンの相対パスだけを返す。それ以外は null。
 * (`//evil.example` や `/\evil.example` のようなプロトコル相対 URL、制御文字を拒否)
 */
export function safeCallbackPath(value: string | string[] | undefined): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) {
    return null;
  }

  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\") || /[\u0000-\u001f\u007f\\]/.test(value)) {
    return null;
  }

  try {
    const base = "http://callback.invalid";
    const url = new URL(value, base);

    if (url.origin !== base) {
      return null;
    }

    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}
