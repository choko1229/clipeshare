import crypto from "node:crypto";
import { createWriteStream, type WriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import busboy from "busboy";
import { ApiError } from "@/lib/api/errors";
import { SNIFF_BYTES, sniffMedia, type SniffedMedia } from "@/lib/media/magic-bytes";
import { exceedsSizeLimit, type QuickShareSizeLimits } from "@/lib/quick-share/limits";
import { detectMediaKind } from "@/lib/uploads/file-kind";

export type QuickShareQuality = "original" | "shrink";

export type ReceivedUpload = {
  tempPath: string;
  sizeBytes: number;
  media: SniffedMedia;
  quality: QuickShareQuality;
};

type ReceiveOptions = {
  limits: QuickShareSizeLimits;
  tempDir: string;
};

/**
 * multipart/form-data をストリームで受け取り、一時ファイルに書く(全文をメモリに載せない)。
 * - 先頭バイトで形式を判定(拡張子・Content-Type は信用しない。種別が食い違えば 415)
 * - 種別ごとの上限を受信中に強制し、超えた時点で中断して 413
 * - `file` は1個だけ、`quality` は original|shrink
 */
export async function receiveQuickShareUpload(request: Request, options: ReceiveOptions): Promise<ReceivedUpload> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!/^multipart\/form-data\s*;/i.test(contentType) || !request.body) {
    throw new ApiError("INVALID_REQUEST", { message: "multipart/form-data で送信してください。", reason: "not_multipart" });
  }

  await mkdir(options.tempDir, { recursive: true });
  const tempPath = path.join(options.tempDir, `${crypto.randomUUID()}.upload`);

  let parser: busboy.Busboy;

  try {
    parser = busboy({
      headers: { "content-type": contentType },
      limits: { files: 1, fields: 4, parts: 6, fieldNameSize: 32, fieldSize: 64 },
    });
  } catch {
    throw new ApiError("INVALID_REQUEST", { message: "multipart/form-data で送信してください。", reason: "bad_multipart_header" });
  }

  const source = Readable.fromWeb(request.body as unknown as NodeWebReadableStream<Uint8Array>);

  return new Promise<ReceivedUpload>((resolve, reject) => {
    let settled = false;
    let fileSeen = false;
    let fileDone = false;
    let parserDone = false;
    let quality: QuickShareQuality = "shrink";
    let media: SniffedMedia | null = null;
    let sizeBytes = 0;
    let output: WriteStream | null = null;

    const fail = (error: ApiError) => {
      if (settled) return;
      settled = true;
      source.unpipe(parser);
      source.destroy();

      // 書き込み中の一時ファイルを閉じてから消す(Windows では開いたままだと消せない)
      const removeTemp = () => {
        void rm(tempPath, { force: true })
          .catch(() => undefined)
          .finally(() => reject(error));
      };

      if (output && !output.closed) {
        output.once("close", removeTemp);
        output.destroy();
      } else {
        removeTemp();
      }
    };

    const finishIfReady = () => {
      if (settled || !parserDone || (fileSeen && !fileDone)) return;

      if (!fileSeen || !media) {
        fail(new ApiError("INVALID_REQUEST", { message: "ファイルを指定してください。", reason: "missing_file" }));
        return;
      }

      if (sizeBytes === 0) {
        fail(new ApiError("INVALID_REQUEST", { message: "ファイルが空です。", reason: "empty_file" }));
        return;
      }

      settled = true;
      resolve({ tempPath, sizeBytes, media, quality });
    };

    parser.on("field", (name, value, info) => {
      if (name === "file") {
        // ファイル名の無いパートは busboy がフィールドとして扱う
        fail(new ApiError("INVALID_REQUEST", { message: "file はファイル名付きのファイルとして送信してください。", reason: "file_without_filename" }));
        return;
      }

      if (info.valueTruncated || info.nameTruncated) {
        fail(new ApiError("INVALID_REQUEST", { reason: "field_truncated" }));
        return;
      }

      if (name === "quality") {
        if (value !== "original" && value !== "shrink") {
          fail(new ApiError("INVALID_REQUEST", { message: "quality は original か shrink を指定してください。", reason: "invalid_quality" }));
          return;
        }
        quality = value;
      }
    });

    parser.on("file", (name, stream, info) => {
      if (settled) {
        stream.resume();
        return;
      }

      if (name !== "file") {
        stream.resume();
        fail(new ApiError("INVALID_REQUEST", { message: "ファイルは file で送信してください。", reason: "unexpected_file_field" }));
        return;
      }

      fileSeen = true;
      const declaredKind = detectMediaKind({ name: info.filename ?? "", type: info.mimeType });
      const head: Buffer[] = [];
      let headLength = 0;
      let limitBytes = 0;

      const out = createWriteStream(tempPath, { flags: "wx" });
      output = out;
      out.on("error", () => fail(new ApiError("INTERNAL", { reason: "temp_write_failed" })));

      const decide = () => {
        const sniffed = sniffMedia(Buffer.concat(head));

        if (!sniffed) {
          fail(new ApiError("UNSUPPORTED_MEDIA", { message: "対応している画像(jpg/png/webp)または動画(mp4/mov/webm/mkv/avi)を選択してください。", reason: "unknown_magic" }));
          return false;
        }

        const sniffedKind = sniffed.kind === "IMAGE" ? "SCREENSHOT" : "CLIP";

        if (declaredKind !== null && declaredKind !== sniffedKind) {
          fail(new ApiError("UNSUPPORTED_MEDIA", { message: "ファイルの中身と拡張子が一致しません。", reason: "magic_mismatch" }));
          return false;
        }

        media = sniffed;
        limitBytes = sniffed.kind === "IMAGE" ? options.limits.imageMaxBytes : options.limits.videoMaxBytes;
        return true;
      };

      const write = (chunk: Buffer) => {
        sizeBytes += chunk.length;

        if (media && exceedsSizeLimit(sizeBytes, limitBytes)) {
          fail(
            new ApiError("SIZE_LIMIT_EXCEEDED", {
              message: media.kind === "IMAGE" ? "画像サイズが上限を超えています。" : "動画サイズが上限を超えています。",
              details: { limitBytes, kind: media.kind },
              reason: "size_limit",
            }),
          );
          stream.resume();
          return;
        }

        if (!out.write(chunk)) {
          stream.pause();
          out.once("drain", () => stream.resume());
        }
      };

      stream.on("data", (chunk: Buffer) => {
        if (settled) return;

        if (!media) {
          head.push(chunk);
          headLength += chunk.length;

          if (headLength < SNIFF_BYTES) return;
          if (!decide()) {
            stream.resume();
            return;
          }

          const buffered = Buffer.concat(head);
          head.length = 0;
          write(buffered);
          return;
        }

        write(chunk);
      });

      stream.on("end", () => {
        if (settled) return;

        if (!media) {
          if (headLength === 0) {
            fail(new ApiError("INVALID_REQUEST", { message: "ファイルが空です。", reason: "empty_file" }));
            return;
          }

          if (!decide()) return;
          write(Buffer.concat(head));
          if (settled) return;
        }

        // 'finish' ではなく 'close'(ファイル記述子を閉じた後)で完了にする。直後に rename するため
        out.once("close", () => {
          fileDone = true;
          finishIfReady();
        });
        out.end();
      });

      stream.on("error", () => fail(new ApiError("INVALID_REQUEST", { reason: "file_stream_error" })));
    });

    parser.on("filesLimit", () => fail(new ApiError("INVALID_REQUEST", { message: "ファイルは1個だけ送信してください。", reason: "too_many_files" })));
    parser.on("fieldsLimit", () => fail(new ApiError("INVALID_REQUEST", { reason: "too_many_fields" })));
    parser.on("partsLimit", () => fail(new ApiError("INVALID_REQUEST", { reason: "too_many_parts" })));
    parser.on("error", () => fail(new ApiError("INVALID_REQUEST", { message: "送信データを読み取れませんでした。", reason: "multipart_parse_error" })));
    parser.on("close", () => {
      parserDone = true;
      finishIfReady();
    });

    source.on("error", () => fail(new ApiError("INVALID_REQUEST", { message: "送信が途中で切れました。", reason: "request_aborted" })));
    source.pipe(parser);
  });
}

export async function discardTempUpload(tempPath: string) {
  await rm(tempPath, { force: true });
}
