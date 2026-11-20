import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakePrisma, resetFakePrisma } from "./helpers/fake-prisma";

vi.mock("@/lib/db/prisma", async () => {
  const helpers = await import("./helpers/fake-prisma");
  return { prisma: helpers.fakePrisma };
});
vi.mock("@/lib/admin/auth", () => ({
  requireAdmin: vi.fn(async () => ({ id: "admin-1", role: "ADMIN" })),
  requireModerator: vi.fn(async () => ({ id: "admin-1", role: "ADMIN" })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { revokeApiTokenByAdmin, updateAccountLevelQuickShareLimits, updateQuickApiSettings } = await import("@/app/admin/quick-share-actions");
const { updateQuickShareSettings } = await import("@/app/admin/actions");
const { clearQuickApiSettingsCache, getQuickApiSettings } = await import("@/lib/quick-share/api-settings");
const { getQuickShareSettings } = await import("@/lib/quick-share/settings");

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.append(key, value);
  return data;
}

beforeEach(() => {
  resetFakePrisma();
  clearQuickApiSettingsCache();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  fakePrisma.insert("user", { id: "admin-1", username: "admin" });
  fakePrisma.insert("user", { id: "user-1", username: "alice" });
});

describe("admin token management", () => {
  it("revokes another user's token and writes an audit log without the token hash", async () => {
    const token = fakePrisma.insert("apiToken", { userId: "user-1", name: "PC", prefix: "csq_Ab12", tokenHash: "f".repeat(64), clientId: "clipshare-quick" });
    await revokeApiTokenByAdmin(form({ tokenId: token.id, reason: "不正利用の疑い" }));

    const updated = fakePrisma.rows("apiToken")[0];
    expect(updated.revokedAt).toBeInstanceOf(Date);
    expect(updated.revokedReason).toBe("ADMIN");

    const audit = fakePrisma.rows("adminAuditLog");
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ adminId: "admin-1", action: "api_token.revoke", targetType: "api_token", targetId: token.id, reason: "不正利用の疑い" });
    expect(JSON.stringify(audit[0])).not.toContain("f".repeat(64));
    expect(JSON.stringify(audit[0])).toContain("user-1");
  });

  it("does nothing (and no audit) for an already revoked token", async () => {
    const token = fakePrisma.insert("apiToken", { userId: "user-1", name: "PC", prefix: "csq_x", tokenHash: "a".repeat(64), clientId: "c", revokedAt: new Date() });
    await revokeApiTokenByAdmin(form({ tokenId: token.id }));
    expect(fakePrisma.rows("adminAuditLog")).toHaveLength(0);
  });
});

describe("admin quick share limits (screen 20)", () => {
  it("stores MB as bytes, 0 as unlimited and empty as NULL (site default)", async () => {
    const level = fakePrisma.insert("accountLevel", { name: "Member", quickShareImageMaxBytes: 50_000_000n, quickShareVideoMaxBytes: 200_000_000n });
    await updateAccountLevelQuickShareLimits(form({ accountLevelId: level.id, quickShareImageMaxMb: "0", quickShareVideoMaxMb: "" }));
    const updated = fakePrisma.rows("accountLevel")[0];
    expect(updated.quickShareImageMaxBytes).toBe(0n);
    expect(updated.quickShareVideoMaxBytes).toBeNull();
    expect(fakePrisma.rows("adminAuditLog")[0]).toMatchObject({ action: "account_level.update_quick_share_limits" });
  });

  it("rejects negative or non-integer values", async () => {
    const level = fakePrisma.insert("accountLevel", { name: "Member" });
    await expect(updateAccountLevelQuickShareLimits(form({ accountLevelId: level.id, quickShareImageMaxMb: "-1", quickShareVideoMaxMb: "1" }))).rejects.toThrow();
    await expect(updateAccountLevelQuickShareLimits(form({ accountLevelId: level.id, quickShareImageMaxMb: "1.1234567", quickShareVideoMaxMb: "1" }))).rejects.toThrow();
  });

  it("keeps fractional MB exactly (no silent rounding)", async () => {
    const level = fakePrisma.insert("accountLevel", { name: "Member" });
    await updateAccountLevelQuickShareLimits(form({ accountLevelId: level.id, quickShareImageMaxMb: "20.97152", quickShareVideoMaxMb: "1.5" }));
    const updated = fakePrisma.rows("accountLevel")[0];
    expect(updated.quickShareImageMaxBytes).toBe(20_971_520n);
    expect(updated.quickShareVideoMaxBytes).toBe(1_500_000n);
  });

  it("saves the site-wide settings entered in MB as bytes", async () => {
    await updateQuickShareSettings(form({ maxImageMb: "50", maxVideoMb: "200", retentionHours: "24", anonymousDailyLimit: "5" }));
    const settings = await getQuickShareSettings();
    expect(settings).toEqual({ maxImageBytes: 50_000_000, maxVideoBytes: 200_000_000, retentionHours: 24, anonymousDailyLimit: 5 });
  });
});

describe("Clipshare Quick settings", () => {
  const valid = {
    tokenRateLimitPerMinute: "30",
    anonymousRateLimitPerMinute: "10",
    authFailureLimitPer10Minutes: "20",
    clientGithubRepo: "choko1229/clipshare-qick",
    clientMinSupportedVersion: "",
    clientReleaseCacheSeconds: "600",
    clientSupportedOs: "Windows 11",
  };

  it("can stop token issuance (emergency stop) and is audited", async () => {
    await updateQuickApiSettings(form(valid));
    const settings = await getQuickApiSettings();
    expect(settings.tokenIssuanceEnabled).toBe(false);
    expect(fakePrisma.rows("adminAuditLog")[0]).toMatchObject({ action: "site_setting.update_quick_api" });
  });

  it("validates the repository and version format", async () => {
    await expect(updateQuickApiSettings(form({ ...valid, clientGithubRepo: "https://github.com/x/y" }))).rejects.toThrow();
    await expect(updateQuickApiSettings(form({ ...valid, clientMinSupportedVersion: "v1" }))).rejects.toThrow();
  });
});
