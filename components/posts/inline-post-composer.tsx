"use client";

import Image from "next/image";
import Link from "next/link";
import { EyeOff, Gamepad2, Globe2, ImagePlus, Lock, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPost } from "@/app/posts/new/actions";
import { Button } from "@/components/ui/button";
import { PostSubmitButton } from "@/components/posts/post-submit-button";
import { cn } from "@/lib/utils";

type InlinePostComposerProps = {
  isLoggedIn: boolean;
  userName?: string | null;
  userImage?: string | null;
  gameSuggestions: {
    aliases?: unknown;
    id: string;
    name: string;
    slug?: string;
  }[];
  tagSuggestions: {
    id: string;
    name: string;
  }[];
};

type SelectedPreview = {
  compressed: boolean;
  durationSeconds?: number;
  id: string;
  name: string;
  originalSize: number;
  size: number;
  type: string;
  url: string;
};

function fileLabel(files: FileList | null) {
  if (!files || files.length === 0) {
    return "画像または動画を追加";
  }

  if (files.length === 1) {
    return files[0].name;
  }

  return `${files.length}件の画像を選択中`;
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)}MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))}KB`;
}

function normalizeSearchText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function aliasStrings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

async function compressImageFile(file: File) {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 2560;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");

    if (!context) {
      bitmap.close();
      return file;
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
    if (!blob || blob.size >= file.size) {
      return file;
    }

    const name = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${name}.webp`, {
      lastModified: Date.now(),
      type: "image/webp",
    });
  } catch {
    return file;
  }
}

