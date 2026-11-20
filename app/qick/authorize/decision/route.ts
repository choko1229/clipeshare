import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { logApi } from "@/lib/api/log";
import { decideAuthorization } from "@/lib/api-auth/authorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FORM_BYTES = 4096;

/**
 * 認可画面の「許可する」「キャンセル」(通常のフォーム POST)。
 * CSRF 対策: 要求ごとの CSRF トークン(ハッシュ照合)＋ セッションの本人確認 ＋ Origin / Sec-Fetch-Site の確認。
 * 失敗時は redirect_uri には戻さず、無効画面へ 303。
 */
export async function POST(request: Request) {
  const invalid = () => redirectTo(request, "/qick/authorize");

  if (!isSameOriginRequest(request)) {
    logApi("warn", { event: "api_auth.decision_rejected", reason: "cross_origin" });
    return invalid();
  }

  const declaredLength = Number.parseInt(request.headers.get("content-length") ?? "", 10);

  if (Number.isFinite(declaredLength) && declaredLength > MAX_FORM_BYTES) {
    return invalid();
  }

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return redirectTo(request, "/login");
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return invalid();
  }

  const authorizationId = form.get("authorization_id");
  const csrfToken = form.get("csrf_token");
  const decision = form.get("decision");

  if (
    typeof authorizationId !== "string" ||
    typeof csrfToken !== "string" ||
    authorizationId.length > 64 ||
    csrfToken.length > 64 ||
    (decision !== "approve" && decision !== "deny")
  ) {
    return invalid();
  }

  try {
    const result = await decideAuthorization({
      authorizationId,
      csrfToken,
      userId: session.user.id,
      approve: decision === "approve",
    });

    if (result.kind === "invalid") {
      logApi("warn", { event: "api_auth.decision_invalid", userId: session.user.id, reason: result.reason });
      return invalid();
    }

    logApi("info", { event: "api_auth.decision", userId: session.user.id, reason: decision });
    // ループバック(http://127.0.0.1:{port}/…)へ。redirect_uri は保存時に検証済み
    return new Response(null, {
      status: 303,
      headers: {
        Location: result.location,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    logApi("error", {
      event: "api_auth.decision_failed",
      userId: session.user.id,
      reason: error instanceof Error ? error.name : "unknown",
    });
    return invalid();
  }
}

function appOrigin(request: Request) {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL ?? request.url).origin;
  } catch {
    return new URL(request.url).origin;
  }
}

function isSameOriginRequest(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");

  if (fetchSite && fetchSite !== "same-origin") {
    return false;
  }

  const origin = request.headers.get("origin");

  if (origin === null) {
    // Origin を送らない古いブラウザは CSRF トークン + SameSite=Lax の Cookie で守る
    return true;
  }

  return origin === appOrigin(request) || origin === new URL(request.url).origin;
}

function redirectTo(request: Request, path: string) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL(path, appOrigin(request)).toString(),
      "Cache-Control": "no-store",
    },
  });
}
