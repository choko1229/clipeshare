export type SearchPostType = "CLIP" | "SCREENSHOT";

export type ParsedSearchQuery = {
  keyword: string;
  game?: string;
  tag?: string;
  from?: string;
  type?: SearchPostType;
};

const operatorPattern = /(?:^|\s)(game|tag|from|type):(?:"([^"]+)"|(\S+))/gi;

export function parseSearchQuery(input: string): ParsedSearchQuery {
  const operators: ParsedSearchQuery = {
    keyword: "",
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
