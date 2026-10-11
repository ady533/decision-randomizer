// Network first, cache as fallback: online users always get the latest
// version, and the last version seen keeps working offline.
// Bump CACHE_NAME when the precache list changes.
const CACHE_NAME = 'decision-randomizer-v2';
const PRECACHE = [
  './',
  'index.html',
  'styles.css',
  'manifest.json',
  'js/app.js',
  'js/picker.js',
  'js/state.js',
  'js/sync.js',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  // Leave the sync API and anything cross-origin to the network.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/')) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match('index.html')))
  );
});
