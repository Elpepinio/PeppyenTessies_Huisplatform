// Service worker voor "Ons Huishouden" — zorgt dat de app blijft laden zonder
// internet, en dat de laatst opgehaalde gegevens (boodschappenlijst, voorraad,
// etc.) nog zichtbaar zijn. Wijzigen/opslaan kan alleen met een verbinding —
// deze worker doet bewust GEEN offline-schrijfacties of automatische sync,
// om te voorkomen dat gelijktijdige offline-wijzigingen van Pepijn en Tessa
// elkaar per ongeluk overschrijven.

const CACHE_NAME = "huishouden-cache-v1";
const APP_SHELL = ["/", "/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Alleen GET-verzoeken cachen. Alles wat wijzigt (POST) gaat altijd direct
  // naar het netwerk en wordt nooit uit de cache beantwoord — een offline
  // "opslaan" moet gewoon mislukken in plaats van te doen alsof het lukte.
  if (request.method !== "GET") return;

  // Alleen verzoeken naar onze eigen app cachen, niet naar externe diensten
  // (Leaflet-tegels, Anthropic, OMDb, IMDb, weerdata, etc.).
  if (url.origin !== self.location.origin) return;

  // Next.js build-bestanden hebben een hash in de bestandsnaam en veranderen
  // dus nooit — die mogen agressief cache-first bediend worden.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        });
      })
    );
    return;
  }

  // Pagina's en API-data (GET): probeer eerst het netwerk voor de meest
  // actuele gegevens; val bij een mislukte/ontbrekende verbinding terug op
  // de laatst bewaarde versie uit de cache.
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Alleen geslaagde responses bewaren (geen 401/500 als "laatste stand" opslaan).
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          // Voor paginanavigatie zonder cache-hit: toon in elk geval het
          // gecachete hoofdscherm in plaats van een kapotte lege pagina.
          if (request.mode === "navigate") return caches.match("/");
          return Response.error();
        })
      )
  );
});
