/* Offline-first layer: deliberately independent from the UI code. */
(() => {
  'use strict';
  const DB_NAME = 'finvexa-offline';
  const DB_VERSION = 1;
  const STORE = 'operations';
  const MAX_ATTEMPTS = 8;
  let syncing = false;
  const statusEl = document.getElementById('connection-status');
  const config = document.getElementById('pwa-config')?.dataset || {};

  const notify = (state, message) => {
    if (!statusEl) return;
    statusEl.hidden = !message;
    statusEl.dataset.state = state;
    statusEl.textContent = message || '';
  };
  const openDb = () => new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB indisponível'));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('status', 'status');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const dbRequest = async (mode, action) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const result = action(tx.objectStore(STORE));
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  };
  const listPending = () => dbRequest('readonly', store => {
    const request = store.index('status').getAll('pending');
    return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result.sort((a, b) => a.createdAt.localeCompare(b.createdAt))); request.onerror = () => reject(request.error); });
  });
  const enqueue = operation => dbRequest('readwrite', store => store.put(operation));
  const remove = id => dbRequest('readwrite', store => store.delete(id));
  const update = operation => dbRequest('readwrite', store => store.put(operation));
  const uuid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const isWrite = url => /^\/entry\/(new|\d+\/(edit|toggle|delete))$/.test(new URL(url, location.origin).pathname);
  const payloadFromForm = form => {
    const payload = {};
    for (const [key, value] of new FormData(form).entries()) {
      if (typeof value === 'string') payload[key] = value;
    }
    return payload;
  };
  const setBaseRevision = (form, revision) => {
    if (!form || !revision) return;
    let input = form.elements.base_revision;
    if (!input) { input = document.createElement('input'); input.type = 'hidden'; input.name = 'base_revision'; form.appendChild(input); }
    input.value = revision;
  };
  const loadRevisions = async () => {
    const controls = [...document.querySelectorAll('[data-id], [data-confirm-action], .table-action[href*="/edit"]')];
    const ids = [...new Set(controls.map(control => control.dataset.id || control.dataset.confirmAction?.match(/\/entry\/(\d+)\/(?:toggle|delete)/)?.[1] || control.href?.match(/\/entry\/(\d+)\/edit/)?.[1]).filter(Boolean))];
    if (!ids.length) return;
    try {
      const revisionsUrl = new URL(config.revisionsUrl || 'api/entry-revisions', location.href);
      revisionsUrl.searchParams.set('ids', ids.join(','));
      const response = await fetch(revisionsUrl, { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) return;
      const revisions = (await response.json()).revisions || {};
      controls.forEach(control => {
        const id = control.dataset.id || control.dataset.confirmAction?.match(/\/entry\/(\d+)\/(?:toggle|delete)/)?.[1] || control.href?.match(/\/entry\/(\d+)\/edit/)?.[1];
        if (id && revisions[id]) {
          control.dataset.revision = revisions[id];
          if (control.matches('.table-action[href*="/edit"]')) { const target = new URL(control.href, location.origin); target.searchParams.set('base_revision', revisions[id]); control.href = target.pathname + target.search; }
        }
      });
    } catch (_) { /* progressive enhancement */ }
  };
  const requestOptions = operation => ({ method: operation.method, headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'X-Idempotency-Key': operation.id }, body: new URLSearchParams(operation.payload), credentials: 'same-origin', redirect: 'manual' });
  const apiAvailable = async () => {
    if (navigator.onLine === false) return false;
    try { const response = await fetch(config.healthUrl || 'healthz', { cache: 'no-store', credentials: 'same-origin' }); return response.ok; } catch (_) { return false; }
  };
  const sync = async () => {
    if (syncing || !(await apiAvailable())) return;
    syncing = true;
    const now = Date.now();
    const pending = (await listPending().catch(() => [])).filter(operation => !operation.nextAttemptAt || operation.nextAttemptAt <= now);
    if (pending.length) notify('syncing', `Sincronizando ${pending.length} alteração${pending.length === 1 ? '' : 'ões'}…`);
    try {
      for (const operation of pending) {
        try {
          const response = await fetch(operation.endpoint, requestOptions(operation));
          if (response.ok || response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) await remove(operation.id);
          else if (response.status === 409) { operation.status = 'conflict'; operation.error = 'O servidor detectou um conflito. Revise este lançamento.'; await update(operation); }
          else if (response.status >= 400 && response.status < 500 && response.status !== 401 && response.status !== 408 && response.status !== 429) { operation.status = 'failed'; operation.error = `HTTP ${response.status}`; await update(operation); }
          else { operation.attempts += 1; operation.nextAttemptAt = Date.now() + Math.min(300000, 1000 * (2 ** operation.attempts)); await update(operation); }
        } catch (_) { operation.attempts += 1; operation.nextAttemptAt = Date.now() + Math.min(300000, 1000 * (2 ** operation.attempts)); if (operation.attempts >= MAX_ATTEMPTS) operation.status = 'failed'; await update(operation); break; }
      }
      const remaining = await listPending().catch(() => []);
      const conflicts = remaining.filter(operation => operation.status === 'conflict');
      notify(conflicts.length ? 'pending' : remaining.length ? 'pending' : 'online', conflicts.length ? `${conflicts.length} conflito${conflicts.length === 1 ? '' : 's'} precisa${conflicts.length === 1 ? '' : 'm'} de revisão.` : remaining.length ? `${remaining.length} alteração${remaining.length === 1 ? '' : 'ões'} pendente${remaining.length === 1 ? '' : 's'}.` : 'Alterações sincronizadas.');
      if (!remaining.length) setTimeout(() => notify('', ''), 3500);
    } finally { syncing = false; }
  };
  const queueOrSubmit = async form => {
    const operation = { id: uuid(), method: 'POST', endpoint: form.action, payload: payloadFromForm(form), createdAt: new Date().toISOString(), attempts: 0, status: 'pending' };
    try {
      if (await apiAvailable()) return false;
      await enqueue(operation);
      if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then(registration => registration.sync?.register('sync-pending-operations')).catch(() => {});
      notify('offline', 'Você está offline. A alteração será sincronizada quando a conexão retornar.'); form.closest('dialog')?.close(); return true;
    } catch (_) { return false; }
  };
  const register = async () => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register(config.workerUrl || 'sw.js').catch(() => {});
  };
  const init = () => {
    register();
    if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', event => { if (event.data?.type === 'sync-request') sync(); });
    window.addEventListener('online', () => { notify('online', 'Conexão restaurada.'); sync(); });
    window.addEventListener('offline', () => notify('offline', 'Você está offline. Alterações serão salvas localmente.'));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
    document.querySelectorAll('form#entry-form, form#confirm-form').forEach(form => form.addEventListener('submit', async event => {
      if (!isWrite(form.action) || form.querySelector('input[type=file]')?.files.length) return;
      event.preventDefault();
      if (!(await queueOrSubmit(form))) HTMLFormElement.prototype.submit.call(form);
    }));
    if (navigator.onLine === false) notify('offline', 'Você está offline. Alterações serão salvas localmente.');
    sync();
    loadRevisions();
  };
  window.FinvexaPWA = { setBaseRevision, loadRevisions };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
