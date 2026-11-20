import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakePrisma, resetFakePrisma } from "./helpers/fake-prisma";

vi.mock("@/lib/db/prisma", async () => {
  const helpers = await import("./helpers/fake-prisma");
  return { prisma: helpers.fakePrisma };
});

const { getLatestClientRelease, pickInstallerAsset, resetClientReleaseCache, toClientRelease } = await import("@/lib/quick-client/releases");
const { clearQuickApiSettingsCache } = await import("@/lib/quick-share/api-settings");
const latestRoute = await import("@/app/api/v1/client/latest/route");

const githubRelease = {
  tag_name: "v1.2.3",
  published_at: "2026-11-20T12:00:00Z",
  body: "- 初回リリース",
  html_url: "https://github.com/choko1229/clipshare-qick/releases/tag/v1.2.3",
  draft: false,
  assets: [
    {
      name: "ClipshareQuick-1.2.3.msix",
      browser_download_url: "https://github.com/choko1229/clipshare-qick/releases/download/v1.2.3/ClipshareQuick-1.2.3.msix",
      size: 12_345_678,
      digest: `sha256:${"ab".repeat(32)}`,
    },
    {
      name: "ClipshareQuick.appinstaller",
      browser_download_url: "https://github.com/choko1229/clipshare-qick/releases/download/v1.2.3/ClipshareQuick.appinstaller",
      size: 900,
      digest: null,
    },
    { name: "evil.msix", browser_download_url: "https://evil.example/evil.msix", size: 1 },
  ],
};

function okResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  resetFakePrisma();
  clearQuickApiSettingsCache();
  resetClientReleaseCache();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GitHub release parsing", () => {
  it("maps to the contract shape, strips the v prefix and drops non-GitHub URLs", () => {
    const release = toClientRelease("choko1229/clipshare-qick", githubRelease);
    expect(release).toMatchObject({ version: "1.2.3", publishedAt: "2026-11-20T12:00:00.000Z", notes: "- 初回リリース" });
    expect(release?.assets.map((asset) => asset.name)).toEqual(["ClipshareQuick-1.2.3.msix", "ClipshareQuick.appinstaller"]);
    expect(release?.assets[0].sha256).toBe("ab".repeat(32));
    expect(release?.assets[1].sha256).toBeNull();
    expect(pickInstallerAsset(release)?.name).toBe("ClipshareQuick-1.2.3.msix");
  });

  it("rejects drafts and malformed payloads", () => {
    expect(toClientRelease("a/b", { ...githubRelease, draft: true })).toBeNull();
    expect(toClientRelease("a/b", { message: "Not Found" })).toBeNull();
  });
});

describe("server-side release cache", () => {
  it("caches within the TTL (one GitHub call for many requests)", async () => {
    fetchMock.mockResolvedValue(okResponse(githubRelease));
    const now = Date.now();
    await getLatestClientRelease(now);
    await getLatestClientRelease(now + 1000);
    await getLatestClientRelease(now + 599_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.github.com/repos/choko1229/clipshare-qick/releases/latest");

    fetchMock.mockResolvedValue(okResponse({ ...githubRelease, tag_name: "v1.2.4" }));
    expect((await getLatestClientRelease(now + 601_000))?.version).toBe("1.2.4");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns the last successful result when GitHub fails, and backs off for a minute", async () => {
    fetchMock.mockResolvedValueOnce(okResponse(githubRelease));
    const now = Date.now();
    await getLatestClientRelease(now);

    fetchMock.mockResolvedValue(new Response("rate limited", { status: 403 }));
    expect((await getLatestClientRelease(now + 700_000))?.version).toBe("1.2.3");
    expect((await getLatestClientRelease(now + 730_000))?.version).toBe("1.2.3");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to the result persisted in the DB after a restart", async () => {
    fetchMock.mockResolvedValueOnce(okResponse(githubRelease));
    await getLatestClientRelease();
    expect(fakePrisma.rows("siteSetting").some((row) => row.key === "quick_client_release_cache")).toBe(true);

    resetClientReleaseCache();
    fetchMock.mockRejectedValue(new Error("network down"));
    expect((await getLatestClientRelease())?.version).toBe("1.2.3");
  });

  it("returns 503 from /api/v1/client/latest when nothing was ever fetched", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const response = await latestRoute.GET(new Request("https://clipshare.link/api/v1/client/latest"), { params: Promise.resolve({}) });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "SERVICE_UNAVAILABLE" } });
  });

  it("serves the contract body from /api/v1/client/latest", async () => {
    fetchMock.mockResolvedValue(okResponse(githubRelease));
    fakePrisma.insert("siteSetting", { key: "quick_client_min_supported_version", value: "1.0.0" });
    clearQuickApiSettingsCache();
    const response = await latestRoute.GET(new Request("https://clipshare.link/api/v1/client/latest"), { params: Promise.resolve({}) });
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ version: "1.2.3", minSupportedVersion: "1.0.0", notes: "- 初回リリース" });
    expect(body.assets).toEqual([
      expect.objectContaining({ name: "ClipshareQuick-1.2.3.msix", sizeBytes: 12_345_678, sha256: "ab".repeat(32) }),
      expect.objectContaining({ name: "ClipshareQuick.appinstaller", sha256: null }),
    ]);
  });
});
