const CORE_CACHE_NAME = "turni-di-palco-v0d5eb66f";
const TILE_CACHE_NAME = "turni-di-palco-tiles-v0d5eb66f";
const TILE_HOSTS = new Set([
  "tile.openstreetmap.org",
  "a.tile.openstreetmap.org",
  "b.tile.openstreetmap.org",
  "c.tile.openstreetmap.org",
]);
const OFFLINE_URL = "/index.html";
const CORE_ASSETS = [
  "/",
  OFFLINE_URL,
  "/map.html",
  "/game.html",
  "/avatar.html",
  "/profile.html",
  "/dev.html",
  "/events.html",
  "/turns.html",
  "/leaderboard.html",
  "/mobile/index.html",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/apple-touch-icon.png",
  "/icons/pwa-48.png",
  "/icons/pwa-96.png",
  "/icons/pwa-144.png",
  "/icons/pwa-192.png",
  "/icons/pwa-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![CORE_CACHE_NAME, TILE_CACHE_NAME].includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting" || event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const { request } = event;
  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isTileHost = TILE_HOSTS.has(url.hostname);

  if (!isSameOrigin && !isTileHost) return;

  const isNavigation = request.mode === "navigate";

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          event.waitUntil(
            caches
              .open(CORE_CACHE_NAME)
              .then((cache) => cache.put(request, copy))
              .catch(() => undefined)
          );
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  if (!isSameOrigin && isTileHost) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const fetchRequest = fetch(request)
            .then((response) => {
              if (response && (response.ok || response.type === "opaque")) {
                cache.put(request, response.clone()).catch(() => undefined);
              }
              return response;
            })
            .catch(() => cached);

          return cached || fetchRequest;
        })
      )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        event.waitUntil(
          fetch(request)
            .then((response) => {
              if (!response || !response.ok) return;
              return caches.open(CORE_CACHE_NAME).then((cache) => cache.put(request, response.clone()));
            })
            .catch(() => undefined)
        );
        return cached;
      }

      return fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CORE_CACHE_NAME).then((cache) => cache.put(request, copy).catch(() => undefined));
          }
          return response;
        })
        .catch(() => {
          if (request.destination === "document") {
            return caches.match(OFFLINE_URL);
          }
          return new Response("", { status: 504, statusText: "Offline" });
        });
    })
  );
});
