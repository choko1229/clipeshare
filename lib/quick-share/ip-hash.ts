import crypto from "node:crypto";
import { headers } from "next/headers";

type HeaderReader = Pick<Headers, "get">;

/** 現行のクイック共有と同じ IP ハッシュ方式(Web/API 共通) */
export function computeClientIpHash(headerList: HeaderReader) {
  const forwardedFor = headerList.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || headerList.get("x-real-ip") || "unknown";
  const salt = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "clipeshare-quick-share";

  return crypto.createHash("sha256").update(`${ip}:${salt}`).digest("hex");
}

export async function getClientIpHash() {
  return computeClientIpHash(await headers());
}
