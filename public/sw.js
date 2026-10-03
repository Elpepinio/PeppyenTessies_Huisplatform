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

// ── Pushmeldingen — bv. "nog 14 dagen om je sportschool-abonnement op te
//    zeggen". De payload komt van de server (zie /api/cron/abonnementen-
//    check.js) en bevat titel/tekst/een link naar waar de melding bij hoort.
self.addEventListener("push", (event) => {
  let data = { title: "Ons Huishouden", body: "Je hebt een nieuwe melding." };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/" },
      tag: data.tag, // zelfde tag = latere melding vervangt de vorige i.p.v. te stapelen
    })
  );
});

// Een tik op de melding opent (of focust) de app op de relevante pagina.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
