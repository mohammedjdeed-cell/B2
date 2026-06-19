const CACHE_NAME = 'b2-buddy-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css', // Falls Ihre CSS-Datei anders heißt, bitte anpassen
  './app.js',    // Falls Ihre JS-Datei anders heißt, bitte anpassen
  'https://img.icons8.com/fluency/192/knowledge-sharing.png',
  'https://img.icons8.com/fluency/512/knowledge-sharing.png'
];

// Installieren und Ressourcen cachen
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Alten Cache aufräumen
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
  self.clientsClaim();
});

// Netzwerk-First mit Cache-Fallback
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
