import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 3500;

export type ExternalLinkMetaCard = {
  description?: string | null;
  errorMessage?: string | null;
  handle?: string | null;
  imageUrl?: string | null;
  provider: string;
  siteName?: string | null;
  title?: string | null;
};

type UserLinkForMeta = {
  id: string;
  label: string | null;
  meta?: ExternalLinkMetaCardWithDates | null;
  type: string;
  url: string;
};

type ExternalLinkMetaCardWithDates = ExternalLinkMetaCard & {
  expiresAt: Date;
  fetchedAt: Date;
};

type FetchedExternalLinkMeta = ExternalLinkMetaCard & {
  extra?: Prisma.InputJsonObject;
};

export async function getExternalLinkMetaMap(links: UserLinkForMeta[]) {
  const now = new Date();
  const entries = await Promise.all(
    links.map(async (link) => {
      if (link.meta && link.meta.expiresAt > now) {
        return [link.id, link.meta] as const;
      }

      const meta = await refreshExternalLinkMeta(link);
      return [link.id, meta] as const;
    }),
  );

  return new Map(entries);
}

async function refreshExternalLinkMeta(link: UserLinkForMeta) {
  const provider = normalizeProvider(link.type);
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS);

  try {
    const fetched = await fetchExternalLinkMeta(provider, link.url);
    const saved = await prisma.userLinkMeta.upsert({
      create: {
        description: fetched.description ?? null,
        errorMessage: null,
        expiresAt,
        extra: fetched.extra ?? undefined,
        fetchedAt: new Date(),
        handle: fetched.handle ?? null,
        imageUrl: fetched.imageUrl ?? null,
        provider,
        siteName: fetched.siteName ?? null,
        title: fetched.title ?? null,
        userLinkId: link.id,
      },
      update: {
        description: fetched.description ?? null,
        errorMessage: null,
        expiresAt,
        extra: fetched.extra ?? undefined,
        fetchedAt: new Date(),
        handle: fetched.handle ?? null,
        imageUrl: fetched.imageUrl ?? null,
        provider,
        siteName: fetched.siteName ?? null,
        title: fetched.title ?? null,
      },
      where: {
        userLinkId: link.id,
      },
    });

    return saved;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "外部リンク情報を取得できませんでした。";
    const saved = await prisma.userLinkMeta.upsert({
      create: {
        errorMessage,
        expiresAt,
        fetchedAt: new Date(),
        provider,
        userLinkId: link.id,
      },
      update: {
        errorMessage,
        expiresAt,
        fetchedAt: new Date(),
        provider,
      },
      where: {
        userLinkId: link.id,
      },
    });

    return saved;
  }
}

async function fetchExternalLinkMeta(provider: string, url: string): Promise<FetchedExternalLinkMeta> {
  switch (provider) {
    case "youtube":
      return fetchYouTubeMeta(url);
    case "github":
      return fetchGitHubMeta(url);
    case "misskey":
      return fetchMisskeyMeta(url);
    case "discord":
      return fetchDiscordInviteMeta(url);
    case "x":
      return fetchXMeta(url);
    default:
      return fetchGenericMeta(url, provider);
  }
}

async function fetchYouTubeMeta(url: string): Promise<FetchedExternalLinkMeta> {
  const data = await fetchJson<{
    author_name?: string;
    author_url?: string;
    provider_name?: string;
    thumbnail_url?: string;
    title?: string;
  }>(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);

  return {
    description: data.author_url ?? "YouTubeの公開情報です。",
    handle: data.author_name ?? extractFirstPath(url),
    imageUrl: data.thumbnail_url ?? null,
    provider: "youtube",
    siteName: data.provider_name ?? "YouTube",
    title: data.author_name ?? data.title ?? "YouTube",
  };
}

async function fetchGitHubMeta(url: string): Promise<FetchedExternalLinkMeta> {
  const parsed = safeUrl(url);
  const [owner, repo] = parsed?.pathname.split("/").filter(Boolean) ?? [];

  if (!owner) {
    throw new Error("GitHubユーザー名を判定できませんでした。");
  }

  if (repo) {
    const data = await fetchJson<{
      description?: string | null;
      full_name?: string;
      html_url?: string;
      owner?: {
        avatar_url?: string;
        login?: string;
      };
      stargazers_count?: number;
    }>(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);

    return {
      description: data.description ?? `${data.stargazers_count ?? 0} stars`,
      extra: {
        stars: data.stargazers_count ?? 0,
      },
      handle: data.owner?.login ?? owner,
      imageUrl: data.owner?.avatar_url ?? null,
      provider: "github",
      siteName: "GitHub",
      title: data.full_name ?? `${owner}/${repo}`,
    };
  }

  const data = await fetchJson<{
    avatar_url?: string;
    bio?: string | null;
    followers?: number;
    login?: string;
    name?: string | null;
    public_repos?: number;
  }>(`https://api.github.com/users/${encodeURIComponent(owner)}`);

  return {
    description: data.bio ?? `公開リポジトリ ${data.public_repos ?? 0} / フォロワー ${data.followers ?? 0}`,
    extra: {
      followers: data.followers ?? 0,
      publicRepos: data.public_repos ?? 0,
    },
    handle: data.login ?? owner,
    imageUrl: data.avatar_url ?? null,
    provider: "github",
    siteName: "GitHub",
    title: data.name || data.login || owner,
  };
}

