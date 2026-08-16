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

type QuickShareUploadFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  errorMessage: string | null;
  hint: string;
};

export function QuickShareUploadForm({ action, errorMessage, hint }: QuickShareUploadFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  function submitFile(file: File) {
    if (!detectMediaKind(file)) {
      setLocalError("対応している画像または動画ファイルを選択してください。");
      return;
    }

    setLocalError(null);
    setSelectedName(file.name);

    const transfer = new DataTransfer();
    transfer.items.add(file);
    if (inputRef.current) {
      inputRef.current.files = transfer.files;
    }

    setIsUploading(true);
    formRef.current?.requestSubmit();
  }

  const displayError = localError ?? errorMessage;

  return (
    <form action={action} className="space-y-4" ref={formRef}>
      <div
        className={`flex min-h-56 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-border bg-card"
        }`}
        onClick={() => !isUploading && inputRef.current?.click()}
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
          if (file && !isUploading) {
            submitFile(file);
          }
        }}
        role="button"
        tabIndex={0}
      >
        <UploadCloud className="text-muted-foreground" size={40} />
        <p className="font-medium">{isUploading ? "アップロード中..." : "ここに画像・動画をドラッグ&ドロップ"}</p>
        {isUploading ? null : <p className="text-sm text-muted-foreground">またはクリックしてファイルを選択</p>}
        {selectedName ? <p className="text-xs text-muted-foreground">{selectedName}</p> : null}
      </div>
      <input
        accept={acceptTypes}
        className="hidden"
        disabled={isUploading}
        name="media"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) {
            submitFile(file);
          }
        }}
        ref={inputRef}
        type="file"
      />
      <p className="text-center text-xs text-muted-foreground">{hint}</p>
      {displayError ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{displayError}</div>
      ) : null}
    </form>
  );
}