async function readVideoDuration(file: File) {
  if (!file.type.startsWith("video/")) {
    return undefined;
  }

  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = url;

    return await new Promise<number | undefined>((resolve) => {
      video.onloadedmetadata = () => resolve(Number.isFinite(video.duration) ? video.duration : undefined);
      video.onerror = () => resolve(undefined);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function InlinePostComposer({ isLoggedIn, userName, userImage, gameSuggestions, tagSuggestions }: InlinePostComposerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [bodyText, setBodyText] = useState("");
  const [clipEnd, setClipEnd] = useState<number | "">("");
  const [clipStart, setClipStart] = useState(0);
  const [gameFocused, setGameFocused] = useState(false);
  const [gameManuallyEdited, setGameManuallyEdited] = useState(false);
  const [gameName, setGameName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isNsfw, setIsNsfw] = useState(false);
  const [isPreparingFiles, setIsPreparingFiles] = useState(false);
  const [selectedFileLabel, setSelectedFileLabel] = useState("画像または動画を追加");
  const [selectedPreviews, setSelectedPreviews] = useState<SelectedPreview[]>([]);
  const [tagQuery, setTagQuery] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");

  function inferGameNameFromText(text: string) {
    const haystack = normalizeSearchText(text);
    if (!haystack) {
      return null;
    }

    return (
      [...gameSuggestions]
        .sort((a, b) => b.name.length - a.name.length)
        .find((game) => {
          const candidates = [game.name, game.slug ?? "", ...aliasStrings(game.aliases)]
            .map((candidate) => normalizeSearchText(candidate))
            .filter(Boolean);
          return candidates.some((candidate) => haystack.includes(candidate));
        })?.name ?? null
    );
  }

  function updateGameAutoFill(text: string) {
    if (gameManuallyEdited || gameName.trim()) {
      return;
    }

    const detected = inferGameNameFromText(text);
    if (detected) {
      setGameName(detected);
    }
  }

  function updateTagQuery(value: string, cursor: number) {
    const currentHashMatch = value.slice(0, cursor).match(/(^|[\s　])#([^\s　#]*)$/u);
    setTagQuery(currentHashMatch ? currentHashMatch[2] : null);
  }

  async function updateFiles(files: FileList | null) {
    if (!inputRef.current || !files || files.length === 0) {
      return;
    }

    setIsPreparingFiles(true);
    const originalFiles = Array.from(files);
    const processedFiles = await Promise.all(originalFiles.map((file) => compressImageFile(file)));
    const transfer = new DataTransfer();
    processedFiles.forEach((file) => transfer.items.add(file));
    inputRef.current.files = transfer.files;
    setSelectedFileLabel(fileLabel(transfer.files));

    const previews = await Promise.all(
      processedFiles.map(async (file, index) => ({
        compressed: file.size < originalFiles[index].size,
        durationSeconds: await readVideoDuration(file),
        id: `${file.name}-${file.size}-${index}`,
        name: file.name,
        originalSize: originalFiles[index].size,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
      })),
    );

    setSelectedPreviews((current) => {
      current.forEach((preview) => URL.revokeObjectURL(preview.url));
      return previews;
    });
    updateGameAutoFill(`${bodyText}\n${processedFiles.map((file) => file.name).join("\n")}`);
    setIsPreparingFiles(false);
  }

  useEffect(() => {
    return () => {
      selectedPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [selectedPreviews]);

  const matchingTags = tagQuery !== null
    ? tagSuggestions.filter((tag) => tag.name.toLowerCase().includes(tagQuery.toLowerCase())).slice(0, 5)
    : [];
  const matchingGames =
    gameFocused && gameName
      ? gameSuggestions.filter((game) => game.name.toLowerCase().includes(gameName.toLowerCase())).slice(0, 8)
      : [];
  const videoPreview = selectedPreviews.find((preview) => preview.type.startsWith("video/"));
  const clipEndValue = clipEnd === "" ? (videoPreview?.durationSeconds ? Math.floor(videoPreview.durationSeconds) : "") : clipEnd;
  const clipDuration =
    typeof clipEndValue === "number" && clipEndValue > clipStart ? Math.max(0, clipEndValue - clipStart) : undefined;

  function insertTag(tagName: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const cursor = textarea.selectionStart;
    const before = bodyText.slice(0, cursor);
    const after = bodyText.slice(cursor);
    const replacedBefore = before.replace(/(^|[\s　])#([^\s　#]*)$/u, `$1#${tagName} `);
    const next = `${replacedBefore}${after}`;
    setBodyText(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = replacedBefore.length;
      textarea.selectionEnd = replacedBefore.length;
    });
  }

  if (!isLoggedIn) {
    return (
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">ゲームの記録を、消えない場所に</p>
            <h2 className="mt-1 text-lg font-bold">クリップを投稿</h2>
            <p className="mt-1 text-sm text-muted-foreground">投稿、いいね、コメントにはログインが必要です。</p>
          </div>
          <Button asChild>
            <Link href="/login">ログイン</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn("relative rounded-lg border border-border bg-card p-4 transition", isDragging ? "border-primary bg-primary/5" : null)}
      onDragEnter={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        void updateFiles(event.dataTransfer.files);
      }}
    >
      {isDragging ? (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-lg border-2 border-dashed border-primary bg-background/85 text-sm font-bold text-primary backdrop-blur">
          ドロップして投稿へ追加
        </div>
      ) : null}

      <form action={createPost} className="space-y-4">
        <input name="returnTo" type="hidden" value="/" />
        <div className="flex gap-3">
          <div className="relative size-10 shrink-0 overflow-hidden rounded-full bg-muted">
            {userImage ? <Image alt="" className="object-cover" fill sizes="40px" src={userImage} /> : null}
          </div>
          <div className="min-w-0 flex-1">
            {selectedPreviews.length > 0 ? (
              <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {selectedPreviews.map((preview) => (
                  <div className="overflow-hidden rounded-md border border-border bg-background" key={preview.id}>
                    <div
                      className="aspect-video bg-muted bg-cover bg-center"
                      style={preview.type.startsWith("image/") ? { backgroundImage: `url("${preview.url}")` } : undefined}
                    >
                      {preview.type.startsWith("video/") ? (
                        <video className="h-full w-full object-cover" muted preload="metadata" src={preview.url} />
                      ) : null}
                    </div>
                    <div className="space-y-1 p-2 text-xs text-muted-foreground">
                      <p className="truncate font-medium text-foreground">{preview.name}</p>
                      <p>
                        {formatFileSize(preview.size)}
                        {preview.compressed ? ` / ${formatFileSize(preview.originalSize)}から圧縮` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <textarea
              className="mt-2 min-h-28 w-full resize-y border-0 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              maxLength={4200}
              name="bodyText"
              onChange={(event) => {
                const next = event.currentTarget.value;
                setBodyText(next);
                updateTagQuery(next, event.currentTarget.selectionStart);
                updateGameAutoFill(`${next}\n${selectedPreviews.map((preview) => preview.name).join("\n")}`);
              }}
              onClick={(event) => updateTagQuery(bodyText, event.currentTarget.selectionStart)}
              onKeyUp={(event) => updateTagQuery(bodyText, event.currentTarget.selectionStart)}
              placeholder="今この瞬間を共有する"
              ref={textareaRef}
              required
              value={bodyText}
            />

            {matchingTags.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {matchingTags.map((tag) => (
                  <button
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                    key={tag.id}
                    onClick={() => insertTag(tag.name)}
                    type="button"
                  >
                    #{tag.name}
                  </button>
                ))}
              </div>
            ) : null}

            <input name="visibility" type="hidden" value={visibility} />
            {isNsfw ? <input name="isNsfw" type="hidden" value="on" /> : null}
            {videoPreview ? (
              <>
                <input name="clipStartSeconds" type="hidden" value={clipStart} />
                {typeof clipEndValue === "number" ? <input name="clipEndSeconds" type="hidden" value={clipEndValue} /> : null}
              </>
            ) : null}
            <input
              className="sr-only"
              multiple
              name="media"
              onChange={(event) => void updateFiles(event.currentTarget.files)}
              ref={inputRef}
              required
              type="file"
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <label className="relative flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
            <Gamepad2 size={16} />
            <input
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
              list="home-game-suggestions"
              maxLength={120}
              name="gameName"
              onBlur={() => setTimeout(() => setGameFocused(false), 120)}
              onChange={(event) => {
                setGameName(event.currentTarget.value);
                setGameManuallyEdited(true);
              }}
              onFocus={() => setGameFocused(true)}
              placeholder="ゲーム名（空欄なら推定）"
              value={gameName}
            />
            {matchingGames.length > 0 ? (
              <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 rounded-md border border-border bg-popover p-1 shadow-lg">
                {matchingGames.map((game) => (
                  <button
                    className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-muted"
                    key={game.id}
                    onClick={() => {
                      setGameName(game.name);
                      setGameManuallyEdited(true);
                      setGameFocused(false);
                    }}
                    onMouseDown={(event) => event.preventDefault()}
                    type="button"
                  >
                    <Gamepad2 size={15} />
                    {game.name}
                  </button>
                ))}
              </div>
            ) : null}
          </label>
          <button
            className="flex min-w-0 items-center gap-2 rounded-md border border-dashed border-border bg-background px-3 py-2 text-left text-sm text-muted-foreground transition hover:text-foreground"
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            <UploadCloud className="shrink-0" size={17} />
            <span className="truncate">{isPreparingFiles ? "ファイルを準備中" : selectedFileLabel}</span>
          </button>
        </div>

        <datalist id="home-game-suggestions">
          {gameSuggestions.map((game) => (
            <option key={game.id} value={game.name} />
          ))}
        </datalist>

        {videoPreview ? (
          <div className="rounded-md border border-border bg-background p-3 text-sm">
            <p className="font-medium">動画クリッピング</p>
            <p className="mt-1 text-xs text-muted-foreground">
              動画時間: {videoPreview.durationSeconds ? `${videoPreview.durationSeconds.toFixed(1)}秒` : "読み取り中"}。指定した範囲で変換します。
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div className="flex items-center gap-1">
            <button
              className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
              onClick={() => inputRef.current?.click()}
              title="メディアを追加"
              type="button"
            >
              {isPreparingFiles ? <UploadCloud className="animate-pulse" size={18} /> : <ImagePlus size={18} />}
            </button>
            <button
              className={cn(
                "inline-flex size-9 items-center justify-center rounded-md transition hover:bg-muted",
                visibility === "PRIVATE" ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setVisibility((current) => (current === "PUBLIC" ? "PRIVATE" : "PUBLIC"))}
              title={visibility === "PUBLIC" ? "公開" : "非公開"}
              type="button"
            >
              {visibility === "PUBLIC" ? <Globe2 size={18} /> : <Lock size={18} />}
            </button>
            <button
              className={cn(
                "inline-flex size-9 items-center justify-center rounded-md transition hover:bg-muted",
                isNsfw ? "text-destructive" : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setIsNsfw((current) => !current)}
              title="NSFW"
              type="button"
            >
              <EyeOff size={18} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">{userName ? `${userName} として投稿` : null}</span>
            <PostSubmitButton compact />
          </div>
        </div>
      </form>
    </section>
  );
}
