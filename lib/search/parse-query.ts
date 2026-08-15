export type SearchPostType = "CLIP" | "SCREENSHOT";

export type NsfwFilter = "include" | "exclude" | "only";

export type ParsedSearchQuery = {
  keyword: string;
  game?: string;
  tag?: string;
  from?: string;
  type?: SearchPostType;
  rank?: string;
  server?: string;
  nsfw: NsfwFilter;
};

const operatorPattern = /(?:^|\s)(game|tag|from|type|rank|server|nsfw):(?:"([^"]+)"|(\S+))/gi;

export function parseSearchQuery(input: string): ParsedSearchQuery {
  const operators: ParsedSearchQuery = {
    keyword: "",
    nsfw: "exclude",
  };
  const consumedRanges: Array<[number, number]> = [];

  for (const match of input.matchAll(operatorPattern)) {
    const key = match[1]?.toLowerCase();
    const value = (match[2] ?? match[3] ?? "").trim();
    if (!key || !value) {
      continue;
    }

    consumedRanges.push([match.index ?? 0, (match.index ?? 0) + match[0].length]);

    if (key === "game") {
      operators.game = value;
    }
    if (key === "tag") {
      operators.tag = value.replace(/^#/, "");
    }
    if (key === "from") {
      operators.from = value.replace(/^@/, "");
    }
    if (key === "type") {
      const normalizedType = normalizeType(value);
      if (normalizedType) {
        operators.type = normalizedType;
      }
    }
    if (key === "rank") {
      operators.rank = value;
    }
    if (key === "server") {
      operators.server = value;
    }
    if (key === "nsfw") {
      operators.nsfw = normalizeNsfwFilter(value);
    }
  }

  operators.keyword = stripConsumedRanges(input, consumedRanges).replace(/\s+/g, " ").trim();
  return operators;
}

function normalizeType(value: string): SearchPostType | undefined {
  const normalized = value.trim().toLowerCase();

  if (["clip", "video", "movie"].includes(normalized)) {
    return "CLIP";
  }
  if (["screenshot", "ss", "image", "photo"].includes(normalized)) {
    return "SCREENSHOT";
  }

  return undefined;
}

function normalizeNsfwFilter(value: string): NsfwFilter {
  const normalized = value.trim().toLowerCase();

  if (["true", "1", "yes", "only"].includes(normalized)) {
    return "only";
  }
  if (["all", "any", "both"].includes(normalized)) {
    return "include";
  }

  return "exclude";
}

function stripConsumedRanges(input: string, ranges: Array<[number, number]>) {
  if (ranges.length === 0) {
    return input;
  }

  let output = "";
  let cursor = 0;

  for (const [start, end] of ranges) {
    output += input.slice(cursor, start);
    cursor = end;
  }

  output += input.slice(cursor);
  return output;
}
