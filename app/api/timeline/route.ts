import { NextResponse } from "next/server";
import { getTimelinePage, parseTimelineSort, timelinePageSize } from "@/lib/timeline/posts";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sort = parseTimelineSort(url.searchParams.get("sort") ?? undefined);
  const rawOffset = Number(url.searchParams.get("offset") ?? "0");
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

  try {
    const page = await getTimelinePage(sort, offset, timelinePageSize);
    return NextResponse.json(page);
  } catch {
    return NextResponse.json({ posts: [], hasMore: false, nextOffset: offset }, { status: 500 });
  }
}
