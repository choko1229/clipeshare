import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type SharpOptions } from "sharp";
import { mediaPaths } from "@/lib/media/paths";
import { exceedsSizeLimit } from "@/lib/quick-share/limits";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const adBannerPath = path.join(process.cwd(), "public", "images", "quick-share-ad-banner.png");
const adBannerMaxHeight = 65;
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
  /** 0 = 無制限 */
  maxImageSizeBytes: number;
};

type StoreQuickShareVideoOptions = {
  /** 0 = 無制限 */
  maxVideoSizeBytes: number;
};

export type StoredQuickShareVideoOriginal = {
  mimeType: string;
  originalPath: string;
  size: number;
};

export async function storeQuickShareImage(
  file: File,
  publicId: string,
  options: StoreQuickShareImageOptions,
): Promise<StoredQuickShareMedia> {
  if (!isAllowedImage(file)) {
    throw new Error("対応していない画像形式です。jpg, png, webpを選択してください。");
  }

  if (exceedsSizeLimit(file.size, options.maxImageSizeBytes)) {
    throw new Error("画像サイズが上限を超えています。");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const dir = path.join(mediaPaths.quickShareRoot, "images");
  await mkdir(dir, { recursive: true });

  const fileName = `${publicId}.webp`;
  const filePath = path.join(dir, fileName);

  const { width, height } = await renderShrinkWithBanner(bytes, filePath);

  return {
    mediaUrl: `/media/quick/images/${fileName}`,
    mimeType: "image/webp",
    size: file.size,
    width,
    height,
  };
}

/**
 * 現行の /qick と同じ処理: 回転補正 → 長辺2000px(バナー分を除く) → 下部にバナー合成 → WebP q88。
 * Web 経由の出力を変えないため、処理内容はこの関数に固定する。
 */
async function renderShrinkWithBanner(input: Buffer | string, filePath: string, sharpOptions: SharpOptions = { failOn: "none" }) {
  const image = sharp(input, sharpOptions).rotate();

  const resizedMain = await image
    .resize({
      width: 2000,
      height: 2000 - adBannerMaxHeight,
      fit: "inside",
      withoutEnlargement: true,
    })
    .toBuffer();
  const mainMetadata = await sharp(resizedMain).metadata();
  const mainWidth = mainMetadata.width ?? 2000;
  const mainHeight = mainMetadata.height ?? 0;

  const banner = await sharp(adBannerPath)
    .resize({ width: mainWidth, withoutEnlargement: true })
    .toBuffer();
  const bannerMetadata = await sharp(banner).metadata();
  const bannerHeight = bannerMetadata.height ?? 0;

  const width = mainWidth;
  const height = mainHeight + bannerHeight;

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: resizedMain, left: 0, top: 0 },
      { input: banner, left: 0, top: mainHeight },
    ])
    .webp({ quality: 88 })
    .toFile(filePath);

  return { width, height };
}

/** WebP の1辺の上限 */
const WEBP_MAX_DIMENSION = 16_383;
/** API 経由の画像のピクセル数上限(展開爆弾対策。8K = 約3,300万画素を十分に上回る) */
export const API_IMAGE_MAX_PIXELS = 100_000_000;

export type QuickShareImageVariant = {
  /** shrink = 長辺2000px(現行と同じ)、original = 寸法そのまま(WebP の上限を超える場合のみ縮小) */
  quality: "shrink" | "original";
  banner: boolean;
};

export class QuickShareImagePixelLimitError extends Error {
  constructor() {
    super("Image exceeds the pixel limit.");
    this.name = "QuickShareImagePixelLimitError";
  }
}

/**
 * API(Clipshare Quick)用の画像処理。入力はディスク上の一時ファイル(全体をメモリに読み込まない)。
 * EXIF・位置情報などのメタデータは付けない(sharp は withMetadata/keepMetadata を呼ばない限り出力に含めない)。
 */
