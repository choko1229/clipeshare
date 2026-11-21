import crypto from "node:crypto";
import { Prisma } from "@prisma/client";

/**
 * テスト用のごく小さなインメモリ Prisma。テスト対象のコードが使う操作・条件だけを実装する。
 * - where: 等価、null、{ in, not, gt, gte, lt, lte }、OR
 * - 戻り値: 行のコピー。userId を持つ行には user を付ける(select/include は簡略化)
 */
type Row = Record<string, unknown> & { id: string };
type Where = Record<string, unknown>;

const uniqueKeys: Record<string, string[]> = {
  apiAuthorization: ["codeChallenge", "codeHash", "apiTokenId"],
  apiToken: ["tokenHash"],
  quickShare: ["publicId"],
  user: ["username"],
  siteSetting: ["key"],
};

const defaults: Record<string, () => Record<string, unknown>> = {
  apiAuthorization: () => ({
    status: "PENDING",
    codeHash: null,
    decidedAt: null,
    codeExpiresAt: null,
    usedAt: null,
    apiTokenId: null,
    devicePlatform: null,
    createdAt: new Date(),
  }),
  apiToken: () => ({
    platform: null,
    clientVersion: null,
    lastUsedAt: null,
    lastUsedIpHash: null,
    revokedAt: null,
    revokedReason: null,
    createdAt: new Date(),
  }),
  quickShare: () => ({
    status: "READY",
    mediaUrl: null,
    thumbnailUrl: null,
    originalPath: null,
    errorMessage: null,
    width: null,
    height: null,
    userId: null,
    ipHash: null,
    apiTokenId: null,
    deletedAt: null,
    createdAt: new Date(),
  }),
  uploadJob: () => ({ createdAt: new Date() }),
  user: () => ({
    username: null,
    displayName: null,
    name: null,
    isBanned: false,
    accountLevelId: null,
    accountLevel: null,
    createdAt: new Date(),
  }),
};

function matchValue(actual: unknown, condition: unknown): boolean {
  if (condition === null) {
    return actual === null || actual === undefined;
  }

  if (condition instanceof Date) {
    return actual instanceof Date && actual.getTime() === condition.getTime();
  }

  if (typeof condition === "object" && !Array.isArray(condition)) {
    const ops = condition as Record<string, unknown>;
    const comparable = actual instanceof Date ? actual.getTime() : actual;
    const asComparable = (value: unknown) => (value instanceof Date ? value.getTime() : value);

    for (const [op, value] of Object.entries(ops)) {
      switch (op) {
        case "in":
          if (!(value as unknown[]).includes(actual)) return false;
          break;
        case "not":
          if (matchValue(actual, value)) return false;
          break;
        case "gt":
          if (actual === null || actual === undefined || !((comparable as number) > (asComparable(value) as number))) return false;
          break;
        case "gte":
          if (actual === null || actual === undefined || !((comparable as number) >= (asComparable(value) as number))) return false;
          break;
        case "lt":
          if (actual === null || actual === undefined || !((comparable as number) < (asComparable(value) as number))) return false;
          break;
        case "lte":
          if (actual === null || actual === undefined || !((comparable as number) <= (asComparable(value) as number))) return false;
          break;
        default:
          throw new Error(`fake-prisma: unsupported operator ${op}`);
      }
    }

    return true;
  }

  return actual === condition;
}

export function matchesWhere(row: Row, where: Where | undefined): boolean {
  if (!where) {
    return true;
  }

  for (const [key, condition] of Object.entries(where)) {
    if (key === "OR") {
      if (!(condition as Where[]).some((sub) => matchesWhere(row, sub))) return false;
      continue;
    }

    if (key === "AND") {
      if (!(condition as Where[]).every((sub) => matchesWhere(row, sub))) return false;
      continue;
    }

    // 複合ユニークキー(例 repo_tag_assetName: { repo, tag, assetName })
    if (!(key in row) && key.includes("_") && typeof condition === "object" && condition !== null && !(condition instanceof Date)) {
      if (!matchesWhere(row, condition as Where)) return false;
      continue;
    }

    if (!matchValue(row[key], condition)) {
      return false;
    }
  }

  return true;
}

export class FakePrisma {
  tables: Record<string, Map<string, Row>> = {};

  constructor() {
    for (const model of ["apiAuthorization", "apiToken", "quickShare", "uploadJob", "user", "siteSetting", "accountLevel", "adminAuditLog", "quickClientAssetChecksum"]) {
      this.tables[model] = new Map();
    }
  }

  private table(model: string) {
    const table = this.tables[model];
    if (!table) throw new Error(`fake-prisma: unknown model ${model}`);
    return table;
  }

  private attach(model: string, row: Row): Row {
    const copy: Row = { ...row };

    if (model !== "user" && typeof row.userId === "string") {
      const user = this.tables.user.get(row.userId);
      copy.user = user ? { ...user } : null;
    }

    if (model === "user" && typeof row.accountLevelId === "string") {
      copy.accountLevel = this.tables.accountLevel.get(row.accountLevelId) ?? null;
    }

    return copy;
  }

  private checkUnique(model: string, row: Row, ignoreId?: string) {
    for (const key of uniqueKeys[model] ?? []) {
      const value = row[key];
      if (value === null || value === undefined) continue;
      for (const other of this.table(model).values()) {
        if (other.id !== ignoreId && other[key] === value) {
          throw new Prisma.PrismaClientKnownRequestError(`Unique constraint failed on ${key}`, {
            code: "P2002",
            clientVersion: "test",
          });
        }
      }
    }
  }

