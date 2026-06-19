const CACHE_NAME = 'b2-trainer-v1';

// App-Shell und Datendateien für den Offline-Betrieb vorab cachen
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './Topics.json',
  './topics.json',
  './Template.json',
  './template.json',
  './Grammatik.json',
  './grammatik.json'
];

// Service Worker installieren und Ressourcen sichern
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Erlaubt das Fortfahren, auch wenn einzelne JSON-Dateien temporär nicht erreichbar sind
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Einige optionale Ressourcen konnten beim Installieren nicht gecached werden:', err);
      });
    })
  );
  self.skipWaiting();
});

// Bereinigung alter Cache-Versionen bei Aktivierung
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Steuerung der Netzwerkanfragen
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const path = url.pathname.toLowerCase();

  // Prüfen, ob es sich um eine der primären Datendateien handelt (ausgenommen manifest.json)
  const isDataJson = path.endsWith('.json') && !path.endsWith('manifest.json');

  if (isDataJson) {
    // Network-First Strategie für dynamische Lehrinhalte
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback auf den Cache, falls das Netzwerk offline ist
          return caches.match(event.request);
        })
    );
  } else {
    // Cache-First (mit Stale-While-Revalidate) für statische Assets, Fonts und Layout-Elemente
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Sofortige Cache-Rückgabe, gefolgt von einem asynchronen Hintergrund-Update
          fetch(event.request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          }).catch((err) => console.log('Hintergrund-Aktualisierung im Offline-Modus ausgesetzt.'));
          
          return cachedResponse;
        }
        return fetch(event.request);
      })
    );
  }
});
