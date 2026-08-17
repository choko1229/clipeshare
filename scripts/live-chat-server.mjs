#!/usr/bin/env node
import crypto from "node:crypto";
import { createServer } from "node:http";
import { PrismaClient } from "@prisma/client";
import { WebSocketServer } from "ws";

const prisma = new PrismaClient();
const port = Number(process.env.LIVE_CHAT_SERVER_PORT ?? 8081);
// Nginxの/ws/リバースプロキシ経由でのみアクセスされる想定なのでループバックのみに束縛する。
const host = process.env.LIVE_CHAT_SERVER_HOST ?? "127.0.0.1";
const chatTokenSecret = process.env.LIVE_CHAT_TOKEN_SECRET;
const sweepIntervalMs = Number(process.env.LIVE_OFFLINE_SWEEP_INTERVAL_MS ?? 10_000);
const settingsRefreshMs = 30_000;
const chatHistoryLimit = 50;
const mediamtxApiBase = process.env.LIVE_MEDIAMTX_API_URL;

async function unregisterViewRelay(viewToken) {
  if (!mediamtxApiBase) {
    return;
  }

  try {
    await fetch(`${mediamtxApiBase}/v3/config/paths/delete/live/${encodeURIComponent(viewToken)}`, {
      method: "POST",
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // 削除に失敗しても実害は限定的(TTL切れ等で自然に解消する)。
  }
}

if (!chatTokenSecret) {
  console.error("LIVE_CHAT_TOKEN_SECRET is not set.");
  process.exit(1);
}

/** @type {Map<string, { liveStreamId: string, connections: Map<import("ws").WebSocket, string | null> }>} */
const rooms = new Map();

let cachedOfflineGraceSeconds = 45;
let cachedSettingsAt = 0;

async function getOfflineGraceSeconds() {
  const now = Date.now();
  if (now - cachedSettingsAt < settingsRefreshMs) {
    return cachedOfflineGraceSeconds;
  }

  const row = await prisma.siteSetting.findUnique({
    where: { key: "live_offline_grace_seconds" },
    select: { value: true },
  });

  const parsed = Number.parseInt(row?.value ?? "", 10);
  cachedOfflineGraceSeconds = Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 45;
  cachedSettingsAt = now;
  return cachedOfflineGraceSeconds;
}

function verifyChatToken(token) {
  if (!token) {
    return null;
  }

  const [body, signature] = token.split(".");
  if (!body || !signature) {
    return null;
  }

  const expected = crypto.createHmac("sha256", chatTokenSecret).update(body).digest("base64url");
  if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return {
      userId: String(payload.sub),
      name: String(payload.name ?? "ユーザー"),
      role: payload.role ? String(payload.role) : undefined,
    };
  } catch {
    return null;
  }
}

const moderationRoles = new Set(["MODERATOR", "ADMIN", "OWNER"]);

async function canView(stream, viewerId, viewerRole) {
  if (viewerId === stream.userId) {
    return true;
  }
  if (viewerRole && moderationRoles.has(viewerRole)) {
    return true;
  }
  if (stream.visibility === "PUBLIC") {
    return true;
  }
  if (stream.visibility === "PRIVATE") {
    return false;
  }
  if (!viewerId) {
    return false;
  }

  const follow = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: viewerId, followingId: stream.userId } },
    select: { followerId: true },
  });
  return Boolean(follow);
}

async function checkNgWords(text) {
  const rules = await prisma.moderationRule.findMany({ where: { isActive: true } });
  const normalized = text.toLocaleLowerCase().normalize("NFKC");

  for (const rule of rules) {
    const type = rule.type.toLocaleLowerCase();
    const pattern = rule.pattern.trim();
    if (!pattern) {
      continue;
    }

    let matched = false;
    if (type === "blocked_pattern" || type === "pattern" || type === "regex") {
      try {
        matched = new RegExp(pattern, "i").test(text);
      } catch {
        matched = false;
      }
    } else {
      matched = normalized.includes(pattern.toLocaleLowerCase().normalize("NFKC"));
    }

    if (matched && rule.action.toLocaleLowerCase() === "block") {
      return false;
    }
  }

  return true;
}

