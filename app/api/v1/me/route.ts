import { apiJson, apiRoute } from "@/lib/api/handler";
import { enforceApiRateLimit } from "@/lib/api/rate-limits";
import { authenticateApiRequest } from "@/lib/api-auth/authenticate";
import { displayNameOf } from "@/lib/api-auth/authorization";
import { getApiLimits } from "@/lib/quick-share/api-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute("/api/v1/me", async (request, context) => {
  const auth = await authenticateApiRequest(request, context);
  await enforceApiRateLimit(auth.kind === "token" ? { kind: "token", tokenId: auth.tokenId } : { kind: "anonymous", ipHash: auth.ipHash });

  if (auth.kind === "anonymous") {
    const limits = await getApiLimits({ kind: "anonymous", ipHash: auth.ipHash });
    return apiJson({ authenticated: false, user: null, limits }, 200, context);
  }

  const limits = await getApiLimits({ kind: "token", userId: auth.user.id });
  return apiJson(
    {
      authenticated: true,
      user: { id: auth.user.id, name: displayNameOf(auth.user) },
      limits,
    },
    200,
    context,
  );
});
