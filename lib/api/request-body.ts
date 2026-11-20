import { ApiError } from "@/lib/api/errors";

/** JSON 本文を上限付きで読む。Content-Type が JSON でない・壊れている・大きすぎる場合は 400 */
export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!/^application\/json(\s*;|$)/i.test(contentType)) {
    throw new ApiError("INVALID_REQUEST", { message: "Content-Type は application/json にしてください。", reason: "not_json" });
  }

  const declaredLength = Number.parseInt(request.headers.get("content-length") ?? "", 10);

  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ApiError("INVALID_REQUEST", { reason: "json_too_large" });
  }

  if (!request.body) {
    throw new ApiError("INVALID_REQUEST", { reason: "empty_body" });
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    total += value.byteLength;

    if (total > maxBytes) {
      await reader.cancel();
      throw new ApiError("INVALID_REQUEST", { reason: "json_too_large" });
    }

    chunks.push(value);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new ApiError("INVALID_REQUEST", { reason: "invalid_json" });
  }
}
