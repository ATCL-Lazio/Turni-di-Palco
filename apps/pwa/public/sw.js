const CACHE_NAME = "turni-di-palco-v12";
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
  "/mobile/index.html",
  "/manifest.webmanifest",
  "/icons/pwa-192.png",
  "/icons/pwa-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const { request } = event;
  const isNavigation = request.mode === "navigate";

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(OFFLINE_URL, copy).catch(() => undefined));
          return response;
        })
        .catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy).catch(() => undefined));
          return response;
        })
        .catch(() => {
          if (request.destination === "document") {
            return caches.match(OFFLINE_URL);
          }
          return caches.match(request);
        });
    })
  );
});
