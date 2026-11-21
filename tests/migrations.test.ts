import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(process.cwd(), "prisma", "migrations", "20261121000000_add_quickshare_api_tokens", "migration.sql");

describe("quick share API migration", () => {
  const sql = readFileSync(migrationPath, "utf8");
  const statements = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  it("never drops or truncates anything", () => {
    expect(statements).not.toMatch(/\bDROP\b/i);
    expect(statements).not.toMatch(/\bTRUNCATE\b/i);
    expect(statements).not.toMatch(/^\s*DELETE\b/im);
    expect(statements).not.toMatch(/\bMODIFY\b/i);
  });

  it("only raises the image limit when it is still the old default", () => {
    expect(statements).toMatch(/WHERE `key` = 'quick_share_max_image_bytes' AND `value` = '20000000'/);
  });

  it("copies the current limits into existing levels", () => {
    expect(statements).toMatch(/UPDATE `AccountLevel`/);
    expect(statements).toMatch(/quick_share_max_video_bytes/);
  });
});

describe("quick client checksum migration", () => {
  const sql = readFileSync(
    path.join(process.cwd(), "prisma", "migrations", "20261121010000_add_quick_client_asset_checksums", "migration.sql"),
    "utf8",
  );

  it("only creates a table", () => {
    const statements = sql
      .split(/\r?\n/)
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    expect(statements).toMatch(/CREATE TABLE `QuickClientAssetChecksum`/);
    expect(statements).not.toMatch(/\b(DROP|TRUNCATE|MODIFY|ALTER|DELETE|UPDATE)\b/i);
  });
});
