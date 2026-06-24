import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { mediaPaths } from "@/lib/media/paths";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export type StoredImage = {
  originalPath: string;
  processedPath: string;
  thumbnailPath: string;
  mediaUrl: string;
  thumbnailUrl: string;
  width: number | null;
  height: number | null;
  size: number;
};

type StoreScreenshotImageOptions = {
  maxImageSizeBytes: number;
};

export async function storeScreenshotImage(file: File, publicId: string, options: StoreScreenshotImageOptions): Promise<StoredImage> {
  if (!allowedImageTypes.has(file.type)) {
    throw new Error("対応していない画像形式です。jpg, png, webpを選択してください。");
  }

  if (file.size > options.maxImageSizeBytes) {
    throw new Error("画像サイズがアカウントの上限を超えています。");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const contentHash = crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  const extension = extensionFromMime(file.type);

  const originalDir = path.join(mediaPaths.originalRoot, "images");
  const processedDir = path.join(mediaPaths.processedRoot, "images");
  const thumbnailDir = path.join(mediaPaths.processedRoot, "thumbnails");

  await Promise.all([mkdir(originalDir, { recursive: true }), mkdir(processedDir, { recursive: true }), mkdir(thumbnailDir, { recursive: true })]);

  const originalPath = path.join(originalDir, `${publicId}-${contentHash}.${extension}`);
  const processedPath = path.join(processedDir, `${publicId}.webp`);
  const thumbnailPath = path.join(thumbnailDir, `${publicId}.webp`);

  await writeFile(originalPath, bytes, { flag: "wx" });

  const image = sharp(bytes, { failOn: "none" }).rotate();
  const metadata = await image.metadata();

  await image
    .clone()
    .resize({
      width: 3840,
      height: 2160,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 88 })
    .toFile(processedPath);

  await image
    .clone()
    .resize({
      width: 1280,
      height: 720,
      fit: "cover",
      position: "attention",
    })
    .webp({ quality: 82 })
    .toFile(thumbnailPath);

  return {
    originalPath,
    processedPath,
    thumbnailPath,
    mediaUrl: `/media/images/${publicId}.webp`,
    thumbnailUrl: `/media/thumbnails/${publicId}.webp`,
    width: metadata.width ?? null,
    height: metadata.height ?? null,
    size: file.size,
  };
}

function extensionFromMime(mime: string) {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}
