const VERSION = 'finvexa-v2';
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const scopeUrl = self.registration.scope;
const asset = path => new URL(path, scopeUrl).href;
const OFFLINE_URL = asset('static/offline.html');
const STATIC_ASSETS = ['static/style.css', 'static/actions.css', 'static/app.js', 'static/pwa.js', 'static/manifest.webmanifest', 'static/offline.html'].map(asset);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => ![STATIC_CACHE, RUNTIME_CACHE].includes(key)).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pending-operations') event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => clients.forEach(client => client.postMessage({ type: 'sync-request' }))));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/healthz') || url.pathname.includes('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok && !url.pathname.endsWith('/login')) caches.open(RUNTIME_CACHE).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(async () => (await caches.match(request)) || (await caches.match(OFFLINE_URL))));
    return;
  }
  if (url.pathname.includes('/static/')) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) caches.open(STATIC_CACHE).then(cache => cache.put(request, response.clone()));
      return response;
    })));
  }
});
