import crypto from "node:crypto";
import { access, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fakePrisma, resetFakePrisma } from "./helpers/fake-prisma";
import { fakeMp4, jpegWithGpsExif, multipartRequest, plainPng } from "./helpers/media";

const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "clipshare-quick-"));
process.env.CLIPSHARE_TEST_MEDIA_ROOT = tmpRoot;

vi.mock("@/lib/db/prisma", async () => {
  const helpers = await import("./helpers/fake-prisma");
  return { prisma: helpers.fakePrisma };
});

vi.mock("@/lib/media/paths", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/media/paths")>();
  const nodePath = await import("node:path");
  const root = process.env.CLIPSHARE_TEST_MEDIA_ROOT ?? "";
  return {
    ...original,
    mediaPaths: {
      ...original.mediaPaths,
      processedRoot: nodePath.join(root, "processed"),
      quickShareRoot: nodePath.join(root, "processed", "quick"),
      quickShareOriginalRoot: nodePath.join(root, "originals", "quick"),
    },
  };
});

const quickRoute = await import("@/app/api/v1/quick/route");
const quickIdRoute = await import("@/app/api/v1/quick/[id]/route");
const { generateApiToken } = await import("@/lib/api-auth/crypto");
const { authFailureLimiter } = await import("@/lib/api-auth/authenticate");
const { apiRequestLimiter } = await import("@/lib/api/rate-limits");
const { clearQuickApiSettingsCache } = await import("@/lib/quick-share/api-settings");

const url = "https://clipshare.link/api/v1/quick";
const noParams = { params: Promise.resolve({}) };
let logged: string[] = [];

afterAll(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

beforeEach(() => {
  resetFakePrisma();
  clearQuickApiSettingsCache();
  authFailureLimiter.reset();
  apiRequestLimiter.reset();
  process.env.NEXT_PUBLIC_APP_URL = "https://clipshare.link";
  logged = [];
  for (const method of ["info", "warn", "error", "log"] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(" "));
    });
  }
  fakePrisma.insert("user", { id: "user-1", username: "alice" });
  fakePrisma.insert("user", { id: "user-2", username: "bob" });
});

function issueToken(userId: string) {
  const generated = generateApiToken();
  const row = fakePrisma.insert("apiToken", {
    userId,
    clientId: "clipshare-quick",
    name: "PC",
    tokenHash: generated.tokenHash,
    prefix: generated.prefix,
  });
  return { token: generated.token, tokenId: row.id };
}

function upload(parts: Parameters<typeof multipartRequest>[1], headers: Record<string, string> = {}) {
  return quickRoute.POST(multipartRequest(url, parts, { "x-forwarded-for": "192.0.2.10", ...headers }), noParams);
}

function deleteRequest(id: string, headers: Record<string, string> = {}) {
  return quickIdRoute.DELETE(
    new Request(`${url}/${id}`, { method: "DELETE", headers: { "x-forwarded-for": "192.0.2.10", ...headers } }),
    { params: Promise.resolve({ id }) },
  );
}

async function storedImagePath(id: string) {
  return path.join(tmpRoot, "processed", "quick", "images", `${id}.webp`);
}

