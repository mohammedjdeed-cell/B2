const CACHE_NAME = 'b2-trainer-v1';
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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Einige nicht kritische Offline-Ressourcen wurden übersprungen:', err);
      });
    })
  );
  self.skipWaiting();
});

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

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        console.log('Anfrage fehlgeschlagen - Offline-Modus aktiv.');
      });
    })
  );
});