function send(ws, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcast(viewToken, payload) {
  const room = rooms.get(viewToken);
  if (!room) {
    return;
  }
  for (const ws of room.connections.keys()) {
    send(ws, payload);
  }
}

function viewerCount(viewToken) {
  return rooms.get(viewToken)?.connections.size ?? 0;
}

async function getActiveSession(liveStreamId) {
  return prisma.liveSession.findFirst({
    where: { liveStreamId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
}

const server = createServer((request, response) => {
  response.writeHead(200, { "content-type": "text/plain" });
  response.end("clipshare live chat server\n");
});

const wss = new WebSocketServer({ server });

wss.on("connection", async (ws, request) => {
  try {
    const url = new URL(request.url ?? "", "http://internal");
    const viewToken = url.pathname.replace(/^\/+/, "");
    const identity = verifyChatToken(url.searchParams.get("token"));

    const stream = await prisma.liveStream.findUnique({ where: { viewToken } });
    if (!stream) {
      send(ws, { type: "error", message: "配信が見つかりません。" });
      ws.close();
      return;
    }

    const allowed = await canView(stream, identity?.userId, identity?.role);
    if (!allowed) {
      send(ws, { type: "error", message: "この配信は視聴できません。" });
      ws.close();
      return;
    }

    if (!rooms.has(viewToken)) {
      rooms.set(viewToken, { liveStreamId: stream.id, connections: new Map() });
    }
    const room = rooms.get(viewToken);
    room.connections.set(ws, identity?.userId ?? null);

    const activeSession = stream.status === "LIVE" ? await getActiveSession(stream.id) : null;
    const [messages, liked] = await Promise.all([
      activeSession
        ? prisma.liveChatMessage.findMany({
            where: { liveSessionId: activeSession.id, status: "PUBLISHED" },
            orderBy: { createdAt: "asc" },
            take: chatHistoryLimit,
            include: { user: { select: { username: true, displayName: true } } },
          })
        : Promise.resolve([]),
      activeSession && identity?.userId
        ? prisma.liveLike.findUnique({
            where: { userId_liveSessionId: { userId: identity.userId, liveSessionId: activeSession.id } },
            select: { userId: true },
          })
        : Promise.resolve(null),
    ]);

    send(ws, {
      type: "init",
      live: stream.status === "LIVE",
      viewerCount: viewerCount(viewToken),
      likeCount: activeSession?.likeCount ?? 0,
      liked: Boolean(liked),
      messages: messages.map(toChatPayload),
    });
    broadcast(viewToken, { type: "viewer_count", count: viewerCount(viewToken) });

    ws.on("message", async (raw) => {
      let data;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (data.type === "chat") {
        await handleChat(viewToken, stream, identity, String(data.body ?? ""), ws);
      } else if (data.type === "like") {
        await handleLike(viewToken, stream, identity, ws);
      }
    });

    ws.on("close", () => {
      room.connections.delete(ws);
      if (room.connections.size === 0) {
        rooms.delete(viewToken);
      } else {
        broadcast(viewToken, { type: "viewer_count", count: viewerCount(viewToken) });
      }
    });
  } catch (error) {
    console.error("connection handling failed", error);
    ws.close();
  }
});

function toChatPayload(message) {
  return {
    id: message.id,
    userId: message.userId,
    username: message.user.displayName ?? message.user.username ?? "ユーザー",
    body: message.body,
    createdAt: message.createdAt.toISOString(),
  };
}

async function handleChat(viewToken, stream, identity, body, ws) {
  const text = body.trim().slice(0, 300);
  if (!identity?.userId || !text) {
    send(ws, { type: "error", message: "コメントするにはログインしてください。" });
    return;
  }

  if (stream.status !== "LIVE") {
    return;
  }

  const activeSession = await getActiveSession(stream.id);
  if (!activeSession) {
    return;
  }

  const allowed = await checkNgWords(text);
  if (!allowed) {
    send(ws, { type: "error", message: "コメント内容がモデレーションルールに一致したため送信できませんでした。" });
    return;
  }

  const message = await prisma.liveChatMessage.create({
    data: {
      liveSessionId: activeSession.id,
      userId: identity.userId,
      body: text,
    },
    include: { user: { select: { username: true, displayName: true } } },
  });

  broadcast(viewToken, { type: "chat", message: toChatPayload(message) });
}

async function handleLike(viewToken, stream, identity, ws) {
  if (!identity?.userId) {
    send(ws, { type: "error", message: "いいねするにはログインしてください。" });
    return;
  }

  const activeSession = stream.status === "LIVE" ? await getActiveSession(stream.id) : null;
  if (!activeSession) {
    return;
  }

  const existing = await prisma.liveLike.findUnique({
    where: { userId_liveSessionId: { userId: identity.userId, liveSessionId: activeSession.id } },
  });

  let liked;
  if (existing) {
    await prisma.$transaction([
      prisma.liveLike.delete({ where: { userId_liveSessionId: { userId: identity.userId, liveSessionId: activeSession.id } } }),
      prisma.liveSession.update({ where: { id: activeSession.id }, data: { likeCount: { decrement: 1 } } }),
    ]);
    liked = false;
  } else {
    await prisma.$transaction([
      prisma.liveLike.create({ data: { userId: identity.userId, liveSessionId: activeSession.id } }),
      prisma.liveSession.update({ where: { id: activeSession.id }, data: { likeCount: { increment: 1 } } }),
    ]);
    liked = true;
  }

  const updated = await prisma.liveSession.findUnique({ where: { id: activeSession.id }, select: { likeCount: true } });
  send(ws, { type: "like_state", liked });
  broadcast(viewToken, { type: "like_count", count: updated?.likeCount ?? 0 });
}

async function sweepOfflineStreams() {
  try {
    const graceSeconds = await getOfflineGraceSeconds();
    const threshold = new Date(Date.now() - graceSeconds * 1000);

    const stale = await prisma.liveStream.findMany({
      where: { status: "LIVE", disconnectedAt: { not: null, lt: threshold } },
      select: { id: true, viewToken: true },
    });

    for (const stream of stale) {
      await prisma.$transaction(async (tx) => {
        await tx.liveStream.update({ where: { id: stream.id }, data: { status: "OFFLINE" } });
        await tx.liveSession.updateMany({
          where: { liveStreamId: stream.id, endedAt: null },
          data: { endedAt: new Date() },
        });
      });

      broadcast(stream.viewToken, { type: "live_state", live: false });
      await unregisterViewRelay(stream.viewToken);
    }
  } catch (error) {
    console.error("offline sweep failed", error);
  }
}

setInterval(() => void sweepOfflineStreams(), sweepIntervalMs);

server.listen(port, host, () => {
  console.log(`Clipshare live chat server listening on ${host}:${port}`);
});