describe("POST /api/v1/quick", () => {
  it("token upload: 201, /q/{id} URL, no banner, no deleteToken, linked to the token", async () => {
    const { token, tokenId } = issueToken("user-1");
    const png = await plainPng(800, 600);
    const response = await upload({ file: { bytes: png, name: "VRChat_1.png", type: "image/png" } }, { authorization: `Bearer ${token}` });
    expect(response.status).toBe(201);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ kind: "IMAGE", status: "READY", url: `https://clipshare.link/q/${String(body.id)}` });
    expect(body).not.toHaveProperty("deleteToken");
    expect(Date.parse(String(body.expiresAt)) - Date.now()).toBeGreaterThan(23.9 * 3600 * 1000);

    const row = fakePrisma.rows("quickShare")[0];
    expect(row).toMatchObject({ userId: "user-1", apiTokenId: tokenId, ipHash: null });
    const metadata = await sharp(await storedImagePath(String(body.id))).metadata();
    // バナーなし: 寸法はそのまま
    expect([metadata.width, metadata.height]).toEqual([800, 600]);
    expect(logged.join("\n")).not.toContain(token);
  });

  it("anonymous upload: banner and deleteToken, counted by IP hash", async () => {
    const response = await upload({ file: { bytes: await plainPng(800, 600), name: "a.png" } });
    expect(response.status).toBe(201);
    const body = (await response.json()) as Record<string, unknown>;
    expect(typeof body.deleteToken).toBe("string");
    const metadata = await sharp(await storedImagePath(String(body.id))).metadata();
    expect(metadata.width).toBe(800);
    expect(metadata.height).toBeGreaterThan(600);
    const row = fakePrisma.rows("quickShare")[0];
    expect(row.userId).toBeNull();
    expect(row.apiTokenId).toBeNull();
    expect(typeof row.ipHash).toBe("string");
  });

  it("anonymous original still gets the banner", async () => {
    const response = await upload({ file: { bytes: await plainPng(800, 600), name: "a.png" }, quality: "original" });
    const body = (await response.json()) as Record<string, unknown>;
    const metadata = await sharp(await storedImagePath(String(body.id))).metadata();
    expect(metadata.height).toBeGreaterThan(600);
  });

  it("token original keeps full size and removes GPS EXIF", async () => {
    const { token } = issueToken("user-1");
    const response = await upload({ file: { bytes: await jpegWithGpsExif(3000, 2400), name: "a.jpg" }, quality: "original" }, { authorization: `Bearer ${token}` });
    const body = (await response.json()) as Record<string, unknown>;
    const metadata = await sharp(await storedImagePath(String(body.id))).metadata();
    expect([metadata.width, metadata.height]).toEqual([2400, 3000]);
    expect(metadata.exif).toBeUndefined();
  });

  it("invalid or revoked tokens get 401 and never fall back to anonymous", async () => {
    const bad = await upload({ file: { bytes: await plainPng(10, 10), name: "a.png" } }, { authorization: "Bearer nope" });
    expect(bad.status).toBe(401);

    const { token, tokenId } = issueToken("user-1");
    const row = fakePrisma.tables.apiToken.get(tokenId);
    fakePrisma.tables.apiToken.set(tokenId, { ...row!, revokedAt: new Date() });
    const revoked = await upload({ file: { bytes: await plainPng(10, 10), name: "a.png" } }, { authorization: `Bearer ${token}` });
    expect(revoked.status).toBe(401);
    expect(fakePrisma.rows("quickShare")).toHaveLength(0);
  });

  it("anonymous: the 5th upload succeeds and the 6th returns 429 DAILY_LIMIT_EXCEEDED with resetsAt", async () => {
    for (let i = 0; i < 5; i += 1) {
      const response = await upload({ file: { bytes: await plainPng(10, 10), name: "a.png" } });
      expect(response.status).toBe(201);
    }

    const sixth = await upload({ file: { bytes: await plainPng(10, 10), name: "a.png" } });
    expect(sixth.status).toBe(429);
    const body = (await sixth.json()) as { error: { code: string; details: { resetsAt: string } } };
    expect(body.error.code).toBe("DAILY_LIMIT_EXCEEDED");
    const resetsAt = new Date(body.error.details.resetsAt);
    expect(resetsAt.getHours()).toBe(0);
    expect(resetsAt.getMinutes()).toBe(0);
    expect(resetsAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("counts uploads made yesterday separately (day boundary)", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);
    for (let i = 0; i < 5; i += 1) {
      fakePrisma.insert("quickShare", { publicId: `old${i}`, ipHash: (await import("@/lib/quick-share/ip-hash")).computeClientIpHash(new Headers({ "x-forwarded-for": "192.0.2.10" })), createdAt: yesterday, kind: "IMAGE", deleteToken: "x", mimeType: "image/webp", fileSizeBytes: 1n, expiresAt: new Date() });
    }
    const response = await upload({ file: { bytes: await plainPng(10, 10), name: "a.png" } });
    expect(response.status).toBe(201);
  });

  it("uses the account level's limits for token users (daily limit and 0 = unlimited size)", async () => {
    fakePrisma.insert("accountLevel", { id: "lvl", name: "Member", isDefault: true, createdAt: new Date(), dailyUploadLimit: 1, quickShareImageMaxBytes: 0n, quickShareVideoMaxBytes: 1000n, maxVideoSeconds: 1, maxVideoSizeBytes: 1n, maxImageSizeBytes: 1n, maxImagesPerPost: 1, levelColor: "#fff" });
    const user = fakePrisma.tables.user.get("user-1");
    fakePrisma.tables.user.set("user-1", { ...user!, accountLevelId: "lvl" });
    const { token } = issueToken("user-1");

    const video = await upload({ file: { bytes: fakeMp4(1001), name: "a.mp4" } }, { authorization: `Bearer ${token}` });
    expect(video.status).toBe(413);
    expect(await video.json()).toMatchObject({ error: { code: "SIZE_LIMIT_EXCEEDED", details: { limitBytes: 1000, kind: "VIDEO" } } });

    const first = await upload({ file: { bytes: await plainPng(10, 10), name: "a.png" } }, { authorization: `Bearer ${token}` });
    expect(first.status).toBe(201);
    const second = await upload({ file: { bytes: await plainPng(10, 10), name: "a.png" } }, { authorization: `Bearer ${token}` });
    expect(second.status).toBe(429);
  });

  it("video: PROCESSING with the original stored and a job queued (existing async pipeline)", async () => {
    const { token } = issueToken("user-1");
    const response = await upload({ file: { bytes: fakeMp4(2048), name: "clip.mp4", type: "video/mp4" } }, { authorization: `Bearer ${token}` });
    expect(response.status).toBe(201);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ kind: "VIDEO", status: "PROCESSING" });
    const row = fakePrisma.rows("quickShare")[0];
    expect(row.originalPath).toBe(path.join(tmpRoot, "originals", "quick", "videos", `${String(body.id)}.mp4`));
    await access(String(row.originalPath));
    expect(fakePrisma.rows("uploadJob")[0]).toMatchObject({ quickShareId: row.id, status: "QUEUED" });
  });

  it("rejects a disguised video with 415", async () => {
    const response = await upload({ file: { bytes: Buffer.from("not a video at all".repeat(10)), name: "clip.mp4", type: "video/mp4" } });
    expect(response.status).toBe(415);
    expect(await response.json()).toMatchObject({ error: { code: "UNSUPPORTED_MEDIA" } });
  });

  it("rate-limits per token with Retry-After", async () => {
    fakePrisma.insert("siteSetting", { key: "quick_api_rate_limit_token_per_minute", value: "1" });
    clearQuickApiSettingsCache();
    const { token } = issueToken("user-1");
    expect((await upload({ file: { bytes: await plainPng(10, 10), name: "a.png" } }, { authorization: `Bearer ${token}` })).status).toBe(201);
    const limited = await upload({ file: { bytes: await plainPng(10, 10), name: "a.png" } }, { authorization: `Bearer ${token}` });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(await limited.json()).toMatchObject({ error: { code: "RATE_LIMITED" } });
  });
});

