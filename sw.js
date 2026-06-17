const CACHE_NAME = 'b2-trainer-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './reel-mode.html', // Offline-Caching für das neue Reel-Overlay
  './topics.json',
  './manifest.json',
  'https://cdn.tailwindcss.com' // Pre-cached so Tailwind works completely offline
];

// 1. Install Event: Populate static shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline shell');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Event: Perform cache maintenance on version updates
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event Routing
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore non-GET, non-http, and Chrome/Browser Extensions requests
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // Intercept and handle with SWR Strategy
  event.respondWith(staleWhileRevalidate(request));
});

// Stale-While-Revalidate function logic
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  // Trigger background fetch to update the cache bucket
  const networkFetch = fetchAndCache(request, cache);

  // Return the instant cached copy if found, otherwise wait on the network fetch
  return cachedResponse || networkFetch;
}

// Background fetcher and dynamic cache writer
async function fetchAndCache(request, cache) {
  try {
    const response = await fetch(request);
    
    // Only save valid response streams to avoid caching empty errors
    if (response && response.status === 200 && response.type !== 'opaque') {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.warn('[Service Worker] Fetch failed (possibly offline). Cache state used.', error);
  }
}
