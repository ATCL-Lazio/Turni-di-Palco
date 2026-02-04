const DEV_HOSTS = new Set(["localhost", "127.0.0.1"]);
const isDevEnvironment =
  DEV_HOSTS.has(self.location.hostname) || self.location.hostname.endsWith(".local");
const CORE_ASSETS_BY_ENV = {
  common: [
    "/",
    "/index.html",
    "/map.html",
    "/game.html",
    "/avatar.html",
    "/profile.html",
    "/privacy.html",
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
  ],
  dev: ["/dev.html"],
  prod: [],
};
const CORE_ASSETS = [
  ...CORE_ASSETS_BY_ENV.common,
  ...(isDevEnvironment ? CORE_ASSETS_BY_ENV.dev : CORE_ASSETS_BY_ENV.prod),
];
const NON_PUBLIC_PATHS = new Set(CORE_ASSETS_BY_ENV.dev);
const OFFLINE_URL = "/index.html";

const CORE_CACHE_VERSION = "__SW_CACHE_VERSION__";
const CORE_CACHE_NAME = `turni-di-palco-core-${CORE_CACHE_VERSION}`;
const TILE_CACHE_NAME = `turni-di-palco-tiles-${CORE_CACHE_VERSION}`;
const TILE_HOSTS = new Set([
  "tile.openstreetmap.org",
  "a.tile.openstreetmap.org",
  "b.tile.openstreetmap.org",
  "c.tile.openstreetmap.org",
]);

const isNonPublicPath = (url) => !isDevEnvironment && NON_PUBLIC_PATHS.has(url.pathname);
const shouldCacheRequest = (url) => url.origin === self.location.origin && !isNonPublicPath(url);

const cacheCoreAssets = async (cache) => {
  // Optional entries (for example /dev.html in public-mode builds) must not break SW install.
  await Promise.all(
    CORE_ASSETS.map((assetUrl) =>
      cache.add(assetUrl).catch(() => undefined)
    )
  );
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CORE_CACHE_NAME)
      .then((cache) => cacheCoreAssets(cache))
      .then(() => self.skipWaiting())
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
  const canCacheRequest = shouldCacheRequest(url);

  if (isSameOrigin && isNonPublicPath(url)) {
    event.respondWith(fetch(request));
    return;
  }

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (canCacheRequest) {
            const copy = response.clone();
            event.waitUntil(
              caches
                .open(CORE_CACHE_NAME)
                .then((cache) => cache.put(request, copy))
                .catch(() => undefined)
            );
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL)))
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
              if (!response || !response.ok || !canCacheRequest) return;
              return caches
                .open(CORE_CACHE_NAME)
                .then((cache) => cache.put(request, response.clone()));
            })
            .catch(() => undefined)
        );
        return cached;
      }

      return fetch(request)
        .then((response) => {
          if (response && response.ok && canCacheRequest) {
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
