import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakePrisma, resetFakePrisma } from "./helpers/fake-prisma";

vi.mock("@/lib/db/prisma", async () => {
  const helpers = await import("./helpers/fake-prisma");
  return { prisma: helpers.fakePrisma };
});

const { isApiError } = await import("@/lib/api/errors");
const { authenticateApiRequest, authFailureLimiter } = await import("@/lib/api-auth/authenticate");
const { decideAuthorization, exchangeAuthorizationCode, startAuthorization } = await import("@/lib/api-auth/authorization");
const { isLoopbackRedirectUri, parseAuthorizeParams } = await import("@/lib/api-auth/authorize-params");
const { generateApiToken, hashSecret, looksLikeApiToken, pkceChallengeFromVerifier, verifyPkceS256 } = await import("@/lib/api-auth/crypto");
const { safeCallbackPath } = await import("@/lib/auth/callback-url");
const { clearQuickApiSettingsCache } = await import("@/lib/quick-share/api-settings");

const verifier = "v".repeat(20) + crypto.randomBytes(24).toString("base64url");

function validParams(overrides: Record<string, string> = {}) {
  return {
    client_id: "clipshare-quick",
    redirect_uri: "http://127.0.0.1:53682/callback",
    state: "state-abc_123",
    code_challenge: pkceChallengeFromVerifier(verifier),
    code_challenge_method: "S256",
    connection_code: "7K2-M9Q",
    device_name: "DESKTOP-4N7QK",
    device_platform: "Windows 11",
    ...overrides,
  };
}

function requestWith(headers: Record<string, string>) {
  return new Request("https://clipshare.link/api/v1/me", { headers: { "x-forwarded-for": "203.0.113.5", ...headers } });
}

function newContext() {
  return { requestId: crypto.randomUUID(), logFields: {} };
}

async function expectApiError(promise: Promise<unknown>, code: string) {
  try {
    await promise;
  } catch (error) {
    expect(isApiError(error)).toBe(true);
    expect((error as { code: string }).code).toBe(code);
    return error;
  }

  throw new Error(`expected ApiError ${code}`);
}

let logged: string[] = [];

