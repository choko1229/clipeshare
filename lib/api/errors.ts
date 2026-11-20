export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "SIZE_LIMIT_EXCEEDED"
  | "UNSUPPORTED_MEDIA"
  | "DAILY_LIMIT_EXCEEDED"
  | "RATE_LIMITED"
  | "INTERNAL"
  | "SERVICE_UNAVAILABLE";

export type ApiErrorDetails = Record<string, string | number | boolean | null>;

const defaultMessages: Record<ApiErrorCode, string> = {
  INVALID_REQUEST: "リクエストの内容が正しくありません。",
  UNAUTHORIZED: "認証に失敗しました。もう一度連携してください。",
  FORBIDDEN: "この操作は許可されていません。",
  NOT_FOUND: "対象が見つかりません。",
  SIZE_LIMIT_EXCEEDED: "ファイルサイズが上限を超えています。",
  UNSUPPORTED_MEDIA: "対応していないファイル形式です。",
  DAILY_LIMIT_EXCEEDED: "本日のアップロード上限に達しています。",
  RATE_LIMITED: "リクエストが多すぎます。しばらく待ってから再試行してください。",
  INTERNAL: "サーバーでエラーが発生しました。",
  SERVICE_UNAVAILABLE: "現在このサービスは利用できません。",
};

const statusByCode: Record<ApiErrorCode, number> = {
  INVALID_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SIZE_LIMIT_EXCEEDED: 413,
  UNSUPPORTED_MEDIA: 415,
  DAILY_LIMIT_EXCEEDED: 429,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  SERVICE_UNAVAILABLE: 503,
};

type ApiErrorOptions = {
  message?: string;
  details?: ApiErrorDetails;
  headers?: Record<string, string>;
  /** ログ用の理由(応答には含めない)。トークンやファイル内容を入れないこと */
  reason?: string;
};

/**
 * `/api/v1/*` が返す統一エラー。message はクライアントにそのまま見せてよい日本語のみ。
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details: ApiErrorDetails | undefined;
  readonly headers: Record<string, string>;
  readonly reason: string | undefined;

  constructor(code: ApiErrorCode, options: ApiErrorOptions = {}) {
    super(options.message ?? defaultMessages[code]);
    this.name = "ApiError";
    this.code = code;
    this.status = statusByCode[code];
    this.details = options.details;
    this.headers = options.headers ?? {};
    this.reason = options.reason;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function apiErrorBody(error: ApiError) {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  };
}
