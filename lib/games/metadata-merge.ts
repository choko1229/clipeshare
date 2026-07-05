type MergeableGame = {
  name: string;
  summary: string | null;
  coverUrl: string | null;
  heroUrl: string | null;
  officialUrl: string | null;
  genres: unknown;
  platforms: unknown;
  releaseDate: Date | null;
};

type ExternalMetadata = {
  name?: string | null;
  summary?: string | null;
  coverUrl?: string | null;
  heroUrl?: string | null;
  officialUrl?: string | null;
  genres?: string[];
  platforms?: string[];
  releaseDate?: Date | null;
};

function keepText(current: string | null, incoming?: string | null) {
  return current?.trim() ? current : incoming?.trim() || null;
}

function keepDate(current: Date | null, incoming?: Date | null) {
  return current ?? incoming ?? null;
}

function keepArray(current: unknown, incoming?: string[]) {
  return Array.isArray(current) && current.length > 0 ? current : incoming ?? [];
}

export function preserveExistingGameMetadata(current: MergeableGame, incoming: ExternalMetadata) {
  return {
    name: current.name || incoming.name || "Unknown Game",
    summary: keepText(current.summary, incoming.summary),
    coverUrl: keepText(current.coverUrl, incoming.coverUrl),
    heroUrl: keepText(current.heroUrl, incoming.heroUrl),
    officialUrl: keepText(current.officialUrl, incoming.officialUrl),
    genres: keepArray(current.genres, incoming.genres),
    platforms: keepArray(current.platforms, incoming.platforms),
    releaseDate: keepDate(current.releaseDate, incoming.releaseDate),
  };
}
