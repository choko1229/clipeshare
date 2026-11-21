import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakePrisma, resetFakePrisma } from "./helpers/fake-prisma";

vi.mock("@/lib/db/prisma", async () => {
  const helpers = await import("./helpers/fake-prisma");
  return { prisma: helpers.fakePrisma };
});

const releaseMocks = vi.hoisted(() => ({
  latest: vi.fn(),
  history: vi.fn(),
}));

vi.mock("@/lib/quick-client/releases", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/quick-client/releases")>();
  return { ...original, getLatestClientRelease: releaseMocks.latest, getClientReleaseHistory: releaseMocks.history };
});

const { DownloadButtons, ReleaseHistory, TrustSteps } = await import("@/components/quick-download/download-sections");
const { buildHistory, getDownloadPageData } = await import("@/lib/quick-client/download-page-data");
const { formatReleaseDate, formatReleaseNotes, RELEASE_HISTORY_MAX_ENTRIES, RELEASE_NOTE_ITEM_MAX_CHARS, RELEASE_NOTES_MAX_ITEMS } = await import(
  "@/lib/quick-client/release-notes"
);
const { clearQuickApiSettingsCache } = await import("@/lib/quick-share/api-settings");

const sha = (char: string) => char.repeat(64);
const fingerprint = Array(32).fill("AB").join(":");

function servedRelease(version = "1.2.3", withMsix = true) {
  return {
    repo: "choko1229/clipshare-qick",
    tag: `v${version}`,
    version,
    publishedAt: "2026-11-20T12:00:00.000Z",
    notes: "",
    htmlUrl: `https://github.com/choko1229/clipshare-qick/releases/tag/v${version}`,
    assets: [
      { name: `ClipshareQuickSetup-${version}.exe`, url: `https://github.com/x/y/releases/download/v${version}/setup.exe`, sizeBytes: 12_000_000, sha256: sha("a") },
      ...(withMsix
        ? [{ name: `ClipshareQuick-${version}.msix`, url: `https://github.com/x/y/releases/download/v${version}/app.msix`, sizeBytes: 9_000_000, sha256: sha("b") }]
        : []),
    ],
  };
}

function historyEntry(version: string, publishedAt: string, notes = `- ${version} の変更`) {
  return { version, publishedAt, notes, htmlUrl: `https://github.com/x/y/releases/tag/v${version}` };
}

