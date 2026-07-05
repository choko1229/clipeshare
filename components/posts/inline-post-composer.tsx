"use client";

import Image from "next/image";
import Link from "next/link";
import { EyeOff, FileVideo, Globe2, Hash, ImagePlus, Lock, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { createPost } from "@/app/posts/new/actions";
import { Button } from "@/components/ui/button";
import { PostSubmitButton } from "@/components/posts/post-submit-button";
import { cn } from "@/lib/utils";

type InlinePostComposerProps = {
  isLoggedIn: boolean;
  userName?: string | null;
  userImage?: string | null;
  gameSuggestions: {
    id: string;
    name: string;
  }[];
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

export function InlinePostComposer({ isLoggedIn, userName, userImage, gameSuggestions }: InlinePostComposerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFileLabel, setSelectedFileLabel] = useState("画像または動画を追加");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [isNsfw, setIsNsfw] = useState(false);

  function updateFiles(files: FileList | null) {
    if (!inputRef.current || !files || files.length === 0) {
      return;
    }

    const transfer = new DataTransfer();
    Array.from(files).forEach((file) => transfer.items.add(file));
    inputRef.current.files = transfer.files;
    setSelectedFileLabel(fileLabel(transfer.files));
  }

  if (!isLoggedIn) {
    return (
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">クリップを投稿</h2>
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
      className={cn(
        "rounded-lg border border-border bg-card p-4 transition",
        isDragging ? "border-primary bg-primary/5" : null,
      )}
      onDragEnter={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        updateFiles(event.dataTransfer.files);
      }}
    >
      <form action={createPost} className="space-y-4">
        <input name="returnTo" type="hidden" value="/" />
        <div className="flex gap-3">
          <div className="relative size-10 shrink-0 overflow-hidden rounded-full bg-muted">
            {userImage ? <Image alt="" className="object-cover" fill sizes="40px" src={userImage} /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <textarea
              className="min-h-28 w-full resize-y border-0 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              maxLength={4200}
              name="bodyText"
              placeholder="何がありましたか？"
              required
            />
            <input name="visibility" type="hidden" value={visibility} />
            {isNsfw ? <input name="isNsfw" type="hidden" value="on" /> : null}
            <input
              className="sr-only"
              multiple
              name="media"
              onChange={(event) => setSelectedFileLabel(fileLabel(event.currentTarget.files))}
              ref={inputRef}
              required
              type="file"
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <label className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
            <Hash size={16} />
            <input
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
              list="home-game-suggestions"
              maxLength={120}
              name="gameName"
              placeholder="ゲーム名（空欄なら推定）"
            />
          </label>
          <button
            className="flex min-w-0 items-center gap-2 rounded-md border border-dashed border-border bg-background px-3 py-2 text-left text-sm text-muted-foreground transition hover:text-foreground"
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            <UploadCloud className="shrink-0" size={17} />
            <span className="truncate">{selectedFileLabel}</span>
          </button>
        </div>

        <datalist id="home-game-suggestions">
          {gameSuggestions.map((game) => (
            <option key={game.id} value={game.name} />
          ))}
        </datalist>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div className="flex items-center gap-1">
            <button
              className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
              onClick={() => inputRef.current?.click()}
              title="メディアを追加"
              type="button"
            >
              <ImagePlus size={18} />
            </button>
            <button
              className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
              onClick={() => inputRef.current?.click()}
              title="動画を追加"
              type="button"
            >
              <FileVideo size={18} />
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
