import sharp from "sharp";

/** 位置情報(GPS)・カメラ名入りの EXIF と回転指定(orientation=6)を持つ JPEG */
export async function jpegWithGpsExif(width = 300, height = 200) {
  return sharp({ create: { width, height, channels: 3, background: "#33cc66" } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .withExifMerge({
      IFD0: { Make: "SecretCam", Model: "LeakModel" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "35/1 41/1 22/1", GPSLongitudeRef: "E", GPSLongitude: "139/1 41/1 30/1" },
    })
    .toBuffer();
}

export async function plainPng(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: "#123456" } })
    .png()
    .toBuffer();
}

/** マジックバイトだけ本物の MP4(ftyp isom)。中身は変換されないので検証用で十分 */
export function fakeMp4(totalBytes = 1024) {
  const bytes = Buffer.alloc(totalBytes);
  bytes.writeUInt32BE(24, 0);
  bytes.write("ftypisom", 4, "ascii");
  bytes.write("isomiso2", 16, "ascii");
  return bytes;
}

export function fakeWebm(totalBytes = 256) {
  const bytes = Buffer.alloc(totalBytes);
  Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0x82, 0x84]).copy(bytes, 0);
  bytes.write("webm", 12, "ascii");
  return bytes;
}

export function multipartRequest(
  url: string,
  parts: { file?: { bytes: Buffer; name: string; type?: string }; quality?: string; extraFiles?: number },
  headers: Record<string, string> = {},
) {
  const form = new FormData();

  if (parts.file) {
    form.append("file", new Blob([new Uint8Array(parts.file.bytes)], { type: parts.file.type ?? "" }), parts.file.name);
  }

  for (let i = 0; i < (parts.extraFiles ?? 0); i += 1) {
    form.append("file", new Blob([new Uint8Array(parts.file?.bytes ?? Buffer.alloc(10))]), `extra${i}.png`);
  }

  if (parts.quality !== undefined) {
    form.append("quality", parts.quality);
  }

  return new Request(url, { method: "POST", body: form, headers });
}
