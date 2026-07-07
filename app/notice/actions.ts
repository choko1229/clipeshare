"use server";

import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth/active-user";
import { prisma } from "@/lib/db/prisma";

export async function markAllNotificationsRead() {
  const user = await requireActiveUser();

  await prisma.notification.updateMany({
    where: {
      userId: user.id,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  revalidatePath("/notice");
}
