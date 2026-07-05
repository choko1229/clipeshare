import { BadgeCheck, ExternalLink, Gamepad2, Globe, MessageCircle, Play } from "lucide-react";
import { socialLinkTypeLabel } from "@/lib/users/social-links";

type SocialLinkBadgeProps = {
  label?: string | null;
  type: string;
  url: string;
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
