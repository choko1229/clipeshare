"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { takePendingPostFile } from "@/components/uploads/pending-post-file";
import { detectMediaKind } from "@/lib/uploads/file-kind";

const acceptTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "video/x-msvideo",
].join(",");

async function readVideoDuration(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = url;

    return await new Promise<number | null>((resolve) => {
      video.onloadedmetadata = () => resolve(Number.isFinite(video.duration) ? video.duration : null);
      video.onerror = () => resolve(null);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PostMediaInput() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [clipEnd, setClipEnd] = useState<number | "">("");
  const [clipStart, setClipStart] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [mediaLabel, setMediaLabel] = useState("ファイル選択後に自動判定します。");
  const [mediaKind, setMediaKind] = useState<"CLIP" | "SCREENSHOT" | null>(null);

  const updateMediaState = useCallback(async (file: File | null) => {
    const kind = file ? detectMediaKind(file) : null;
    setMediaKind(kind);
    setClipStart(0);
    setClipEnd("");
    setDurationSeconds(null);

    if (kind === "CLIP") {
      setMediaLabel("動画として投稿します。");
      if (!file) {
        return;
      }
      const duration = await readVideoDuration(file);
      setDurationSeconds(duration);
      setClipEnd(duration ? Math.floor(duration) : "");
      return;
    }

    if (kind === "SCREENSHOT") {
      setMediaLabel("スクリーンショットとして投稿します。");
      return;
    }

    setMediaLabel("対応している画像または動画ファイルを選択してください。");
  }, []);

  useEffect(() => {
    async function applyPendingFile() {
      const file = await takePendingPostFile();

      if (!file || !inputRef.current) {
        return;
      }

      const transfer = new DataTransfer();
      transfer.items.add(file);
      inputRef.current.files = transfer.files;
      void updateMediaState(file);
    }

    window.addEventListener("clipeshare:pending-post-file", applyPendingFile);
    void applyPendingFile();

    return () => {
      window.removeEventListener("clipeshare:pending-post-file", applyPendingFile);
    };
  }, [updateMediaState]);

  const clipEndValue = clipEnd === "" ? (durationSeconds ? Math.floor(durationSeconds) : "") : clipEnd;
  const clipDuration = typeof clipEndValue === "number" && clipEndValue > clipStart ? clipEndValue - clipStart : null;

  return (
    <div>
      <label className="block text-sm font-medium" htmlFor="media">
        メディアファイル
      </label>
      <input
        accept={acceptTypes}
        className="mt-2 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
        id="media"
        multiple
        name="media"
        onChange={(event) => void updateMediaState(event.currentTarget.files?.[0] ?? null)}
        ref={inputRef}
        required
        type="file"
      />
      <p className="mt-2 text-xs text-muted-foreground">{mediaLabel}</p>
      {mediaKind === "CLIP" ? (
        <div className="mt-3 rounded-md border border-border bg-background p-3 text-sm">
          <input name="clipStartSeconds" type="hidden" value={clipStart} />
          {typeof clipEndValue === "number" ? <input name="clipEndSeconds" type="hidden" value={clipEndValue} /> : null}
          <p className="font-medium">動画クリッピング</p>
          <p className="mt-1 text-xs text-muted-foreground">
            動画時間: {durationSeconds ? `${durationSeconds.toFixed(1)}秒` : "読み取り中"}。指定した範囲で変換します。
            {clipDuration ? ` 投稿される長さ: ${clipDuration.toFixed(1)}秒。` : ""}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs">
              開始秒
              <input
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                min={0}
                onChange={(event) => setClipStart(Math.max(0, Number(event.currentTarget.value)))}
                step="0.1"
                type="number"
                value={clipStart}
              />
            </label>
            <label className="grid gap-1 text-xs">
              終了秒
              <input
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                min={0}
                onChange={(event) => setClipEnd(event.currentTarget.value ? Math.max(0, Number(event.currentTarget.value)) : "")}
                step="0.1"
                type="number"
                value={clipEndValue}
              />
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}
