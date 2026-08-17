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
  // RTSPの既定ポートは554だが、MediaMTXはrtspAddress: :8554で待ち受けている
  // (mediamtx.yml.example参照)ため、ポート番号を省略するとVLC/VRChatが554へ
  // 接続しようとして失敗する。
  return `rtsp://${liveMediaHost()}:8554/live/${viewToken}`;
}

export function vrchatMpegTsUrl(viewToken: string) {
  return `https://${liveMediaHost()}/ts/${viewToken}`;
}
