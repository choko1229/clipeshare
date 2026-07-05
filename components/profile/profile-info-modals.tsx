"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Gamepad2, UserRound, UsersRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type ProfileGame = {
  count: number;
  name: string;
  slug: string;
};

type ProfileUser = {
  avatarUrl: string | null;
  displayName: string | null;
  id: string;
  image: string | null;
  name: string | null;
  username: string | null;
};

type ModalType = "games" | "followers" | "following" | null;

type ProfileInfoModalsProps = {
  followers: ProfileUser[];
  following: ProfileUser[];
  games: ProfileGame[];
  showFollowersCount: boolean;
  showFollowingCount: boolean;
  showProfileGames: boolean;
};

const modalTitles = {
  followers: "フォロワー",
  following: "フォロー",
  games: "よく投稿するゲーム",
} satisfies Record<Exclude<ModalType, null>, string>;

export function ProfileInfoModals({
  followers,
  following,
  games,
  showFollowersCount,
  showFollowingCount,
  showProfileGames,
}: ProfileInfoModalsProps) {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const activeTitle = activeModal ? modalTitles[activeModal] : "";

  const hasVisibleItems = showProfileGames || showFollowersCount || showFollowingCount;
  const activeContent = useMemo(() => {
    if (activeModal === "games") {
      return <GameList games={games} />;
    }

    if (activeModal === "followers") {
      return <UserList emptyLabel="フォロワーはまだいません。" users={followers} />;
    }

    if (activeModal === "following") {
      return <UserList emptyLabel="まだ誰もフォローしていません。" users={following} />;
    }

    return null;
  }, [activeModal, followers, following, games]);

  if (!hasVisibleItems) {
    return null;
  }

  return (
    <>
      <div className="mt-4 grid gap-2">
        {showProfileGames ? (
          <ProfileInfoButton icon={<Gamepad2 size={16} />} label="ゲーム" value={`${games.length}件`} onClick={() => setActiveModal("games")} />
        ) : null}
        {showFollowersCount ? (
          <ProfileInfoButton icon={<UsersRound size={16} />} label="フォロワー" value={`${followers.length}人`} onClick={() => setActiveModal("followers")} />
        ) : null}
        {showFollowingCount ? (
          <ProfileInfoButton icon={<UserRound size={16} />} label="フォロー" value={`${following.length}人`} onClick={() => setActiveModal("following")} />
        ) : null}
      </div>

      {activeModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={activeTitle}>
          <div className="max-h-[82vh] w-full max-w-lg overflow-hidden rounded-md border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="font-semibold">{activeTitle}</h3>
              <Button className="size-9 px-0" onClick={() => setActiveModal(null)} type="button" variant="ghost">
                <X size={18} />
                <span className="sr-only">閉じる</span>
              </Button>
            </div>
            <div className="max-h-[68vh] overflow-y-auto p-4">{activeContent}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ProfileInfoButton({
  icon,
  label,
  onClick,
  value,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  value: string;
}) {
  return (
    <button
      className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-left text-sm transition hover:border-primary/60 hover:bg-muted"
      onClick={onClick}
      type="button"
    >
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-semibold">{value}</span>
    </button>
  );
}

function GameList({ games }: { games: ProfileGame[] }) {
  if (games.length === 0) {
    return <p className="text-sm text-muted-foreground">ゲーム情報はまだありません。</p>;
  }

  return (
    <div className="grid gap-2">
      {games.map((game) => (
        <Link className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm transition hover:border-primary/60 hover:bg-muted" href={`/games/${game.slug}`} key={game.slug}>
          <span className="font-medium">{game.name}</span>
          <span className="text-muted-foreground">{game.count}件</span>
        </Link>
      ))}
    </div>
  );
}

function UserList({ emptyLabel, users }: { emptyLabel: string; users: ProfileUser[] }) {
  if (users.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="grid gap-2">
      {users.map((user) => {
        const displayName = user.displayName ?? user.name ?? user.username ?? "ユーザー";
        return (
          <Link className="flex items-center gap-3 rounded-md border border-border bg-background p-3 transition hover:border-primary/60 hover:bg-muted" href={`/users/${user.username}`} key={user.id}>
            <div className="relative size-10 overflow-hidden rounded-md bg-muted">
              {user.avatarUrl || user.image ? (
                <Image alt="" className="object-cover" fill sizes="40px" src={user.avatarUrl ?? user.image ?? ""} />
              ) : (
                <div className="grid h-full place-items-center text-sm font-bold">{displayName.slice(0, 1).toUpperCase()}</div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
