"use client";

import { useEffect, useRef, useState } from "react";
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

export function PostMediaInput() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mediaLabel, setMediaLabel] = useState("ファイル選択後に自動判定します。");

  useEffect(() => {
    async function applyPendingFile() {
      const file = await takePendingPostFile();

      if (!file || !inputRef.current) {
        return;
      }

      const transfer = new DataTransfer();
      transfer.items.add(file);
      inputRef.current.files = transfer.files;
      updateMediaLabel(file);
    }

    window.addEventListener("clipeshare:pending-post-file", applyPendingFile);
    void applyPendingFile();

    return () => {
      window.removeEventListener("clipeshare:pending-post-file", applyPendingFile);
    };
  }, []);

  function updateMediaLabel(file: File | null) {
    const kind = file ? detectMediaKind(file) : null;

    if (kind === "CLIP") {
      setMediaLabel("動画として投稿します。");
      return;
    }

    if (kind === "SCREENSHOT") {
      setMediaLabel("スクリーンショットとして投稿します。");
      return;
    }

    setMediaLabel("対応している画像または動画ファイルを選択してください。");
  }

  return (
    <div>
      <label className="block text-sm font-medium" htmlFor="media">
        メディアファイル
      </label>
      <input
        accept={acceptTypes}
        className="mt-2 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
        id="media"
        name="media"
        onChange={(event) => updateMediaLabel(event.currentTarget.files?.[0] ?? null)}
        ref={inputRef}
        required
        type="file"
      />
      <p className="mt-2 text-xs text-muted-foreground">{mediaLabel}</p>
    </div>
  );
}
