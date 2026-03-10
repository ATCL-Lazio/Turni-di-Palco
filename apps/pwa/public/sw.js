const DEV_HOSTS = new Set(["localhost", "127.0.0.1"]);
const isDevEnvironment =
  DEV_HOSTS.has(self.location.hostname) || self.location.hostname.endsWith(".local");
const CORE_ASSETS_BY_ENV = {
  common: [
    "/",
    "/index.html",
    "/mobile-ops.html",
    "/mobile-infrastructure.html",
    "/mobile-access.html",
    "/mobile-runtime.html",
    "/privacy.html",
    "/mobile-releases.html",
    "/mobile-data-ops.html",
    "/mobile-audit.html",
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
  dev: ["/dev-playground.html", "/control-plane.html"],
  prod: [],
};
const CORE_ASSETS = [
  ...CORE_ASSETS_BY_ENV.common,
  ...(isDevEnvironment ? CORE_ASSETS_BY_ENV.dev : CORE_ASSETS_BY_ENV.prod),
];
const NON_PUBLIC_PATHS = new Set(CORE_ASSETS_BY_ENV.dev);
const OFFLINE_URL = "/index.html";

const CORE_CACHE_VERSION = "vfcac4adb";
const CACHE_VERSION_TAG = "v5";
const CORE_CACHE_NAME = `turni-di-palco-core-${CORE_CACHE_VERSION}-${CACHE_VERSION_TAG}`;
const TILE_CACHE_NAME = `turni-di-palco-tiles-${CORE_CACHE_VERSION}-${CACHE_VERSION_TAG}`;
const META_CACHE_NAME = `turni-di-palco-meta-${CORE_CACHE_VERSION}-${CACHE_VERSION_TAG}`;
const CORE_CACHE_MAX_ENTRIES = 80;
const CORE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TILE_CACHE_MAX_ENTRIES = 300;
const TILE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TILE_HOSTS = new Set([
  "tile.openstreetmap.org",
  "a.tile.openstreetmap.org",
  "b.tile.openstreetmap.org",
  "c.tile.openstreetmap.org",
]);
const CORE_ASSET_PATHS = new Set(CORE_ASSETS);
const NEVER_CACHE_PATHS = new Set(["/.well-known/vercel/flags"]);

const isNonPublicPath = (url) => !isDevEnvironment && NON_PUBLIC_PATHS.has(url.pathname);
const shouldCacheRequest = (url) =>
  url.origin === self.location.origin &&
  !isNonPublicPath(url) &&
  !NEVER_CACHE_PATHS.has(url.pathname);

const getRequestUrl = (requestOrUrl) =>
  typeof requestOrUrl === "string"
    ? new URL(requestOrUrl, self.location.origin).href
    : requestOrUrl.url;
const createMetaRequest = (cacheName, requestOrUrl) =>
  new Request(
    `${self.location.origin}/__sw-meta/${encodeURIComponent(cacheName)}/${encodeURIComponent(
      getRequestUrl(requestOrUrl)
    )}`
  );

const recordMetadata = async (cacheName, requestOrUrl) => {
  const metaCache = await caches.open(META_CACHE_NAME);
  await metaCache.put(
    createMetaRequest(cacheName, requestOrUrl),
    new Response(JSON.stringify({ timestamp: Date.now() }))
  );
};

const pruneCache = async ({ cacheName, maxEntries, maxAgeMs, shouldKeep }) => {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (!keys.length) return;

  const metaCache = await caches.open(META_CACHE_NAME);
  const now = Date.now();
  const entries = [];

  for (const request of keys) {
    if (shouldKeep?.(request)) {
      continue;
    }

    const metaResponse = await metaCache.match(createMetaRequest(cacheName, request));
    let timestamp = 0;
    if (metaResponse) {
      const data = await metaResponse.json().catch(() => null);
      if (data && typeof data.timestamp === "number") {
        timestamp = data.timestamp;
      }
    }

    if (maxAgeMs && timestamp && now - timestamp > maxAgeMs) {
      await cache.delete(request);
      await metaCache.delete(createMetaRequest(cacheName, request));
      continue;
    }

    entries.push({ request, timestamp });
  }

  if (maxEntries && entries.length > maxEntries) {
    entries.sort((a, b) => a.timestamp - b.timestamp);
    const overflow = entries.length - maxEntries;
    const toDelete = entries.slice(0, overflow);
    await Promise.all(
      toDelete.map(({ request }) =>
        Promise.all([cache.delete(request), metaCache.delete(createMetaRequest(cacheName, request))])
      )
    );
  }
};

const isCriticalCoreAsset = (request) => {
  const url = new URL(request.url);
  return url.origin === self.location.origin && CORE_ASSET_PATHS.has(url.pathname);
};

const cacheCoreAssets = async (cache) => {
  // Optional entries (for example /dev-playground.html in public-mode builds) must not break SW install.
  await Promise.all(
    CORE_ASSETS.map((assetUrl) =>
      cache
        .add(assetUrl)
        .then(() => recordMetadata(CORE_CACHE_NAME, assetUrl))
        .catch(() => undefined)
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
      .then(() =>
        Promise.all([
          pruneCache({
            cacheName: CORE_CACHE_NAME,
            maxEntries: CORE_CACHE_MAX_ENTRIES,
            maxAgeMs: CORE_CACHE_TTL_MS,
            shouldKeep: isCriticalCoreAsset,
          }),
          pruneCache({
            cacheName: TILE_CACHE_NAME,
            maxEntries: TILE_CACHE_MAX_ENTRIES,
            maxAgeMs: TILE_CACHE_TTL_MS,
          }),
        ])
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
                .then(() => recordMetadata(CORE_CACHE_NAME, request))
                .then(() =>
                  pruneCache({
                    cacheName: CORE_CACHE_NAME,
                    maxEntries: CORE_CACHE_MAX_ENTRIES,
                    maxAgeMs: CORE_CACHE_TTL_MS,
                    shouldKeep: isCriticalCoreAsset,
                  })
                )
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
                cache
                  .put(request, response.clone())
                  .then(() => recordMetadata(TILE_CACHE_NAME, request))
                  .then(() =>
                    pruneCache({
                      cacheName: TILE_CACHE_NAME,
                      maxEntries: TILE_CACHE_MAX_ENTRIES,
                      maxAgeMs: TILE_CACHE_TTL_MS,
                    })
                  )
                  .catch(() => undefined);
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
                .then((cache) => cache.put(request, response.clone()))
                .then(() => recordMetadata(CORE_CACHE_NAME, request))
                .then(() =>
                  pruneCache({
                    cacheName: CORE_CACHE_NAME,
                    maxEntries: CORE_CACHE_MAX_ENTRIES,
                    maxAgeMs: CORE_CACHE_TTL_MS,
                    shouldKeep: isCriticalCoreAsset,
                  })
                );
            })
            .catch(() => undefined)
        );
        return cached;
      }

      return fetch(request)
        .then((response) => {
          if (response && response.ok && canCacheRequest) {
            const copy = response.clone();
            caches
              .open(CORE_CACHE_NAME)
              .then((cache) => cache.put(request, copy))
              .then(() => recordMetadata(CORE_CACHE_NAME, request))
              .then(() =>
                pruneCache({
                  cacheName: CORE_CACHE_NAME,
                  maxEntries: CORE_CACHE_MAX_ENTRIES,
                  maxAgeMs: CORE_CACHE_TTL_MS,
                  shouldKeep: isCriticalCoreAsset,
                })
              )
              .catch(() => undefined);
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
