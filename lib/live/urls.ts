function liveMediaHost() {
  return process.env.LIVE_MEDIA_DOMAIN ?? "live.clipshare.link";
}

export function rtmpIngestUrl() {
  return `rtmp://${liveMediaHost()}/live`;
}

export function webViewUrl(viewToken: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return new URL(`/l/${viewToken}`, appUrl).toString();
}

export function vrchatRtspUrl(viewToken: string) {
  return `rtsp://${liveMediaHost()}/live/${viewToken}`;
}

export function vrchatMpegTsUrl(viewToken: string) {
  return `https://${liveMediaHost()}/ts/${viewToken}`;
}
