import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakePrisma, resetFakePrisma } from "./helpers/fake-prisma";

vi.mock("@/lib/db/prisma", async () => {
  const helpers = await import("./helpers/fake-prisma");
  return { prisma: helpers.fakePrisma };
});

const sessionMock = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));

vi.mock("next-auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("next-auth")>();
  return { ...original, getServerSession: vi.fn(async () => sessionMock.current) };
});

const { POST: decisionPost } = await import("@/app/qick/authorize/decision/route");
const tokenRoute = await import("@/app/api/v1/auth/token/route");
const meRoute = await import("@/app/api/v1/me/route");
const { startAuthorization } = await import("@/lib/api-auth/authorization");
const { parseAuthorizeParams } = await import("@/lib/api-auth/authorize-params");
const { pkceChallengeFromVerifier } = await import("@/lib/api-auth/crypto");
const { authFailureLimiter } = await import("@/lib/api-auth/authenticate");
const { apiRequestLimiter } = await import("@/lib/api/rate-limits");
const { clearQuickApiSettingsCache } = await import("@/lib/quick-share/api-settings");

const verifier = crypto.randomBytes(40).toString("base64url");
const redirectUri = "http://127.0.0.1:50123/callback";
const routeContext = { params: Promise.resolve({}) };

beforeEach(() => {
  resetFakePrisma();
  clearQuickApiSettingsCache();
  authFailureLimiter.reset();
  apiRequestLimiter.reset();
  sessionMock.current = { user: { id: "user-1" } };
  process.env.NEXT_PUBLIC_APP_URL = "https://clipshare.link";
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  fakePrisma.insert("user", { id: "user-1", username: "choko1229", displayName: null });
});

async function pendingAuthorization() {
  const parsed = parseAuthorizeParams({
    client_id: "clipshare-quick",
    redirect_uri: redirectUri,
    state: "s1",
    code_challenge: pkceChallengeFromVerifier(verifier),
    code_challenge_method: "S256",
    connection_code: "ABC-DEF",
    device_name: "PC-1",
  });
  if (!parsed) throw new Error("invalid params");
  const started = await startAuthorization("user-1", parsed);
  if (started.kind !== "ready") throw new Error("not ready");
  return started;
}

function decisionRequest(body: Record<string, string>, headers: Record<string, string> = {}) {
  return new Request("https://clipshare.link/qick/authorize/decision", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: "https://clipshare.link", "sec-fetch-site": "same-origin", ...headers },
    body: new URLSearchParams(body).toString(),
  });
}

async function approveAndGetCode() {
  const started = await pendingAuthorization();
  const response = await decisionPost(
    decisionRequest({ authorization_id: started.authorization.id, csrf_token: started.csrfToken, decision: "approve" }),
  );
  expect(response.status).toBe(303);
  const location = new URL(response.headers.get("location") ?? "");
  return location.searchParams.get("code") ?? "";
}

function tokenRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://clipshare.link/api/v1/auth/token", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "ClipshareQuick/1.0.0 (Windows)", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /qick/authorize/decision", () => {
  it("redirects to the loopback with code and state on approve", async () => {
    const started = await pendingAuthorization();
    const response = await decisionPost(
      decisionRequest({ authorization_id: started.authorization.id, csrf_token: started.csrfToken, decision: "approve" }),
    );
    const location = new URL(response.headers.get("location") ?? "");
    expect(response.status).toBe(303);
    expect(`${location.origin}${location.pathname}`).toBe(redirectUri);
    expect(location.searchParams.get("state")).toBe("s1");
    expect(location.searchParams.get("code")).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("refuses a cross-site POST without touching the request", async () => {
    const started = await pendingAuthorization();
    const response = await decisionPost(
      decisionRequest(
        { authorization_id: started.authorization.id, csrf_token: started.csrfToken, decision: "approve" },
        { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
      ),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://clipshare.link/qick/authorize");
    expect(fakePrisma.rows("apiAuthorization")[0].status).toBe("PENDING");
  });

  it("refuses a wrong CSRF token and sends the user to the invalid screen", async () => {
    const started = await pendingAuthorization();
    const response = await decisionPost(decisionRequest({ authorization_id: started.authorization.id, csrf_token: "nope", decision: "approve" }));
    expect(response.headers.get("location")).toBe("https://clipshare.link/qick/authorize");
    expect(fakePrisma.rows("apiAuthorization")[0].status).toBe("PENDING");
  });

  it("sends a logged-out user to login", async () => {
    const started = await pendingAuthorization();
    sessionMock.current = null;
    const response = await decisionPost(
      decisionRequest({ authorization_id: started.authorization.id, csrf_token: started.csrfToken, decision: "approve" }),
    );
    expect(response.headers.get("location")).toBe("https://clipshare.link/login");
  });
});

describe("POST /api/v1/auth/token", () => {
  it("returns the token once with user and limits", async () => {
    const code = await approveAndGetCode();
    const response = await tokenRoute.POST(tokenRequest({ code, code_verifier: verifier, redirect_uri: redirectUri }), routeContext);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ tokenType: "Bearer", user: { id: "user-1", name: "choko1229" } });
    expect(body.limits).toMatchObject({ banner: false, dailyLimit: 5, imageMaxBytes: 50_000_000, videoMaxBytes: 200_000_000 });
    expect(typeof body.token).toBe("string");
    expect(typeof body.tokenId).toBe("string");
  });

  it("returns the unified 400 error body for a bad request", async () => {
    const response = await tokenRoute.POST(tokenRequest({ code: "x" }), routeContext);
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("INVALID_REQUEST");
    expect(body.error.message).toBeTruthy();
    expect(JSON.stringify(body)).not.toMatch(/stack|prisma|\\|\//i);
  });

  it("rejects non-JSON bodies", async () => {
    const response = await tokenRoute.POST(tokenRequest({}, { "content-type": "text/plain" }), routeContext);
    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/v1/auth/token and GET /api/v1/me", () => {
  async function issue() {
    const code = await approveAndGetCode();
    const response = await tokenRoute.POST(tokenRequest({ code, code_verifier: verifier, redirect_uri: redirectUri }), routeContext);
    return ((await response.json()) as { token: string }).token;
  }

  function meRequest(headers: Record<string, string> = {}) {
    return new Request("https://clipshare.link/api/v1/me", { headers: { "x-forwarded-for": "198.51.100.7", ...headers } });
  }

  it("reports anonymous limits with banner when there is no token", async () => {
    const response = await meRoute.GET(meRequest(), routeContext);
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ authenticated: false, user: null, limits: { banner: true, dailyLimit: 5, dailyUsed: 0 } });
    expect(Date.parse((body.limits as { resetsAt: string }).resetsAt)).toBeGreaterThan(Date.now());
  });

  it("reports the user for a valid token, then 401 after self-revocation", async () => {
    const token = await issue();
    const ok = await meRoute.GET(meRequest({ authorization: `Bearer ${token}` }), routeContext);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ authenticated: true, user: { id: "user-1" }, limits: { banner: false } });

    const revoked = await tokenRoute.DELETE(
      new Request("https://clipshare.link/api/v1/auth/token", { method: "DELETE", headers: { authorization: `Bearer ${token}` } }),
      routeContext,
    );
    expect(revoked.status).toBe(204);

    const after = await meRoute.GET(meRequest({ authorization: `Bearer ${token}` }), routeContext);
    expect(after.status).toBe(401);
    expect(await after.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it("returns 401 for DELETE without a token", async () => {
    const response = await tokenRoute.DELETE(new Request("https://clipshare.link/api/v1/auth/token", { method: "DELETE" }), routeContext);
    expect(response.status).toBe(401);
  });

  it("rate-limits anonymous requests per IP with Retry-After", async () => {
    fakePrisma.insert("siteSetting", { key: "quick_api_rate_limit_anonymous_per_minute", value: "2" });
    clearQuickApiSettingsCache();
    expect((await meRoute.GET(meRequest(), routeContext)).status).toBe(200);
    expect((await meRoute.GET(meRequest(), routeContext)).status).toBe(200);
    const limited = await meRoute.GET(meRequest(), routeContext);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(await limited.json()).toMatchObject({ error: { code: "RATE_LIMITED", details: { retryAfterSeconds: expect.any(Number) } } });
  });
});
