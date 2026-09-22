const VERSION = 'finvexa-v1';
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = '/static/offline.html';
const STATIC_ASSETS = [OFFLINE_URL, '/static/style.css', '/static/actions.css', '/static/app.js', '/static/pwa.js', '/static/manifest.webmanifest'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== STATIC_CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pending-operations') {
    event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => clients.forEach(client => client.postMessage({ type: 'sync-request' }))));
  }
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const url = new URL(request.url);
  if (url.pathname === '/healthz' || url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/static/')) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => { const copy = response.clone(); caches.open(STATIC_CACHE).then(cache => cache.put(request, copy)); return response; })));
    return;
  }
  if (request.mode === 'navigate') event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
});
