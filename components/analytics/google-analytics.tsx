import Script from "next/script";

const SAFE_MEASUREMENT_ID = /^[A-Za-z0-9_-]+$/;

export function GoogleAnalytics({ measurementId }: { measurementId: string | null }) {
  if (!measurementId || !SAFE_MEASUREMENT_ID.test(measurementId)) {
    return null;
  }

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  );
}
