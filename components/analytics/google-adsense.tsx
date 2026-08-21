import Script from "next/script";

const SAFE_CLIENT_ID = /^ca-pub-\d+$/;

export function GoogleAdsense({ clientId }: { clientId: string | null }) {
  if (!clientId || !SAFE_CLIENT_ID.test(clientId)) {
    return null;
  }

  return (
    <Script
      async
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
      strategy="afterInteractive"
    />
  );
}
