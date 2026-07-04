export type MediaKind = "CLIP" | "SCREENSHOT";

const imageExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
const videoExtensions = new Set(["mp4", "mov", "webm", "mkv", "avi"]);

type FileLike = {
  name: string;
  type?: string;
};

export function detectMediaKind(file: FileLike): MediaKind | null {
  if (file.type?.startsWith("video/")) {
    return "CLIP";
  }

  if (file.type?.startsWith("image/")) {
    return "SCREENSHOT";
  }

  const extension = file.name.split(".").pop()?.toLowerCase();

  if (!extension) {
    return null;
  }

  if (videoExtensions.has(extension)) {
    return "CLIP";
  }

  if (imageExtensions.has(extension)) {
    return "SCREENSHOT";
  }

  return null;
}

export function isSupportedMediaFile(file: FileLike) {
  return detectMediaKind(file) !== null;
}
