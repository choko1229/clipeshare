import type { cookies } from "next/headers";

const COOKIE_NAME = "qs_uploads";
const MAX_ENTRIES = 20;
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type StoredQuickShareUpload = {
  id: string;
  token: string;
};

type CookieStore = Awaited<ReturnType<typeof cookies>>;

export function getStoredUploads(cookieStore: CookieStore): StoredQuickShareUpload[] {
  return parseStoredUploads(cookieStore.get(COOKIE_NAME)?.value);
}

export function addStoredUpload(cookieStore: CookieStore, upload: StoredQuickShareUpload) {
  const uploads = [upload, ...getStoredUploads(cookieStore).filter((item) => item.id !== upload.id)].slice(0, MAX_ENTRIES);
  writeStoredUploads(cookieStore, uploads);
}

export function removeStoredUpload(cookieStore: CookieStore, id: string) {
  const uploads = getStoredUploads(cookieStore).filter((item) => item.id !== id);
  writeStoredUploads(cookieStore, uploads);
}

function writeStoredUploads(cookieStore: CookieStore, uploads: StoredQuickShareUpload[]) {
  cookieStore.set(COOKIE_NAME, JSON.stringify(uploads), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
}

function parseStoredUploads(raw: string | undefined): StoredQuickShareUpload[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item): item is StoredQuickShareUpload =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as StoredQuickShareUpload).id === "string" &&
        typeof (item as StoredQuickShareUpload).token === "string",
    );
  } catch {
    return [];
  }
}
