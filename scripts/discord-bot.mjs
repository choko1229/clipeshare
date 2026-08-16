#!/usr/bin/env node
import { Client, Events, GatewayIntentBits, PermissionFlagsBits } from "discord.js";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const botToken = process.env.DISCORD_BOT_TOKEN;
const ingestSecret = process.env.DISCORD_BOT_INGEST_SECRET;

if (!botToken) {
  console.error("DISCORD_BOT_TOKEN is not set.");
  process.exit(1);
}

if (!ingestSecret) {
  console.error("DISCORD_BOT_INGEST_SECRET is not set.");
  process.exit(1);
}

const supportedContentTypePrefixes = ["image/", "video/"];

function isSupportedAttachment(attachment) {
  if (attachment.contentType) {
    return supportedContentTypePrefixes.some((prefix) => attachment.contentType.startsWith(prefix));
  }

  return /\.(jpg|jpeg|png|webp|mp4|mov|webm|mkv|avi)$/i.test(attachment.name ?? "");
}

async function callApi(path, body) {
  const response = await fetch(new URL(path, appUrl), {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${ingestSecret}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const data = await response.json().catch(() => ({}));
  return { data, ok: response.ok };
}

async function handleAttachments(message) {
  const attachments = [...message.attachments.values()].filter(isSupportedAttachment);
  if (attachments.length === 0) {
    return;
  }

  for (const attachment of attachments) {
    const { data, ok } = await callApi("/api/bot/ingest", {
      attachmentContentType: attachment.contentType ?? undefined,
      attachmentId: attachment.id,
      attachmentName: attachment.name ?? `${attachment.id}.bin`,
      attachmentSize: attachment.size,
      attachmentUrl: attachment.url,
      authorId: message.author.id,
      channelId: message.channelId,
      guildId: message.guildId,
      messageId: message.id,
      messageText: message.content || undefined,
    });

    if (!ok) {
      console.error(`ingest failed for message ${message.id}:`, data);
      continue;
    }

    if (data.status === "created") {
      console.log(`saved draft ${data.publicId} from message ${message.id}`);
      try {
        await message.react("📌");
      } catch {
        // リアクション権限がなくても致命的ではない
      }
    }
  }
}

function replyText(message, text) {
  return message.reply({ content: text, allowedMentions: { repliedUser: false } }).catch(() => {});
}

async function handleCommand(message) {
  const args = message.content.trim().split(/\s+/u).slice(1);
  const subcommand = args[0];

  if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await replyText(message, "この操作にはサーバー管理権限が必要です。");
    return;
  }

  if (subcommand === "setup") {
    const gameName = args.slice(1).join(" ").trim();
    if (!gameName) {
      await replyText(message, "使い方: `!clipshare setup ゲーム名`");
      return;
    }

    const { data, ok } = await callApi("/api/bot/guild-config", {
      action: "set_game",
      gameName,
      guildId: message.guildId,
      guildName: message.guild?.name,
      requestedByDiscordUserId: message.author.id,
    });

    await replyText(
      message,
      ok
        ? `既定のゲームを「${data.defaultGameName}」に設定しました。このサーバーで画像・動画を投稿した連携済みユーザーの投稿が、Clipshareへ下書き保存されるようになります。`
        : "設定に失敗しました。あなたのDiscordアカウントがClipshareと連携済みか確認してください。",
    );
    return;
  }

  if (subcommand === "watch") {
    const { ok } = await callApi("/api/bot/guild-config", {
      action: "watch_channel",
      channelId: message.channelId,
      guildId: message.guildId,
      requestedByDiscordUserId: message.author.id,
    });
    await replyText(message, ok ? "このチャンネルを監視対象に追加しました。" : "設定に失敗しました。");
    return;
  }

  if (subcommand === "unwatch") {
    const { ok } = await callApi("/api/bot/guild-config", {
      action: "unwatch_channel",
      channelId: message.channelId,
      guildId: message.guildId,
      requestedByDiscordUserId: message.author.id,
    });
    await replyText(message, ok ? "このチャンネルを監視対象から外しました。" : "設定に失敗しました。");
    return;
  }

  if (subcommand === "watch-all") {
    const { ok } = await callApi("/api/bot/guild-config", {
      action: "watch_all_channels",
      guildId: message.guildId,
      requestedByDiscordUserId: message.author.id,
    });
    await replyText(message, ok ? "サーバー内の全チャンネルを監視対象にしました。" : "設定に失敗しました。");
    return;
  }

  await replyText(
    message,
    "使い方:\n`!clipshare setup ゲーム名` 既定のゲームを設定\n`!clipshare watch` このチャンネルを監視対象に追加\n`!clipshare unwatch` このチャンネルを監視対象から除外\n`!clipshare watch-all` 全チャンネルを監視対象にする",
  );
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Clipshare Discord bot logged in as ${readyClient.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guildId) {
    return;
  }

  try {
    if (message.content.startsWith("!clipshare")) {
      await handleCommand(message);
      return;
    }

    await handleAttachments(message);
  } catch (error) {
    console.error("Failed to process message", message.id, error);
  }
});

client.login(botToken);
