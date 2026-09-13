import { getSeoSettings } from "@/lib/seo/settings";

export const dynamic = "force-dynamic";

const SAFE_CLIENT_ID = /^ca-pub-\d+$/;

// AdSenseの認証局ID(全パブリッシャー共通の固定値)。
const GOOGLE_CERTIFICATION_AUTHORITY_ID = "f08c47fec0942fa0";

export async function GET() {
  const { adsenseClientId } = await getSeoSettings();

  if (!adsenseClientId || !SAFE_CLIENT_ID.test(adsenseClientId)) {
    return new Response("Not Found", { status: 404 });
  }

  const publisherId = adsenseClientId.replace(/^ca-/, "");

  return new Response(`google.com, ${publisherId}, DIRECT, ${GOOGLE_CERTIFICATION_AUTHORITY_ID}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