  private findRows(model: string, where?: Where) {
    return [...this.table(model).values()].filter((row) => matchesWhere(row, where));
  }

  private delegate(model: string) {
    return {
      findUnique: async ({ where }: { where: Where }) => {
        const row = this.findRows(model, where)[0];
        return row ? this.attach(model, row) : null;
      },
      findFirst: async ({ where, orderBy }: { where?: Where; orderBy?: Record<string, "asc" | "desc"> }) => {
        let rows = this.findRows(model, where);
        if (orderBy) {
          const [[key, dir]] = Object.entries(orderBy);
          rows = rows.sort((a, b) => compare(a[key], b[key]) * (dir === "desc" ? -1 : 1));
        }
        return rows[0] ? this.attach(model, rows[0]) : null;
      },
      findMany: async ({ where }: { where?: Where } = {}) => this.findRows(model, where).map((row) => this.attach(model, row)),
      count: async ({ where }: { where?: Where } = {}) => this.findRows(model, where).length,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: Row = { ...(defaults[model]?.() ?? {}), id: crypto.randomUUID(), ...data } as Row;
        this.checkUnique(model, row);
        this.table(model).set(row.id, row);
        return this.attach(model, row);
      },
      update: async ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
        const row = this.findRows(model, where)[0];
        if (!row) {
          throw new Prisma.PrismaClientKnownRequestError("Record to update not found.", { code: "P2025", clientVersion: "test" });
        }
        const next = { ...row, ...data };
        this.checkUnique(model, next, row.id);
        this.table(model).set(row.id, next);
        return this.attach(model, next);
      },
      updateMany: async ({ where, data }: { where?: Where; data: Record<string, unknown> }) => {
        const rows = this.findRows(model, where);
        for (const row of rows) {
          this.table(model).set(row.id, { ...row, ...data });
        }
        return { count: rows.length };
      },
      deleteMany: async ({ where }: { where?: Where } = {}) => {
        const rows = this.findRows(model, where);
        for (const row of rows) this.table(model).delete(row.id);
        return { count: rows.length };
      },
      upsert: async ({ where, create, update }: { where: Where; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const row = this.findRows(model, where)[0];
        if (row) {
          const next = { ...row, ...update };
          this.table(model).set(row.id, next);
          return next;
        }
        const created: Row = { id: crypto.randomUUID(), ...create } as Row;
        this.table(model).set(created.id, created);
        return created;
      },
      groupBy: async ({ by, where }: { by: string[]; where?: Where }) => {
        const groups = new Map<string, { key: Record<string, unknown>; count: number }>();
        for (const row of this.findRows(model, where)) {
          const key = Object.fromEntries(by.map((field) => [field, row[field]]));
          const id = JSON.stringify(key);
          const group = groups.get(id) ?? { key, count: 0 };
          group.count += 1;
          groups.set(id, group);
        }
        return [...groups.values()].map((group) => ({ ...group.key, _count: { _all: group.count } }));
      },
    };
  }

  get apiAuthorization() {
    return this.delegate("apiAuthorization");
  }
  get apiToken() {
    return this.delegate("apiToken");
  }
  get quickShare() {
    return this.delegate("quickShare");
  }
  get uploadJob() {
    return this.delegate("uploadJob");
  }
  get user() {
    return this.delegate("user");
  }
  get siteSetting() {
    return this.delegate("siteSetting");
  }
  get accountLevel() {
    return this.delegate("accountLevel");
  }
  get adminAuditLog() {
    return this.delegate("adminAuditLog");
  }
  get quickClientAssetChecksum() {
    return this.delegate("quickClientAssetChecksum");
  }

  private transactionQueue: Promise<unknown> = Promise.resolve();

  async $transaction<T>(input: ((tx: FakePrisma) => Promise<T>) | Promise<unknown>[]): Promise<T | unknown[]> {
    if (typeof input === "function") {
      // 実 DB の行ロックに近づけるため、対話型トランザクションは1本ずつ実行する
      const run = this.transactionQueue.then(() => this.runTransaction(input));
      this.transactionQueue = run.catch(() => undefined);
      return run;
    }

    return Promise.all(input);
  }

  private async runTransaction<T>(input: (tx: FakePrisma) => Promise<T>): Promise<T> {
    {
      // 失敗時に巻き戻す(簡易スナップショット)
      const snapshot = Object.fromEntries(Object.entries(this.tables).map(([name, table]) => [name, new Map([...table].map(([id, row]) => [id, { ...row }]))]));
      try {
        return await input(this);
      } catch (error) {
        this.tables = snapshot;
        throw error;
      }
    }
  }

  // テスト用ヘルパー
  rows(model: string) {
    return [...this.table(model).values()];
  }

  insert(model: string, data: Record<string, unknown>) {
    const row: Row = { ...(defaults[model]?.() ?? {}), id: crypto.randomUUID(), ...data } as Row;
    this.table(model).set(row.id, row);
    return row;
  }
}

function compare(a: unknown, b: unknown) {
  const left = a instanceof Date ? a.getTime() : (a as number | string | null);
  const right = b instanceof Date ? b.getTime() : (b as number | string | null);
  if (left === right) return 0;
  if (left === null || left === undefined) return -1;
  if (right === null || right === undefined) return 1;
  return left < right ? -1 : 1;
}

export const fakePrisma = new FakePrisma();

export function resetFakePrisma() {
  const fresh = new FakePrisma();
  fakePrisma.tables = fresh.tables;
}
