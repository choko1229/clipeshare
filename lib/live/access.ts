import { prisma } from "@/lib/db/prisma";

const FIXED_KEY_LEVEL_NAME = "TrustedUser";

export async function canUseFixedStreamKey(userId: string) {
  const [user, trustedLevel] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        accountLevel: {
          select: {
            sortOrder: true,
          },
        },
      },
    }),
    prisma.accountLevel.findUnique({
      where: { name: FIXED_KEY_LEVEL_NAME },
      select: {
        sortOrder: true,
      },
    }),
  ]);

  if (!user?.accountLevel || !trustedLevel) {
    return false;
  }

  return user.accountLevel.sortOrder >= trustedLevel.sortOrder;
}
