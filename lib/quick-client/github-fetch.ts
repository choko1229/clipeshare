/**
 * GitHub への取得専用の fetch。SSRF 対策として、取得先(リダイレクト先を含む)は
 * GitHub の決まったホストの https のみ。サイズ上限・タイムアウト付き。認証情報は送らない。
 */
export const allowedGithubHosts = new Set([
  "api.github.com",
  "github.com",
  // リリースのアセットは github.com からこれらへリダイレクトされる
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
]);

export type GithubFetchFailure = "host_not_allowed" | "too_many_redirects" | "too_large" | "http_status" | "timeout" | "network";

export class GithubFetchError extends Error {
  constructor(
    readonly reason: GithubFetchFailure,
    readonly detail: string,
    readonly status?: number,
  ) {
    super(`GitHub fetch failed: ${reason} (${detail})`);
    this.name = "GithubFetchError";
  }
}

type GithubFetchOptions = {
  maxBytes: number;
  timeoutMs: number;
  accept: string;
  maxRedirects?: number;
};

export function isAllowedGithubUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && (url.port === "" || url.port === "443") && allowedGithubHosts.has(url.hostname);
  } catch {
    return false;
  }
}

export async function fetchFromGithub(url: string, options: GithubFetchOptions): Promise<Buffer> {
  const maxRedirects = options.maxRedirects ?? 3;
  const signal = AbortSignal.timeout(options.timeoutMs);
  let current = url;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    if (!isAllowedGithubUrl(current)) {
      throw new GithubFetchError("host_not_allowed", safeHost(current));
    }

    let response: Response;

    try {
      response = await fetch(current, {
        redirect: "manual",
        cache: "no-store",
        credentials: "omit",
        signal,
        headers: {
          Accept: options.accept,
          "User-Agent": "Clipshare-Server",
          ...(new URL(current).hostname === "api.github.com" ? { "X-GitHub-Api-Version": "2022-11-28" } : {}),
        },
      });
    } catch (error) {
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
        throw new GithubFetchError("timeout", safeHost(current));
      }
      throw new GithubFetchError("network", error instanceof Error ? error.name : "unknown");
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => undefined);

      if (!location) {
        throw new GithubFetchError("http_status", "redirect_without_location", response.status);
      }

      current = new URL(location, current).toString();
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new GithubFetchError("http_status", safeHost(current), response.status);
    }

    return readLimited(response, options.maxBytes, current);
  }

  throw new GithubFetchError("too_many_redirects", safeHost(url));
}

async function readLimited(response: Response, maxBytes: number, url: string) {
  const declared = Number.parseInt(response.headers.get("content-length") ?? "", 10);

  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new GithubFetchError("too_large", `${safeHost(url)} declared ${declared}`);
  }

  if (!response.body) {
    return Buffer.alloc(0);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    total += value.byteLength;

    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new GithubFetchError("too_large", safeHost(url));
    }

    chunks.push(value);
  }

  return Buffer.concat(chunks);
}

/** ログ用: ホスト名だけ(署名付き URL のクエリは出さない) */
function safeHost(value: string) {
  try {
    return new URL(value).hostname.slice(0, 100);
  } catch {
    return "invalid-url";
  }
}
