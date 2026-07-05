import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { mediaPaths } from "@/lib/media/paths";

const allowedAvatarTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxAvatarSizeBytes = 2_000_000;
const maxProfileImageSizeBytes = 5_000_000;

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

export async function storeProfileHeaderImage(file: File, userId: string) {
  return storeProfileDecorImage(file, userId, {
    directory: "profile-headers",
    height: 512,
    maxSizeBytes: maxProfileImageSizeBytes,
    width: 1536,
  });
}

export async function storeProfileBackgroundImage(file: File, userId: string) {
  return storeProfileDecorImage(file, userId, {
    directory: "profile-backgrounds",
    height: 1080,
    maxSizeBytes: maxProfileImageSizeBytes,
    width: 1920,
  });
}

async function storeProfileDecorImage(
  file: File,
  userId: string,
  options: {
    directory: string;
    height: number;
    maxSizeBytes: number;
    width: number;
  },
) {
  if (!allowedAvatarTypes.has(file.type)) {
    throw new Error("プロフィール画像は jpg, png, webp を選択してください。");
  }

  if (file.size > options.maxSizeBytes) {
    throw new Error("プロフィール画像は5MB以内にしてください。");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const imageDir = path.join(mediaPaths.processedRoot, options.directory);
  await mkdir(imageDir, { recursive: true });

  const imagePath = path.join(imageDir, `${userId}.webp`);
  await sharp(bytes, { failOn: "none" })
    .rotate()
    .resize({
      width: options.width,
      height: options.height,
      fit: "cover",
      position: "attention",
    })
    .webp({ quality: 86 })
    .toFile(imagePath);

  return `/media/${options.directory}/${userId}.webp?v=${Date.now()}`;
}
