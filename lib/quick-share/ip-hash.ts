import crypto from "node:crypto";
import { headers } from "next/headers";

export async function getClientIpHash() {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || headerList.get("x-real-ip") || "unknown";
  const salt = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "clipeshare-quick-share";

  return crypto.createHash("sha256").update(`${ip}:${salt}`).digest("hex");
}