beforeEach(() => {
  resetFakePrisma();
  clearQuickApiSettingsCache();
  releaseMocks.latest.mockReset();
  releaseMocks.history.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("release notes → change points (plain text)", () => {
  it("uses Markdown list items and strips the Markdown syntax", () => {
    const body = [
      "## What's Changed",
      "* **自動アップロード**の再試行を改善 by @someone in https://github.com/x/y/pull/1",
      "- [リンク](https://example.com)の文字だけ残す",
      "+ `code` を外す",
      "1. 番号付きも対象",
      "",
      "**Full Changelog**: https://github.com/x/y/compare/v1...v2",
    ].join("\n");
    expect(formatReleaseNotes(body)).toEqual([
      "自動アップロードの再試行を改善 by @someone in https://github.com/x/y/pull/1",
      "リンクの文字だけ残す",
      "code を外す",
      "番号付きも対象",
    ]);
  });

  it("falls back to non-heading lines when there is no list, and handles CRLF and HTML comments", () => {
    expect(formatReleaseNotes("# v1.2.3\r\n<!-- 自動生成 -->\r\n初回リリースです。\r\n\r\n不具合を修正しました。")).toEqual([
      "初回リリースです。",
      "不具合を修正しました。",
    ]);
  });

  it("keeps HTML as text (it is escaped when rendered, never interpreted)", () => {
    expect(formatReleaseNotes("- <script>alert(1)</script> を修正\n- <img src=x onerror=alert(2)>")).toEqual([
      "<script>alert(1)</script> を修正",
      "<img src=x onerror=alert(2)>",
    ]);
  });

  it("drops images and control characters", () => {
    expect(formatReleaseNotes("- ![スクショ](https://x/y.png)画面を更新\u0007")).toEqual(["画面を更新"]);
  });

  it("limits the number of items and the length of each item", () => {
    const many = Array.from({ length: 20 }, (_, index) => `- 項目${index}`).join("\n");
    expect(formatReleaseNotes(many)).toHaveLength(RELEASE_NOTES_MAX_ITEMS);

    const long = formatReleaseNotes(`- ${"あ".repeat(500)}`)[0];
    expect(Array.from(long)).toHaveLength(RELEASE_NOTE_ITEM_MAX_CHARS);
    expect(long.endsWith("…")).toBe(true);
  });

  it("returns nothing for an empty body", () => {
    expect(formatReleaseNotes("")).toEqual([]);
    expect(formatReleaseNotes(null)).toEqual([]);
    expect(formatReleaseNotes("## 見出しだけ\n\n")).toEqual([]);
  });

  it("formats dates in Japan time", () => {
    expect(formatReleaseDate("2026-11-20T16:30:00Z")).toBe("2026/11/21");
    expect(formatReleaseDate(new Date(0).toISOString())).toBeNull();
    expect(formatReleaseDate("not a date")).toBeNull();
  });
});

describe("history selection", () => {
  const entries = [
    historyEntry("1.3.0", "2026-11-25T00:00:00Z"),
    historyEntry("1.2.3", "2026-11-20T12:00:00Z"),
    historyEntry("1.2.2", "2026-11-10T00:00:00Z"),
    historyEntry("1.2.1", "2026-11-01T00:00:00Z"),
    historyEntry("1.2.0", "2026-10-20T00:00:00Z"),
  ];

  it("starts at the served (verified) version and caps the count", () => {
    const history = buildHistory(entries, { version: "1.2.3", publishedAt: "2026-11-20T12:00:00Z" });
    expect(history.map((entry) => entry.version)).toEqual(["1.2.3", "1.2.2", "1.2.1"]);
    expect(history).toHaveLength(RELEASE_HISTORY_MAX_ENTRIES);
  });

  it("shows one entry when there is only one", () => {
    expect(buildHistory([historyEntry("1.0.0", "2026-11-01T00:00:00Z")], { version: "1.0.0", publishedAt: "2026-11-01T00:00:00Z" })).toHaveLength(1);
  });

  it("shows nothing without a served release", () => {
    expect(buildHistory(entries, null)).toEqual([]);
  });

  it("falls back to the publish date when the served version is not in the list", () => {
    const history = buildHistory(entries, { version: "1.2.2-hotfix", publishedAt: "2026-11-15T00:00:00Z" });
    expect(history.map((entry) => entry.version)).toEqual(["1.2.2", "1.2.1", "1.2.0"]);
  });
});

describe("rendered sections", () => {
  it("download buttons: setup exe as the main button, MSIX as the ghost button, version line", () => {
    const html = renderToStaticMarkup(
      <DownloadButtons
        release={{
          version: "1.2.3",
          installer: { name: "setup.exe", url: "https://github.com/x/y/releases/download/v1.2.3/setup.exe", sizeBytes: 12_000_000, sha256: sha("a") },
          msix: { name: "app.msix", url: "https://github.com/x/y/releases/download/v1.2.3/app.msix", sizeBytes: 9_000_000, sha256: sha("b") },
        }}
        supportedOs="Windows 11"
      />,
    );
    expect(html).toContain('href="https://github.com/x/y/releases/download/v1.2.3/setup.exe"');
    expect(html).toContain("Windows 11 版をダウンロード");
    expect(html).toContain('href="https://github.com/x/y/releases/download/v1.2.3/app.msix"');
    expect(html).toContain("MSIXをダウンロード");
    expect(html).toContain("v1.2.3 · 12MB · Windows 11");
  });

  it("download buttons without a verified release (503 case): disabled, no link, no MSIX, no version line", () => {
    const html = renderToStaticMarkup(<DownloadButtons release={null} supportedOs="Windows 11" />);
    expect(html).toMatch(/<button[^>]*disabled/);
    expect(html).toContain("Windows 11 版をダウンロード");
    expect(html).not.toContain("href=");
    expect(html).not.toContain("MSIXをダウンロード");
    expect(html).not.toMatch(/v\d+\.\d+\.\d+/);
  });

  it("hides the MSIX button when the release has no MSIX", () => {
    const html = renderToStaticMarkup(
      <DownloadButtons
        release={{ version: "1.2.3", installer: { name: "setup.exe", url: "https://github.com/x/y/setup.exe", sizeBytes: 1, sha256: sha("a") }, msix: null }}
        supportedOs="Windows 11"
      />,
    );
    expect(html).not.toContain("MSIXをダウンロード");
  });

  it("trust steps show the design text; the fingerprint row and its copy value appear only when registered", () => {
    const withFingerprint = renderToStaticMarkup(<TrustSteps certFingerprint={fingerprint} />);
    for (const text of ["証明書の信頼手順", "セットアップを開く", "証明書を信頼する", "発行元 choko1229 の証明書を信頼します。", "インストール"]) {
      expect(withFingerprint).toContain(text);
    }
    expect(withFingerprint).toContain("証明書のSHA-256フィンガープリント");
    expect(withFingerprint).toContain(`data-copy-value="${fingerprint}"`);
    expect(withFingerprint).toContain(">コピー<");

    const without = renderToStaticMarkup(<TrustSteps certFingerprint={null} />);
    expect(without).toContain("証明書の信頼手順");
    expect(without).not.toContain("フィンガープリント");
    expect(without).not.toContain("コピー");
  });

  it("history: 0 entries renders nothing (degraded), 1 and 3 render rows", () => {
    expect(renderToStaticMarkup(<ReleaseHistory history={[]} />)).toBe("");

    const one = renderToStaticMarkup(<ReleaseHistory history={[{ version: "1.0.0", dateLabel: "2026/11/01", changes: ["初回リリース"] }]} />);
    expect(one).toContain("更新履歴");
    expect(one).toContain("v1.0.0");
    expect(one).toContain("2026/11/01");
    expect(one).toContain("・初回リリース");

    const three = renderToStaticMarkup(
      <ReleaseHistory
        history={["1.2.3", "1.2.2", "1.2.1"].map((version) => ({ version, dateLabel: null, changes: ["変更1", "変更2"] }))}
      />,
    );
    expect(three.match(/>v1\.2\.\d</g)).toHaveLength(3);
    expect(three).toContain("<span>・変更1</span><span><br/>・変更2</span>");
  });

  it("history escapes HTML and scripts from the release body", () => {
    const html = renderToStaticMarkup(
      <ReleaseHistory
        history={[
          {
            version: "1.2.3",
            dateLabel: "2026/11/20",
            changes: formatReleaseNotes('- <script>alert("x")</script>\n- <img src=x onerror=alert(1)>\n- <a href="javascript:alert(1)">link</a>'),
          },
        ]}
      />,
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<a ");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });
});

describe("page data (each section degrades on its own)", () => {
  it("builds buttons, fingerprint and the history from the verified release", async () => {
    releaseMocks.latest.mockResolvedValue(servedRelease());
    releaseMocks.history.mockResolvedValue([historyEntry("1.3.0", "2026-11-25T00:00:00Z"), historyEntry("1.2.3", "2026-11-20T12:00:00Z", "- 改善")]);
    fakePrisma.insert("siteSetting", { key: "quick_client_cert_fingerprint", value: "ab".repeat(32) });

    const data = await getDownloadPageData();
    expect(data.release?.installer.name).toBe("ClipshareQuickSetup-1.2.3.exe");
    expect(data.release?.msix?.name).toBe("ClipshareQuick-1.2.3.msix");
    expect(data.certFingerprint).toBe(fingerprint);
    // 未検証の 1.3.0 は履歴に出さない
    expect(data.history).toEqual([{ version: "1.2.3", dateLabel: "2026/11/20", changes: ["改善"] }]);
  });

  it("keeps the page when the history lookup fails (history only is empty)", async () => {
    releaseMocks.latest.mockResolvedValue(servedRelease());
    releaseMocks.history.mockRejectedValue(new Error("boom"));
    const data = await getDownloadPageData();
    expect(data.release).not.toBeNull();
    expect(data.history).toEqual([]);
  });

  it("no verified release: no download, no history", async () => {
    releaseMocks.latest.mockResolvedValue(null);
    releaseMocks.history.mockResolvedValue([historyEntry("1.2.3", "2026-11-20T12:00:00Z")]);
    const data = await getDownloadPageData();
    expect(data.release).toBeNull();
    expect(data.history).toEqual([]);
  });

  it("falls back to defaults when settings cannot be read", async () => {
    releaseMocks.latest.mockRejectedValue(new Error("db down"));
    releaseMocks.history.mockResolvedValue([]);
    const findMany = vi.spyOn(fakePrisma.siteSetting, "findMany");
    findMany.mockRejectedValue(new Error("db down"));
    const data = await getDownloadPageData();
    expect(data.release).toBeNull();
    expect(data.certFingerprint).toBeNull();
    expect(data.supportedOs).toBe("Windows 11");
    expect(data.retentionHours).toBe(24);
    expect(data.anonymousDailyLimit).toBe(5);
  });

  it("hides the MSIX button when the only installer is the MSIX itself", async () => {
    const release = servedRelease();
    release.assets = release.assets.filter((asset) => asset.name.endsWith(".msix"));
    releaseMocks.latest.mockResolvedValue(release);
    releaseMocks.history.mockResolvedValue([]);
    const data = await getDownloadPageData();
    expect(data.release?.installer.name).toBe("ClipshareQuick-1.2.3.msix");
    expect(data.release?.msix).toBeNull();
  });
});
