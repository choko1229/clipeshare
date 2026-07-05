type SteamStoreSearchItem = {
  id?: number;
  name?: string;
  tiny_image?: string;
};

type SteamAppDetailsResponse = Record<
  string,
  {
    success?: boolean;
    data?: {
      name?: string;
      short_description?: string;
      detailed_description?: string;
      header_image?: string;
      capsule_image?: string;
      capsule_imagev5?: string;
      website?: string;
      genres?: { description?: string }[];
      platforms?: Record<string, boolean>;
      release_date?: {
        coming_soon?: boolean;
        date?: string;
      };
    };
  }
>;

export type SteamSearchResult = {
  appId: number;
  name: string;
  imageUrl: string | null;
};

export type SteamGameMetadata = {
  steamAppId: number;
  name: string;
  summary: string | null;
  coverUrl: string | null;
  heroUrl: string | null;
  officialUrl: string | null;
  genres: string[];
  platforms: string[];
  releaseDate: Date | null;
  steamHeaderUrl: string | null;
  steamCapsuleUrl: string | null;
};

function stripHtml(input?: string) {
  if (!input) {
    return null;
  }

  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || null;
}

function parseSteamReleaseDate(input?: string) {
  if (!input) {
    return null;
  }

  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function mapSteamPlatforms(platforms?: Record<string, boolean>) {
  if (!platforms) {
    return [];
  }

  const labels: Record<string, string> = {
    windows: "PC",
    mac: "Mac",
    linux: "Linux",
  };

  return Object.entries(platforms)
    .filter(([, enabled]) => enabled)
    .map(([key]) => labels[key] ?? key);
}

export async function searchSteamGames(name: string): Promise<SteamSearchResult[]> {
  const query = name.trim();
  if (!query) {
    return [];
  }

  const url = new URL("https://store.steampowered.com/api/storesearch/");
  url.searchParams.set("term", query);
  url.searchParams.set("l", "japanese");
  url.searchParams.set("cc", "JP");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    next: {
      revalidate: 3600,
    },
  });

  if (!response.ok) {
    throw new Error(`Steam検索に失敗しました。status=${response.status}`);
  }

  const data = (await response.json()) as { items?: SteamStoreSearchItem[] };
  return (data.items ?? [])
    .filter((item): item is Required<Pick<SteamStoreSearchItem, "id" | "name">> & SteamStoreSearchItem =>
      Boolean(item.id && item.name),
    )
    .slice(0, 5)
    .map((item) => ({
      appId: item.id,
      name: item.name,
      imageUrl: item.tiny_image ?? null,
    }));
}

export async function fetchSteamGameMetadata(appId: number): Promise<SteamGameMetadata> {
  const url = new URL("https://store.steampowered.com/api/appdetails");
  url.searchParams.set("appids", String(appId));
  url.searchParams.set("l", "japanese");
  url.searchParams.set("cc", "JP");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Steamゲーム取得に失敗しました。status=${response.status}`);
  }

  const data = (await response.json()) as SteamAppDetailsResponse;
  const game = data[String(appId)]?.data;

  if (!data[String(appId)]?.success || !game?.name) {
    throw new Error("Steamで一致するゲーム情報が見つかりませんでした。");
  }

  const steamHeaderUrl = game.header_image ?? null;
  const steamCapsuleUrl = game.capsule_imagev5 ?? game.capsule_image ?? null;

  return {
    steamAppId: appId,
    name: game.name,
    summary: stripHtml(game.short_description ?? game.detailed_description),
    coverUrl: steamCapsuleUrl,
    heroUrl: steamHeaderUrl,
    officialUrl: game.website ?? null,
    genres: game.genres?.map((genre) => genre.description).filter((name): name is string => Boolean(name)) ?? [],
    platforms: mapSteamPlatforms(game.platforms),
    releaseDate: game.release_date?.coming_soon ? null : parseSteamReleaseDate(game.release_date?.date),
    steamHeaderUrl,
    steamCapsuleUrl,
  };
}
