"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
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

type Phase = "idle" | "uploading" | "processing";

type QuickShareUploadFormProps = {
  errorMessage: string | null;
  hint: string;
};

export function QuickShareUploadForm({ errorMessage, hint }: QuickShareUploadFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const isBusy = phase !== "idle";

  function submitFile(file: File) {
    if (!detectMediaKind(file)) {
      setLocalError("対応している画像または動画ファイルを選択してください。");
      return;
    }

    setLocalError(null);
    setSelectedName(file.name);
    setPhase("uploading");
    setProgress(0);

    const formData = new FormData();
    formData.append("media", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/qick/upload");

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }
      setProgress(Math.round((event.loaded / event.total) * 100));
      if (event.loaded >= event.total) {
        setPhase("processing");
      }
    };

    xhr.onload = () => {
      let payload: { redirectUrl?: string; error?: string } = {};
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        // レスポンスがJSONでない場合は下のエラーメッセージにフォールバック
      }

      if (xhr.status >= 200 && xhr.status < 300 && payload.redirectUrl) {
        window.location.href = payload.redirectUrl;
        return;
      }

      setPhase("idle");
      setProgress(0);
      setLocalError(payload.error ?? "アップロードに失敗しました。");
    };

    xhr.onerror = () => {
      setPhase("idle");
      setProgress(0);
      setLocalError("アップロードに失敗しました。通信環境をご確認ください。");
    };

    xhr.send(formData);
  }

  const displayError = localError ?? errorMessage;

  return (
    <div className="space-y-4">
      <div
        className={`flex min-h-56 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-border bg-card"
        }`}
        onClick={() => !isBusy && inputRef.current?.click()}
        onDragLeave={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragging(false);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragging(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file && !isBusy) {
            submitFile(file);
          }
        }}
        role="button"
        tabIndex={0}
      >
        {isBusy ? (
          <div className="w-full max-w-xs space-y-2">
            <p className="text-sm font-medium">
              {phase === "uploading" ? `アップロード中... ${progress}%` : "処理中...(圧縮・変換しています)"}
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              {phase === "uploading" ? (
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              ) : (
                <div className="submit-progress-bar h-full w-1/3 rounded-full bg-primary" />
              )}
            </div>
            {selectedName ? <p className="truncate text-xs text-muted-foreground">{selectedName}</p> : null}
          </div>
        ) : (
          <>
            <UploadCloud className="text-muted-foreground" size={40} />
            <p className="font-medium">ここに画像・動画をドラッグ&ドロップ</p>
            <p className="text-sm text-muted-foreground">またはクリックしてファイルを選択</p>
          </>
        )}
      </div>
      <input
        accept={acceptTypes}
        className="hidden"
        disabled={isBusy}
        name="media"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) {
            submitFile(file);
          }
          event.currentTarget.value = "";
        }}
        ref={inputRef}
        type="file"
      />
      <p className="text-center text-xs text-muted-foreground">{hint}</p>
      {displayError ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{displayError}</div>
      ) : null}
    </div>
  );
}
