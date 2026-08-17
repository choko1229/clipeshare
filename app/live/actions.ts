"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { errorRedirectUrl } from "@/lib/actions/error-message";
import { requireActiveUser } from "@/lib/auth/active-user";
import { prisma } from "@/lib/db/prisma";
import { canUseFixedStreamKey } from "@/lib/live/access";
import { kickPublisher, unregisterViewRelay } from "@/lib/live/media-control";
import { getCurrentLiveSession, getOrCreateLiveStream } from "@/lib/live/stream";
import { generateStreamKey, generateViewToken, isValidCustomStreamKey } from "@/lib/live/tokens";

const visibilitySchema = z.enum(["PUBLIC", "FOLLOWERS_ONLY", "PRIVATE"]);

export async function regenerateStreamKey() {
  try {
    const user = await requireActiveUser();
    const stream = await getOrCreateLiveStream(user.id);

    await prisma.liveStream.update({
      where: { id: stream.id },
      data: { streamKey: generateStreamKey() },
    });

    revalidatePath("/live");
    redirect("/live");
  } catch (error) {
    redirect(errorRedirectUrl("/live", error));
  }
}

export async function setCustomStreamKey(formData: FormData) {
  try {
    const user = await requireActiveUser();
    const value = z.string().trim().parse(formData.get("streamKey"));

    if (!isValidCustomStreamKey(value)) {
      throw new Error("ストリームキーは半角英数字・ハイフン・アンダースコアのみ、6〜32文字で入力してください。");
    }

    const allowed = await canUseFixedStreamKey(user.id);
    if (!allowed) {
      throw new Error("固定IDへの変更はtrusted以上のアカウントのみ利用できます。");
    }

    const stream = await getOrCreateLiveStream(user.id);

    const conflict = await prisma.liveStream.findUnique({
      where: { streamKey: value },
      select: { id: true },
    });
    if (conflict && conflict.id !== stream.id) {
      throw new Error("そのストリームキーは既に使用されています。別の値を指定してください。");
    }

    await prisma.liveStream.update({
      where: { id: stream.id },
      data: { streamKey: value },
    });

    revalidatePath("/live");
    redirect("/live");
  } catch (error) {
    redirect(errorRedirectUrl("/live", error));
  }
}

export async function regenerateViewToken() {
  try {
    const user = await requireActiveUser();
    const stream = await getOrCreateLiveStream(user.id);

    await prisma.liveStream.update({
      where: { id: stream.id },
      data: { viewToken: generateViewToken() },
    });

    revalidatePath("/live");
    redirect("/live");
  } catch (error) {
    redirect(errorRedirectUrl("/live", error));
  }
}

export async function updateVisibility(formData: FormData) {
  try {
    const user = await requireActiveUser();
    const visibility = visibilitySchema.parse(formData.get("visibility"));
    const stream = await getOrCreateLiveStream(user.id);

    await prisma.liveStream.update({
      where: { id: stream.id },
      data: { visibility },
    });

    revalidatePath("/live");
    redirect("/live");
  } catch (error) {
    redirect(errorRedirectUrl("/live", error));
  }
}

export async function forceStopStream() {
  try {
    const user = await requireActiveUser();
    const stream = await getOrCreateLiveStream(user.id);

    if (stream.status === "LIVE") {
      const session = await getCurrentLiveSession(stream.id);

      await prisma.$transaction(async (tx) => {
        await tx.liveStream.update({
          where: { id: stream.id },
          data: { status: "OFFLINE", disconnectedAt: null },
        });

        if (session) {
          await tx.liveSession.update({
            where: { id: session.id },
            data: { endedAt: new Date() },
          });
        }
      });

      await kickPublisher(stream.streamKey);
      await unregisterViewRelay(stream.viewToken);
    }

    revalidatePath("/live");
    redirect("/live");
  } catch (error) {
    redirect(errorRedirectUrl("/live", error));
  }
}
