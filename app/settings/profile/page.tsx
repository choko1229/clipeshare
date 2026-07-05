import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { Button } from "@/components/ui/button";
import { ProfileBackgroundBlurInput } from "@/components/profile/profile-background-blur-input";
import { ProfileImageCropInput } from "@/components/profile/profile-image-crop-input";
import { prisma } from "@/lib/db/prisma";
import { updateProfile } from "@/app/settings/profile/actions";
import { searchParamError } from "@/lib/actions/error-message";

type ProfileSettingsPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function ProfileSettingsPage({ searchParams }: ProfileSettingsPageProps) {
  const { error } = await searchParams;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      links: {
        orderBy: {
          sortOrder: "asc",
        },
        take: 12,
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  const usernameLinks = {
    instagram: extractSocialUsername(user.links.find((link) => link.type === "instagram")?.url, "instagram"),
    twitch: extractSocialUsername(user.links.find((link) => link.type === "twitch")?.url, "twitch"),
    x: extractSocialUsername(user.links.find((link) => link.type === "x")?.url, "x"),
    youtube: extractSocialUsername(user.links.find((link) => link.type === "youtube")?.url, "youtube"),
  };
  const customLinks = user.links.filter((link) => !["instagram", "twitch", "x", "youtube"].includes(link.type));
  const linkRows = Array.from({ length: 5 }, (_, index) => customLinks[index] ?? null);
  const birthDateText = user.birthDate ? user.birthDate.toLocaleDateString("ja-JP") : null;

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">プロフィール編集</h1>
        <p className="mt-2 text-sm text-muted-foreground">公開プロフィールに表示する情報を設定します。</p>
      </div>

      <section className="max-w-3xl rounded-md border border-border bg-card p-5">
        <form action={updateProfile} className="space-y-5">
          <ActionError message={searchParamError(error)} />
          <section className="rounded-md border border-border bg-background p-4">
            <h2 className="text-sm font-semibold">基本プロフィール</h2>
            <div className="mt-4 grid gap-4">
              <ProfileImageCropInput
                aspectRatio={3}
                defaultPreviewUrl={user.profileHeaderUrl}
                description="3:1でクロップします。横位置、縦位置、ズームを調整できます。"
                label="ヘッダー画像"
                name="profileHeader"
                outputHeight={512}
                outputWidth={1536}
              />
              <ProfileImageCropInput
                aspectRatio={1}
                defaultPreviewUrl={user.avatarUrl ?? user.image}
                description="1:1でクロップします。プロフィールアイコンとして表示されます。"
                label="アイコン"
                name="avatar"
                outputHeight={512}
                outputWidth={512}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput defaultValue={user.displayName ?? user.name ?? user.email ?? ""} id="displayName" label="名前" maxLength={60} name="displayName" required />
                <TextInput
                  defaultValue={user.username ?? ""}
                  id="username"
                  label="ユーザーID"
                  maxLength={30}
                  minLength={3}
                  name="username"
                  pattern="[a-zA-Z0-9_]+"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium" htmlFor="bio">
                  自己紹介
                </label>
                <textarea
                  className="mt-2 min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring transition focus:ring-2"
                  defaultValue={user.bio ?? ""}
                  id="bio"
                  maxLength={500}
                  name="bio"
                  placeholder="改行、リンク、**太字**、*斜体*、- リストが使えます"
                />
                <p className="mt-2 text-xs text-muted-foreground">HTMLは使用できません。安全なMarkdownだけ表示します。</p>
              </div>
            </div>
          </section>

          <section className="rounded-md border border-border bg-background p-4">
            <h2 className="text-sm font-semibold">プロフィール画面</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ProfileImageCropInput
              aspectRatio={16 / 9}
              defaultPreviewUrl={user.profileBackgroundUrl}
              description="16:9でクロップします。プロフィール画面の背景に使います。"
              label="背景画像"
              name="profileBackground"
              outputHeight={1080}
              outputWidth={1920}
            />
              <ProfileBackgroundBlurInput defaultValue={user.profileBackgroundBlur} />
              <ColorInput defaultValue={user.profileAccentColor ?? "#7c5cff"} id="profileAccentColor" label="アクセントカラー" name="profileAccentColor" />
              <ColorInput defaultValue={user.profileButtonColor ?? "#7c5cff"} id="profileButtonColor" label="ボタンカラー" name="profileButtonColor" />
              <ColorInput defaultValue={user.profileOverlayColor ?? user.profileAccentColor ?? "#10131b"} id="profileOverlayColor" label="背景画像オーバーレイ色" name="profileOverlayColor" />
              <SelectInput
                defaultValue={user.profileThemePreference}
                id="profileThemePreference"
                label="テーマカラー"
                name="profileThemePreference"
                options={[
                  ["SYSTEM", "閲覧者設定に従う"],
                  ["DARK", "ダークで上書き"],
                  ["LIGHT", "ライトで上書き"],
                ]}
              />
              <SelectInput
                defaultValue={user.profileDefaultView}
                id="profileDefaultView"
                label="初期表示のレイアウト"
                name="profileDefaultView"
                options={[
                  ["CARD", "カード"],
                  ["TILE", "タイル"],
                  ["GROUPED_BY_GAME", "ゲームごと"],
                ]}
              />
              <VisibilityCheckbox defaultChecked={user.profileGroupGames} label="ゲームごとにカードをまとめる" name="profileGroupGames" />
            </div>
          </section>

          <section className="rounded-md border border-border bg-background p-4">
            <h2 className="text-sm font-medium">プロフィール表示</h2>
            <p className="mt-1 text-xs text-muted-foreground">公開プロフィールに表示する情報を選択します。</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <VisibilityCheckbox defaultChecked={user.showProfileGames} label="よく投稿するゲームを表示" name="showProfileGames" />
              <VisibilityCheckbox defaultChecked={user.showFollowingCount} label="フォロー数を表示" name="showFollowingCount" />
              <VisibilityCheckbox defaultChecked={user.showFollowersCount} label="フォロワー数を表示" name="showFollowersCount" />
              <VisibilityCheckbox defaultChecked={user.showBirthDate} label="生年月日を表示" name="showBirthDate" />
              <VisibilityCheckbox defaultChecked={user.showAgeVerified} label="年齢確認済みを表示" name="showAgeVerified" />
            </div>
          </section>

          <section className="rounded-md border border-border bg-background p-4">
            <h2 className="text-sm font-medium">生年月日</h2>
            {birthDateText ? (
              <div className="mt-2 rounded-md border border-border bg-card p-3 text-sm">
                <p className="font-medium">年齢確認済み</p>
                <p className="mt-1 text-muted-foreground">生年月日: {birthDateText}</p>
                <p className="mt-2 text-xs text-muted-foreground">一度入力した生年月日は変更できません。変更が必要な場合は運営へ依頼してください。</p>
              </div>
            ) : (
              <Button asChild className="mt-3" variant="outline">
                <a href="/settings/age">年齢確認を設定</a>
              </Button>
            )}
          </section>

          <section className="rounded-md border border-border bg-background p-4">
            <h2 className="text-sm font-semibold">SNSリンク</h2>
            <p className="mt-1 text-xs text-muted-foreground">主要SNSはユーザー名だけで登録できます。その他はURLから自動判定します。</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <TextInput defaultValue={usernameLinks.youtube} id="youtubeUsername" label="YouTube" name="youtubeUsername" placeholder="@channel" />
              <TextInput defaultValue={usernameLinks.x} id="xUsername" label="X" name="xUsername" placeholder="username" />
              <TextInput defaultValue={usernameLinks.twitch} id="twitchUsername" label="Twitch" name="twitchUsername" placeholder="username" />
              <TextInput defaultValue={usernameLinks.instagram} id="instagramUsername" label="Instagram" name="instagramUsername" placeholder="username" />
            </div>
            <div className="mt-4 space-y-3">
              {linkRows.map((link, index) => (
                <div className="grid gap-2" key={link?.id ?? index}>
                  <input
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    defaultValue={link?.url ?? ""}
                    maxLength={500}
                    name="linkUrl"
                    placeholder="https://..."
                    type="url"
                  />
                  <input
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    defaultValue={link?.label ?? ""}
                    maxLength={80}
                    name="linkLabel"
                    placeholder="表示名 任意"
                  />
                </div>
              ))}
            </div>
          </section>

          <Button type="submit">保存</Button>
        </form>
      </section>
    </main>
  );
}

