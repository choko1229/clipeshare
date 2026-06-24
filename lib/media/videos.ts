import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { mediaPaths } from "@/lib/media/paths";

const allowedVideoTypes = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "video/x-msvideo",
]);

export type StoredVideo = {
  originalPath: string;
  size: number;
};

type StoreOriginalVideoOptions = {
  maxVideoSizeBytes: number;
};

export async function storeOriginalVideo(file: File, publicId: string, options: StoreOriginalVideoOptions): Promise<StoredVideo> {
  if (!allowedVideoTypes.has(file.type)) {
    throw new Error("対応していない動画形式です。mp4, mov, webm, mkv, aviを選択してください。");
  }

  if (file.size > options.maxVideoSizeBytes) {
    throw new Error("動画サイズがアカウントの上限を超えています。");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const contentHash = crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  const originalDir = path.join(mediaPaths.originalRoot, "videos");
  await mkdir(originalDir, { recursive: true });

  const originalPath = path.join(originalDir, `${publicId}-${contentHash}.${extensionFromMime(file.type)}`);
  await writeFile(originalPath, bytes, { flag: "wx" });

  return {
    originalPath,
    size: file.size,
  };
}

function extensionFromMime(mime: string) {
  switch (mime) {
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
      return "bin";
  }
}
