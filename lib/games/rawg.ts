type RawgGame = {
  id?: number;
  slug?: string;
  name?: string;
  description_raw?: string;
  background_image?: string;
  website?: string;
  metacritic?: number | null;
  released?: string | null;
  genres?: { name?: string }[];
  platforms?: { platform?: { name?: string } }[];
};

export type RawgGameMetadata = {
  rawgId: number;
  rawgSlug: string;
  name: string;
  summary: string | null;
  coverUrl: string | null;
  heroUrl: string | null;
  officialUrl: string | null;
  genres: string[];
  platforms: string[];
  releaseDate: Date | null;
  rawgBackgroundUrl: string | null;
  metacriticScore: number | null;
};

function requireRawgApiKey() {
  const apiKey = process.env.RAWG_API_KEY;
  if (!apiKey) {
    throw new Error("RAWG_API_KEY を設定してください。");
  }

  return apiKey;
}

function parseRawgDate(input?: string | null) {
  if (!input) {
    return null;
  }

  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function mapRawgGame(game: RawgGame): RawgGameMetadata {
  if (!game.id || !game.slug || !game.name) {
    throw new Error("RAWGゲームレスポンスが不正です。");
  }

  return {
    rawgId: game.id,
    rawgSlug: game.slug,
    name: game.name,
    summary: game.description_raw ?? null,
    coverUrl: game.background_image ?? null,
    heroUrl: game.background_image ?? null,
    officialUrl: game.website || null,
    genres: game.genres?.map((genre) => genre.name).filter((name): name is string => Boolean(name)) ?? [],
    platforms:
      game.platforms
        ?.map((platform) => platform.platform?.name)
        .filter((name): name is string => Boolean(name)) ?? [],
    releaseDate: parseRawgDate(game.released),
    rawgBackgroundUrl: game.background_image ?? null,
    metacriticScore: game.metacritic ?? null,
  };
}

async function fetchRawg(path: string, params: Record<string, string>) {
  const url = new URL(`https://api.rawg.io/api/${path}`);
  url.searchParams.set("key", requireRawgApiKey());
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`RAWGゲーム取得に失敗しました。status=${response.status}`);
  }

  return response.json() as Promise<unknown>;
}

export async function fetchRawgGameMetadata(input: { rawgSlug?: string | null; name: string }) {
  if (input.rawgSlug) {
    const game = (await fetchRawg(`games/${encodeURIComponent(input.rawgSlug)}`, {})) as RawgGame;
    return mapRawgGame(game);
  }

  const search = (await fetchRawg("games", {
    search: input.name,
    page_size: "1",
  })) as { results?: RawgGame[] };
  const candidate = search.results?.[0];

  if (!candidate?.slug) {
    throw new Error("RAWGで一致するゲームが見つかりませんでした。");
  }

  const game = (await fetchRawg(`games/${encodeURIComponent(candidate.slug)}`, {})) as RawgGame;
  return mapRawgGame(game);
}
