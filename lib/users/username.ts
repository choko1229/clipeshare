import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";

export function normalizeUsername(input: string) {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 24);
}

export async function generateUniqueUsername(input: string) {
  const base = normalizeUsername(input) || "player";

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = attempt === 0 ? "" : `_${Math.random().toString(36).slice(2, 7)}`;
    const username = `${base}${suffix}`.slice(0, 30);
    const existing = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!existing) {
      return username;
    }
  }

  return `player_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

export function isValidUsername(input: string) {
  return /^[a-z0-9_]{3,30}$/.test(input);
}
