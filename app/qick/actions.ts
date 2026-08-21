"use server";

import { rm } from "node:fs/promises";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { mediaUrlToProcessedPath } from "@/lib/media/retention";
import { getStoredUploads, removeStoredUpload } from "@/lib/quick-share/upload-cookie";

export async function deleteQuickShare(publicId: string, _formData: FormData) {
  const [cookieStore, session] = await Promise.all([cookies(), getServerSession(authOptions)]);
  const quickShare = await prisma.quickShare.findUnique({ where: { publicId } });

  if (quickShare && !quickShare.deletedAt) {
    const isOwnerBySession = Boolean(session?.user?.id) && quickShare.userId === session?.user?.id;
    const isOwnerByCookie = getStoredUploads(cookieStore).some(
      (item) => item.id === publicId && item.token === quickShare.deleteToken,
    );

    if (isOwnerBySession || isOwnerByCookie) {
      const filePaths = [
        mediaUrlToProcessedPath(quickShare.mediaUrl),
        mediaUrlToProcessedPath(quickShare.thumbnailUrl),
        quickShare.originalPath,
      ].filter((value): value is string => Boolean(value));

      await Promise.all(filePaths.map((filePath) => rm(filePath, { force: true })));

      await prisma.quickShare.update({
        where: { publicId },
        data: { deletedAt: new Date() },
      });
    }
  }

  removeStoredUpload(cookieStore, publicId);
  redirect("/qick");
}
