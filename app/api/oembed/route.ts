import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;

function absoluteUrl(pathOrUrl: string) {
  return new URL(pathOrUrl, process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").toString();
}

function extractPublicId(rawUrl: string) {
  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return null;
  }

  const appOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").origin;
  if (target.origin !== appOrigin) {
    return null;
  }

  const match = /^\/c\/([^/]+)\/?$/.exec(target.pathname);
  return match ? match[1] : null;
}

function clampDimension(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.round(parsed), fallback);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");
  const format = searchParams.get("format") ?? "json";

  if (format !== "json") {
    return NextResponse.json({ error: "Only json format is supported." }, { status: 501 });
  }

  if (!targetUrl) {
    return NextResponse.json({ error: "Missing url parameter." }, { status: 400 });
  }

  const publicId = extractPublicId(targetUrl);
  if (!publicId) {
    return NextResponse.json({ error: "Unsupported url." }, { status: 404 });
  }

  const post = await prisma.post.findFirst({
    where: {
      publicId,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      isNsfw: false,
    },
    select: {
      publicId: true,
      title: true,
      type: true,
      thumbnailUrl: true,
      mediaUrl: true,
      width: true,
      height: true,
      user: {
        select: {
          username: true,
          displayName: true,
          name: true,
        },
      },
    },
  });

  if (!post) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const authorName = post.user.displayName ?? post.user.name ?? post.user.username ?? "Clipshare";
  const authorUrl = post.user.username ? absoluteUrl(`/users/${post.user.username}`) : absoluteUrl("/");
  const maxWidth = clampDimension(searchParams.get("maxwidth"), DEFAULT_WIDTH);
  const maxHeight = clampDimension(searchParams.get("maxheight"), DEFAULT_HEIGHT);

  if (post.type === "CLIP") {
    const embedUrl = absoluteUrl(`/embed/c/${post.publicId}`);

    return NextResponse.json({
      version: "1.0",
      type: "video",
      provider_name: "Clipshare",
      provider_url: absoluteUrl("/"),
      title: post.title,
      author_name: authorName,
      author_url: authorUrl,
      width: maxWidth,
      height: maxHeight,
      html: `<iframe src="${embedUrl}" width="${maxWidth}" height="${maxHeight}" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>`,
      thumbnail_url: absoluteUrl(post.thumbnailUrl),
      thumbnail_width: maxWidth,
      thumbnail_height: maxHeight,
    });
  }

  return NextResponse.json({
    version: "1.0",
    type: "photo",
    provider_name: "Clipshare",
    provider_url: absoluteUrl("/"),
    title: post.title,
    author_name: authorName,
    author_url: authorUrl,
    url: absoluteUrl(post.mediaUrl ?? post.thumbnailUrl),
    width: post.width ?? maxWidth,
    height: post.height ?? maxHeight,
  });
}
