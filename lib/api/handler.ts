import crypto from "node:crypto";
import { ApiError, apiErrorBody, isApiError } from "@/lib/api/errors";
import { describeError, logApi, type ApiLogFields } from "@/lib/api/log";

export type ApiRequestContext = {
  requestId: string;
  /** 完了ログに載せる項目(userId / tokenId / ipHash など)。秘密情報は入れない */
  logFields: Partial<ApiLogFields>;
};

type RouteContext<P> = {
  params: Promise<P>;
};

const baseHeaders: Record<string, string> = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export function apiJson(body: unknown, status: number, context: ApiRequestContext, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...baseHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "X-Request-Id": context.requestId,
      ...extraHeaders,
    },
  });
}

export function apiNoContent(context: ApiRequestContext) {
  return new Response(null, {
    status: 204,
    headers: {
      ...baseHeaders,
      "X-Request-Id": context.requestId,
    },
  });
}

/**
 * `/api/v1/*` 共通のラッパー。リクエストID付与、統一エラー形式、完了ログ(所要時間・結果コード)を担う。
 * 想定外の例外は 500 INTERNAL にし、内部情報は応答に含めない。
 */
export function apiRoute<P = Record<string, never>>(
  route: string,
  handler: (request: Request, context: ApiRequestContext, params: P) => Promise<Response>,
) {
  return async (request: Request, routeContext: RouteContext<P>) => {
    const startedAt = performance.now();
    const context: ApiRequestContext = {
      requestId: crypto.randomUUID(),
      logFields: {},
    };

    let response: Response;
    let errorCode: string | undefined;
    let reason: string | undefined;
    let level: "info" | "warn" | "error" = "info";

    try {
      const params = await routeContext.params;
      response = await handler(request, context, params);
    } catch (error) {
      const apiError = isApiError(error) ? error : new ApiError("INTERNAL");

      if (!isApiError(error)) {
        level = "error";
        reason = describeError(error);
      } else {
        level = apiError.status >= 500 ? "error" : "warn";
        reason = apiError.reason;
      }

      errorCode = apiError.code;
      response = apiJson(apiErrorBody(apiError), apiError.status, context, apiError.headers);
    }

    logApi(level, {
      event: "api.request",
      requestId: context.requestId,
      route,
      method: request.method,
      status: response.status,
      code: errorCode,
      durationMs: Math.round(performance.now() - startedAt),
      reason,
      ...context.logFields,
    });

    return response;
  };
}

export function parseClientVersion(userAgent: string | null) {
  const match = userAgent?.match(/^ClipshareQuick\/([0-9A-Za-z.+-]{1,32})(?:\s|$)/);
  return match?.[1] ?? null;
}
