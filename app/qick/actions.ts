"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { deleteQuickShareRecord } from "@/lib/quick-share/delete-quick-share";
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
      await deleteQuickShareRecord(quickShare);
    }
  }

  removeStoredUpload(cookieStore, publicId);
  redirect("/qick");
}
