const CACHE_NAME = 'b2trainer-v6'; // Bumped to clear old cache layers
const OFFLINE_URL = './index.html';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './index.html?utm_source=pwa', // CRITICAL: Matches manifest start_url exactly
  './manifest.json',
  './topics.json',
  './icons/icon-192.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300..700&family=Noto+Sans+Arabic:wght@300..700&display=swap',
  'https://cdn.tailwindcss.com',
  'https://d3js.org/d3.v7.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        PRECACHE_ASSETS.map(asset => {
          const requestOptions = asset.startsWith('http') ? { mode: 'cors' } : {};
          const request = new Request(asset, requestOptions);
          
          return fetch(request)
            .then(response => {
              if (response.ok || response.type === 'opaque') {
                return cache.put(request, response);
              }
              throw new Error(`Asset fetch error: ${asset}`);
            })
            .catch(err => console.warn('Precaching skipped for:', asset, err));
        })
      ).then(() => self.skipWaiting());
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    // ignoreSearch: true ensures urls with parameters match their base files cleanly
    caches.match(event.request, { ignoreSearch: true }).then(cached => {
      const networkFetch = fetch(event.request)
        .then(response => {
          if (response && (response.status === 200 || response.type === 'opaque')) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached || caches.match(OFFLINE_URL));
        
      return cached || networkFetch;
    })
  );
});
