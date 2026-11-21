import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const { getClientReleaseHistory, getClientReleaseStatuses, getLatestClientRelease, pickInstallerAsset, resetClientReleaseCache } = await import(
  "@/lib/quick-client/releases"
);
const { parseSha256Sums } = await import("@/lib/quick-client/checksums");
const { fetchFromGithub, isAllowedGithubUrl } = await import("@/lib/quick-client/github-fetch");
const { clearQuickApiSettingsCache } = await import("@/lib/quick-share/api-settings");
const { registerClientAssetChecksum } = await import("@/app/admin/quick-share-actions");
const latestRoute = await import("@/app/api/v1/client/latest/route");

const REPO = "choko1229/clipshare-qick";
const LIST_URL = `https://api.github.com/repos/${REPO}/releases?per_page=10`;
const hash = (seed: string) => crypto.createHash("sha256").update(seed).digest("hex");

type AssetSpec = { name: string; url?: string; size?: number; digest?: string | null };

function release(tag: string, assets: AssetSpec[], extra: Record<string, unknown> = {}) {
  return {
    tag_name: tag,
    published_at: "2026-11-20T12:00:00Z",
    body: `${tag} notes`,
    html_url: `https://github.com/${REPO}/releases/tag/${tag}`,
    draft: false,
    prerelease: false,
    assets: assets.map((asset) => ({
      name: asset.name,
      browser_download_url: asset.url ?? `https://github.com/${REPO}/releases/download/${tag}/${asset.name}`,
      size: asset.size ?? 1000,
      digest: asset.digest ?? null,
    })),
    ...extra,
  };
}

function standardAssets(tag: string): AssetSpec[] {
  return [
    { name: `ClipshareQuickSetup-${tag}.exe` },
    { name: `ClipshareQuick-${tag}.msix` },
    { name: "ClipshareQuick.appinstaller" },
    { name: "SHA256SUMS" },
  ];
}

function sumsFor(tag: string) {
  return [`${hash(`exe-${tag}`)}  ClipshareQuickSetup-${tag}.exe`, `${hash(`msix-${tag}`)} *ClipshareQuick-${tag}.msix`, ""].join("\n");
}

/** URL ごとの応答を返す fetch のモック。SHA256SUMS は github.com → release-assets へ 302 する(実物と同じ) */
function installFetch(routes: Record<string, () => Response>) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const route = routes[url];
    if (route) return route();
    if (url.startsWith(`https://github.com/${REPO}/releases/download/`)) {
      const file = url.split("/").slice(-2).join("/");
      return new Response(null, { status: 302, headers: { location: `https://release-assets.githubusercontent.com/github-production-release-asset/${file}?sig=secret` } });
    }
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

const json = (body: unknown) => () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const text = (body: string) => () => new Response(body, { status: 200 });
const sumsUrl = (tag: string) => `https://release-assets.githubusercontent.com/github-production-release-asset/${tag}/SHA256SUMS?sig=secret`;

let logged: string[] = [];

