// Conservative service worker — caches ONLY immutable Next.js build assets
// (`/_next/static/*`) and named static images from /public. Never caches HTML
// pages or API responses, so dynamic data is always fresh. Goal: when venue
// WiFi drops mid-session, the app shell still loads from disk.

const STATIC_CACHE = "th-static-v3";
const STATIC_ASSETS = [
  "/treasure-hunt-only-logo.png",
  "/treasure-hunt-logo.png",
  "/favicon.png",
  "/fil_map.jpeg",
  "/fil_map_legend.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        Promise.allSettled(STATIC_ASSETS.map((url) => cache.add(url))),
      ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never touch API routes — leave fresh-vs-cached up to the route's headers.
  if (url.pathname.startsWith("/api/")) return;

  // Hashed Next.js build assets are immutable — cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Named static assets (logos, map) — stale-while-revalidate.
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        const fetcher = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || fetcher;
      }),
    );
    return;
  }

  // Everything else (HTML, images served by next/image, etc.) — pass through.
});
