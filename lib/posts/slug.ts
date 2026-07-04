export function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function parseTags(input: string) {
  return Array.from(
    new Set(
      input
        .split(/[,\s]+/)
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean)
        .slice(0, 10),
    ),
  );
}

export function extractHashTags(input: string, limit = 10) {
  const tags: string[] = [];
  const seen = new Set<string>();
  const matches = input.matchAll(/(^|[\s　])#([^\s　#]+)/gu);

  for (const match of matches) {
    const tag = normalizeHashTag(match[2]);
    const key = tag.toLowerCase();

    if (!tag || seen.has(key)) {
      continue;
    }

    tags.push(tag);
    seen.add(key);

    if (tags.length >= limit) {
      break;
    }
  }

  return tags;
}

export function appendMissingHashTags(bodyText: string, tagNames: string[]) {
  const existing = new Set(extractHashTags(bodyText).map((tag) => tag.toLowerCase()));
  const missing = tagNames
    .map(normalizeHashTag)
    .filter((tag) => tag && !existing.has(tag.toLowerCase()))
    .slice(0, Math.max(0, 10 - existing.size));

  if (missing.length === 0) {
    return bodyText;
  }

  const suffix = missing.map((tag) => `#${tag}`).join(" ");
  return `${bodyText.trimEnd()}\n\n${suffix}`;
}

function normalizeHashTag(input: string) {
  return input
    .trim()
    .replace(/^#+/, "")
    .replace(/[、。,.!?！？:：;；)）\]】}]+$/u, "")
    .slice(0, 40);
}
