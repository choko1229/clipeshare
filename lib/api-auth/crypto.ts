import crypto from "node:crypto";

export const API_TOKEN_PREFIX = "csq_";
const TOKEN_BYTES = 32;

/** base64url(32バイト) = 43文字 */
function randomUrlSafe(bytes = TOKEN_BYTES) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function generateApiToken() {
  const token = `${API_TOKEN_PREFIX}${randomUrlSafe()}`;
  return {
    token,
    tokenHash: hashSecret(token),
    // 一覧で端末を見分けるための表示用。ハッシュ照合には使わない
    prefix: token.slice(0, API_TOKEN_PREFIX.length + 4),
  };
}

export function generateAuthorizationCode() {
  const code = randomUrlSafe();
  return { code, codeHash: hashSecret(code) };
}

export function generateCsrfToken() {
  const csrfToken = randomUrlSafe();
  return { csrfToken, csrfTokenHash: hashSecret(csrfToken) };
}

export function hashSecret(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

/** 長さが違っても例外にせず false を返す定数時間比較 */
export function constantTimeEqual(a: string, b: string) {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");

  if (left.length !== right.length) {
    // 長さの違いで早期 return するとタイミングが漏れるので、同じ長さ同士でも比較してから false
    crypto.timingSafeEqual(left, left);
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

/** 平文と保存済みハッシュの照合 */
export function secretMatchesHash(secret: string, expectedHash: string) {
  return constantTimeEqual(hashSecret(secret), expectedHash);
}

/** PKCE S256: BASE64URL(SHA256(verifier)) === challenge */
export function verifyPkceS256(codeVerifier: string, codeChallenge: string) {
  const computed = crypto.createHash("sha256").update(codeVerifier, "ascii").digest("base64url");
  return constantTimeEqual(computed, codeChallenge);
}

export function pkceChallengeFromVerifier(codeVerifier: string) {
  return crypto.createHash("sha256").update(codeVerifier, "ascii").digest("base64url");
}

export function looksLikeApiToken(value: string) {
  return /^csq_[A-Za-z0-9_-]{43}$/.test(value);
}