beforeEach(() => {
  resetFakePrisma();
  clearQuickApiSettingsCache();
  resetClientReleaseCache();
  logged = [];
  for (const method of ["info", "warn", "error"] as const) {
    vi.spyOn(console, method).mockImplementation((line: unknown) => {
      logged.push(String(line));
    });
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function callLatest() {
  return latestRoute.GET(new Request("https://clipshare.link/api/v1/client/latest"), { params: Promise.resolve({}) });
}

describe("SHA256SUMS parsing (API_CONTRACT v1.2「SHA256SUMS の形式」)", () => {
  const exe = "ClipshareQuickSetup-1.2.3.exe";
  const msix = "ClipshareQuick-1.2.3.msix";

  function expectOk(input: string) {
    const parsed = parseSha256Sums(input);
    if (!parsed.ok) throw new Error(`expected ok, got ${parsed.reason}`);
    return parsed.sums;
  }

  function expectProblem(input: string, reason: string) {
    const parsed = parseSha256Sums(input);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.reason).toBe(reason);
  }

  it("accepts the canonical `sha256sum` output (two spaces, LF)", () => {
    const sums = expectOk(`${hash("a")}  ${exe}\n${hash("b")}  ${msix}\n`);
    expect([...sums.entries()]).toEqual([
      [exe, hash("a")],
      [msix, hash("b")],
    ]);
  });

  it("accepts CRLF line endings", () => {
    const sums = expectOk(`${hash("a")}  ${exe}\r\n${hash("b")}  ${msix}\r\n`);
    expect(sums.get(msix)).toBe(hash("b"));
  });

  it("ignores trailing blank lines, blank lines in between, trailing spaces and a BOM", () => {
    const bom = String.fromCharCode(0xfeff);
    const sums = expectOk([`${bom}${hash("a")}  ${exe}  `, "", `${hash("b")}  ${msix}`, "", "", ""].join("\n").replace(/\n$/, "\r\n"));
    expect(sums.size).toBe(2);
  });

  it("accepts the binary marker `*` before the file name (and does not keep it in the name)", () => {
    const sums = expectOk(`${hash("a")} *${exe}\n${hash("b")}  ${msix}`);
    expect(sums.get(exe)).toBe(hash("a"));
    expect(sums.has(`*${exe}`)).toBe(false);
  });

  it("accepts upper-case hex and normalizes it to lower case", () => {
    expect(expectOk(`${hash("a").toUpperCase()}  ${exe}`).get(exe)).toBe(hash("a"));
  });

  it("keeps file names exactly (no trimming of dots or case changes)", () => {
    const sums = expectOk(`${hash("a")}  ClipshareQuickSetup-1.2.3.EXE`);
    expect(sums.has("ClipshareQuickSetup-1.2.3.EXE")).toBe(true);
    expect(sums.has(exe)).toBe(false);
  });

  it.each([
    ["the same entry twice", `${hash("a")}  ${exe}\n${hash("a")}  ${exe}`],
    ["the same name with different hashes", `${hash("a")}  ${exe}\n${hash("b")}  ${exe}`],
  ])("rejects duplicate entries: %s", (_label, input) => {
    expectProblem(input, "duplicate_entry");
  });

  it.each([
    ["63 hex digits", `${hash("a").slice(1)}  ${exe}`],
    ["65 hex digits", `${hash("a")}0  ${exe}`],
    ["non-hex characters", `${"g".repeat(64)}  ${exe}`],
    ["a single space separator", `${hash("a")} ${exe}`],
    ["a tab separator", `${hash("a")}\t${exe}`],
    ["a leading space", ` ${hash("a")}  ${exe}`],
    ["a BSD-style line", `SHA256 (${exe}) = ${hash("a")}`],
    ["a hash without a file name", `${hash("a")}  `],
    ["one bad line among good ones", `${hash("a")}  ${exe}\nnot a checksum line\n${hash("b")}  ${msix}`],
    ["an HTML error page", "<html><body>Not Found</body></html>"],
  ])("rejects %s as a malformed line", (_label, input) => {
    expectProblem(input, "malformed_line");
  });

  it("reports the line number of the first bad line", () => {
    const parsed = parseSha256Sums(`${hash("a")}  ${exe}\r\n${hash("b").slice(2)}  ${msix}\r\n`);
    expect(parsed).toEqual({ ok: false, reason: "malformed_line", line: 2 });
  });

  it.each([`./${exe}`, `dist/${exe}`, ["dist", exe].join("\\")])("rejects file names with a path (%s)", (name) => {
    expectProblem(`${hash("a")}  ${name}`, "path_in_file_name");
  });

  it("rejects an empty file", () => {
    expectProblem("", "empty");
    expectProblem("\r\n\r\n", "empty");
  });
});

describe("GitHub fetch (SSRF protection)", () => {
  it.each([
    "https://api.github.com/repos/a/b/releases",
    "https://github.com/a/b/releases/download/v1/SHA256SUMS",
    "https://objects.githubusercontent.com/x",
    "https://release-assets.githubusercontent.com/x",
  ])("allows %s", (url) => {
    expect(isAllowedGithubUrl(url)).toBe(true);
  });

  it.each([
    "http://github.com/a",
    "https://evil.example/a",
    "https://github.com.evil.example/a",
    "https://user:pass@github.com/a",
    "https://github.com:8443/a",
    "https://169.254.169.254/latest/meta-data",
    "https://localhost/a",
    "file:///etc/passwd",
  ])("rejects %s", (url) => {
    expect(isAllowedGithubUrl(url)).toBe(false);
  });

  it("never follows a redirect to a non-GitHub host", async () => {
    const calls = installFetch({
      "https://github.com/x/y/releases/download/v1/SHA256SUMS": () =>
        new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } }),
    });
    await expect(
      fetchFromGithub("https://github.com/x/y/releases/download/v1/SHA256SUMS", { maxBytes: 1000, timeoutMs: 1000, accept: "*/*" }),
    ).rejects.toMatchObject({ reason: "host_not_allowed" });
    expect(calls).toEqual(["https://github.com/x/y/releases/download/v1/SHA256SUMS"]);
  });

  it("stops at the size limit (declared and streamed)", async () => {
    installFetch({
      "https://github.com/declared": () => new Response("x", { status: 200, headers: { "content-length": "999999" } }),
      "https://github.com/streamed": () => new Response("x".repeat(5000), { status: 200 }),
    });
    await expect(fetchFromGithub("https://github.com/declared", { maxBytes: 1000, timeoutMs: 1000, accept: "*/*" })).rejects.toMatchObject({ reason: "too_large" });
    await expect(fetchFromGithub("https://github.com/streamed", { maxBytes: 1000, timeoutMs: 1000, accept: "*/*" })).rejects.toMatchObject({ reason: "too_large" });
  });

  it("reports network failures with the cause code but without the URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw Object.assign(new TypeError("fetch failed https://github.com/x?sig=secret"), { cause: { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" } });
      }),
    );
    const error = await fetchFromGithub("https://github.com/x", { maxBytes: 1000, timeoutMs: 1000, accept: "*/*" }).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ reason: "network" });
    const detail = (error as { detail: string }).detail;
    expect(detail).toContain("UNABLE_TO_VERIFY_LEAF_SIGNATURE");
    expect(detail).not.toContain("sig=secret");
    expect(detail).not.toContain("github.com");
  });

  it("limits redirect hops", async () => {
    installFetch({
      "https://github.com/loop": () => new Response(null, { status: 302, headers: { location: "https://github.com/loop" } }),
    });
    await expect(fetchFromGithub("https://github.com/loop", { maxBytes: 1000, timeoutMs: 1000, accept: "*/*" })).rejects.toMatchObject({
      reason: "too_many_redirects",
    });
  });

  it("times out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("timed out"), { name: "TimeoutError" })));
          }),
      ),
    );
    await expect(fetchFromGithub("https://github.com/slow", { maxBytes: 1000, timeoutMs: 20, accept: "*/*" })).rejects.toMatchObject({ reason: "timeout" });
  });
});

