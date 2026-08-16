import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { updatePost } from "@/app/c/[id]/edit/actions";
import { PostVideoReplaceInput } from "@/components/posts/post-video-replace-input";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { formatBytes, getUploadLimitsForUser } from "@/lib/uploads/account-limits";
import { joinPostBody } from "@/lib/posts/post-body";
import { appendMissingHashTags } from "@/lib/posts/slug";
import { searchParamError } from "@/lib/actions/error-message";

export const dynamic = "force-dynamic";

type EditPostPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    error?: string;
  }>;
};

function getCustomText(value: unknown) {
  if (typeof value === "object" && value !== null && "note" in value && typeof (value as { note: unknown }).note === "string") {
    return (value as { note: string }).note;
  }

  return "";
}

function getCustomFieldValue(value: unknown, key: string) {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return "";
  }

  const fieldValue = (value as Record<string, unknown>)[key];
  return typeof fieldValue === "string" || typeof fieldValue === "number" ? String(fieldValue) : "";
}

export default async function EditPostPage({ params, searchParams }: EditPostPageProps) {
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const post = await prisma.post.findFirst({
    where: {
      publicId: id,
      userId: session.user.id,
      status: {
        notIn: ["HIDDEN", "DELETED"],
      },
    },
    include: {
      game: {
        include: {
          fields: {
            where: {
              isActive: true,
            },
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      },
      tags: {
        include: {
          tag: true,
        },
        orderBy: {
          tag: {
            name: "asc",
          },
        },
      },
      uploadJobs: {
        where: {
          status: {
            in: ["QUEUED", "PROCESSING"],
          },
        },
        select: {
          id: true,
        },
      },
      _count: {
        select: {
          mediaItems: true,
        },
      },
    },
  });

  if (!post) {
    notFound();
  }

  const tagNames = post.tags.map(({ tag }) => tag.name);
  const customText = getCustomText(post.customFields);
  const bodyText = appendMissingHashTags(joinPostBody(post.title, post.description), tagNames);
  const hasActiveUploadJob = post.uploadJobs.length > 0;
  const [gameSuggestions, uploadLimits] = await Promise.all([
    prisma.game.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: [{ posts: { _count: "desc" } }, { name: "asc" }],
      take: 80,
    }),
    getUploadLimitsForUser(session.user.id),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">投稿編集</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          本文、ゲーム名、タグ、公開設定、追加情報、メディアを編集できます。
        </p>
      </div>

      <section className="rounded-md border border-border bg-card p-5">
        <form action={updatePost} className="space-y-5">
          <input name="publicId" type="hidden" value={post.publicId} />
          <ActionError message={searchParamError(error)} />

          <div>
            <label className="block text-sm font-medium" htmlFor="bodyText">
              本文
            </label>
            <textarea
              className="mt-2 min-h-36 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring transition focus:ring-2"
              defaultValue={bodyText}
              id="bodyText"
              maxLength={4200}
              name="bodyText"
              required
            />
            <p className="mt-2 text-xs text-muted-foreground">
              1行目をタイトル、2行目以降を説明文として保存します。本文内の #タグ を最大10個までタグとして保存します。
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium" htmlFor="gameName">
              ゲーム名
            </label>
            <input
              className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
              autoComplete="off"
              defaultValue={post.game.name}
              id="gameName"
              list="game-suggestions"
              maxLength={120}
              name="gameName"
              required
            />
            <datalist id="game-suggestions">
              {gameSuggestions.map((game) => (
                <option key={game.id} value={game.name} />
              ))}
            </datalist>
          </div>

          {post.type === "CLIP" ? (
            <>
              <PostVideoReplaceInput disabled={hasActiveUploadJob} />

              <div>
                <label className="block text-sm font-medium" htmlFor="thumbnail">
                  動画サムネイル
                </label>
                <input
                  accept="image/jpeg,image/png,image/webp"
                  className="mt-2 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
                  id="thumbnail"
                  name="thumbnail"
                  type="file"
                />
                <p className="mt-2 text-xs text-muted-foreground">選択した画像を1280x720のWebPサムネイルへ変換します。動画を差し替えた場合、変換完了後にサムネイルが自動生成し直されます。</p>
              </div>
            </>
          ) : null}

          {post.type === "SCREENSHOT" ? (
            <div>
              <label className="block text-sm font-medium" htmlFor="media">
                画像を差し替える
              </label>
              <input
                accept="image/jpeg,image/png,image/webp"
                className="mt-2 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
                id="media"
                multiple
                name="media"
                type="file"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                選択しない場合、画像は変更されません。選択した場合は現在の{post._count.mediaItems}枚をすべて置き換えます(最大
                {uploadLimits.maxImagesPerPost}枚、{formatBytes(uploadLimits.maxImageSizeBytes)}まで)。
              </p>
            </div>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium" htmlFor="rankName">
                ランク帯
              </label>
              <input
                className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
                defaultValue={post.rankName ?? ""}
                id="rankName"
                maxLength={80}
                name="rankName"
                placeholder="Diamond / Master など"
              />
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor="discordServerName">
                Discordサーバー名
              </label>
              <input
                className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
                defaultValue={post.discordServerName ?? ""}
                id="discordServerName"
                maxLength={120}
                name="discordServerName"
              />
            </div>
          </div>

          {post.game.fields.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {post.game.fields.map((field) => {
                const fieldName = `customField:${field.key}`;
                const currentValue = getCustomFieldValue(post.customFields, field.key);
                const options = Array.isArray(field.options)
                  ? field.options.filter((option): option is string => typeof option === "string")
                  : [];

                return (
                  <div key={field.id}>
                    <label className="block text-sm font-medium" htmlFor={fieldName}>
                      {field.label}
                    </label>
                    {field.inputType === "SELECT" ? (
                      <select
                        className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
                        defaultValue={currentValue}
                        id={fieldName}
                        name={fieldName}
                      >
                        <option value="">未選択</option>
                        {options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
                        defaultValue={currentValue}
                        id={fieldName}
                        maxLength={120}
                        name={fieldName}
                        type={field.inputType === "NUMBER" ? "number" : "text"}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}

          <div>
            <label className="block text-sm font-medium" htmlFor="customText">
              自由メモ
            </label>
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring transition focus:ring-2"
              defaultValue={customText}
              id="customText"
              maxLength={1000}
              name="customText"
              placeholder="補足情報を自由に入力"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-3 rounded-md border border-border bg-background p-3 text-sm">
              <input
                className="size-4 accent-primary"
                defaultChecked={post.visibility === "PRIVATE"}
                name="visibility"
                type="checkbox"
                value="PRIVATE"
              />
              非公開にする
            </label>
            <label className="flex items-center gap-3 rounded-md border border-border bg-background p-3 text-sm">
              <input className="size-4 accent-primary" defaultChecked={post.isNsfw} name="isNsfw" type="checkbox" />
              NSFWとして表示
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="submit">保存する</Button>
            <Button asChild variant="outline">
              <Link href={`/c/${post.publicId}`}>キャンセル</Link>
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}

function ActionError({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{message}</div>;
}
