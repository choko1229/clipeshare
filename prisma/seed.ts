import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await seedAccountLevels();

  await prisma.storageSetting.upsert({
    where: { key: "deleted_file_retention_days" },
    update: {},
    create: {
      key: "deleted_file_retention_days",
      value: "45",
      description: "Deleted media retention period in days.",
    },
  });

  await prisma.storageSetting.upsert({
    where: { key: "original_video_retention_days" },
    update: {
      value: "30",
    },
    create: {
      key: "original_video_retention_days",
      value: "30",
      description: "Original video retention period after HLS conversion.",
    },
  });

  await prisma.storageSetting.upsert({
    where: { key: "replaced_file_retention_days" },
    update: {},
    create: {
      key: "replaced_file_retention_days",
      value: "45",
      description: "Replaced media retention period in days.",
    },
  });

  await ensureModerationRule("ng_word", "report", "違法薬物");
  await ensureModerationRule("ng_word", "report", "個人情報");
  await ensureModerationRule("ng_word", "report", "住所晒し");
  await ensureModerationRule("ng_word", "report", "電話番号晒し");
  await ensureModerationRule("ng_word", "report", "殺害予告");
  await ensureModerationRule("ng_word", "report", "チート販売");
  await ensureModerationRule("ng_word", "report", "アカウント販売");
  await ensureModerationRule("blocked_pattern", "report", "(?:https?://)?(?:.+\\.)?(?:discord|steam|x|twitter)\\.(?:gift|free|click)");
}

async function seedAccountLevels() {
  const existingDefault = await prisma.accountLevel.findUnique({
    where: { name: "default" },
  });

  if (existingDefault) {
    await prisma.accountLevel.update({
      where: { id: existingDefault.id },
      data: {
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
        isDefault: true,
      },
    });
  }

  await upsertAccountLevel({
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
    isDefault: true,
  });
  await upsertAccountLevel({
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
      anyOf: [
        { minPostCount: 15, minAccountAgeDays: 5 },
        { minFollowerCount: 1 },
        { requiresEmailVerified: true },
      ],
    },
    isManualOnly: false,
    isDefault: false,
  });
  await upsertAccountLevel({
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
    isDefault: false,
  });
  await upsertAccountLevel({
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
    isDefault: false,
  });
  await upsertAccountLevel({
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
    isDefault: false,
  });
  await upsertAccountLevel({
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
    isDefault: false,
  });
  await upsertAccountLevel({
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
    isDefault: false,
  });
}

type AccountLevelSeed = {
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
  isDefault: boolean;
};

async function upsertAccountLevel(level: AccountLevelSeed) {
  if (level.isDefault) {
    await prisma.accountLevel.updateMany({
      where: {
        isDefault: true,
        name: {
          not: level.name,
        },
      },
      data: {
        isDefault: false,
      },
    });
  }

  await prisma.accountLevel.upsert({
    where: { name: level.name },
    update: level,
    create: level,
  });
}

async function ensureModerationRule(type: string, action: string, pattern: string) {
  const existing = await prisma.moderationRule.findFirst({
    where: {
      type,
      action,
      pattern,
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    return;
  }

  await prisma.moderationRule.create({
    data: {
      type,
      action,
      pattern,
      isActive: true,
    },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
