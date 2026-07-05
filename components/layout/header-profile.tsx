import Image from "next/image";
import Link from "next/link";

type HeaderProfileProps = {
  image?: string | null;
  name?: string | null;
  username?: string | null;
};

export function HeaderProfile({ image, name, username }: HeaderProfileProps) {
  const label = name ?? username ?? "プロフィール";
  const href = username ? `/users/${username}` : "/settings/profile";

  return (
    <Link className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-muted" href={href}>
      <span className="relative size-8 shrink-0 overflow-hidden rounded-full border border-border bg-card">
        {image ? (
          <Image alt="" className="object-cover" fill sizes="32px" src={image} />
        ) : (
          <span className="grid h-full place-items-center text-xs font-bold text-primary">
            {label.slice(0, 1).toUpperCase()}
          </span>
        )}
      </span>
      <span className="hidden max-w-36 truncate text-sm font-medium sm:block">{label}</span>
    </Link>
  );
}