function ColorInput({ defaultValue, id, label, name }: { defaultValue: string; id: string; label: string; name: string }) {
  return (
    <label className="block text-sm font-medium" htmlFor={id}>
      {label}
      <input
        className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
        defaultValue={defaultValue}
        id={id}
        name={name}
        type="color"
      />
    </label>
  );
}

function SelectInput({
  defaultValue,
  id,
  label,
  name,
  options,
}: {
  defaultValue: string;
  id: string;
  label: string;
  name: string;
  options: [string, string][];
}) {
  return (
    <label className="block text-sm font-medium" htmlFor={id}>
      {label}
      <select
        className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
        defaultValue={defaultValue}
        id={id}
        name={name}
      >
        {options.map(([value, labelText]) => (
          <option key={value} value={value}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextInput({
  defaultValue,
  id,
  label,
  maxLength,
  minLength,
  name,
  pattern,
  placeholder,
  required,
}: {
  defaultValue: string;
  id: string;
  label: string;
  maxLength?: number;
  minLength?: number;
  name: string;
  pattern?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium" htmlFor={id}>
      {label}
      <input
        className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
        defaultValue={defaultValue}
        id={id}
        maxLength={maxLength}
        minLength={minLength}
        name={name}
        pattern={pattern}
        placeholder={placeholder}
        required={required}
      />
    </label>
  );
}

function ActionError({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{message}</div>;
}

function VisibilityCheckbox({ defaultChecked, label, name }: { defaultChecked: boolean; label: string; name: string }) {
  return (
    <label className="flex items-center gap-3 rounded-md border border-border bg-card p-3 text-sm">
      <input className="size-4 accent-primary" defaultChecked={defaultChecked} name={name} type="checkbox" />
      {label}
    </label>
  );
}

function extractSocialUsername(url: string | null | undefined, type: "instagram" | "twitch" | "x" | "youtube") {
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);
    const firstPath = parsed.pathname.split("/").filter(Boolean)[0] ?? "";

    if (type === "youtube") {
      return firstPath.startsWith("@") ? firstPath : firstPath ? `@${firstPath}` : "";
    }

    return firstPath.replace(/^@/, "");
  } catch {
    return "";
  }
}
