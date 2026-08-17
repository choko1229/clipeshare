import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";

export async function serveMediaFile(request: Request, filePath: string) {
  try {
    const fileStat = await stat(filePath);
    const range = request.headers.get("range");
    const type = contentTypeFromPath(filePath);

    if (range) {
      const parsedRange = parseRange(range, fileStat.size);

      if (!parsedRange) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            "Accept-Ranges": "bytes",
            "Content-Range": `bytes */${fileStat.size}`,
          },
        });
      }

      const stream = createReadStream(filePath, {
        start: parsedRange.start,
        end: parsedRange.end,
      });
      const contentLength = parsedRange.end - parsedRange.start + 1;

      return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
        status: 206,
        headers: {
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=31536000, immutable",
          "Content-Length": String(contentLength),
          "Content-Range": `bytes ${parsedRange.start}-${parsedRange.end}/${fileStat.size}`,
          "Content-Type": type,
        },
      });
    }

    const file = await readFile(filePath);
    return new NextResponse(file, {
      headers: {
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(file.length),
        "Content-Type": type,
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

export function contentTypeFromPath(filePath: string) {
  if (filePath.endsWith(".webp")) {
    return "image/webp";
  }
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (filePath.endsWith(".png")) {
    return "image/png";
  }
  if (filePath.endsWith(".m3u8")) {
    return "application/vnd.apple.mpegurl";
  }
  if (filePath.endsWith(".ts")) {
    return "video/mp2t";
  }
  if (filePath.endsWith(".mp4")) {
    return "video/mp4";
  }
  if (filePath.endsWith(".webm")) {
    return "video/webm";
  }
  if (filePath.endsWith(".mov")) {
    return "video/quicktime";
  }
  if (filePath.endsWith(".mkv")) {
    return "video/x-matroska";
  }
  if (filePath.endsWith(".avi")) {
    return "video/x-msvideo";
  }
  return "application/octet-stream";
}

function parseRange(rangeHeader: string, fileSize: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);

  if (!match) {
    return null;
  }

  const [, rawStart, rawEnd] = match;

  if (!rawStart && !rawEnd) {
    return null;
  }

  let start: number;
  let end: number;

  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) {
      return null;
    }
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Number(rawEnd) : fileSize - 1;
  }

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= fileSize) {
    return null;
  }

  return {
    start,
    end: Math.min(end, fileSize - 1),
  };
}