describe("GET /api/v1/client/latest always returns sha256", () => {
  it("normal: serves exe + MSIX with SHA-256 from SHA256SUMS (no null, no other assets)", async () => {
    installFetch({ [LIST_URL]: json([release("v1.2.3", standardAssets("v1.2.3"))]), [sumsUrl("v1.2.3")]: text(sumsFor("v1.2.3")) });
    const response = await callLatest();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { version: string; assets: Array<{ name: string; sha256: string }> };
    expect(body.version).toBe("1.2.3");
    expect(body.assets).toEqual([
      expect.objectContaining({ name: "ClipshareQuickSetup-v1.2.3.exe", sha256: hash("exe-v1.2.3") }),
      expect.objectContaining({ name: "ClipshareQuick-v1.2.3.msix", sha256: hash("msix-v1.2.3") }),
    ]);
    expect(logged.join("\n")).not.toContain("sig=secret");
  });

  it("SHA256SUMS missing on the newest release: keeps serving the newest verified older release", async () => {
    installFetch({
      [LIST_URL]: json([
        release("v1.3.0", standardAssets("v1.3.0").filter((asset) => asset.name !== "SHA256SUMS")),
        release("v1.2.3", standardAssets("v1.2.3")),
      ]),
      [sumsUrl("v1.2.3")]: text(sumsFor("v1.2.3")),
    });
    const body = (await (await callLatest()).json()) as { version: string };
    expect(body.version).toBe("1.2.3");
    const status = await getClientReleaseStatuses();
    expect(status.statuses[0]).toMatchObject({ tag: "v1.3.0", servable: false });
    expect(status.statuses[0].reason).toContain("sha256sums_missing");
    expect(logged.some((line) => line.includes("quick_client.release_not_servable"))).toBe(true);
  });

  it("returns 503 (never null) when no release has checksums", async () => {
    installFetch({ [LIST_URL]: json([release("v1.0.0", standardAssets("v1.0.0").filter((asset) => asset.name !== "SHA256SUMS"))]) });
    const response = await callLatest();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "SERVICE_UNAVAILABLE" } });
  });

  it("malformed SHA256SUMS is not trusted at all", async () => {
    installFetch({ [LIST_URL]: json([release("v1.2.3", standardAssets("v1.2.3"))]), [sumsUrl("v1.2.3")]: text(`${sumsFor("v1.2.3")}\nnot a checksum line`) });
    expect((await callLatest()).status).toBe(503);
    expect((await getClientReleaseStatuses()).statuses[0].reason).toContain("sha256sums_invalid");
  });

  it("a SHA256SUMS line for a file that is not an asset of the release makes it not servable", async () => {
    installFetch({
      [LIST_URL]: json([release("v1.2.3", standardAssets("v1.2.3"))]),
      [sumsUrl("v1.2.3")]: text(`${sumsFor("v1.2.3")}${hash("old")}  ClipshareQuickSetup-v1.2.2.exe\n`),
    });
    expect((await callLatest()).status).toBe(503);
    expect((await getClientReleaseStatuses()).statuses[0].reason).toBe("sha256sums_invalid:unknown_file");
  });

  it("allows lines for other assets of the same release (e.g. .appinstaller) without serving them", async () => {
    installFetch({
      [LIST_URL]: json([release("v1.2.3", standardAssets("v1.2.3"))]),
      [sumsUrl("v1.2.3")]: text(`${sumsFor("v1.2.3")}${hash("ai")}  ClipshareQuick.appinstaller\n`),
    });
    const body = (await (await callLatest()).json()) as { assets: Array<{ name: string }> };
    expect(body.assets.map((asset) => asset.name)).toEqual(["ClipshareQuickSetup-v1.2.3.exe", "ClipshareQuick-v1.2.3.msix"]);
  });

  it("an invalid SHA256SUMS cannot be overridden by manual registration", async () => {
    installFetch({
      [LIST_URL]: json([release("v1.2.3", standardAssets("v1.2.3"))]),
      [sumsUrl("v1.2.3")]: text(`${hash("exe-v1.2.3")}  ClipshareQuickSetup-v1.2.3.exe\n${hash("x").slice(1)}  ClipshareQuick-v1.2.3.msix\n`),
    });
    for (const [name, seed] of [
      ["ClipshareQuickSetup-v1.2.3.exe", "exe-v1.2.3"],
      ["ClipshareQuick-v1.2.3.msix", "msix-v1.2.3"],
    ] as const) {
      const form = new FormData();
      form.set("tag", "v1.2.3");
      form.set("assetName", name);
      form.set("sha256", hash(seed));
      await registerClientAssetChecksum(form);
    }
    expect((await callLatest()).status).toBe(503);
    expect((await getClientReleaseStatuses()).statuses[0].reason).toBe("sha256sums_invalid:malformed_line@line2");
  });

  it("SHA256SUMS that misses one installer makes the release not servable", async () => {
    installFetch({
      [LIST_URL]: json([release("v1.2.3", standardAssets("v1.2.3"))]),
      [sumsUrl("v1.2.3")]: text(`${hash("exe-v1.2.3")}  ClipshareQuickSetup-v1.2.3.exe\n`),
    });
    expect((await callLatest()).status).toBe(503);
    const status = (await getClientReleaseStatuses()).statuses[0];
    expect(status.assets).toEqual([
      { name: "ClipshareQuickSetup-v1.2.3.exe", sha256: hash("exe-v1.2.3"), source: "SHA256SUMS" },
      { name: "ClipshareQuick-v1.2.3.msix", sha256: null, source: null },
    ]);
  });

  it("SHA256SUMS download failure: not servable, detailed log, no fallback to null", async () => {
    installFetch({ [LIST_URL]: json([release("v1.2.3", standardAssets("v1.2.3"))]), [sumsUrl("v1.2.3")]: () => new Response("boom", { status: 500 }) });
    expect((await callLatest()).status).toBe(503);
    expect(logged.some((line) => line.includes("quick_client.sha256sums_fetch_failed") && line.includes("http_status"))).toBe(true);
  });

  it("refuses a SHA256SUMS asset hosted outside GitHub (SSRF) without requesting it", async () => {
    const assets = standardAssets("v1.2.3").map((asset) =>
      asset.name === "SHA256SUMS" ? { ...asset, url: "https://evil.example/SHA256SUMS" } : asset,
    );
    const calls = installFetch({ [LIST_URL]: json([release("v1.2.3", assets)]) });
    expect((await callLatest()).status).toBe(503);
    expect(calls.some((url) => url.includes("evil.example"))).toBe(false);
    expect((await getClientReleaseStatuses()).statuses[0].reason).toContain("host_not_allowed");
  });

  it("does not serve when GitHub's own digest contradicts SHA256SUMS", async () => {
    const assets = standardAssets("v1.2.3").map((asset) => (asset.name.endsWith(".exe") ? { ...asset, digest: `sha256:${hash("tampered")}` } : asset));
    installFetch({ [LIST_URL]: json([release("v1.2.3", assets)]), [sumsUrl("v1.2.3")]: text(sumsFor("v1.2.3")) });
    expect((await callLatest()).status).toBe(503);
    expect((await getClientReleaseStatuses()).statuses[0].reason).toContain("digest_mismatch");
  });

  it("manual registration in the admin screen makes a release without SHA256SUMS servable", async () => {
    installFetch({ [LIST_URL]: json([release("v1.2.3", standardAssets("v1.2.3").filter((asset) => asset.name !== "SHA256SUMS"))]) });
    expect((await callLatest()).status).toBe(503);

    for (const [name, seed] of [
      ["ClipshareQuickSetup-v1.2.3.exe", "exe-v1.2.3"],
      ["ClipshareQuick-v1.2.3.msix", "msix-v1.2.3"],
    ] as const) {
      const form = new FormData();
      form.set("tag", "v1.2.3");
      form.set("assetName", name);
      form.set("sha256", hash(seed).toUpperCase());
      await registerClientAssetChecksum(form);
    }

    const response = await callLatest();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { assets: Array<{ sha256: string }> };
    expect(body.assets.map((asset) => asset.sha256)).toEqual([hash("exe-v1.2.3"), hash("msix-v1.2.3")]);
    expect((await getClientReleaseStatuses()).statuses[0].assets.map((asset) => asset.source)).toEqual(["MANUAL", "MANUAL"]);
    expect(fakePrisma.rows("adminAuditLog").map((row) => row.action)).toEqual(["quick_client.checksum.create", "quick_client.checksum.create"]);
  });

  it("stops serving a release whose manual checksum was deleted (no stale fallback to the same release)", async () => {
    installFetch({ [LIST_URL]: json([release("v1.2.3", standardAssets("v1.2.3").filter((asset) => asset.name !== "SHA256SUMS"))]) });

    for (const [name, seed] of [
      ["ClipshareQuickSetup-v1.2.3.exe", "exe-v1.2.3"],
      ["ClipshareQuick-v1.2.3.msix", "msix-v1.2.3"],
    ] as const) {
      const form = new FormData();
      form.set("tag", "v1.2.3");
      form.set("assetName", name);
      form.set("sha256", hash(seed));
      await registerClientAssetChecksum(form);
    }
    expect((await callLatest()).status).toBe(200);

    const { deleteClientAssetChecksum } = await import("@/app/admin/quick-share-actions");
    const entry = fakePrisma.rows("quickClientAssetChecksum").find((row) => String(row.assetName).endsWith(".msix"));
    const form = new FormData();
    form.set("checksumId", String(entry?.id));
    await deleteClientAssetChecksum(form);

    // メモリ・DB に前回配信した v1.2.3 が残っていても、いま配信不可と判定したので返さない
    expect((await callLatest()).status).toBe(503);
  });

  it("validates manual registrations", async () => {
    const bad = (values: Record<string, string>) => {
      const form = new FormData();
      for (const [key, value] of Object.entries(values)) form.set(key, value);
      return registerClientAssetChecksum(form);
    };
    await expect(bad({ tag: "v1", assetName: "a.exe", sha256: "xyz" })).rejects.toThrow();
    await expect(bad({ tag: "v1", assetName: "notes.txt", sha256: hash("a") })).rejects.toThrow();
    await expect(bad({ tag: "v1", assetName: "../a.exe", sha256: hash("a") })).rejects.toThrow();
    await expect(bad({ tag: "v1", assetName: "..\\a.exe", sha256: hash("a") })).rejects.toThrow();
    await expect(bad({ tag: "v 1", assetName: "a.exe", sha256: hash("a") })).rejects.toThrow();
    expect(fakePrisma.rows("quickClientAssetChecksum")).toHaveLength(0);
  });

  it("list fetch failure: keeps the last served release (memory, then DB), else 503", async () => {
    installFetch({ [LIST_URL]: json([release("v1.2.3", standardAssets("v1.2.3"))]), [sumsUrl("v1.2.3")]: text(sumsFor("v1.2.3")) });
    const now = Date.now();
    expect((await getLatestClientRelease(now))?.version).toBe("1.2.3");

    installFetch({ [LIST_URL]: () => new Response("rate limited", { status: 403 }) });
    expect((await getLatestClientRelease(now + 700_000))?.version).toBe("1.2.3");

    resetClientReleaseCache();
    expect((await getLatestClientRelease(now + 800_000))?.version).toBe("1.2.3");
    expect(logged.some((line) => line.includes("quick_client.release_fetch_failed"))).toBe(true);
  });

  it("ignores a persisted v1.1-era cache that contains null sha256", async () => {
    fakePrisma.insert("siteSetting", {
      key: "quick_client_release_cache",
      value: JSON.stringify({ repo: REPO, tag: "v1.0.0", version: "1.0.0", publishedAt: "x", notes: "", htmlUrl: "x", assets: [{ name: "a.msix", url: "x", sizeBytes: 1, sha256: null }] }),
    });
    installFetch({ [LIST_URL]: () => new Response("down", { status: 502 }) });
    expect((await callLatest()).status).toBe(503);
  });

  it("caches within the TTL (one list call)", async () => {
    const calls = installFetch({ [LIST_URL]: json([release("v1.2.3", standardAssets("v1.2.3"))]), [sumsUrl("v1.2.3")]: text(sumsFor("v1.2.3")) });
    const now = Date.now();
    await getLatestClientRelease(now);
    await getLatestClientRelease(now + 599_000);
    expect(calls.filter((url) => url === LIST_URL)).toHaveLength(1);
  });

  it("skips drafts and prereleases, and keeps the release history for the download page", async () => {
    installFetch({
      [LIST_URL]: json([
        release("v2.0.0-beta", standardAssets("v2.0.0-beta"), { prerelease: true }),
        release("v1.9.0", standardAssets("v1.9.0"), { draft: true }),
        release("v1.2.3", standardAssets("v1.2.3")),
        release("v1.2.2", standardAssets("v1.2.2")),
      ]),
      [sumsUrl("v1.2.3")]: text(sumsFor("v1.2.3")),
    });
    expect((await getLatestClientRelease())?.version).toBe("1.2.3");
    expect((await getClientReleaseHistory()).map((entry) => entry.version)).toEqual(["1.2.3", "1.2.2"]);
  });

  it("prefers the setup exe for the download button", async () => {
    installFetch({ [LIST_URL]: json([release("v1.2.3", standardAssets("v1.2.3"))]), [sumsUrl("v1.2.3")]: text(sumsFor("v1.2.3")) });
    expect(pickInstallerAsset(await getLatestClientRelease())?.name).toBe("ClipshareQuickSetup-v1.2.3.exe");
  });
});
