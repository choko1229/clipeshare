/* eslint-disable @next/next/no-img-element */
import { BadgeCheck, Code2, ExternalLink, Gamepad2, Globe, MessageCircle, Pin, Play, Radio } from "lucide-react";
import type { ExternalLinkMetaCard } from "@/lib/users/external-link-meta";
import { cn } from "@/lib/utils";
import { socialLinkTypeLabel } from "@/lib/users/social-links";

type SocialLinkBadgeProps = {
  label?: string | null;
  meta?: ExternalLinkMetaCard | null;
  type: string;
  url: string;
};

type RichSocialLinkCardProps = SocialLinkBadgeProps & {
  featured?: boolean;
};

export function SocialLinkBadge({ label, type, url }: SocialLinkBadgeProps) {
  return (
    <a
      className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
      href={url}
      rel="noreferrer"
      target="_blank"
    >
      <SocialIcon type={type} />
      {label || socialLinkTypeLabel(type)}
      <ExternalLink size={14} />
    </a>
  );
}

export function SocialLinkCard({ label, type, url }: SocialLinkBadgeProps) {
  const info = socialLinkInfo({ label, meta: null, type, url });

  return (
    <article className="min-w-0 rounded-md border border-border bg-background p-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-muted text-primary">
          <SocialIcon type={type} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{info.serviceName}</p>
              <p className="mt-0.5 break-all text-xs text-muted-foreground">{info.handle}</p>
            </div>
            <a
              aria-label={`${info.serviceName}を開く`}
              className="grid size-8 shrink-0 place-items-center rounded-md border border-border transition hover:border-primary hover:text-primary"
              href={url}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink size={15} />
            </a>
          </div>
          <p className="mt-2 break-words text-xs leading-5 text-muted-foreground">{info.description}</p>
        </div>
      </div>
    </article>
  );
}

export function RichSocialLinkCard({ featured = false, label, meta, type, url }: RichSocialLinkCardProps) {
  const info = socialLinkInfo({ label, meta, type, url });
  const hasRemoteImage = Boolean(info.imageUrl);

  return (
    <article
      className={cn(
        "min-w-0 rounded-md border bg-background p-3",
        featured ? "border-primary/60 bg-primary/5 p-4" : "border-border",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            "grid shrink-0 place-items-center overflow-hidden rounded-md bg-muted text-primary",
            featured ? "size-14" : "size-11",
          )}
        >
          {hasRemoteImage ? <img alt="" className="size-full object-cover" loading="lazy" referrerPolicy="no-referrer" src={info.imageUrl ?? ""} /> : <SocialIcon type={type} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              {featured ? (
                <span className="mb-1 inline-flex items-center gap-1 text-[11px] font-bold text-primary">
                  <Pin size={11} />
                  ピン留め
                </span>
              ) : null}
              <p className={cn("truncate font-semibold", featured ? "text-base" : "text-sm")}>{info.title}</p>
              <p className="mt-0.5 break-all text-xs text-muted-foreground">{info.handle}</p>
            </div>
            <a
              aria-label={`${info.serviceName}を開く`}
              className="grid size-8 shrink-0 place-items-center rounded-md border border-border transition hover:border-primary hover:text-primary"
              href={url}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink size={15} />
            </a>
          </div>
          <div className="mt-2 flex min-w-0 items-center gap-2 text-[11px] font-semibold text-muted-foreground">
            <SocialIcon type={type} />
            <span className="truncate">{info.serviceName}</span>
          </div>
          <p className="mt-2 line-clamp-3 break-words text-xs leading-5 text-muted-foreground">{info.description}</p>
        </div>
      </div>
    </article>
  );
}

export function VerifiedAdultBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
      <BadgeCheck size={14} />
      18歳以上確認済み
    </span>
  );
}

function SocialIcon({ type }: { type: string }) {
  switch (type) {
    case "discord":
      return <MessageCircle size={16} />;
    case "x":
      return <span className="text-sm font-bold leading-none">X</span>;
    case "youtube":
      return <Play size={16} />;
    case "instagram":
      return <span className="text-sm font-bold leading-none">IG</span>;
    case "twitch":
      return <Radio size={16} />;
    case "github":
      return <Code2 size={16} />;
    case "vrc":
      return <span className="text-sm font-bold leading-none">VRC</span>;
    case "steam":
      return <Gamepad2 size={16} />;
    case "misskey":
      return <span className="text-sm font-bold leading-none">Mi</span>;
    case "website":
      return <Globe size={16} />;
    default:
      return <Globe size={16} />;
  }
}

function socialLinkInfo({ label, meta, type, url }: SocialLinkBadgeProps) {
  const parsed = safeUrl(url);
  const serviceName = label || socialLinkTypeLabel(type);
  const host = parsed?.hostname.replace(/^www\./, "") ?? url;
  const pathParts = parsed?.pathname.split("/").filter(Boolean) ?? [];
  const firstPath = pathParts[0] ?? "";
  const lastPath = pathParts[pathParts.length - 1] ?? firstPath;

  if (meta?.title || meta?.description || meta?.imageUrl) {
    return {
      description: meta.description || `${meta.siteName || serviceName}の公開情報です。`,
      handle: meta.handle || firstPath || host,
      imageUrl: meta.imageUrl ?? null,
      serviceName: meta.siteName || serviceName,
      title: meta.title || serviceName,
    };
  }

  if (type === "discord") {
    const inviteCode = host === "discord.gg" ? firstPath : lastPath;
    return {
      description: inviteCode ? `Discord招待またはサーバーリンク: ${inviteCode}` : "Discordの外部リンクです。",
      handle: inviteCode ? inviteCode : host,
      imageUrl: null,
      serviceName: "Discord",
      title: "Discord",
    };
  }

  if (type === "misskey") {
    const handle = firstPath.startsWith("@") ? `${firstPath}@${host}` : host;
    return {
      description: `Misskeyインスタンス: ${host}`,
      handle,
      imageUrl: null,
      serviceName: "Misskey",
      title: "Misskey",
    };
  }

  if (["x", "youtube", "instagram", "twitch", "github", "steam", "vrc"].includes(type)) {
    return {
      description: `${socialLinkTypeLabel(type)}のプロフィールまたは関連ページです。`,
      handle: firstPath || host,
      imageUrl: null,
      serviceName,
      title: serviceName,
    };
  }

  return {
    description: `${host} の外部リンクです。`,
    handle: host,
    imageUrl: null,
    serviceName,
    title: serviceName,
  };
}

function safeUrl(url: string) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}
