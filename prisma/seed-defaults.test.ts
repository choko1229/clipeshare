/**
 * seed の冪等性のテスト(DB 不要)。実行: node --import tsx --test prisma/seed-defaults.test.ts
 * seed が使う操作だけを持つメモリ上の簡易 Prisma で確認する。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { accountLevelSeeds, moderationRuleSeeds, runSeed, storageSettingSeeds } from "./seed-defaults";

type Row = Record<string, unknown> & { id: string };
type Where = Record<string, unknown>;

class Table {
  rows: Row[] = [];
  private nextId = 1;

  constructor(private readonly uniqueKeys: string[]) {}

  private matches(row: Row, where: Where) {
    return Object.entries(where).every(([key, value]) => row[key] === value);
  }

  private pick(row: Row | undefined, select?: Record<string, boolean>) {
    if (!row) {
      return null;
    }
    if (!select) {
      return { ...row };
    }
    return Object.fromEntries(Object.keys(select).map((key) => [key, row[key]]));
  }

  private assertUnique(candidate: Row) {
    for (const key of this.uniqueKeys) {
      if (this.rows.some((row) => row.id !== candidate.id && row[key] === candidate[key])) {
        throw new Error(`Unique constraint failed on ${key}`);
      }
    }
  }

  findUnique = async ({ where, select }: { where: Where; select?: Record<string, boolean> }) => this.pick(this.rows.find((row) => this.matches(row, where)), select);

  findFirst = this.findUnique;

  count = async ({ where }: { where: Where }) => this.rows.filter((row) => this.matches(row, where)).length;

  create = async ({ data }: { data: Record<string, unknown> }) => {
    const row: Row = { ...data, id: `id-${this.nextId++}` };
    this.assertUnique(row);
    this.rows.push(row);
    return { ...row };
  };

  update = async ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
    const index = this.rows.findIndex((row) => this.matches(row, where));
    if (index < 0) {
      throw new Error("Record to update not found");
    }
    const next: Row = { ...this.rows[index], ...data, id: this.rows[index].id };
    this.assertUnique(next);
    this.rows[index] = next;
    return { ...next };
  };

  upsert = async ({ where, update, create }: { where: Where; update: Record<string, unknown>; create: Record<string, unknown> }) => {
    const existing = this.rows.find((row) => this.matches(row, where));
    return existing ? this.update({ where: { id: existing.id }, data: update }) : this.create({ data: create });
  };
}

function createFakePrisma() {
  const db = {
    accountLevel: new Table(["name"]),
    storageSetting: new Table(["key"]),
    moderationRule: new Table([]),
  };
  return { db, prisma: db as unknown as PrismaClient };
}

function level(db: ReturnType<typeof createFakePrisma>["db"], name: string) {
  const row = db.accountLevel.rows.find((candidate) => candidate.name === name);
  assert.ok(row, `level ${name} exists`);
  return row;
}

function setting(db: ReturnType<typeof createFakePrisma>["db"], key: string) {
  return db.storageSetting.rows.find((row) => row.key === key)?.value;
}

const snapshot = (db: ReturnType<typeof createFakePrisma>["db"]) =>
  JSON.stringify(db, (_key, value: unknown) => (typeof value === "bigint" ? value.toString() : value));

describe("seed on an empty database", () => {
  it("creates the 7 account levels, the storage settings and the moderation rules, with Visitor as the only default", async () => {
    const { db, prisma } = createFakePrisma();
    await runSeed(prisma);

    assert.deepEqual(
      db.accountLevel.rows.map((row) => row.name),
      ["Visitor", "NewUser", "User", "KnowUser", "TrustedUser", "Admin", "Nuisance"],
    );
    assert.equal(db.accountLevel.rows.length, accountLevelSeeds.length);
    assert.deepEqual(
      db.accountLevel.rows.filter((row) => row.isDefault).map((row) => row.name),
      ["Visitor"],
    );
    assert.equal(level(db, "User").maxImageSizeBytes, 30_000_000n);
    assert.equal(db.storageSetting.rows.length, storageSettingSeeds.length);
    assert.equal(setting(db, "original_video_retention_days"), "30");
    assert.equal(setting(db, "deleted_file_retention_days"), "45");
    assert.equal(setting(db, "replaced_file_retention_days"), "45");
    assert.equal(db.moderationRule.rows.length, moderationRuleSeeds.length);
  });
});

describe("seed keeps values changed in the admin panel", () => {
  it("does not overwrite level values, the chosen default level or original_video_retention_days", async () => {
    const { db, prisma } = createFakePrisma();
    await runSeed(prisma);

    await db.accountLevel.update({ where: { name: "Visitor" }, data: { maxImageSizeBytes: 9_000_000n, dailyUploadLimit: 7, isDefault: false } });
    await db.accountLevel.update({ where: { name: "NewUser" }, data: { levelColor: "#000000", isDefault: true } });
    await db.accountLevel.update({ where: { name: "Admin" }, data: { maxImagesPerPost: 3, promotionRule: { custom: true } } });
    await db.storageSetting.update({ where: { key: "original_video_retention_days" }, data: { value: "90" } });
    await db.storageSetting.update({ where: { key: "deleted_file_retention_days" }, data: { value: "10" } });

    await runSeed(prisma);

    assert.equal(level(db, "Visitor").maxImageSizeBytes, 9_000_000n);
    assert.equal(level(db, "Visitor").dailyUploadLimit, 7);
    assert.equal(level(db, "Visitor").isDefault, false);
    assert.equal(level(db, "NewUser").levelColor, "#000000");
    assert.equal(level(db, "NewUser").isDefault, true);
    assert.equal(level(db, "Admin").maxImagesPerPost, 3);
    assert.deepEqual(level(db, "Admin").promotionRule, { custom: true });
    assert.deepEqual(
      db.accountLevel.rows.filter((row) => row.isDefault).map((row) => row.name),
      ["NewUser"],
    );
    assert.equal(setting(db, "original_video_retention_days"), "90");
    assert.equal(setting(db, "deleted_file_retention_days"), "10");
  });

  it("only creates a level that was deleted, without touching the others", async () => {
    const { db, prisma } = createFakePrisma();
    await runSeed(prisma);
    await db.accountLevel.update({ where: { name: "User" }, data: { sortOrder: 99 } });
    db.accountLevel.rows = db.accountLevel.rows.filter((row) => row.name !== "KnowUser");

    await runSeed(prisma);

    assert.equal(db.accountLevel.rows.length, 7);
    assert.equal(level(db, "KnowUser").isDefault, false);
    assert.equal(level(db, "User").sortOrder, 99);
  });
});

describe("seed is idempotent", () => {
  it("running it twice in a row neither adds rows nor changes data", async () => {
    const { db, prisma } = createFakePrisma();
    await runSeed(prisma);
    const first = snapshot(db);

    await runSeed(prisma);

    assert.equal(snapshot(db), first);
  });
});

describe("default level", () => {
  it("sets Visitor as default only when no level is default", async () => {
    const { db, prisma } = createFakePrisma();
    await runSeed(prisma);
    await db.accountLevel.update({ where: { name: "Visitor" }, data: { isDefault: false } });

    await runSeed(prisma);

    assert.deepEqual(
      db.accountLevel.rows.filter((row) => row.isDefault).map((row) => row.name),
      ["Visitor"],
    );
  });

  it("keeps an existing default level from an older database and does not add a second default", async () => {
    const { db, prisma } = createFakePrisma();
    await db.accountLevel.create({ data: { name: "Custom", isDefault: true } });

    await runSeed(prisma);

    assert.deepEqual(
      db.accountLevel.rows.filter((row) => row.isDefault).map((row) => row.name),
      ["Custom"],
    );
    assert.equal(level(db, "Visitor").isDefault, false);
  });
});

describe("legacy \"default\" level (single level from the first version)", () => {
  it("renames it to Visitor and keeps its values and default flag, so its users stay on it", async () => {
    const { db, prisma } = createFakePrisma();
    const legacy = await db.accountLevel.create({ data: { name: "default", maxImageSizeBytes: 50_000_000n, dailyUploadLimit: 20, isDefault: true } });

    await runSeed(prisma);

    const visitor = level(db, "Visitor");
    assert.equal(visitor.id, legacy.id);
    assert.equal(visitor.maxImageSizeBytes, 50_000_000n);
    assert.equal(visitor.dailyUploadLimit, 20);
    assert.equal(visitor.isDefault, true);
    assert.equal(db.accountLevel.rows.length, 7);
    assert.equal(db.accountLevel.rows.filter((row) => row.isDefault).length, 1);
  });

  it("leaves both untouched when Visitor already exists (no unique-constraint error)", async () => {
    const { db, prisma } = createFakePrisma();
    await db.accountLevel.create({ data: { name: "default", isDefault: false, dailyUploadLimit: 20 } });
    await db.accountLevel.create({ data: { name: "Visitor", isDefault: true, dailyUploadLimit: 5 } });
    const messages: string[] = [];

    await runSeed(prisma, (message) => messages.push(message));

    assert.equal(level(db, "default").dailyUploadLimit, 20);
    assert.equal(level(db, "Visitor").dailyUploadLimit, 5);
    assert.ok(messages.some((message) => message.includes("left as is")));
  });
});
