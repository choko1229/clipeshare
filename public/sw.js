const CACHE_VERSION = "clipeshare-pwa-v1";
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const CORE_ASSETS = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/images/og-default.svg",
  "/images/processing-placeholder.svg",
  "/images/nsfw-placeholder.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("clipeshare-pwa-") && key !== STATIC_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || shouldBypassCache(url)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/offline"));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

self.addEventListener("push", (event) => {
  const payload = event.data
    ? event.data.json()
    : {
        title: "Clipshare",
        body: "新しい通知があります。",
        url: "/notice",
      };
  const title = payload.title || "Clipshare";
  const options = {
    body: payload.body || "新しい通知があります。",
    data: {
      url: payload.url || "/notice",
    },
    icon: "/icons/icon.svg",
    badge: "/icons/icon.svg",
    tag: payload.url || "clipeshare-notice",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/notice", self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({
        includeUncontrolled: true,
        type: "window",
      })
      .then((clients) => {
        const existing = clients.find((client) => client.url === targetUrl);
        if (existing) {
          return existing.focus();
        }

        return self.clients.openWindow(targetUrl);
      }),
  );
});

function shouldBypassCache(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/media/") ||
    url.pathname.startsWith("/embed/") ||
    url.pathname.startsWith("/api/auth/") ||
    url.pathname.includes("/auth/")
  );
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname === "/manifest.webmanifest"
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
  }

  return response;
}

async function networkFirst(request, fallbackPath) {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    if (fallbackPath) {
      return caches.match(fallbackPath);
    }

    return new Response("Offline", {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
      status: 503,
    });
  }
}
