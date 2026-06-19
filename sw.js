const CACHE_NAME = 'b2trainer-v7'; // Bumped version to hard-reset the cache
const OFFLINE_URL = './index.html';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './index.html?utm_source=pwa',
  './manifest.json',
  './topics.json',
  'https://cdn-icons-png.flaticon.com/512/3406/3406828.png', // External CDN Icon asset
  'https://fonts.googleapis.com/css2?family=Inter:wght@300..700&family=Noto+Sans+Arabic:wght@300..700&display=swap',
  'https://cdn.tailwindcss.com',
  'https://d3js.org/d3.v7.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        PRECACHE_ASSETS.map(asset => {
          // Request cross-origin assets securely with CORS verification
          const requestOptions = asset.startsWith('http') ? { mode: 'cors' } : {};
          const request = new Request(asset, requestOptions);
          
          return fetch(request)
            .then(response => {
              if (response.ok || response.type === 'opaque') {
                return cache.put(request, response);
              }
              throw new Error(`Failed to cache asset: ${asset}`);
            })
            .catch(err => console.warn('Precaching bypassed for:', asset, err));
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
