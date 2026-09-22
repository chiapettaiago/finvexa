const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { test } = require('node:test');

test('PWA preloads pages, shows fresh server content, and falls back offline', async () => {
  const scope = 'https://finvexa.test/finvexa/';
  const stores = new Map();
  const key = request => typeof request === 'string' ? request : request.url;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async match(request) { return entries.get(key(request))?.clone(); },
        async put(request, response) { entries.set(key(request), response.clone()); },
        async addAll(urls) { for (const url of urls) entries.set(url, (await fetcher(url)).clone()); },
      };
    },
    async match(request) {
      for (const entries of stores.values()) if (entries.has(key(request))) return entries.get(key(request)).clone();
      return undefined;
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  const handlers = {};
  let online = true;
  let serverVersion = 'original';
  const fetcher = async request => {
    if (!online) throw new Error('offline');
    const url = key(request);
    if (url.includes('/static/')) return new Response('asset', { status: 200 });
    return new Response(serverVersion, { status: 200, headers: { 'Content-Type': 'text/html', 'X-PWA-User': '1' } });
  };
  const self = {
    registration: { scope },
    location: new URL(scope),
    clients: { async claim() {}, async matchAll() { return []; } },
    async skipWaiting() {},
    addEventListener(type, handler) { handlers[type] = handler; },
  };
  const code = readFileSync('static/sw.js', 'utf8');
  runInNewContext(code, { self, caches, fetch: fetcher, Request, Response, URL, Promise });
  const dispatch = async (type, extra = {}) => {
    const waits = [];
    let response;
    handlers[type]({
      ...extra,
      waitUntil(promise) { waits.push(Promise.resolve(promise)); },
      respondWith(promise) { response = Promise.resolve(promise); },
    });
    if (response) response = await response;
    await Promise.all(waits);
    return response;
  };

  await dispatch('install');
  await dispatch('activate');
  await dispatch('message', { data: { type: 'PWA_PREFETCH', userId: '1', urls: [scope, `${scope}reports`] } });
  const request = { url: `${scope}reports`, method: 'GET', mode: 'navigate' };
  online = false;
  assert.equal(await (await dispatch('fetch', { request })).text(), 'original');
  assert.equal(await (await dispatch('fetch', { request: { url: `${scope}?modal=entry`, method: 'GET', mode: 'navigate' } })).text(), 'original');
  online = true;
  serverVersion = 'atualizado';
  assert.equal(await (await dispatch('fetch', { request })).text(), 'atualizado');
  online = false;
  assert.equal(await (await dispatch('fetch', { request })).text(), 'atualizado');
  await dispatch('message', { data: { type: 'PWA_CLEAR_PRIVATE' }, ports: [{ postMessage() {} }] });
  assert.match(await (await dispatch('fetch', { request })).text(), /asset/);
});