async function fetchMisskeyMeta(url: string): Promise<FetchedExternalLinkMeta> {
  const parsed = safeUrl(url);
  const host = parsed?.hostname;
  const username = extractMisskeyUsername(url);

  if (!host || !username) {
    throw new Error("Misskeyユーザーを判定できませんでした。");
  }

  const data = await fetchJson<{
    avatarUrl?: string;
    description?: string | null;
    followersCount?: number;
    name?: string | null;
    username?: string;
  }>(`https://${host}/api/users/show`, {
    body: JSON.stringify({
      username,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  return {
    description: stripHtml(data.description ?? "") || `フォロワー ${data.followersCount ?? 0}`,
    extra: {
      followers: data.followersCount ?? 0,
      instance: host,
    },
    handle: `@${data.username ?? username}@${host}`,
    imageUrl: data.avatarUrl ?? null,
    provider: "misskey",
    siteName: host,
    title: data.name || data.username || username,
  };
}

async function fetchDiscordInviteMeta(url: string): Promise<FetchedExternalLinkMeta> {
  const code = extractDiscordInviteCode(url);

  if (!code) {
    throw new Error("Discord招待コードを判定できませんでした。");
  }

  const data = await fetchJson<{
    approximate_member_count?: number;
    approximate_presence_count?: number;
    code?: string;
    guild?: {
      icon?: string | null;
      id?: string;
      name?: string;
    };
  }>(`https://discord.com/api/v10/invites/${encodeURIComponent(code)}?with_counts=true`);
  const guild = data.guild;
  const iconUrl = guild?.id && guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128` : null;

  return {
    description: `メンバー ${data.approximate_member_count ?? 0} / オンライン ${data.approximate_presence_count ?? 0}`,
    extra: {
      inviteCode: data.code ?? code,
      memberCount: data.approximate_member_count ?? null,
      presenceCount: data.approximate_presence_count ?? null,
    },
    handle: data.code ?? code,
    imageUrl: iconUrl,
    provider: "discord",
    siteName: "Discord",
    title: guild?.name ?? "Discord招待",
  };
}

async function fetchXMeta(url: string): Promise<FetchedExternalLinkMeta> {
  const data = await fetchJson<{
    author_name?: string;
    author_url?: string;
    provider_name?: string;
    title?: string;
  }>(`https://publish.twitter.com/oembed?omit_script=true&url=${encodeURIComponent(url)}`);

  return {
    description: data.author_url ?? "Xの公開情報です。",
    handle: data.author_name ?? extractFirstPath(url),
    provider: "x",
    siteName: data.provider_name ?? "X",
    title: data.author_name ?? data.title ?? "X",
  };
}

async function fetchGenericMeta(url: string, provider: string): Promise<FetchedExternalLinkMeta> {
  const parsed = safeUrl(url);
  const host = parsed?.hostname.replace(/^www\./, "") ?? provider;

  return {
    description: `${host} の外部リンクです。`,
    handle: host,
    provider,
    siteName: host,
    title: host,
  };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  headers.set("User-Agent", "ClipshareBot/1.0");

  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`外部APIが ${response.status} を返しました。`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeProvider(type: string) {
  return type.trim().toLowerCase() || "website";
}

function safeUrl(url: string) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function extractFirstPath(url: string) {
  return safeUrl(url)?.pathname.split("/").filter(Boolean)[0] ?? "";
}

function extractMisskeyUsername(url: string) {
  const firstPath = extractFirstPath(url);
  return firstPath.replace(/^@/, "") || null;
}

function extractDiscordInviteCode(url: string) {
  const parsed = safeUrl(url);
  const parts = parsed?.pathname.split("/").filter(Boolean) ?? [];

  if (parsed?.hostname === "discord.gg") {
    return parts[0] ?? null;
  }

  const inviteIndex = parts.findIndex((part) => part === "invite");
  if (inviteIndex >= 0) {
    return parts[inviteIndex + 1] ?? null;
  }

  return parts[0] ?? null;
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, "").trim();
}
