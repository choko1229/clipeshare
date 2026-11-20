import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { fakeMp4, fakeWebm, jpegWithGpsExif, multipartRequest, plainPng } from "./helpers/media";

const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "clipshare-media-"));

vi.mock("@/lib/media/paths", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/media/paths")>();
  const nodePath = await import("node:path");
  const root = process.env.CLIPSHARE_TEST_MEDIA_ROOT ?? "";
  return {
    ...original,
    mediaPaths: {
      ...original.mediaPaths,
      processedRoot: nodePath.join(root, "processed"),
      quickShareRoot: nodePath.join(root, "processed", "quick"),
      quickShareOriginalRoot: nodePath.join(root, "originals", "quick"),
    },
  };
});
process.env.CLIPSHARE_TEST_MEDIA_ROOT = tmpRoot;

const { sniffMedia } = await import("@/lib/media/magic-bytes");
const { renderQuickShareApiImage, storeQuickShareImage } = await import("@/lib/media/quick-share");
const { receiveQuickShareUpload } = await import("@/lib/quick-share/api-multipart");

const incoming = path.join(tmpRoot, "incoming");

beforeAll(async () => {
  await rm(incoming, { recursive: true, force: true });
});

afterAll(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

async function writeInput(name: string, bytes: Buffer) {
  const filePath = path.join(tmpRoot, name);
  await writeFile(filePath, bytes);
  return filePath;
}

describe("magic byte sniffing", () => {
  it("detects every supported format", async () => {
    expect(sniffMedia(await jpegWithGpsExif())?.format).toBe("jpeg");
    expect(sniffMedia(await plainPng(4, 4))?.format).toBe("png");
    expect(sniffMedia(await sharp({ create: { width: 4, height: 4, channels: 3, background: "#000" } }).webp().toBuffer())?.format).toBe("webp");
    expect(sniffMedia(fakeMp4())?.format).toBe("mp4");
    const mov = fakeMp4();
    mov.write("qt  ", 8, "ascii");
    expect(sniffMedia(mov)?.format).toBe("mov");
    expect(sniffMedia(fakeWebm())?.format).toBe("webm");
    const mkv = fakeWebm();
    mkv.write("matroska", 12, "ascii");
    expect(sniffMedia(mkv)?.format).toBe("mkv");
    const avi = Buffer.alloc(32);
    avi.write("RIFF", 0, "ascii");
    avi.write("AVI ", 8, "ascii");
    expect(sniffMedia(avi)?.format).toBe("avi");
  });

  it.each([
    ["text", Buffer.from("just some text pretending to be a video file......")],
    ["gif", Buffer.from("GIF89a..........")],
    ["exe", Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00])],
    ["heic", Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypheic")])],
    ["riff wav", Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVE")])],
    ["empty", Buffer.alloc(0)],
  ])("rejects %s", (_label, bytes) => {
    expect(sniffMedia(bytes)).toBeNull();
  });
});

describe("sharp metadata removal and orientation (verified with a real GPS EXIF sample)", () => {
  it("the sample really contains GPS EXIF and orientation 6", async () => {
    const metadata = await sharp(await jpegWithGpsExif()).metadata();
    expect(metadata.orientation).toBe(6);
    expect(metadata.exif?.includes(Buffer.from("SecretCam"))).toBe(true);
    // GPS IFD ポインタ(タグ 0x8825)が入っている
    const exif = metadata.exif ?? Buffer.alloc(0);
    expect(exif.includes(Buffer.from([0x88, 0x25])) || exif.includes(Buffer.from([0x25, 0x88]))).toBe(true);
  });

  it.each([
    ["original", false],
    ["original", true],
    ["shrink", false],
    ["shrink", true],
  ] as const)("strips EXIF/XMP/ICC and applies rotation (%s, banner=%s)", async (quality, banner) => {
    const input = await writeInput(`exif-${quality}-${banner}.jpg`, await jpegWithGpsExif(300, 200));
    const stored = await renderQuickShareApiImage(input, `exif${quality}${banner ? 1 : 0}`, { quality, banner });
    const metadata = await sharp(stored.filePath).metadata();

    expect(metadata.format).toBe("webp");
    expect(metadata.exif).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
    // 回転補正後は縦長(200x300)
    expect(metadata.width).toBe(200);
    if (banner) {
      expect(metadata.height).toBeGreaterThan(300);
    } else {
      expect(metadata.height).toBe(300);
    }
  });

  it("shrink keeps the long edge at 2000px; original keeps the full size", async () => {
    const input = await writeInput("big.png", await plainPng(4000, 3000));
    const shrink = await renderQuickShareApiImage(input, "big-shrink", { quality: "shrink", banner: false });
    const original = await renderQuickShareApiImage(input, "big-original", { quality: "original", banner: false });
    expect([shrink.width, shrink.height]).toEqual([2000, 1500]);
    expect([original.width, original.height]).toEqual([4000, 3000]);
  });

  it("anonymous original gets a full-width banner below the image", async () => {
    const input = await writeInput("banner.png", await plainPng(6000, 1000));
    const stored = await renderQuickShareApiImage(input, "banner-original", { quality: "original", banner: true });
    expect(stored.width).toBe(6000);
    expect(stored.height).toBeGreaterThan(1000);
    // バナー部分は透明ではない(幅いっぱいに合成されている)
    const corner = await sharp(stored.filePath).extract({ left: 5990, top: stored.height - 3, width: 1, height: 1 }).raw().toBuffer();
    expect(corner[3] ?? 255).toBeGreaterThan(0);
  });

  it("keeps the web (/qick) output unchanged: 2000px wide with the banner", async () => {
    const bytes = await plainPng(4000, 3000);
    const file = new File([new Uint8Array(bytes)], "web.png", { type: "image/png" });
    const stored = await storeQuickShareImage(file, "web-output", { maxImageSizeBytes: 50_000_000 });
    expect(stored.width).toBe(2000);
    // 本体 2000x1500 + バナー(4167x134 を幅2000に縮小 = 高さ64)
    expect(stored.height).toBe(1500 + 64);
  });

  it("produces byte-identical web output to the pre-change pipeline", async () => {
    const bytes = await jpegWithGpsExif(1200, 900);
    const file = new File([new Uint8Array(bytes)], "same.jpg", { type: "image/jpeg" });
    const stored = await storeQuickShareImage(file, "web-same", { maxImageSizeBytes: 50_000_000 });
    const actual = await readFile(path.join(tmpRoot, "processed", "quick", "images", "web-same.webp"));

    // 変更前の storeQuickShareImage の処理をそのまま再現した参照実装
    const bannerPath = path.join(process.cwd(), "public", "images", "quick-share-ad-banner.png");
    const resizedMain = await sharp(bytes, { failOn: "none" })
      .rotate()
      .resize({ width: 2000, height: 2000 - 65, fit: "inside", withoutEnlargement: true })
      .toBuffer();
    const mainMeta = await sharp(resizedMain).metadata();
    const banner = await sharp(bannerPath).resize({ width: mainMeta.width ?? 2000, withoutEnlargement: true }).toBuffer();
    const bannerMeta = await sharp(banner).metadata();
    const expected = await sharp({
      create: {
        width: mainMeta.width ?? 2000,
        height: (mainMeta.height ?? 0) + (bannerMeta.height ?? 0),
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        { input: resizedMain, left: 0, top: 0 },
        { input: banner, left: 0, top: mainMeta.height ?? 0 },
      ])
      .webp({ quality: 88 })
      .toBuffer();

    expect(stored.width).toBe(900);
    expect(actual.equals(expected)).toBe(true);
  });

  it("rejects images above the pixel limit without decoding them", async () => {
    // 20000 x 6000 = 1.2億画素(ヘッダだけで判定される)
    const input = await writeInput("huge.png", await plainPng(20000, 6000));
    await expect(renderQuickShareApiImage(input, "huge", { quality: "shrink", banner: false })).rejects.toMatchObject({
      name: "QuickShareImagePixelLimitError",
    });
  });
});

describe("streaming multipart receiver", () => {
  const limits = { imageMaxBytes: 2_000, videoMaxBytes: 4_000 };

  async function receive(request: Request, custom = limits) {
    return receiveQuickShareUpload(request, { limits: custom, tempDir: incoming });
  }

  async function errorOf(promise: Promise<unknown>) {
    try {
      await promise;
    } catch (error) {
      return error as { code: string; status: number; details?: Record<string, unknown> };
    }
    throw new Error("expected failure");
  }

  async function incomingFiles() {
    return readdir(incoming).catch(() => []);
  }

  const url = "https://clipshare.link/api/v1/quick";

  it("accepts a file of exactly the limit and reports the quality", async () => {
    const bytes = fakeMp4(4_000);
    const received = await receive(multipartRequest(url, { file: { bytes, name: "clip.mp4", type: "video/mp4" }, quality: "original" }));
    expect(received).toMatchObject({ sizeBytes: 4_000, quality: "original", media: { kind: "VIDEO", format: "mp4" } });
    await rm(received.tempPath, { force: true });
  });

  it("rejects limit + 1 byte with 413, the limit and the kind, and leaves no temp file", async () => {
    const error = await errorOf(receive(multipartRequest(url, { file: { bytes: fakeMp4(4_001), name: "clip.mp4" } })));
    expect(error.code).toBe("SIZE_LIMIT_EXCEEDED");
    expect(error.status).toBe(413);
    expect(error.details).toEqual({ limitBytes: 4_000, kind: "VIDEO" });
    expect(await incomingFiles()).toEqual([]);
  });

  it("applies the image limit to images", async () => {
    const png = await plainPng(200, 200);
    const error = await errorOf(receive(multipartRequest(url, { file: { bytes: png, name: "a.png" } }), { imageMaxBytes: png.length - 1, videoMaxBytes: 0 }));
    expect(error.details).toEqual({ limitBytes: png.length - 1, kind: "IMAGE" });
  });

  it("treats 0 as unlimited", async () => {
    const received = await receive(multipartRequest(url, { file: { bytes: fakeMp4(50_000), name: "clip.mp4" } }), { imageMaxBytes: 0, videoMaxBytes: 0 });
    expect(received.sizeBytes).toBe(50_000);
    await rm(received.tempPath, { force: true });
  });

  it("defaults quality to shrink", async () => {
    const received = await receive(multipartRequest(url, { file: { bytes: await plainPng(10, 10), name: "a.png" } }));
    expect(received.quality).toBe("shrink");
    await rm(received.tempPath, { force: true });
  });

  it("rejects a disguised file (video extension, image bytes is fine to detect; text bytes are not)", async () => {
    const error = await errorOf(receive(multipartRequest(url, { file: { bytes: Buffer.from("x".repeat(500)), name: "fake.mp4", type: "video/mp4" } })));
    expect(error.code).toBe("UNSUPPORTED_MEDIA");
    expect(await incomingFiles()).toEqual([]);
  });

  it("rejects a kind mismatch between the extension and the bytes", async () => {
    const png = await plainPng(10, 10);
    const error = await errorOf(receive(multipartRequest(url, { file: { bytes: png, name: "photo.mp4", type: "video/mp4" } })));
    expect(error.code).toBe("UNSUPPORTED_MEDIA");
  });

  it("accepts an unknown extension when the bytes are a supported format", async () => {
    const received = await receive(multipartRequest(url, { file: { bytes: await plainPng(10, 10), name: "VRChat_photo", type: "application/octet-stream" } }));
    expect(received.media.format).toBe("png");
    await rm(received.tempPath, { force: true });
  });

  it.each([
    ["missing file", { quality: "shrink" }],
    ["invalid quality", { file: { bytes: Buffer.alloc(0), name: "a.png" }, quality: "best" }],
    ["empty file", { file: { bytes: Buffer.alloc(0), name: "a.png" } }],
  ])("rejects %s with 400", async (_label, parts) => {
    const error = await errorOf(receive(multipartRequest(url, parts as Parameters<typeof multipartRequest>[1])));
    expect(error.code).toBe("INVALID_REQUEST");
  });

  it("rejects more than one file", async () => {
    const error = await errorOf(receive(multipartRequest(url, { file: { bytes: await plainPng(10, 10), name: "a.png" }, extraFiles: 1 })));
    expect(error.code).toBe("INVALID_REQUEST");
  });

  it("rejects a non-multipart body", async () => {
    const error = await errorOf(receive(new Request(url, { method: "POST", body: "{}", headers: { "content-type": "application/json" } })));
    expect(error.code).toBe("INVALID_REQUEST");
  });

  it("receives a large file without holding it in memory (streams to disk)", async () => {
    const big = fakeMp4(30 * 1024 * 1024);
    const before = process.memoryUsage().arrayBuffers;
    const received = await receive(multipartRequest(url, { file: { bytes: big, name: "big.mp4" } }), { imageMaxBytes: 0, videoMaxBytes: 0 });
    expect(received.sizeBytes).toBe(big.length);
    // リクエスト本体(30MB)とは別に、受信側でさらに全体を保持していないこと
    expect(process.memoryUsage().arrayBuffers - before).toBeLessThan(60 * 1024 * 1024);
    await rm(received.tempPath, { force: true });
  });
});
