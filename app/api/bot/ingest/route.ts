import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createBasePost } from "@/app/posts/new/actions";
import { prisma } from "@/lib/db/prisma";
import { storeScreenshotImage } from "@/lib/media/images";
import { storeOriginalVideo } from "@/lib/media/videos";
import { sendWebPushToUser } from "@/lib/notifications/web-push";
import { splitPostBody } from "@/lib/posts/post-body";
import { extractHashTags, slugify } from "@/lib/posts/slug";
import { getUploadLimitsForUser } from "@/lib/uploads/account-limits";
import { detectMediaKind } from "@/lib/uploads/file-kind";

const ingestSchema = z.object({
  guildId: z.string().min(1),
  channelId: z.string().min(1),
  messageId: z.string().min(1),
  attachmentId: z.string().min(1),
  authorId: z.string().min(1),
  gameName: z.string().trim().max(120).optional(),
  attachmentUrl: z.string().url(),
  attachmentName: z.string().min(1).max(200),
  attachmentContentType: z.string().optional(),
  attachmentSize: z.number().int().positive().optional(),
  messageText: z.string().max(4000).optional(),
});

function checkBotSecret(request: Request) {
  const expected = process.env.DISCORD_BOT_INGEST_SECRET;
  if (!expected) {
    return false;
  }

  const header = request.headers.get("authorization");
  return header === `Bearer ${expected}`;
}

export async function POST(request: Request) {
  if (!checkBotSecret(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = ingestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }

  const input = parsed.data;

  const account = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "discord",
        providerAccountId: input.authorId,
      },
    },
    select: {
      userId: true,
    },
  });

  if (!account) {
    return NextResponse.json({ skipped: "not_linked" });
  }

  const user = await prisma.user.findUnique({
    where: { id: account.userId },
    select: {
      id: true,
      isBanned: true,
      discordAutoMirrorEnabled: true,
    },
  });

  if (!user || user.isBanned || !user.discordAutoMirrorEnabled) {
    return NextResponse.json({ skipped: "mirror_disabled" });
  }

  const guildLink = await prisma.discordGuildLink.findUnique({
    where: { guildId: input.guildId },
    include: {
      defaultGame: true,
    },
  });

  if (!guildLink) {
    return NextResponse.json({ skipped: "guild_not_registered" });
  }

  const watchedChannelIds = Array.isArray(guildLink.watchedChannelIds)
    ? guildLink.watchedChannelIds.filter((id): id is string => typeof id === "string")
    : null;
  if (watchedChannelIds && watchedChannelIds.length > 0 && !watchedChannelIds.includes(input.channelId)) {
    return NextResponse.json({ skipped: "channel_not_watched" });
  }

  const gameName = input.gameName?.trim() || guildLink.defaultGame?.name;
  if (!gameName) {
    return NextResponse.json({ skipped: "no_game_configured" });
  }

  const sourceDiscordMessageId = `${input.messageId}:${input.attachmentId}`;
  const existingPost = await prisma.post.findUnique({
    where: { sourceDiscordMessageId },
    select: { id: true },
  });
  if (existingPost) {
    return NextResponse.json({ skipped: "duplicate" });
  }

  const mediaKind = detectMediaKind({ name: input.attachmentName, type: input.attachmentContentType });
  if (!mediaKind) {
    return NextResponse.json({ skipped: "unsupported_media" });
  }

  const attachmentResponse = await fetch(input.attachmentUrl);
  if (!attachmentResponse.ok) {
    return NextResponse.json({ error: "attachment_fetch_failed" }, { status: 502 });
  }
  const attachmentBytes = await attachmentResponse.arrayBuffer();
  const mediaFile = new File([attachmentBytes], input.attachmentName, {
    type: input.attachmentContentType ?? attachmentResponse.headers.get("content-type") ?? "",
  });

  const uploadLimits = await getUploadLimitsForUser(user.id);
  const { title, description } = splitPostBody(input.messageText?.trim() || "Discordから保存");
  const tagNames = input.messageText ? extractHashTags(input.messageText) : [];
  const publicId = nanoid(12);
  const gameSlug = slugify(gameName) || nanoid(8);

  try {
    if (mediaKind === "SCREENSHOT") {
      const storedImage = await storeScreenshotImage(mediaFile, publicId, {
        maxImageSizeBytes: uploadLimits.maxImageSizeBytes,
      });

      const post = await createBasePost({
        description,
        fileSizeBytes: BigInt(storedImage.size),
        gameName,
        gameSlug,
        height: storedImage.height,
        isNsfw: false,
        mediaUrl: storedImage.mediaUrl,
        originalFilePath: storedImage.originalPath,
        publicId,
        sourceDiscordGuildId: input.guildId,
        sourceDiscordMessageId,
        tagNames,
        thumbnailUrl: storedImage.thumbnailUrl,
        title,
        type: "SCREENSHOT",
        userId: user.id,
        visibility: "PRIVATE",
        width: storedImage.width,
      });

      await notifyMirrorSaved(user.id, post.id, post.publicId);
      return NextResponse.json({ publicId: post.publicId, status: "created" });
    }

    const storedVideo = await storeOriginalVideo(mediaFile, publicId, {
      maxVideoSizeBytes: uploadLimits.maxVideoSizeBytes,
    });

    const post = await createBasePost({
      description,
      fileSizeBytes: BigInt(storedVideo.size),
      gameName,
      gameSlug,
      height: null,
      isNsfw: false,
      mediaUrl: null,
      originalFilePath: storedVideo.originalPath,
      publicId,
      sourceDiscordGuildId: input.guildId,
      sourceDiscordMessageId,
      tagNames,
      thumbnailUrl: "/images/processing-placeholder.svg",
      title,
      type: "CLIP",
      userId: user.id,
      visibility: "PRIVATE",
      width: null,
    });

    await prisma.uploadJob.create({
      data: {
        inputPath: storedVideo.originalPath,
        postId: post.id,
        status: "QUEUED",
      },
    });

    await notifyMirrorSaved(user.id, post.id, post.publicId);
    return NextResponse.json({ publicId: post.publicId, status: "created" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}

async function notifyMirrorSaved(userId: string, postId: string, publicId: string) {
  try {
    await prisma.notification.create({
      data: {
        targetId: postId,
        targetType: "POST",
        type: "DISCORD_MIRROR_SAVED",
        userId,
      },
    });
    await sendWebPushToUser(userId, {
      body: "Discordの投稿を下書きとして保存しました。確認して公開してください。",
      title: "Discordから自動保存",
      url: `/c/${publicId}`,
    });
  } catch {
    // 通知の失敗で投稿作成自体を失敗させない
  }
}
