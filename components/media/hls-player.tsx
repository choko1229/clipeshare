"use client";

import { Maximize2, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { cn } from "@/lib/utils";

type HlsPlayerProps = {
  src: string;
  poster?: string;
  title: string;
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${rest}`;
}

export function HlsPlayer({ src, poster, title }: HlsPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.85);

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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.volume = volume;
    video.muted = isMuted;
  }, [isMuted, volume]);

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

  function seek(value: number) {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.currentTime = value;
    setCurrentTime(value);
  }

  async function enterFullscreen() {
    if (containerRef.current?.requestFullscreen) {
      await containerRef.current.requestFullscreen();
    }
  }

  return (
    <div className="group relative h-full bg-black" ref={containerRef}>
      <button aria-label={isPlaying ? "一時停止" : "再生"} className="absolute inset-0 z-10 cursor-pointer" onClick={() => void togglePlay()} type="button" />
      <video
        className="h-full w-full bg-black object-contain"
        onClick={() => void togglePlay()}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        playsInline
        poster={poster}
        preload="metadata"
        ref={videoRef}
        title={title}
      />

      {!isPlaying ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="grid size-20 place-items-center rounded-full bg-black/55 text-white backdrop-blur">
            <Play className="ml-1" size={34} />
          </div>
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-4 text-white opacity-100 transition group-hover:opacity-100">
        <input
          aria-label="再生位置"
          className="h-1 w-full accent-white"
          max={duration || 0}
          min={0}
          onChange={(event) => seek(Number(event.currentTarget.value))}
          step="0.1"
          type="range"
          value={Math.min(currentTime, duration || currentTime)}
        />
        <div className="mt-3 flex items-center gap-3">
          <PlayerButton label={isPlaying ? "一時停止" : "再生"} onClick={() => void togglePlay()}>
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </PlayerButton>
          <PlayerButton label="先頭へ戻る" onClick={() => seek(0)}>
            <RotateCcw size={18} />
          </PlayerButton>
          <span className="min-w-24 text-xs tabular-nums text-white/85">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <PlayerButton label={isMuted ? "ミュート解除" : "ミュート"} onClick={() => setIsMuted((current) => !current)}>
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </PlayerButton>
            <input
              aria-label="音量"
              className={cn("hidden h-1 w-24 accent-white sm:block", isMuted ? "opacity-45" : null)}
              max={1}
              min={0}
              onChange={(event) => {
                const next = Number(event.currentTarget.value);
                setVolume(next);
                setIsMuted(next === 0);
              }}
              step="0.01"
              type="range"
              value={isMuted ? 0 : volume}
            />
            <PlayerButton label="全画面" onClick={() => void enterFullscreen()}>
              <Maximize2 size={18} />
            </PlayerButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      className="relative z-30 inline-flex size-9 items-center justify-center rounded-md bg-white/10 text-white transition hover:bg-white/20"
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
