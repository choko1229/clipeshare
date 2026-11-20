import Link from "next/link";
import { Check, ExternalLink, Monitor, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QuickAppMark({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden="true"
      className={
        size === "sm"
          ? "inline-grid size-9 shrink-0 place-items-center rounded-md bg-primary text-lg font-extrabold leading-none text-primary-foreground"
          : "inline-grid size-11 shrink-0 place-items-center rounded-[10px] bg-primary text-2xl font-extrabold leading-none text-primary-foreground"
      }
    >
      C
    </span>
  );
}

export function AuthorizeLayout({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-7 px-4 pb-14 pt-10">
      <h1 className="text-2xl font-extrabold leading-snug">アプリの連携</h1>
      <div className="w-full max-w-[460px]">
        <p className="mb-2 text-xs font-bold tracking-wide text-muted-foreground">{label}</p>
        <div className="rounded-md border border-border bg-card p-6">{children}</div>
      </div>
    </main>
  );
}

export function DeviceSummary({ name, detail }: { name: string; detail: string | null }) {
  return (
    <div className="flex items-center gap-2.5">
      <Monitor aria-hidden="true" className="shrink-0 text-muted-foreground" size={18} strokeWidth={1.8} />
      <div className="min-w-0">
        <p className="break-all text-[13px] font-bold leading-relaxed">{name}</p>
        {detail ? <p className="text-xs leading-relaxed text-muted-foreground">{detail}</p> : null}
      </div>
    </div>
  );
}

function PermissionList({ allowed, items }: { allowed: boolean; items: string[] }) {
  return (
    <ul className="mt-2 flex flex-col gap-2">
      {items.map((item) => (
        <li className="flex items-start gap-2.5" key={item}>
          {allowed ? (
            <Check aria-hidden="true" className="mt-0.5 shrink-0 text-primary" size={16} strokeWidth={2.4} />
          ) : (
            <X aria-hidden="true" className="mt-0.5 shrink-0 text-muted-foreground" size={16} strokeWidth={2.4} />
          )}
          <span className={allowed ? "text-[13px] leading-relaxed" : "text-[13px] leading-relaxed text-muted-foreground"}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

type ConsentViewProps = {
  authorizationId: string;
  csrfToken: string;
  connectionCode: string;
  deviceName: string;
  deviceDetail: string;
  accountName: string;
  switchAccountHref: string;
};

export function AuthorizeConsentView({
  authorizationId,
  csrfToken,
  connectionCode,
  deviceName,
  deviceDetail,
  accountName,
  switchAccountHref,
}: ConsentViewProps) {
  return (
    <AuthorizeLayout label="許可の確認">
      <div className="flex items-center gap-3">
        <QuickAppMark />
        <div>
          <p className="font-extrabold leading-relaxed">Clipshare Quick</p>
          <p className="text-xs leading-relaxed text-muted-foreground">Windows アプリ</p>
        </div>
      </div>
      <h2 className="mt-[18px] text-xl font-extrabold leading-snug">このアプリがアカウントへのアクセスを求めています</h2>

      <div className="mt-4 rounded-md bg-muted p-3.5 text-center">
        <p className="text-xs font-bold tracking-wide text-muted-foreground">接続コード</p>
        <p className="font-mono text-[32px] font-extrabold leading-relaxed tracking-[0.12em]">{connectionCode}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          アプリに表示されているコードと同じか確認してください。違う場合は許可しないでください。
        </p>
      </div>

      <div className="mt-4">
        <DeviceSummary detail={deviceDetail} name={deviceName} />
      </div>

      <div className="my-4 h-px bg-border" />

      <p className="text-xs font-bold tracking-wide text-muted-foreground">許可すること</p>
      <PermissionList
        allowed
        items={["クイック共有への画像・動画のアップロード", "このアプリでアップロードしたファイルの削除", "アカウント名とレベルの表示"]}
      />
      <p className="mt-4 text-xs font-bold tracking-wide text-muted-foreground">許可しないこと</p>
      <PermissionList allowed={false} items={["投稿・コメント・フォローなどの操作", "アカウント設定の変更", "メールアドレスの閲覧"]} />

      <form action="/qick/authorize/decision" className="mt-5 flex items-center gap-2" method="post">
        <input name="authorization_id" type="hidden" value={authorizationId} />
        <input name="csrf_token" type="hidden" value={csrfToken} />
        <Button className="h-11 flex-1 font-bold" name="decision" type="submit" value="approve">
          許可する
        </Button>
        <Button className="h-11 font-bold" name="decision" type="submit" value="deny" variant="outline">
          キャンセル
        </Button>
      </form>
      <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">許可は「設定 › 連携アプリ」からいつでも取り消せます。</p>

      <div className="mb-3 mt-4 h-px bg-border" />
      <div className="flex items-center gap-2">
        <p className="min-w-0 break-all text-xs leading-relaxed text-muted-foreground">{accountName} としてログイン中</p>
        <a className="ml-auto shrink-0 text-xs font-bold leading-relaxed text-primary hover:underline" href={switchAccountHref}>
          アカウントを切り替える
        </a>
      </div>
    </AuthorizeLayout>
  );
}

export function AuthorizeCompleteView({ deviceName, devicePlatform }: { deviceName: string | null; devicePlatform: string | null }) {
  return (
    <AuthorizeLayout label="完了">
      <div className="grid size-14 place-items-center rounded-full bg-primary">
        <Check aria-hidden="true" className="text-primary-foreground" size={28} strokeWidth={3} />
      </div>
      <h2 className="mt-4 text-xl font-extrabold leading-snug">連携が完了しました</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">アプリに戻ってください。このページは閉じて構いません。</p>
      {deviceName ? (
        <div className="mt-[18px] rounded-md bg-muted p-3">
          <DeviceSummary detail={devicePlatform} name={deviceName} />
        </div>
      ) : null}
      <Button asChild className="mt-[18px] font-bold" variant="outline">
        <Link href="/settings/apps">
          <ExternalLink aria-hidden="true" size={16} strokeWidth={1.8} />
          連携アプリを管理
        </Link>
      </Button>
    </AuthorizeLayout>
  );
}

export function AuthorizeInvalidView() {
  return (
    <AuthorizeLayout label="リンクが無効">
      <div className="grid size-14 place-items-center rounded-full bg-destructive">
        <TriangleAlert aria-hidden="true" className="text-destructive-foreground" size={28} strokeWidth={2.2} />
      </div>
      <h2 className="mt-4 text-xl font-extrabold leading-snug">このリンクは使えません</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        有効期限が切れたか、すでに使用されています。アプリから連携をやり直してください。
      </p>
      <Button asChild className="mt-[18px] font-bold" variant="outline">
        <Link href="/">Clipshareに戻る</Link>
      </Button>
    </AuthorizeLayout>
  );
}