beforeEach(() => {
  resetFakePrisma();
  clearQuickApiSettingsCache();
  authFailureLimiter.reset();
  logged = [];
  for (const method of ["info", "warn", "error", "log"] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(" "));
    });
  }
  fakePrisma.insert("user", { id: "user-1", username: "choko1229", displayName: "ちょこ" });
  fakePrisma.insert("user", { id: "user-2", username: "other" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function approveFlow(userId = "user-1", params = validParams()) {
  const parsed = parseAuthorizeParams(params);
  if (!parsed) throw new Error("params invalid");
  const started = await startAuthorization(userId, parsed);
  if (started.kind !== "ready") throw new Error("not ready");
  const decided = await decideAuthorization({
    authorizationId: started.authorization.id,
    csrfToken: started.csrfToken,
    userId,
    approve: true,
  });
  if (decided.kind !== "redirect") throw new Error("not redirected");
  const location = new URL(decided.location);
  return { started, location, code: location.searchParams.get("code") ?? "" };
}

function exchange(code: string, overrides: Partial<{ codeVerifier: string; redirectUri: string }> = {}) {
  return exchangeAuthorizationCode({
    code,
    codeVerifier: overrides.codeVerifier ?? verifier,
    redirectUri: overrides.redirectUri ?? "http://127.0.0.1:53682/callback",
    ipHash: "ip",
    clientVersion: "1.0.0",
    requestId: "req",
  });
}

describe("redirect_uri validation (loopback only)", () => {
  it.each([
    "http://127.0.0.1:53682/callback",
    "http://127.0.0.1:1/",
    "http://[::1]:65535/callback",
    "http://127.0.0.1:8080/cb?x=1",
  ])("accepts %s", (uri) => {
    expect(isLoopbackRedirectUri(uri)).toBe(true);
  });

  it.each([
    "http://localhost:53682/callback",
    "https://127.0.0.1:53682/callback",
    "http://127.0.0.1/callback",
    "http://127.0.0.1:0/callback",
    "http://127.0.0.1:65536/callback",
    "http://127.0.0.2:53682/callback",
    "http://127.0.0.1.evil.example:53682/callback",
    "http://user:pass@127.0.0.1:53682/callback",
    "http://127.0.0.1:53682/callback#frag",
    "http://evil.example/@127.0.0.1:53682",
    "javascript:alert(1)",
    "http://127.0.0.1:53682/ callback",
    `http://127.0.0.1:53682/${"a".repeat(260)}`,
  ])("rejects %s", (uri) => {
    expect(isLoopbackRedirectUri(uri)).toBe(false);
  });
});

describe("authorize params", () => {
  it("accepts a valid request", () => {
    expect(parseAuthorizeParams(validParams())).not.toBeNull();
  });

  it("rejects duplicated parameters", () => {
    expect(parseAuthorizeParams({ ...validParams(), state: ["a", "b"] })).toBeNull();
  });

  it.each([
    ["code_challenge_method", "plain"],
    ["client_id", "other"],
    ["connection_code", "7K2-M9O"],
    ["connection_code", "7k2-m9q"],
    ["code_challenge", "short"],
    ["device_name", "x".repeat(65)],
    ["device_name", "  "],
    ["device_platform", "x".repeat(33)],
    ["state", ""],
    ["state", "a b"],
    ["redirect_uri", "https://evil.example/callback"],
  ])("rejects %s=%s", (key, value) => {
    expect(parseAuthorizeParams(validParams({ [key]: value }))).toBeNull();
  });

  it("requires state", () => {
    const { state: _state, ...withoutState } = validParams();
    expect(parseAuthorizeParams(withoutState)).toBeNull();
  });
});

describe("token crypto", () => {
  it("generates a 47-char csq_ token with a short display prefix and a SHA-256 hash", () => {
    const generated = generateApiToken();
    expect(looksLikeApiToken(generated.token)).toBe(true);
    expect(generated.token).toHaveLength(47);
    expect(generated.prefix).toBe(generated.token.slice(0, 8));
    expect(generated.tokenHash).toBe(hashSecret(generated.token));
    expect(generated.tokenHash).not.toContain(generated.token);
  });

  it("verifies PKCE S256 and rejects a different verifier", () => {
    const challenge = pkceChallengeFromVerifier(verifier);
    expect(verifyPkceS256(verifier, challenge)).toBe(true);
    expect(verifyPkceS256(`${verifier}x`, challenge)).toBe(false);
  });
});

describe("login callbackUrl", () => {
  it.each([
    ["/qick/authorize?client_id=clipshare-quick", "/qick/authorize?client_id=clipshare-quick"],
    ["/settings/apps", "/settings/apps"],
  ])("keeps same-origin path %s", (input, expected) => {
    expect(safeCallbackPath(input)).toBe(expected);
  });

  it.each(["https://evil.example/", "//evil.example/", "/\\evil.example", "qick", "", undefined])("rejects %s", (input) => {
    expect(safeCallbackPath(input)).toBeNull();
  });
});

describe("authorization flow", () => {
  it("issues a token for a valid code + verifier and returns the same state", async () => {
    const { location, code } = await approveFlow();
    expect(location.origin).toBe("http://127.0.0.1:53682");
    expect(location.searchParams.get("state")).toBe("state-abc_123");

    const result = await exchange(code);
    expect(looksLikeApiToken(result.token)).toBe(true);
    expect(result.user).toEqual({ id: "user-1", name: "ちょこ" });

    const stored = fakePrisma.rows("apiToken")[0];
    expect(stored.tokenHash).toBe(hashSecret(result.token));
    expect(JSON.stringify(stored)).not.toContain(result.token);
    expect(stored.name).toBe("DESKTOP-4N7QK");
    expect(stored.platform).toBe("Windows 11");

    // 認可コードもハッシュのみ保存
    const authorization = fakePrisma.rows("apiAuthorization")[0];
    expect(JSON.stringify(authorization)).not.toContain(code);
    expect(logged.join("\n")).not.toContain(result.token);
    expect(logged.join("\n")).not.toContain(code);
  });

  it("rejects a PKCE mismatch", async () => {
    const { code } = await approveFlow();
    await expectApiError(exchange(code, { codeVerifier: "w".repeat(43) }), "INVALID_REQUEST");
    expect(fakePrisma.rows("apiToken")).toHaveLength(0);
  });

  it("rejects a different redirect_uri at exchange", async () => {
    const { code } = await approveFlow();
    await expectApiError(exchange(code, { redirectUri: "http://127.0.0.1:53683/callback" }), "INVALID_REQUEST");
  });

  it("rejects an expired code", async () => {
    const { code } = await approveFlow();
    const row = fakePrisma.rows("apiAuthorization")[0];
    fakePrisma.tables.apiAuthorization.set(row.id, { ...row, codeExpiresAt: new Date(Date.now() - 1000) });
    await expectApiError(exchange(code), "INVALID_REQUEST");
  });

  it("rejects a reused code and revokes the token issued from it", async () => {
    const { code } = await approveFlow();
    const first = await exchange(code);
    await expectApiError(exchange(code), "INVALID_REQUEST");

    const token = fakePrisma.rows("apiToken")[0];
    expect(token.revokedAt).toBeInstanceOf(Date);
    expect(token.revokedReason).toBe("CODE_REUSE");
    await expectApiError(authenticateApiRequest(requestWith({ authorization: `Bearer ${first.token}` }), newContext()), "UNAUTHORIZED");
  });

  it("revokes the token when the same code is exchanged twice at the same time", async () => {
    const { code } = await approveFlow();
    const results = await Promise.allSettled([exchange(code), exchange(code)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const tokens = fakePrisma.rows("apiToken");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].revokedReason).toBe("CODE_REUSE");
  });

  it("rejects an unknown code", async () => {
    await expectApiError(exchange(crypto.randomBytes(32).toString("base64url")), "INVALID_REQUEST");
  });

  it("returns access_denied with state on cancel and never issues a code", async () => {
    const parsed = parseAuthorizeParams(validParams());
    if (!parsed) throw new Error("invalid");
    const started = await startAuthorization("user-1", parsed);
    if (started.kind !== "ready") throw new Error("not ready");
    const decided = await decideAuthorization({ authorizationId: started.authorization.id, csrfToken: started.csrfToken, userId: "user-1", approve: false });
    expect(decided.kind).toBe("redirect");
    const location = new URL((decided as { location: string }).location);
    expect(location.searchParams.get("error")).toBe("access_denied");
    expect(location.searchParams.get("state")).toBe("state-abc_123");
    expect(location.searchParams.get("code")).toBeNull();
  });

  it("rejects a CSRF token mismatch, another user's decision and a second decision", async () => {
    const parsed = parseAuthorizeParams(validParams());
    if (!parsed) throw new Error("invalid");
    const started = await startAuthorization("user-1", parsed);
    if (started.kind !== "ready") throw new Error("not ready");
    const id = started.authorization.id;

    expect((await decideAuthorization({ authorizationId: id, csrfToken: "wrong", userId: "user-1", approve: true })).kind).toBe("invalid");
    expect((await decideAuthorization({ authorizationId: id, csrfToken: started.csrfToken, userId: "user-2", approve: true })).kind).toBe("invalid");
    expect((await decideAuthorization({ authorizationId: id, csrfToken: started.csrfToken, userId: "user-1", approve: true })).kind).toBe("redirect");
    expect((await decideAuthorization({ authorizationId: id, csrfToken: started.csrfToken, userId: "user-1", approve: true })).kind).toBe("invalid");
  });

  it("reuses the pending request on reload (rotating the CSRF token) and rejects changed or decided requests", async () => {
    const parsed = parseAuthorizeParams(validParams());
    if (!parsed) throw new Error("invalid");
    const first = await startAuthorization("user-1", parsed);
    const second = await startAuthorization("user-1", parsed);
    expect(first.kind).toBe("ready");
    expect(second.kind).toBe("ready");
    expect(fakePrisma.rows("apiAuthorization")).toHaveLength(1);

    if (first.kind !== "ready" || second.kind !== "ready") throw new Error("not ready");
    expect(second.csrfToken).not.toBe(first.csrfToken);
    // 古い CSRF トークンはもう使えない
    expect((await decideAuthorization({ authorizationId: first.authorization.id, csrfToken: first.csrfToken, userId: "user-1", approve: true })).kind).toBe(
      "invalid",
    );

    const changed = parseAuthorizeParams(validParams({ connection_code: "AAA-BBB" }));
    if (!changed) throw new Error("invalid");
    expect((await startAuthorization("user-1", changed)).kind).toBe("invalid");
    expect((await startAuthorization("user-2", parsed)).kind).toBe("invalid");
  });

  it("rejects an expired authorization request", async () => {
    const parsed = parseAuthorizeParams(validParams());
    if (!parsed) throw new Error("invalid");
    const started = await startAuthorization("user-1", parsed, new Date(Date.now() - 11 * 60 * 1000));
    if (started.kind !== "ready") throw new Error("not ready");
    expect((await decideAuthorization({ authorizationId: started.authorization.id, csrfToken: started.csrfToken, userId: "user-1", approve: true })).kind).toBe(
      "invalid",
    );
    expect((await startAuthorization("user-1", parsed)).kind).toBe("invalid");
  });

  it("refuses to approve and to exchange while token issuance is disabled", async () => {
    const { code } = await approveFlow();
    fakePrisma.insert("siteSetting", { key: "quick_api_token_issuance_enabled", value: "false" });
    clearQuickApiSettingsCache();
    await expectApiError(exchange(code), "SERVICE_UNAVAILABLE");

    const parsed = parseAuthorizeParams(validParams({ code_challenge: pkceChallengeFromVerifier("z".repeat(50)) }));
    if (!parsed) throw new Error("invalid");
    const started = await startAuthorization("user-1", parsed);
    if (started.kind !== "ready") throw new Error("not ready");
    expect((await decideAuthorization({ authorizationId: started.authorization.id, csrfToken: started.csrfToken, userId: "user-1", approve: true })).kind).toBe(
      "invalid",
    );
  });

  it("refuses to issue a token to a banned user", async () => {
    const { code } = await approveFlow();
    const user = fakePrisma.tables.user.get("user-1");
    fakePrisma.tables.user.set("user-1", { ...user!, isBanned: true });
    await expectApiError(exchange(code), "FORBIDDEN");
  });
});

describe("bearer authentication", () => {
  async function issuedToken() {
    const { code } = await approveFlow();
    return (await exchange(code)).token;
  }

  it("treats a request without Authorization as anonymous", async () => {
    const auth = await authenticateApiRequest(requestWith({}), newContext());
    expect(auth.kind).toBe("anonymous");
  });

  it("accepts a valid token", async () => {
    const token = await issuedToken();
    const context = newContext();
    const auth = await authenticateApiRequest(requestWith({ authorization: `Bearer ${token}`, "user-agent": "ClipshareQuick/1.2.3 (Windows)" }), context);
    expect(auth.kind).toBe("token");
    expect(context.logFields).toMatchObject({ userId: "user-1" });
    expect(JSON.stringify(context.logFields)).not.toContain(token);
  });

  it.each(["Bearer", "Bearer ", "Basic abc", "Bearer not-a-token", `Bearer csq_${"a".repeat(42)}`, "Bearer a b"])(
    "rejects malformed header %s with 401 (never anonymous)",
    async (header) => {
      await expectApiError(authenticateApiRequest(requestWith({ authorization: header }), newContext()), "UNAUTHORIZED");
    },
  );

  it("rejects an unknown token with 401", async () => {
    await expectApiError(authenticateApiRequest(requestWith({ authorization: `Bearer ${generateApiToken().token}` }), newContext()), "UNAUTHORIZED");
  });

  it("rejects a revoked token with 401 immediately", async () => {
    const token = await issuedToken();
    const row = fakePrisma.rows("apiToken")[0];
    fakePrisma.tables.apiToken.set(row.id, { ...row, revokedAt: new Date(), revokedReason: "USER" });
    await expectApiError(authenticateApiRequest(requestWith({ authorization: `Bearer ${token}` }), newContext()), "UNAUTHORIZED");
  });

  it("rejects a banned user's token with 403", async () => {
    const token = await issuedToken();
    const user = fakePrisma.tables.user.get("user-1");
    fakePrisma.tables.user.set("user-1", { ...user!, isBanned: true });
    await expectApiError(authenticateApiRequest(requestWith({ authorization: `Bearer ${token}` }), newContext()), "FORBIDDEN");
  });

  it("rate-limits repeated failures from one IP and warns", async () => {
    fakePrisma.insert("siteSetting", { key: "quick_api_auth_failure_limit_per_10min", value: "3" });
    clearQuickApiSettingsCache();
    const bad = requestWith({ authorization: `Bearer ${generateApiToken().token}` });

    for (let i = 0; i < 3; i += 1) {
      await expectApiError(authenticateApiRequest(bad, newContext()), "UNAUTHORIZED");
    }

    const error = await expectApiError(authenticateApiRequest(bad, newContext()), "RATE_LIMITED");
    expect((error as { headers: Record<string, string> }).headers["Retry-After"]).toMatch(/^\d+$/);
    expect(logged.some((line) => line.includes("api_auth.repeated_failures"))).toBe(true);
  });

  it("records the client version from the User-Agent", async () => {
    const token = await issuedToken();
    await authenticateApiRequest(requestWith({ authorization: `Bearer ${token}`, "user-agent": "ClipshareQuick/1.4.0 (Windows)" }), newContext());
    expect(fakePrisma.rows("apiToken")[0].clientVersion).toBe("1.4.0");
  });
});
