import { Prisma, type PrismaClient } from "@prisma/client";

/**
 * 初期データ。デプロイのたびに `prisma db seed` で実行されるため、
 * 「無いときだけ作る」だけにして、管理画面で変更した値・既定のレベルは上書きしない。
 * (seed の値を変えても、既にある行には反映されない)
 */

export type SeedLogger = (message: string) => void;

export type AccountLevelSeed = {
  name: string;
  levelColor: string;
  maxVideoSeconds: number;
  maxVideoSizeBytes: bigint;
  maxImageSizeBytes: bigint;
  maxImagesPerPost: number;
  dailyUploadLimit: number | null;
  sortOrder: number;
  minPostCount: number;
  minAccountAgeDays: number;
  minFollowerCount: number;
  promotionRule: Prisma.InputJsonValue | Prisma.NullTypes.JsonNull;
  isManualOnly: boolean;
};

/** 既定のレベルが1つも無いときに既定にするレベル */
export const FALLBACK_DEFAULT_LEVEL_NAME = "Visitor";

/** 旧版(レベル1つだけの頃)の既定レベルの名前。残っていれば Visitor へ名前だけ移す */
const LEGACY_DEFAULT_LEVEL_NAME = "default";

export const accountLevelSeeds: readonly AccountLevelSeed[] = [
  {
    name: "Visitor",
    levelColor: "#808080",
    maxVideoSeconds: 30,
    maxVideoSizeBytes: 60_000_000n,
    maxImageSizeBytes: 3_000_000n,
    maxImagesPerPost: 1,
    dailyUploadLimit: 5,
    sortOrder: 0,
    minPostCount: 0,
    minAccountAgeDays: 0,
    minFollowerCount: 0,
    promotionRule: Prisma.JsonNull,
    isManualOnly: false,
  },
  {
    name: "NewUser",
    levelColor: "#38bdf8",
    maxVideoSeconds: 60,
    maxVideoSizeBytes: 120_000_000n,
    maxImageSizeBytes: 15_000_000n,
    maxImagesPerPost: 4,
    dailyUploadLimit: 10,
    sortOrder: 10,
    minPostCount: 15,
    minAccountAgeDays: 5,
    minFollowerCount: 1,
    promotionRule: {
      anyOf: [{ minPostCount: 15, minAccountAgeDays: 5 }, { minFollowerCount: 1 }, { requiresEmailVerified: true }],
    },
    isManualOnly: false,
  },
  {
    name: "User",
    levelColor: "#22c55e",
    maxVideoSeconds: 180,
    maxVideoSizeBytes: 500_000_000n,
    maxImageSizeBytes: 30_000_000n,
    maxImagesPerPost: 8,
    dailyUploadLimit: 15,
    sortOrder: 20,
    minPostCount: 30,
    minAccountAgeDays: 7,
    minFollowerCount: 5,
    promotionRule: {
      anyOf: [{ minPostCount: 30, minAccountAgeDays: 7 }, { minFollowerCount: 5 }],
    },
    isManualOnly: false,
  },
  {
    name: "KnowUser",
    levelColor: "#f97316",
    maxVideoSeconds: 300,
    maxVideoSizeBytes: 750_000_000n,
    maxImageSizeBytes: 60_000_000n,
    maxImagesPerPost: 16,
    dailyUploadLimit: 20,
    sortOrder: 30,
    minPostCount: 100,
    minAccountAgeDays: 20,
    minFollowerCount: 15,
    promotionRule: {
      anyOf: [{ minPostCount: 100, minAccountAgeDays: 20 }, { minFollowerCount: 15 }],
    },
    isManualOnly: false,
  },
  {
    name: "TrustedUser",
    levelColor: "#a855f7",
    maxVideoSeconds: 420,
    maxVideoSizeBytes: 1_000_000_000n,
    maxImageSizeBytes: 120_000_000n,
    maxImagesPerPost: 32,
    dailyUploadLimit: 40,
    sortOrder: 40,
    minPostCount: 200,
    minAccountAgeDays: 30,
    minFollowerCount: 15,
    promotionRule: {
      anyOf: [{ minPostCount: 200, minAccountAgeDays: 30 }, { minFollowerCount: 15 }],
      requiresAdminFollow: true,
    },
    isManualOnly: false,
  },
  {
    name: "Admin",
    levelColor: "#facc15",
    maxVideoSeconds: 86_400,
    maxVideoSizeBytes: 100_000_000_000n,
    maxImageSizeBytes: 1_000_000_000n,
    maxImagesPerPost: 100,
    dailyUploadLimit: null,
    sortOrder: 90,
    minPostCount: 0,
    minAccountAgeDays: 0,
    minFollowerCount: 0,
    promotionRule: Prisma.JsonNull,
    isManualOnly: true,
  },
  {
    name: "Nuisance",
    levelColor: "#ff4d2e",
    maxVideoSeconds: 0,
    maxVideoSizeBytes: 0n,
    maxImageSizeBytes: 3_000_000n,
    maxImagesPerPost: 1,
    dailyUploadLimit: 3,
    sortOrder: -10,
    minPostCount: 0,
    minAccountAgeDays: 0,
    minFollowerCount: 0,
    promotionRule: Prisma.JsonNull,
    isManualOnly: true,
  },
];

