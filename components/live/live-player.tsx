"use client";

import Hls from "hls.js";
import { Play, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type LivePlayerProps = {
  src: string;
};

export function LivePlayer({ src }: LivePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

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

    const hls = new Hls({ liveSyncDurationCount: 3 });
    hls.loadSource(src);
    hls.attachMedia(video);

    return () => {
      hls.destroy();
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
