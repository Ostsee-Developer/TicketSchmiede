// Ticket Schmiede Service Worker
const CACHE_NAME = "ticket-schmiede-v1";
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [
  "/offline.html",
];

// Install: precache offline page
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - API calls: network-only (no caching)
// - Pages: network-first, fallback to offline.html
// - Static assets: stale-while-revalidate
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // API routes: always network-only
  if (url.pathname.startsWith("/api/")) return;

  // Next.js internal routes
  if (url.pathname.startsWith("/_next/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const networkFetch = fetch(request).then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        }).catch(() => cached);
        return cached ?? networkFetch;
      })
    );
    return;
  }

  // HTML navigation: network-first, offline fallback
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return cache.match(OFFLINE_URL) ?? Response.error();
      })
    );
  }
});