export const storageSettingSeeds = [
  { key: "deleted_file_retention_days", value: "45", description: "Deleted media retention period in days." },
  { key: "original_video_retention_days", value: "30", description: "Original video retention period after HLS conversion." },
  { key: "replaced_file_retention_days", value: "45", description: "Replaced media retention period in days." },
] as const;

export const moderationRuleSeeds = [
  { type: "ng_word", action: "report", pattern: "違法薬物" },
  { type: "ng_word", action: "report", pattern: "個人情報" },
  { type: "ng_word", action: "report", pattern: "住所晒し" },
  { type: "ng_word", action: "report", pattern: "電話番号晒し" },
  { type: "ng_word", action: "report", pattern: "殺害予告" },
  { type: "ng_word", action: "report", pattern: "チート販売" },
  { type: "ng_word", action: "report", pattern: "アカウント販売" },
  { type: "blocked_pattern", action: "report", pattern: "(?:https?://)?(?:.+\\.)?(?:discord|steam|x|twitter)\\.(?:gift|free|click)" },
] as const;

export async function runSeed(prisma: PrismaClient, log: SeedLogger = () => undefined) {
  await seedAccountLevels(prisma, log);
  await seedStorageSettings(prisma);
  await seedModerationRules(prisma);
}

export async function seedAccountLevels(prisma: PrismaClient, log: SeedLogger = () => undefined) {
  await migrateLegacyDefaultLevel(prisma, log);

  for (const level of accountLevelSeeds) {
    const existing = await prisma.accountLevel.findUnique({ where: { name: level.name }, select: { id: true } });

    if (existing) {
      continue;
    }

    // 既定かどうかは下でまとめて決める(既にある既定のレベルを奪わない)
    await prisma.accountLevel.create({ data: { ...level, isDefault: false } });
    log(`created account level ${level.name}`);
  }

  const defaultCount = await prisma.accountLevel.count({ where: { isDefault: true } });

  if (defaultCount === 0) {
    await prisma.accountLevel.update({ where: { name: FALLBACK_DEFAULT_LEVEL_NAME }, data: { isDefault: true } });
    log(`no default account level; set ${FALLBACK_DEFAULT_LEVEL_NAME} as default`);
  }
}

/**
 * 旧版の「default」レベル(レベルが1つだけだった頃の既定)を Visitor として引き継ぐ。
 * 所属ユーザーをそのまま残すため、名前だけ変えて値・既定かどうかは変えない。
 * Visitor が既にある場合は、どちらも触らない(一意制約の衝突とデータの上書きを避ける)。
 */
async function migrateLegacyDefaultLevel(prisma: PrismaClient, log: SeedLogger) {
  const legacy = await prisma.accountLevel.findUnique({ where: { name: LEGACY_DEFAULT_LEVEL_NAME }, select: { id: true } });

  if (!legacy) {
    return;
  }

  const visitor = await prisma.accountLevel.findUnique({ where: { name: FALLBACK_DEFAULT_LEVEL_NAME }, select: { id: true } });

  if (visitor) {
    log(`legacy account level "${LEGACY_DEFAULT_LEVEL_NAME}" left as is because ${FALLBACK_DEFAULT_LEVEL_NAME} already exists`);
    return;
  }

  await prisma.accountLevel.update({ where: { id: legacy.id }, data: { name: FALLBACK_DEFAULT_LEVEL_NAME } });
  log(`renamed legacy account level "${LEGACY_DEFAULT_LEVEL_NAME}" to ${FALLBACK_DEFAULT_LEVEL_NAME}`);
}

export async function seedStorageSettings(prisma: PrismaClient) {
  for (const setting of storageSettingSeeds) {
    await prisma.storageSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: { ...setting },
    });
  }
}

export async function seedModerationRules(prisma: PrismaClient) {
  for (const rule of moderationRuleSeeds) {
    const existing = await prisma.moderationRule.findFirst({ where: { ...rule }, select: { id: true } });

    if (existing) {
      continue;
    }

    await prisma.moderationRule.create({ data: { ...rule, isActive: true } });
  }
}
