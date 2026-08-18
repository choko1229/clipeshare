#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const port = Number(process.env.LIVE_MPEGTS_SERVER_PORT ?? 8082);
// Nginxの/ts/リバースプロキシ経由でのみアクセスされる想定なのでループバックのみに束縛する。
const host = process.env.LIVE_MPEGTS_SERVER_HOST ?? "127.0.0.1";
// ffmpegの再エンコードはCPU負荷が高いため、同時に走らせる本数を制限する(1配信=1プロセス、視聴者数によらず共有)。
const maxConcurrent = Number(process.env.LIVE_MPEGTS_MAX_CONCURRENT ?? 2);
// 最後の視聴者が切断してからこの時間だけ待ってffmpegを止める(直後の再接続での再スポーン連打を避ける)。
const idleGraceMs = Number(process.env.LIVE_MPEGTS_IDLE_GRACE_MS ?? 15_000);
const settingsRefreshMs = 30_000;

/** @type {Map<string, { proc: import("node:child_process").ChildProcess, clients: Set<import("node:http").ServerResponse>, idleTimer: NodeJS.Timeout | null }>} */
const relays = new Map();

let cachedBitrates = { videoKbps: 2_000, audioKbps: 320 };
let cachedBitratesAt = 0;

async function getVrchatBitrates() {
  const now = Date.now();
  if (now - cachedBitratesAt < settingsRefreshMs) {
    return cachedBitrates;
  }

  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: ["live_vrchat_video_bitrate_kbps_max", "live_vrchat_audio_bitrate_kbps_max"] } },
    select: { key: true, value: true },
  });
  const map = new Map(rows.map((row) => [row.key, row.value]));

  const video = Number.parseInt(map.get("live_vrchat_video_bitrate_kbps_max") ?? "", 10);
  const audio = Number.parseInt(map.get("live_vrchat_audio_bitrate_kbps_max") ?? "", 10);

  cachedBitrates = {
    videoKbps: Number.isSafeInteger(video) && video > 0 ? video : 2_000,
    audioKbps: Number.isSafeInteger(audio) && audio > 0 ? audio : 320,
  };
  cachedBitratesAt = now;
  return cachedBitrates;
}

function createRelay(viewToken, videoKbps, audioKbps) {
  const args = [
    "-loglevel",
    "warning",
    // ソースはMediaMTXの視聴用パス(live/{viewToken})。ストリームキーではなくviewTokenで引くため
    // 秘匿情報はこのプロセスにも一切渡らない。configが未反映/OBS未接続だと即座に接続失敗するので、
    // 無限に待たせないようタイムアウトを付ける(マイクロ秒指定)。
    "-rw_timeout",
    "5000000",
    "-rtsp_transport",
    "tcp",
    "-i",
    `rtsp://127.0.0.1:8554/live/${viewToken}`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-tune",
    "zerolatency",
    "-profile:v",
    "main",
    "-b:v",
    `${videoKbps}k`,
    "-maxrate",
    `${videoKbps}k`,
    "-bufsize",
    `${videoKbps * 2}k`,
    "-g",
    "60",
    "-c:a",
    "aac",
    "-b:a",
    `${audioKbps}k`,
    "-ar",
    "48000",
    "-f",
    "mpegts",
    "-mpegts_flags",
    "+resend_headers",
    "-muxdelay",
    "0",
    "-flush_packets",
    "1",
    "pipe:1",
  ];

  const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });

  /** @type {{ proc: import("node:child_process").ChildProcess, clients: Set<import("node:http").ServerResponse>, idleTimer: NodeJS.Timeout | null }} */
  const relay = { proc, clients: new Set(), idleTimer: null };

  proc.stdout.on("data", (chunk) => {
    for (const client of relay.clients) {
      if (!client.writableEnded) {
        client.write(chunk);
      }
    }
  });

  proc.stderr.on("data", (chunk) => {
    console.error(`[mpegts-relay ${viewToken}] ${chunk.toString().trim()}`);
  });

  proc.on("error", (error) => {
    console.error(`[mpegts-relay ${viewToken}] spawn failed`, error);
  });

  proc.on("exit", (code, signal) => {
    console.log(`[mpegts-relay ${viewToken}] ffmpeg exited (code=${code}, signal=${signal})`);
    for (const client of relay.clients) {
      client.end();
    }
    relay.clients.clear();
    if (relay.idleTimer) {
      clearTimeout(relay.idleTimer);
    }
    relays.delete(viewToken);
  });

  return relay;
}

function scheduleIdleKill(viewToken, relay) {
  if (relay.idleTimer) {
    clearTimeout(relay.idleTimer);
  }
  relay.idleTimer = setTimeout(() => {
    if (relay.clients.size === 0) {
      relay.proc.kill("SIGTERM");
    }
  }, idleGraceMs);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "", "http://internal");
  const viewToken = url.pathname.replace(/^\/+/, "");

  if (!viewToken) {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("clipshare live mpegts relay\n");
    return;
  }

  let stream;
  try {
    stream = await prisma.liveStream.findUnique({ where: { viewToken }, select: { status: true } });
  } catch (error) {
    console.error("live stream lookup failed", error);
    response.writeHead(500, { "content-type": "text/plain" });
    response.end("internal error\n");
    return;
  }

  if (!stream || stream.status !== "LIVE") {
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("offline\n");
    return;
  }

  let relay = relays.get(viewToken);
  if (!relay) {
    if (relays.size >= maxConcurrent) {
      response.writeHead(503, { "content-type": "text/plain" });
      response.end("relay capacity exceeded\n");
      return;
    }
    const { videoKbps, audioKbps } = await getVrchatBitrates();
    relay = createRelay(viewToken, videoKbps, audioKbps);
    relays.set(viewToken, relay);
  } else if (relay.idleTimer) {
    clearTimeout(relay.idleTimer);
    relay.idleTimer = null;
  }

  response.writeHead(200, {
    "content-type": "video/mp2t",
    "cache-control": "no-cache, no-store",
    connection: "keep-alive",
  });
  relay.clients.add(response);

  request.on("close", () => {
    relay.clients.delete(response);
    if (relay.clients.size === 0) {
      scheduleIdleKill(viewToken, relay);
    }
  });
});

server.listen(port, host, () => {
  console.log(`Clipshare live MPEG-TS relay listening on ${host}:${port}`);
});
