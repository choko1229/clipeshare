import { ApiError } from "@/lib/api/errors";
import { apiJson, apiNoContent, apiRoute, parseClientVersion } from "@/lib/api/handler";
import { enforceApiRateLimit } from "@/lib/api/rate-limits";
import { readJsonBody } from "@/lib/api/request-body";
import { requireApiToken } from "@/lib/api-auth/authenticate";
import { exchangeAuthorizationCode } from "@/lib/api-auth/authorization";
import { tokenExchangeSchema } from "@/lib/api-auth/authorize-params";
import { revokeOwnApiToken } from "@/lib/api-auth/tokens";
import { computeClientIpHash } from "@/lib/quick-share/ip-hash";
import { getApiLimits } from "@/lib/quick-share/api-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiRoute("/api/v1/auth/token", async (request, context) => {
  const ipHash = computeClientIpHash(request.headers);
  context.logFields.ipHash = ipHash;
  await enforceApiRateLimit({ kind: "anonymous", ipHash });

  const body = await readJsonBody(request, 4096);
  const parsed = tokenExchangeSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError("INVALID_REQUEST", { reason: "invalid_token_request" });
  }

  const result = await exchangeAuthorizationCode({
    code: parsed.data.code,
    codeVerifier: parsed.data.code_verifier,
    redirectUri: parsed.data.redirect_uri,
    ipHash,
    clientVersion: parseClientVersion(request.headers.get("user-agent")),
    requestId: context.requestId,
  });

  context.logFields.userId = result.user.id;
  context.logFields.tokenId = result.tokenId;

  const limits = await getApiLimits({ kind: "token", userId: result.user.id });

  return apiJson(
    {
      token: result.token,
      tokenId: result.tokenId,
      tokenType: "Bearer",
      user: result.user,
      limits,
    },
    200,
    context,
  );
});

export const DELETE = apiRoute("/api/v1/auth/token", async (request, context) => {
  const auth = await requireApiToken(request, context);
  await enforceApiRateLimit({ kind: "token", tokenId: auth.tokenId });
  await revokeOwnApiToken(auth.tokenId, auth.user.id, "SELF");
  return apiNoContent(context);
});
