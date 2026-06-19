const CACHE_NAME = 'b2trainer-v5'; // Version bump forces instant update
const OFFLINE_URL = './index.html';

// Matrix includes manifest, assets, and core icons explicitly
const PRECACHE_ASSETS = [
  './',
  './index.html',
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

// Safe installation loop that protects your app from opaque response rejections
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
            .catch(err => console.warn('Precaching skipped for target asset:', asset, err));
        })
      ).then(() => self.skipWaiting());
    })
  );
});

// Clears out v4 and all old caches cleanly
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

// Cache-first with seamless background updates
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request)
        .then(response => {
          // Permit both normal local responses and opaque cross-origin assets
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
