/* =========================================================
   VoetbalTeam Manager - Service Worker
   Zorgt voor volledige offline werking door de app-shell
   (HTML, CSS, JS, manifest, iconen) te cachen.

   BELANGRIJK - Nieuwe versie publiceren op GitHub Pages:
   Verhoog onderstaand versienummer (v1 -> v2 -> v3, ...) bij elke
   update van de app-bestanden. Dat zorgt ervoor dat:
     1. Er een nieuwe cache wordt aangemaakt met verse bestanden
        (rechtstreeks van het netwerk, niet uit de browsercache);
     2. De oude cache automatisch wordt opgeruimd (zie 'activate');
     3. De nieuwe service worker direct actief wordt (skipWaiting)
        en de pagina automatisch ververst zodra de trainer de app
        opent of ververst (zie de 'controllerchange'-listener in
        app.js).
   ========================================================= */

const CACHE_NAME = "vtm-cache-v20";

const APP_SHELL_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon.svg",
  "./icons/apple-touch-icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png"
];

// Installatie: cache alle app-shell bestanden.
// cache: "reload" dwingt een verse download af vanaf het netwerk, in
// plaats van een mogelijk verouderde versie uit de HTTP-cache van de
// browser te hergebruiken.
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(
        APP_SHELL_FILES.map(function (url) {
          const request = new Request(url, { cache: "reload" });
          return fetch(request).then(function (response) {
            return cache.put(url, response);
          });
        })
      );
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