describe("DELETE /api/v1/quick/{id}", () => {
  async function tokenUpload(token: string) {
    const response = await upload({ file: { bytes: await plainPng(10, 10), name: "a.png" } }, { authorization: `Bearer ${token}` });
    return ((await response.json()) as { id: string }).id;
  }

  it("lets the owner delete an API upload (204) and removes the file", async () => {
    const { token } = issueToken("user-1");
    const id = await tokenUpload(token);
    const response = await deleteRequest(id, { authorization: `Bearer ${token}` });
    expect(response.status).toBe(204);
    expect(fakePrisma.rows("quickShare")[0].deletedAt).toBeInstanceOf(Date);
    await expect(access(await storedImagePath(id))).rejects.toThrow();
    // 2回目は 404
    expect((await deleteRequest(id, { authorization: `Bearer ${token}` })).status).toBe(404);
  });

  it("allows another device token of the same user", async () => {
    const first = issueToken("user-1");
    const second = issueToken("user-1");
    const id = await tokenUpload(first.token);
    expect((await deleteRequest(id, { authorization: `Bearer ${second.token}` })).status).toBe(204);
  });

  it("returns 404 for another user's upload", async () => {
    const owner = issueToken("user-1");
    const other = issueToken("user-2");
    const id = await tokenUpload(owner.token);
    expect((await deleteRequest(id, { authorization: `Bearer ${other.token}` })).status).toBe(404);
    expect(fakePrisma.rows("quickShare")[0].deletedAt).toBeNull();
  });

  it("returns 404 for the user's own web upload (not uploaded by the app)", async () => {
    const { token } = issueToken("user-1");
    fakePrisma.insert("quickShare", { publicId: "web1", userId: "user-1", apiTokenId: null, kind: "IMAGE", deleteToken: "t", mimeType: "image/webp", fileSizeBytes: 1n, expiresAt: new Date(Date.now() + 3600_000) });
    expect((await deleteRequest("web1", { authorization: `Bearer ${token}` })).status).toBe(404);
  });

  it("returns 404 for unknown ids and expired items", async () => {
    const { token } = issueToken("user-1");
    expect((await deleteRequest("nope123456", { authorization: `Bearer ${token}` })).status).toBe(404);
    fakePrisma.insert("quickShare", { publicId: "expired1", userId: "user-1", apiTokenId: "x", kind: "IMAGE", deleteToken: "t", mimeType: "image/webp", fileSizeBytes: 1n, expiresAt: new Date(Date.now() - 1000) });
    expect((await deleteRequest("expired1", { authorization: `Bearer ${token}` })).status).toBe(404);
  });

  it("anonymous: deletes with the right X-Delete-Token, 404 otherwise", async () => {
    const response = await upload({ file: { bytes: await plainPng(10, 10), name: "a.png" } });
    const { id, deleteToken } = (await response.json()) as { id: string; deleteToken: string };
    expect((await deleteRequest(id)).status).toBe(404);
    expect((await deleteRequest(id, { "x-delete-token": crypto.randomBytes(18).toString("base64url") })).status).toBe(404);
    expect((await deleteRequest(id, { "x-delete-token": deleteToken })).status).toBe(204);
  });

  it("anonymous delete token cannot delete a logged-in user's upload", async () => {
    fakePrisma.insert("quickShare", { publicId: "owned1", userId: "user-1", apiTokenId: "x", kind: "IMAGE", deleteToken: "known-token", mimeType: "image/webp", fileSizeBytes: 1n, expiresAt: new Date(Date.now() + 3600_000) });
    expect((await deleteRequest("owned1", { "x-delete-token": "known-token" })).status).toBe(404);
  });
});
