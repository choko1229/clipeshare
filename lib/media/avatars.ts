import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { mediaPaths } from "@/lib/media/paths";

const allowedAvatarTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxAvatarSizeBytes = 2_000_000;

export async function storeAvatarImage(file: File, userId: string) {
  if (!allowedAvatarTypes.has(file.type)) {
    throw new Error("アイコン画像は jpg, png, webp を選択してください。");
  }

  if (file.size > maxAvatarSizeBytes) {
    throw new Error("アイコン画像は2MB以内にしてください。");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const avatarDir = path.join(mediaPaths.processedRoot, "avatars");
  await mkdir(avatarDir, { recursive: true });

  const avatarPath = path.join(avatarDir, `${userId}.webp`);
  await sharp(bytes, { failOn: "none" })
    .rotate()
    .resize({
      width: 512,
      height: 512,
      fit: "cover",
      position: "attention",
    })
    .webp({ quality: 86 })
    .toFile(avatarPath);

  return `/media/avatars/${userId}.webp?v=${Date.now()}`;
}
