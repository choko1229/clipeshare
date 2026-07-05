import { PrismaClient } from "@prisma/client";

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
        name: "NewUser",
        levelColor: "#8b949e",
        maxVideoSeconds: 180,
        maxVideoSizeBytes: 300_000_000n,
        maxImageSizeBytes: 50_000_000n,
        maxImagesPerPost: 1,
        dailyUploadLimit: 20,
        sortOrder: 10,
        minPostCount: 0,
        minAccountAgeDays: 0,
        minFollowerCount: 0,
        isManualOnly: false,
        isDefault: true,
      },
    });
  }

  await upsertAccountLevel({
    name: "Visitor",
    levelColor: "#64748b",
    maxVideoSeconds: 0,
    maxVideoSizeBytes: 0n,
    maxImageSizeBytes: 0n,
    maxImagesPerPost: 0,
    dailyUploadLimit: 0,
    sortOrder: 0,
    minPostCount: 0,
    minAccountAgeDays: 0,
    minFollowerCount: 0,
    isManualOnly: true,
    isDefault: false,
  });
  await upsertAccountLevel({
    name: "NewUser",
    levelColor: "#8b949e",
    maxVideoSeconds: 180,
    maxVideoSizeBytes: 300_000_000n,
    maxImageSizeBytes: 50_000_000n,
    maxImagesPerPost: 1,
    dailyUploadLimit: 20,
    sortOrder: 10,
    minPostCount: 0,
    minAccountAgeDays: 0,
    minFollowerCount: 0,
    isManualOnly: false,
    isDefault: true,
  });
  await upsertAccountLevel({
    name: "User",
    levelColor: "#22c55e",
    maxVideoSeconds: 300,
    maxVideoSizeBytes: 600_000_000n,
    maxImageSizeBytes: 80_000_000n,
    maxImagesPerPost: 4,
    dailyUploadLimit: 40,
    sortOrder: 20,
    minPostCount: 5,
    minAccountAgeDays: 1,
    minFollowerCount: 0,
    isManualOnly: false,
    isDefault: false,
  });
  await upsertAccountLevel({
    name: "KnowUser",
    levelColor: "#38bdf8",
    maxVideoSeconds: 600,
    maxVideoSizeBytes: 1_000_000_000n,
    maxImageSizeBytes: 100_000_000n,
    maxImagesPerPost: 8,
    dailyUploadLimit: 80,
    sortOrder: 30,
    minPostCount: 20,
    minAccountAgeDays: 7,
    minFollowerCount: 3,
    isManualOnly: false,
    isDefault: false,
  });
  await upsertAccountLevel({
    name: "TrustedUser",
    levelColor: "#f59e0b",
    maxVideoSeconds: 900,
    maxVideoSizeBytes: 1_500_000_000n,
    maxImageSizeBytes: 150_000_000n,
    maxImagesPerPost: 12,
    dailyUploadLimit: null,
    sortOrder: 40,
    minPostCount: 60,
    minAccountAgeDays: 30,
    minFollowerCount: 10,
    isManualOnly: false,
    isDefault: false,
  });
  await upsertAccountLevel({
    name: "Admin",
    levelColor: "#a855f7",
    maxVideoSeconds: 1800,
    maxVideoSizeBytes: 3_000_000_000n,
    maxImageSizeBytes: 200_000_000n,
    maxImagesPerPost: 20,
    dailyUploadLimit: null,
    sortOrder: 90,
    minPostCount: 0,
    minAccountAgeDays: 0,
    minFollowerCount: 0,
    isManualOnly: true,
    isDefault: false,
  });
  await upsertAccountLevel({
    name: "Nuisance",
    levelColor: "#ef4444",
    maxVideoSeconds: 60,
    maxVideoSizeBytes: 100_000_000n,
    maxImageSizeBytes: 20_000_000n,
    maxImagesPerPost: 1,
    dailyUploadLimit: 3,
    sortOrder: -10,
    minPostCount: 0,
    minAccountAgeDays: 0,
    minFollowerCount: 0,
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
