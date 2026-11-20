export type SniffedMedia = {
  kind: "IMAGE" | "VIDEO";
  format: "jpeg" | "png" | "webp" | "mp4" | "mov" | "webm" | "mkv" | "avi";
  mimeType: string;
  extension: string;
};

/** 判定に必要な先頭バイト数 */
export const SNIFF_BYTES = 64;

const formats: Record<SniffedMedia["format"], Omit<SniffedMedia, "format">> = {
  jpeg: { kind: "IMAGE", mimeType: "image/jpeg", extension: "jpg" },
  png: { kind: "IMAGE", mimeType: "image/png", extension: "png" },
  webp: { kind: "IMAGE", mimeType: "image/webp", extension: "webp" },
  mp4: { kind: "VIDEO", mimeType: "video/mp4", extension: "mp4" },
  mov: { kind: "VIDEO", mimeType: "video/quicktime", extension: "mov" },
  webm: { kind: "VIDEO", mimeType: "video/webm", extension: "webm" },
  mkv: { kind: "VIDEO", mimeType: "video/x-matroska", extension: "mkv" },
  avi: { kind: "VIDEO", mimeType: "video/x-msvideo", extension: "avi" },
};

function ascii(bytes: Uint8Array, start: number, length: number) {
  if (bytes.length < start + length) {
    return "";
  }

  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
}

function result(format: SniffedMedia["format"]): SniffedMedia {
  return { format, ...formats[format] };
}

/**
 * 先頭バイトからファイル形式を判定する。対応形式(現行のクイック共有と同じ: jpg/png/webp/mp4/mov/webm/mkv/avi)
 * 以外、または判定できない場合は null。拡張子や Content-Type は見ない。
 */
export function sniffMedia(bytes: Uint8Array): SniffedMedia | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return result("jpeg");
  }

  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return result("png");
  }

  if (ascii(bytes, 0, 4) === "RIFF") {
    const type = ascii(bytes, 8, 4);
    if (type === "WEBP") {
      return result("webp");
    }
    if (type === "AVI ") {
      return result("avi");
    }
    return null;
  }

  // ISO BMFF (MP4 / MOV): [size:4]["ftyp"][major brand:4]
  if (ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4);
    // 画像系の ftyp(HEIC/AVIF)は対応外
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1", "avif", "avis"].includes(brand)) {
      return null;
    }
    return result(brand === "qt  " ? "mov" : "mp4");
  }

  // ftyp を持たない古い QuickTime
  if (["moov", "mdat", "wide", "free", "skip", "pnot"].includes(ascii(bytes, 4, 4))) {
    return result("mov");
  }

  // EBML (WebM / Matroska)。DocType は先頭付近にある
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) {
    const head = ascii(bytes, 0, Math.min(bytes.length, SNIFF_BYTES));
    if (head.includes("webm")) {
      return result("webm");
    }
    if (head.includes("matroska")) {
      return result("mkv");
    }
    return null;
  }

  return null;
}
