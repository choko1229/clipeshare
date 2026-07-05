import { ZodError } from "zod";
import { isRedirectError } from "next/dist/client/components/redirect-error";

export function rethrowRedirectError(error: unknown) {
  if (isRedirectError(error)) {
    throw error;
  }
}

export function actionErrorMessage(error: unknown, fallback = "処理に失敗しました。入力内容を確認してください。") {
  rethrowRedirectError(error);

  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}

export function errorRedirectUrl(path: string, error: unknown) {
  const url = new URL(path, "http://localhost");
  url.searchParams.set("error", actionErrorMessage(error));
  return `${url.pathname}${url.search}`;
}

export function searchParamError(value: string | undefined) {
  if (!value) {
    return null;
  }

  return value.slice(0, 500);
}
