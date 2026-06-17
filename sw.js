
const CACHE_NAME = 'b2trainer-v3';
const OFFLINE_URL = './index.html';
const PRECACHE_ASSETS = [
  './index.html',
  './reel-mode.html',
  './manifest.json',
  './topics.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300..700&family=Noto+Sans+Arabic:wght@300..700&display=swap',
  'https://cdn.tailwindcss.com',
  'https://d3js.org/d3.v7.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached || caches.match(OFFLINE_URL));
      return cached || networkFetch;
    })
  );
});
