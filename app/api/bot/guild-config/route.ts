import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { slugify } from "@/lib/posts/slug";

const guildConfigSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set_game"),
    guildId: z.string().min(1),
    guildName: z.string().trim().max(120).optional(),
    gameName: z.string().trim().min(1).max(120),
    requestedByDiscordUserId: z.string().min(1),
  }),
  z.object({
    action: z.literal("watch_channel"),
    guildId: z.string().min(1),
    guildName: z.string().trim().max(120).optional(),
    channelId: z.string().min(1),
    requestedByDiscordUserId: z.string().min(1),
  }),
  z.object({
    action: z.literal("unwatch_channel"),
    guildId: z.string().min(1),
    channelId: z.string().min(1),
    requestedByDiscordUserId: z.string().min(1),
  }),
  z.object({
    action: z.literal("watch_all_channels"),
    guildId: z.string().min(1),
    requestedByDiscordUserId: z.string().min(1),
  }),
]);

function checkBotSecret(request: Request) {
  const expected = process.env.DISCORD_BOT_INGEST_SECRET;
  if (!expected) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${expected}`;
}

async function resolveRequestingUser(discordUserId: string) {
  const account = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "discord",
        providerAccountId: discordUserId,
      },
    },
    select: {
      userId: true,
    },
  });

  return account?.userId ?? null;
}

async function getOrCreateGuildLink(guildId: string, guildName: string | undefined, installedByUserId: string) {
  return prisma.discordGuildLink.upsert({
    where: { guildId },
    update: guildName ? { guildName } : {},
    create: {
      guildId,
      guildName,
      installedByUserId,
    },
  });
}

export async function POST(request: Request) {
  if (!checkBotSecret(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = guildConfigSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }

  const input = parsed.data;
  const userId = await resolveRequestingUser(input.requestedByDiscordUserId);
  if (!userId) {
    return NextResponse.json({ error: "requester_not_linked" }, { status: 403 });
  }

  if (input.action === "set_game") {
    const gameSlug = slugify(input.gameName);
    const game = await prisma.game.upsert({
      where: { slug: gameSlug },
      update: {},
      create: {
        name: input.gameName,
        slug: gameSlug,
      },
    });

    const guildLink = await getOrCreateGuildLink(input.guildId, input.guildName, userId);
    const updated = await prisma.discordGuildLink.update({
      where: { id: guildLink.id },
      data: {
        defaultGameId: game.id,
      },
    });

    return NextResponse.json({ defaultGameName: game.name, guildId: updated.guildId, status: "ok" });
  }

  if (input.action === "watch_all_channels") {
    const guildLink = await getOrCreateGuildLink(input.guildId, undefined, userId);
    await prisma.discordGuildLink.update({
      where: { id: guildLink.id },
      data: {
        watchedChannelIds: [],
      },
    });

    return NextResponse.json({ status: "ok" });
  }

  const guildLink = await getOrCreateGuildLink(input.guildId, undefined, userId);
  const currentChannelIds = Array.isArray(guildLink.watchedChannelIds)
    ? guildLink.watchedChannelIds.filter((id): id is string => typeof id === "string")
    : [];

  const nextChannelIds =
    input.action === "watch_channel"
      ? Array.from(new Set([...currentChannelIds, input.channelId]))
      : currentChannelIds.filter((id) => id !== input.channelId);

  await prisma.discordGuildLink.update({
    where: { id: guildLink.id },
    data: {
      watchedChannelIds: nextChannelIds,
    },
  });

  return NextResponse.json({ status: "ok", watchedChannelIds: nextChannelIds });
}
