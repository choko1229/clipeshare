import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderServiceWorkerScript } from "@/lib/pwa/service-worker-script";

export const dynamic = "force-dynamic";

let cachedScript: string | null = null;

// next build が書き出すビルドIDはデプロイごとに変わる。プロセスの寿命中は不変なので一度だけ読む。
async function readBuildId() {
  try {
    return (await readFile(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8")).trim();
  } catch {
    return "development";
  }
}

export async function GET() {
  cachedScript ??= renderServiceWorkerScript(await readBuildId());

  return new Response(cachedScript, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Service Workerの更新確認を確実にネットワークへ向かわせる。
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
