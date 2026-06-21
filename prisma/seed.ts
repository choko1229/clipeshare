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
    update: {},
    create: {
      key: "original_video_retention_days",
      value: "45",
      description: "Original video retention period after HLS conversion.",
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
