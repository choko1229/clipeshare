"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/auth";
import { revokeOwnApiToken } from "@/lib/api-auth/tokens";

const tokenIdSchema = z.string().min(1).max(64);

/** 連携アプリ管理(画面13)の「解除する」。自分のトークンだけを失効させる */
export async function revokeConnectedApp(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error("ログインしてください。");
  }

  const tokenId = tokenIdSchema.parse(formData.get("tokenId"));
  await revokeOwnApiToken(tokenId, session.user.id, "USER");
  revalidatePath("/settings/apps");
}
