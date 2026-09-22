const VERSION = 'finvexa-v8';
const STATIC_CACHE = `${VERSION}-static`;
const PAGES_PREFIX = `${VERSION}-pages-`;
const META_CACHE = `${VERSION}-meta`;
const scope = self.registration.scope;
const appUrl = path => new URL(path, scope).href;
const OFFLINE_URL = appUrl('static/offline.html');
const ACTIVE_USER_URL = appUrl('__pwa_active_user__');
// A connection can disappear without the browser immediately emitting an
// offline event. Do not leave navigation (and its modal forms) waiting for a
// network request that will never complete when an authenticated copy exists.
const NAVIGATION_TIMEOUT_MS = 4000;
const ASSETS = [
  'static/offline.html', 'static/style.css', 'static/actions.css',
  'static/app.js', 'static/pwa.js', 'static/theme.js',
  'static/manifest.webmanifest', 'static/favicon.svg',
  'static/icon-192.png', 'static/icon-512.png', 'static/apple-touch-icon.png',
].map(appUrl);

async function activeUser() {
  const response = await (await caches.open(META_CACHE)).match(ACTIVE_USER_URL);
  return response ? response.text() : null;
}

async function setActiveUser(userId) {
  const previous = await activeUser();
  if (previous && previous !== userId) await caches.delete(`${PAGES_PREFIX}${previous}`);
  await (await caches.open(META_CACHE)).put(ACTIVE_USER_URL, new Response(userId));
}

async function clearPrivatePages() {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith(PAGES_PREFIX) || key === META_CACHE || key === 'finvexa-v2-runtime').map(key => caches.delete(key)));
}

function cacheablePage(response, userId) {
  return response.ok && response.headers.get('X-PWA-User') === userId && response.headers.get('Content-Type')?.includes('text/html');
}

async function refreshPage(url, userId) {
  const request = new Request(url, { credentials: 'same-origin', cache: 'no-store' });
  const response = await fetch(request);
  if (cacheablePage(response, userId)) await (await caches.open(`${PAGES_PREFIX}${userId}`)).put(url, response.clone());
  return response;
}

function fetchNavigation(request) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('navigation timeout')), NAVIGATION_TIMEOUT_MS);
    fetch(request).then(
      response => { clearTimeout(timer); resolve(response); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}

async function prefetchPages(urls, userId) {
  if (!userId || await activeUser() !== userId) return;
  for (const url of urls) {
    if (await activeUser() !== userId) return;
    try {
      const target = new URL(url, scope);
      if (target.origin === self.location.origin && target.href.startsWith(scope)) await refreshPage(target.href, userId);
    } catch (_) { /* An unavailable page can be fetched on the next visit. */ }
  }
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('finvexa-v') && ![STATIC_CACHE, META_CACHE].includes(key) && !key.startsWith(PAGES_PREFIX)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type === 'PWA_CLEAR_PRIVATE') {
    event.waitUntil(clearPrivatePages().then(() => event.ports?.[0]?.postMessage({ ok: true })));
  } else if (data.type === 'PWA_PREFETCH' && /^\d+$/.test(String(data.userId || ''))) {
    event.waitUntil((async () => {
      await setActiveUser(String(data.userId));
      event.ports?.[0]?.postMessage({ ok: true });
      await prefetchPages(Array.isArray(data.urls) ? data.urls.slice(0, 16) : [], String(data.userId));
    })());
  }
});

self.addEventListener('sync', event => {
  if (event.tag === 'sync-pending-operations') event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => clients.forEach(client => client.postMessage({ type: 'sync-request' }))));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(scope)) return;
  if (url.pathname.endsWith('/healthz') || url.pathname.includes('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const userId = await activeUser();
      try {
        const response = await fetchNavigation(request);
        if (userId && cacheablePage(response, userId)) {
          event.waitUntil((await caches.open(`${PAGES_PREFIX}${userId}`)).put(request, response.clone()));
        }
        return response;
      } catch (_) {
        if (userId) {
          const cache = await caches.open(`${PAGES_PREFIX}${userId}`);
          const exact = await cache.match(request);
          if (exact) return exact;
          const canonical = new URL(request.url);
          canonical.searchParams.delete('modal');
          canonical.searchParams.delete('edit');
          canonical.searchParams.delete('base_revision');
          const periodPage = await cache.match(canonical.href);
          if (periodPage) return periodPage;
          canonical.search = '';
          const base = await cache.match(canonical.href);
          if (base) return base;
        }
        return (await caches.match(OFFLINE_URL)) || Response.error();
      }
    })());
    return;
  }

  if (url.pathname.includes('/static/')) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) event.waitUntil((await caches.open(STATIC_CACHE)).put(request, response.clone()));
        return response;
      } catch (_) {
        return (await caches.match(request)) || Response.error();
      }
    })());
  }
});
