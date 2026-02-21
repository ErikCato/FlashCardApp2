const CACHE = "flashcards-cache-v2";

const ASSETS = [
  "./",
  "./index.html",
  "./css/main.css",
  "./js/app.js",
  "./js/ui.js",
  "./js/storage.js",
  "./js/data_mock.js",
  "./js/data_api.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : Promise.resolve())));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req).then((resp) => {
        const url = new URL(req.url);

        // Cache only same-origin GETs
        if (url.origin === self.location.origin) {
          const copy = resp.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return resp;
      });
    })
  );
});