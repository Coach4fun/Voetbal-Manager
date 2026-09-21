/* =========================================================
   VoetbalTeam Manager - Service Worker
   Zorgt voor volledige offline werking door de app-shell
   (HTML, CSS, JS, manifest, iconen) te cachen.
   ========================================================= */

const CACHE_NAME = "vtm-cache-v1";

const APP_SHELL_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon.svg"
];

// Installatie: cache alle app-shell bestanden
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL_FILES);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

// Activatie: oude caches opruimen
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function (name) {
            return name !== CACHE_NAME;
          })
          .map(function (name) {
            return caches.delete(name);
          })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// Fetch: cache-first, met network fallback en runtime caching
self.addEventListener("fetch", function (event) {
  // Alleen GET-requests binnen dezelfde origin cachen
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cachedResponse) {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then(function (networkResponse) {
          // Sla geldige responses op voor toekomstig offline gebruik
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === "basic"
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(function () {
          // Bij navigatie zonder netwerk: val terug op index.html
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
          return undefined;
        });
    })
  );
});
