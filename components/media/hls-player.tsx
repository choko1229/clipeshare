"use client";

import { useEffect, useRef } from "react";
import Hls from "hls.js";

type HlsPlayerProps = {
  src: string;
  poster?: string;
  title: string;
};

export function HlsPlayer({ src, poster, title }: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }

    if (!Hls.isSupported()) {
      return;
    }

    const hls = new Hls();
    hls.loadSource(src);
    hls.attachMedia(video);

    return () => {
      hls.destroy();
    };
  }, [src]);

  return (
    <video
      className="h-full w-full bg-black object-contain"
      controls
      playsInline
      poster={poster}
      preload="metadata"
      ref={videoRef}
      title={title}
    />
  );
}
