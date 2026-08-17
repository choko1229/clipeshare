import crypto from "node:crypto";

type ChatTokenPayload = {
  sub: string;
  name: string;
  role?: string;
  exp: number;
};

function secret() {
  const value = process.env.LIVE_CHAT_TOKEN_SECRET;

  if (!value) {
    throw new Error("LIVE_CHAT_TOKEN_SECRET が設定されていません。");
  }

  return value;
}

export function signChatToken(payload: Omit<ChatTokenPayload, "exp">, ttlSeconds = 60) {
  const full: ChatTokenPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const body = Buffer.from(JSON.stringify(full)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}
