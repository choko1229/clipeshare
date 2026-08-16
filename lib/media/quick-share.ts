import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { mediaPaths } from "@/lib/media/paths";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedVideoTypes = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "video/x-msvideo",
]);

export type StoredQuickShareMedia = {
  mediaUrl: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
};

type StoreQuickShareImageOptions = {
  maxImageSizeBytes: number;
};

type StoreQuickShareVideoOptions = {
  maxVideoSizeBytes: number;
};

export async function storeQuickShareImage(
  file: File,
  publicId: string,
  options: StoreQuickShareImageOptions,
): Promise<StoredQuickShareMedia> {
  if (!isAllowedImage(file)) {
    throw new Error("対応していない画像形式です。jpg, png, webpを選択してください。");
  }

  if (file.size > options.maxImageSizeBytes) {
    throw new Error("画像サイズが上限を超えています。");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const dir = path.join(mediaPaths.quickShareRoot, "images");
  await mkdir(dir, { recursive: true });

  const fileName = `${publicId}.webp`;
  const filePath = path.join(dir, fileName);

  const image = sharp(bytes, { failOn: "none" }).rotate();
  const metadata = await image.metadata();

  await image
    .resize({
      width: 3840,
      height: 2160,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 88 })
    .toFile(filePath);

  return {
    mediaUrl: `/media/quick/images/${fileName}`,
    mimeType: "image/webp",
    size: file.size,
    width: metadata.width ?? null,
    height: metadata.height ?? null,
  };
}

export async function storeQuickShareVideo(
  file: File,
  publicId: string,
  options: StoreQuickShareVideoOptions,
): Promise<StoredQuickShareMedia> {
  if (!isAllowedVideo(file)) {
    throw new Error("対応していない動画形式です。mp4, mov, webm, mkv, aviを選択してください。");
  }

  if (file.size > options.maxVideoSizeBytes) {
    throw new Error("動画サイズが上限を超えています。");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const extension = extensionFromFile(file);
  const dir = path.join(mediaPaths.quickShareRoot, "videos");
  await mkdir(dir, { recursive: true });

  const fileName = `${publicId}.${extension}`;
  const filePath = path.join(dir, fileName);
  await writeFile(filePath, bytes, { flag: "wx" });

  return {
    mediaUrl: `/media/quick/videos/${fileName}`,
    mimeType: file.type || mimeFromExtension(extension),
    size: file.size,
    width: null,
    height: null,
  };
}

function isAllowedImage(file: File) {
  return allowedImageTypes.has(file.type) || ["jpg", "jpeg", "png", "webp"].includes(extensionFromName(file.name));
}

function isAllowedVideo(file: File) {
  return allowedVideoTypes.has(file.type) || ["mp4", "mov", "webm", "mkv", "avi"].includes(extensionFromName(file.name));
}

function extensionFromFile(file: File) {
  const extension = extensionFromName(file.name);

  switch (file.type) {
    case "video/mp4":
      return "mp4";
    case "video/quicktime":
      return "mov";
    case "video/webm":
      return "webm";
    case "video/x-matroska":
      return "mkv";
    case "video/x-msvideo":
      return "avi";
    default:
      return extension || "bin";
  }
}

function mimeFromExtension(extension: string) {
  switch (extension) {
    case "mp4":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "webm":
      return "video/webm";
    case "mkv":
      return "video/x-matroska";
    case "avi":
      return "video/x-msvideo";
    default:
      return "application/octet-stream";
  }
}

function extensionFromName(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}
