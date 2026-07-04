#!/usr/bin/env node

const targetUrl = process.argv[2];

if (!targetUrl) {
  console.error("Usage: node scripts/check-share-metadata.mjs https://example.com/c/{id}");
  process.exit(1);
}

const requiredMeta = [
  "og:title",
  "og:description",
  "og:image",
  "twitter:card",
  "twitter:title",
  "twitter:description",
  "twitter:image",
];

const optionalVideoMeta = [
  "og:video",
  "og:video:secure_url",
  "og:video:type",
  "og:video:width",
  "og:video:height",
  "twitter:player",
  "twitter:player:stream",
  "twitter:player:stream:content_type",
];

const response = await fetch(targetUrl, {
  headers: {
    "User-Agent": "ClipeshareShareCheck/1.0",
  },
});

if (!response.ok) {
  console.error(`Failed to fetch page: ${response.status} ${response.statusText}`);
  process.exit(1);
}

const html = await response.text();
const metadata = readMetadata(html);
const missing = requiredMeta.filter((name) => !metadata.get(name));
const videoUrl = metadata.get("og:video:secure_url") ?? metadata.get("og:video");

console.log(`Page: ${targetUrl}`);
console.log(`Status: ${response.status}`);
console.log("");
console.log("Required metadata");
for (const name of requiredMeta) {
  printMeta(name, metadata.get(name));
}

console.log("");
console.log("Video metadata");
for (const name of optionalVideoMeta) {
  printMeta(name, metadata.get(name));
}

if (missing.length > 0) {
  console.log("");
  console.error(`Missing required metadata: ${missing.join(", ")}`);
  process.exitCode = 1;
}

if (videoUrl) {
  await checkRange(videoUrl);
} else {
  console.log("");
  console.log("No video metadata found. This is expected for screenshots, NSFW posts, private posts, or videos still processing.");
}

function readMetadata(html) {
  const metadata = new Map();
  const metaTagPattern = /<meta\s+[^>]*>/gi;
  const attrPattern = /([a-zA-Z:-]+)=["']([^"']*)["']/g;
  const tags = html.match(metaTagPattern) ?? [];

  for (const tag of tags) {
    const attrs = new Map();
    for (const match of tag.matchAll(attrPattern)) {
      attrs.set(match[1].toLowerCase(), decodeHtml(match[2]));
    }

    const key = attrs.get("property") ?? attrs.get("name");
    const content = attrs.get("content");

    if (key && content && !metadata.has(key)) {
      metadata.set(key, content);
    }
  }

  return metadata;
}

function printMeta(name, value) {
  if (value) {
    console.log(`OK      ${name}: ${value}`);
  } else {
    console.log(`MISSING ${name}`);
  }
}

async function checkRange(videoUrl) {
  console.log("");
  console.log(`Checking video range support: ${videoUrl}`);

  const response = await fetch(videoUrl, {
    headers: {
      Range: "bytes=0-1023",
      "User-Agent": "ClipeshareShareCheck/1.0",
    },
  });

  const contentType = response.headers.get("content-type");
  const contentRange = response.headers.get("content-range");
  const acceptRanges = response.headers.get("accept-ranges");

  console.log(`Status: ${response.status}`);
  console.log(`Content-Type: ${contentType ?? "-"}`);
  console.log(`Accept-Ranges: ${acceptRanges ?? "-"}`);
  console.log(`Content-Range: ${contentRange ?? "-"}`);

  if (response.status !== 206 || contentType !== "video/mp4" || !contentRange) {
    console.error("Video range check failed. Discord/X previews may be less reliable.");
    process.exitCode = 1;
  }
}

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}
