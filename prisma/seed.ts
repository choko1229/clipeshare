import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.accountLevel.upsert({
    where: { name: "default" },
    update: {},
    create: {
      name: "default",
      maxVideoSeconds: 180,
      maxVideoSizeBytes: 300_000_000n,
      maxImageSizeBytes: 50_000_000n,
      dailyUploadLimit: 20,
      isDefault: true,
    },
  });

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
