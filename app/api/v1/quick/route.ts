import { apiJson, apiRoute } from "@/lib/api/handler";
import { enforceApiRateLimit } from "@/lib/api/rate-limits";
import { authenticateApiRequest } from "@/lib/api-auth/authenticate";
import { createQuickShareFromApi } from "@/lib/quick-share/api-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiRoute("/api/v1/quick", async (request, context) => {
  const auth = await authenticateApiRequest(request, context);
  await enforceApiRateLimit(auth.kind === "token" ? { kind: "token", tokenId: auth.tokenId } : { kind: "anonymous", ipHash: auth.ipHash });

  const created = await createQuickShareFromApi(request, auth, context.requestId);
  return apiJson(created, 201, context, { Location: created.url });
});