export async function renderQuickShareApiImage(inputPath: string, publicId: string, variant: QuickShareImageVariant) {
  const sharpOptions: SharpOptions = { failOn: "none", limitInputPixels: API_IMAGE_MAX_PIXELS };
  const input = await sharp(inputPath, sharpOptions)
    .metadata()
    .catch((error: unknown) => {
      if (error instanceof Error && /pixel limit/i.test(error.message)) {
        throw new QuickShareImagePixelLimitError();
      }
      throw error;
    });

  if ((input.width ?? 0) * (input.height ?? 0) > API_IMAGE_MAX_PIXELS) {
    throw new QuickShareImagePixelLimitError();
  }

  const dir = path.join(mediaPaths.quickShareRoot, "images");
  await mkdir(dir, { recursive: true });

  const fileName = `${publicId}.webp`;
  const filePath = path.join(dir, fileName);

  try {
    let size: { width: number; height: number };

    if (variant.quality === "shrink" && variant.banner) {
      size = await renderShrinkWithBanner(inputPath, filePath, sharpOptions);
    } else if (variant.quality === "shrink") {
      const info = await sharp(inputPath, sharpOptions)
        .rotate()
        .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 88 })
        .toFile(filePath);
      size = { width: info.width, height: info.height };
    } else if (!variant.banner) {
      const info = await sharp(inputPath, sharpOptions)
        .rotate()
        .resize({ width: WEBP_MAX_DIMENSION, height: WEBP_MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 95 })
        .toFile(filePath);
      size = { width: info.width, height: info.height };
    } else {
      size = await renderOriginalWithBanner(inputPath, filePath, sharpOptions);
    }

    return {
      mediaUrl: `/media/quick/images/${fileName}`,
      filePath,
      mimeType: "image/webp",
      width: size.width,
      height: size.height,
    };
  } catch (error) {
    await rm(filePath, { force: true }).catch(() => undefined);
    throw error;
  }
}

/**
 * 匿名 + original: 寸法はそのまま、幅に合わせたバナーを下に合成する。
 * 中間バッファを作らず1本のパイプライン(rotate → resize → extend → composite)で処理する。
 */
async function renderOriginalWithBanner(inputPath: string, filePath: string, sharpOptions: SharpOptions) {
  const [metadata, bannerSource] = await Promise.all([sharp(inputPath, sharpOptions).metadata(), sharp(adBannerPath).metadata()]);
  const orientedWidth = metadata.autoOrient?.width ?? metadata.width ?? 0;
  const orientedHeight = metadata.autoOrient?.height ?? metadata.height ?? 0;

  if (orientedWidth <= 0 || orientedHeight <= 0) {
    throw new Error("Unable to read image dimensions.");
  }

  const bannerRatio = (bannerSource.height ?? 1) / (bannerSource.width ?? 1);
  const maxMainHeight = WEBP_MAX_DIMENSION - Math.ceil(WEBP_MAX_DIMENSION * bannerRatio);
  const scale = Math.min(1, WEBP_MAX_DIMENSION / orientedWidth, maxMainHeight / orientedHeight);
  // 縮小時は sharp の丸めと1px ずれても合成できるよう、バナー幅を1px 小さめにする
  const bannerWidth = scale < 1 ? Math.max(1, Math.floor(orientedWidth * scale) - 1) : orientedWidth;
  const banner = await sharp(adBannerPath).resize({ width: bannerWidth }).png().toBuffer({ resolveWithObject: true });

  const info = await sharp(inputPath, sharpOptions)
    .rotate()
    .resize({ width: WEBP_MAX_DIMENSION, height: maxMainHeight, fit: "inside", withoutEnlargement: true })
    .extend({ bottom: banner.info.height, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .composite([{ input: banner.data, gravity: "southwest" }])
    .webp({ quality: 95 })
    .toFile(filePath);

  return { width: info.width, height: info.height };
}

export async function storeQuickShareVideoOriginal(
  file: File,
  publicId: string,
  options: StoreQuickShareVideoOptions,
): Promise<StoredQuickShareVideoOriginal> {
  if (!isAllowedVideo(file)) {
    throw new Error("対応していない動画形式です。mp4, mov, webm, mkv, aviを選択してください。");
  }

  if (exceedsSizeLimit(file.size, options.maxVideoSizeBytes)) {
    throw new Error("動画サイズが上限を超えています。");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const extension = extensionFromFile(file);
  const dir = path.join(mediaPaths.quickShareOriginalRoot, "videos");
  await mkdir(dir, { recursive: true });

  const fileName = `${publicId}.${extension}`;
  const filePath = path.join(dir, fileName);
  await writeFile(filePath, bytes, { flag: "wx" });

  return {
    mimeType: file.type || mimeFromExtension(extension),
    originalPath: filePath,
    size: file.size,
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
