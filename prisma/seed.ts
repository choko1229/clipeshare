import { PrismaClient } from "@prisma/client";
import { runSeed } from "./seed-defaults";

const prisma = new PrismaClient();

runSeed(prisma, (message) => console.log(`[seed] ${message}`))
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
