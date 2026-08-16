"use client";

import { useState } from "react";

const acceptTypes = ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska", "video/x-msvideo"].join(",");

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

type PostVideoReplaceInputProps = {
  disabled?: boolean;
};

export function PostVideoReplaceInput({ disabled = false }: PostVideoReplaceInputProps) {
  const [hasFile, setHasFile] = useState(false);
  const [clipEnd, setClipEnd] = useState<number | "">("");
  const [clipStart, setClipStart] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);

  async function handleFileChange(file: File | null) {
    setHasFile(Boolean(file));
    setClipStart(0);
    setClipEnd("");
    setDurationSeconds(null);

    if (!file) {
      return;
    }

    const duration = await readVideoDuration(file);
    setDurationSeconds(duration);
    setClipEnd(duration ? Math.floor(duration) : "");
  }

  const clipEndValue = clipEnd === "" ? (durationSeconds ? Math.floor(durationSeconds) : "") : clipEnd;
  const clipDuration = typeof clipEndValue === "number" && clipEndValue > clipStart ? clipEndValue - clipStart : null;

  return (
    <div>
      <label className="block text-sm font-medium" htmlFor="media">
        動画を差し替える
      </label>
      <input
        accept={acceptTypes}
        className="mt-2 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        id="media"
        name="media"
        onChange={(event) => void handleFileChange(event.currentTarget.files?.[0] ?? null)}
        type="file"
      />
      <p className="mt-2 text-xs text-muted-foreground">
        {disabled
          ? "処理中の動画があるため、完了してから差し替えてください。"
          : "選択しない場合、動画は変更されません。差し替えると再度エンコードされるまで一時的に非公開になります。"}
      </p>
      {hasFile && !disabled ? (
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
