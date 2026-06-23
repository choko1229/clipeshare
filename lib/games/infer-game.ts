import { slugify } from "@/lib/posts/slug";

type GameCandidate = {
  name: string;
  slug: string;
  aliases?: unknown;
};

function aliasStrings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function inferGameName(input: string, games: GameCandidate[]) {
  const haystack = slugify(input);

  if (!haystack) {
    return null;
  }

  const sortedGames = [...games].sort((a, b) => b.name.length - a.name.length);

  for (const game of sortedGames) {
    const candidates = [game.name, game.slug, ...aliasStrings(game.aliases)].map((candidate) => slugify(candidate)).filter(Boolean);
    if (candidates.some((candidate) => haystack.includes(candidate))) {
      return game.name;
    }
  }

  return null;
}
