"use client";

import Hls from "hls.js";
import { Play, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type LivePlayerProps = {
  src: string;
};

const RECONNECT_DELAY_MS = 4000;

export function LivePlayer({ src }: LivePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (!Hls.isSupported()) {
      // hls.js未対応(=実質Safariのみ)の場合だけネイティブ<video src>にフォールバックする。
      // 以前はcanPlayType()を先に見ていたが、近年のChromeがHLSに対して"maybe"を返す
      // (実際には正しく再生できない)ようになり、誤ってこちらの分岐に入って真っ黒のまま
      // 何も再生されない不具合があった。hls.js対応ブラウザでは常にhls.js(MSE)を使う。
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
      }
      return;
    }

    let hls: Hls | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    function setup() {
      // liveSyncDurationCountを既定(3)から広げ、ライブエッジからのバッファ余裕を増やす。
      // セグメントの揺らぎやネットワークの一瞬の遅延でもすぐバッファ枯渇=カクつきに
      // 直結していたため、多少レイテンシーが伸びても安定性を優先する。
      hls = new Hls({
        liveSyncDurationCount: 6,
        liveMaxLatencyDurationCount: 10,
        // MediaMTXのHLSはCookie(hlsSession)でmuxerの読み取りセッションを維持している。
        // 視聴ページ(clipshare.link)と配信サーバー(live.clipshare.link)は別オリジンなので、
        // withCredentialsを明示しないとブラウザがCookieを送らずセッションが維持できず、
        // 何度リクエストしても再生が始まらない(黒画面のまま)状態になっていた。
        // サーバー側もAccess-Control-Allow-Originをワイルドカードではなく本番オリジンに固定し、
        // Access-Control-Allow-Credentials: trueを返す必要がある(docs/vps-deployment.md参照)。
        xhrSetup: (xhr) => {
          xhr.withCredentials = true;
        },
      });
      hls.loadSource(src);
      hls.attachMedia(video!);

      // 以前はエラーハンドリングが無く、fatalエラー発生時にhls.jsが自動復旧を試みず
      // 再生がそのまま止まっていた。hls.js公式推奨の復旧パターンに加え、復旧不能な
      // fatalエラーの場合はインスタンスを作り直して再接続を試みる。
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) {
          return;
        }

        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls?.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls?.recoverMediaError();
            break;
          default:
            hls?.destroy();
            hls = null;
            if (!stopped) {
              reconnectTimer = setTimeout(setup, RECONNECT_DELAY_MS);
            }
        }
      });
    }

    setup();

    return () => {
      stopped = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      hls?.destroy();
    };
  }, [src]);

  async function togglePlay() {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (video.paused) {
      await video.play();
    } else {
      video.pause();
    }
  }

  return (
    <div className="group relative aspect-video overflow-hidden rounded-md border border-border bg-black">
      <video
        autoPlay
        className="h-full w-full object-contain"
        muted={isMuted}
        onClick={() => void togglePlay()}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        playsInline
        ref={videoRef}
      />
      {!isPlaying ? (
        <button
          aria-label="再生"
          className="absolute inset-0 grid place-items-center bg-black/40"
          onClick={() => void togglePlay()}
          type="button"
        >
          <span className="grid size-16 place-items-center rounded-full bg-black/55 text-white backdrop-blur">
            <Play className="ml-1" size={30} />
          </span>
        </button>
      ) : null}
      <button
        aria-label={isMuted ? "ミュート解除" : "ミュート"}
        className="absolute bottom-3 right-3 z-10 grid size-9 place-items-center rounded-md bg-black/55 text-white opacity-0 transition group-hover:opacity-100"
        onClick={() => setIsMuted((current) => !current)}
        type="button"
      >
        {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>
    </div>
  );
}
