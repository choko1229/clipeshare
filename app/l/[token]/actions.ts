"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/active-user";
import { prisma } from "@/lib/db/prisma";

const tokenSchema = z.string().min(1).max(64);

export async function reportLiveStream(formData: FormData) {
  const user = await requireActiveUser();
  const viewToken = tokenSchema.parse(formData.get("viewToken"));
  const reason = z.enum(["spam", "harassment", "nsfw_missing", "illegal", "other"]).parse(formData.get("reason"));
  const detail = z.string().trim().max(1000).optional().parse(formData.get("detail") || undefined);

  const stream = await prisma.liveStream.findUnique({
    where: { viewToken },
    select: { id: true },
  });

  if (!stream) {
    throw new Error("配信が見つかりません。");
  }

  await prisma.report.create({
    data: {
      reporterId: user.id,
      targetType: "LIVE_STREAM",
      targetId: stream.id,
      reason,
      detail,
      status: "OPEN",
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/reports");
}
