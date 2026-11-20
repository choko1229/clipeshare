import { z } from "zod";

export const QUICK_CLIENT_ID = "clipshare-quick";
export const AUTHORIZATION_REQUEST_TTL_MS = 10 * 60 * 1000;
export const AUTHORIZATION_CODE_TTL_MS = 10 * 60 * 1000;

const controlCharacters = /[\u0000-\u001f\u007f-\u009f]/;

/**
 * ループバックの redirect_uri だけを許可する。
 * `http://127.0.0.1:{port}/…` または `http://[::1]:{port}/…`。ポート必須、ユーザー情報・フラグメント不可。
 */
export function isLoopbackRedirectUri(value: string) {
  if (value.length > 255 || value.includes("#") || controlCharacters.test(value) || /\s/.test(value)) {
    return false;
  }

  if (!/^http:\/\/(127\.0\.0\.1|\[::1\]):\d{1,5}(\/|\?|$)/.test(value)) {
    return false;
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" || url.username || url.password || url.hash) {
    return false;
  }

  if (url.hostname !== "127.0.0.1" && url.hostname !== "[::1]") {
    return false;
  }

  const port = Number.parseInt(url.port, 10);
  return Number.isInteger(port) && port >= 1 && port <= 65_535;
}

const deviceText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !controlCharacters.test(value));

export const authorizeParamsSchema = z.object({
  client_id: z.literal(QUICK_CLIENT_ID),
  redirect_uri: z.string().refine(isLoopbackRedirectUri),
  state: z.string().regex(/^[\x21-\x7e]{1,256}$/),
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  code_challenge_method: z.literal("S256"),
  connection_code: z.string().regex(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/),
  device_name: deviceText(64),
  device_platform: deviceText(32).optional(),
});

export type AuthorizeParams = z.infer<typeof authorizeParamsSchema>;

type SearchParamsRecord = Record<string, string | string[] | undefined>;

/** 同じパラメータが複数あるものは不正として扱う */
export function parseAuthorizeParams(searchParams: SearchParamsRecord): AuthorizeParams | null {
  const flat: Record<string, string> = {};

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      return null;
    }

    if (value !== undefined) {
      flat[key] = value;
    }
  }

  const parsed = authorizeParamsSchema.safeParse(flat);
  return parsed.success ? parsed.data : null;
}

export const tokenExchangeSchema = z.object({
  code: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  code_verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
  redirect_uri: z.string().max(255),
});

export function buildRedirectUrl(redirectUri: string, params: Record<string, string>) {
  const url = new URL(redirectUri);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

/** authorize 画面の URL をパラメータから組み立て直す(ログイン後の戻り先用。相対パス) */
export function authorizePathFromParams(params: AuthorizeParams) {
  const search = new URLSearchParams();
  search.set("client_id", params.client_id);
  search.set("redirect_uri", params.redirect_uri);
  search.set("state", params.state);
  search.set("code_challenge", params.code_challenge);
  search.set("code_challenge_method", params.code_challenge_method);
  search.set("connection_code", params.connection_code);
  search.set("device_name", params.device_name);

  if (params.device_platform) {
    search.set("device_platform", params.device_platform);
  }

  return `/qick/authorize?${search.toString()}`;
}
