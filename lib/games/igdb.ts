type IgdbImage = {
  url?: string;
};

type IgdbNamedValue = {
  name?: string;
};

type IgdbWebsite = {
  category?: number;
  url?: string;
};

type IgdbGame = {
  id: number;
  name?: string;
  summary?: string;
  first_release_date?: number;
  cover?: IgdbImage;
  artworks?: IgdbImage[];
  screenshots?: IgdbImage[];
  genres?: IgdbNamedValue[];
  platforms?: IgdbNamedValue[];
  websites?: IgdbWebsite[];
};

export type IgdbGameMetadata = {
  igdbId: number;
  name: string;
  summary: string | null;
  coverUrl: string | null;
  heroUrl: string | null;
  officialUrl: string | null;
  genres: string[];
  platforms: string[];
  releaseDate: Date | null;
};

let cachedToken: {
  accessToken: string;
  expiresAt: number;
} | null = null;

function requireIgdbCredentials() {
  const clientId = process.env.IGDB_CLIENT_ID;
  const clientSecret = process.env.IGDB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("IGDB_CLIENT_ID と IGDB_CLIENT_SECRET を設定してください。");
  }

  return { clientId, clientSecret };
}

async function getAccessToken() {
  const { clientId, clientSecret } = requireIgdbCredentials();
  const now = Date.now();

  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return {
      clientId,
      accessToken: cachedToken.accessToken,
    };
  }

  const tokenUrl = new URL("https://id.twitch.tv/oauth2/token");
  tokenUrl.searchParams.set("client_id", clientId);
  tokenUrl.searchParams.set("client_secret", clientSecret);
  tokenUrl.searchParams.set("grant_type", "client_credentials");

  const response = await fetch(tokenUrl, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`IGDB認証に失敗しました。status=${response.status}`);
  }

  const token = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!token.access_token || !token.expires_in) {
    throw new Error("IGDB認証レスポンスが不正です。");
  }

  cachedToken = {
    accessToken: token.access_token,
    expiresAt: now + token.expires_in * 1000,
  };

  return {
    clientId,
    accessToken: token.access_token,
  };
}

function normalizeIgdbImageUrl(url?: string, size = "t_cover_big") {
  if (!url) {
    return null;
  }

  const withProtocol = url.startsWith("//") ? `https:${url}` : url;
  return withProtocol.replace(/\/t_[^/]+\//, `/${size}/`);
}

function escapeIgdbSearch(input: string) {
  return input.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function firstOfficialUrl(websites?: IgdbWebsite[]) {
  if (!websites?.length) {
    return null;
  }

  return websites.find((site) => site.category === 1 && site.url)?.url ?? websites.find((site) => site.url)?.url ?? null;
}

function mapIgdbGame(game: IgdbGame): IgdbGameMetadata {
  const coverUrl = normalizeIgdbImageUrl(game.cover?.url, "t_cover_big");
  const heroUrl =
    normalizeIgdbImageUrl(game.artworks?.[0]?.url, "t_1080p") ??
    normalizeIgdbImageUrl(game.screenshots?.[0]?.url, "t_1080p") ??
    coverUrl;

  return {
    igdbId: game.id,
    name: game.name ?? `IGDB ${game.id}`,
    summary: game.summary ?? null,
    coverUrl,
    heroUrl,
    officialUrl: firstOfficialUrl(game.websites),
    genres: game.genres?.map((genre) => genre.name).filter((name): name is string => Boolean(name)) ?? [],
    platforms: game.platforms?.map((platform) => platform.name).filter((name): name is string => Boolean(name)) ?? [],
    releaseDate: game.first_release_date ? new Date(game.first_release_date * 1000) : null,
  };
}

export async function fetchIgdbGameMetadata(input: { igdbId?: number | null; name: string }) {
  const { clientId, accessToken } = await getAccessToken();
  const selector = input.igdbId
    ? `where id = ${input.igdbId};`
    : `search "${escapeIgdbSearch(input.name)}"; where version_parent = null;`;

  const body = [
    "fields name,summary,first_release_date,cover.url,artworks.url,screenshots.url,genres.name,platforms.name,websites.category,websites.url;",
    selector,
    "limit 1;",
  ].join(" ");

  const response = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Client-ID": clientId,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`IGDBゲーム取得に失敗しました。status=${response.status}`);
  }

  const games = (await response.json()) as IgdbGame[];
  const game = games[0];

  if (!game) {
    throw new Error("IGDBで一致するゲームが見つかりませんでした。");
  }

  return mapIgdbGame(game);
}
