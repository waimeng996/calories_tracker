const CACHE_NAME = 'calorie-tracker-shell-v2';
// Do NOT pre-cache '/' — it's server-rendered and its content IS today's live data
// (remaining calories etc.). Caching it at install time would freeze the dashboard
// at whatever it looked like on install. Only cache genuinely static shell assets.
const SHELL_URLS = ['/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first: always try to get fresh data/assets, only fall back to the cache
// when offline. Cache-first would permanently serve stale server-rendered pages.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((cached) => cached ?? Response.error()))
  );
});
