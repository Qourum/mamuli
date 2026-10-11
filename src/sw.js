// Content revisions retain unchanged models across code updates. Cached assets
// are returned without background re-downloads; gameplay and offline preparation
// share one bounded queue. tools/build.py fills the version and revision manifest.
const VERSION = '__VERSION__';
const ARTS = __ARTS__;
const ASSET_REVISIONS = __ASSET_REVISIONS__;
const PAGE = 'mamuli-page-' + VERSION, FILES = 'mamuli-files-v2', FONTS = 'mamuli-fonts';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'rt.js'];
const LIB = ['vendor/three.min.js', 'vendor/GLTFLoader.min.js'];
const SCOPE = new URL(self.registration.scope), META = new URL('__asset_manifest__', SCOPE).href;
const entries = ARTS.map(name => new URL('art/' + name, SCOPE).href);
const tasks = new Map(), queue = [], migrations = [];
let networkActive = 0, backgroundActive = 0, foregroundDemand = 0, migrationActive = false, keepRun = null;
let progress = { done: 0, total: entries.length, bytes: 0, failed: 0, running: false, complete: false };
let assetCachePromise = null;
const assetCache = () => assetCachePromise || (assetCachePromise = caches.open(FILES).catch(error => { assetCachePromise = null; throw error; }));
function assetKey(input) {
  const url = new URL(typeof input === 'string' ? input : input.url, SCOPE);
  const relative = url.origin === SCOPE.origin && url.pathname.startsWith(SCOPE.pathname) ? url.pathname.slice(SCOPE.pathname.length) : url.pathname;
  const revision = ASSET_REVISIONS[relative] || 'build-' + VERSION;
  url.hash = ''; url.search = ''; url.searchParams.set('v', revision); return url.href;
}
const bytesOf = response => Math.max(0, Number(response && response.headers.get('content-length')) || 0);
const cacheMatch = (cache, key, options) => cache.match(key, options).catch(() => null);
function unavailable() { return new Response('', { status: 504, statusText: 'Asset unavailable offline' }); }
function ready(response, bytes = bytesOf(response)) {
  // Consumers reopen their own CacheStorage stream. Never tee a cached 19MB
  // response into an unread original body merely to return its clone.
  if (response.body) response.body.cancel().catch(() => {});
  return { bytes, stored: true };
}

// One timeout covers headers and the cache write/body, so an interrupted stream
// cannot occupy a download slot forever. A failed key is removed and can retry.
async function deadline(run, milliseconds) {
  const controller = new AbortController(); let timer;
  try {
    return await Promise.race([run(controller.signal), new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('Download timed out')); }, milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}
function pump() {
  while (networkActive < 4 && queue.length) {
    let index = queue.findIndex(job => !job.task.background);
    if (index < 0) { if (foregroundDemand || backgroundActive >= 2) return; index = 0; }
    const job = queue.splice(index, 1)[0], background = job.task.background;
    networkActive++; if (background) backgroundActive++;
    Promise.resolve().then(job.run).then(job.resolve, job.reject).finally(() => {
      networkActive--; if (background) backgroundActive--; pump();
    });
  }
}
function queued(task, run) { return new Promise((resolve, reject) => { queue.push({ task, run, resolve, reject }); pump(); }); }
function pumpMigration() {
  if (migrationActive || !migrations.length) return;
  const foreground = migrations.findIndex(job => !job.task.background), job = migrations.splice(foreground < 0 ? 0 : foreground, 1)[0];
  migrationActive = true;
  Promise.resolve().then(job.run).then(job.resolve, job.reject).finally(() => { migrationActive = false; pumpMigration(); });
}
function serialMigration(task, run) { return new Promise((resolve, reject) => { migrations.push({ task, run, resolve, reject }); pumpMigration(); }); }
async function legacyNames() { return (await caches.keys()).filter(name => name === 'mamuli-files' || (name.startsWith('mamuli-files-') && name !== FILES)).reverse(); }
async function migrate(task, cache, request, key) {
  const revision = new URL(key).searchParams.get('v');
  if (!/^[a-f0-9]{64}$/.test(revision) || !self.crypto || !self.crypto.subtle) return null;
  // At most one legacy body is hashed at a time, including the 19MB volcano.
  return serialMigration(task, async () => {
    for (const name of await legacyNames()) {
      const old = await caches.open(name), response = await cacheMatch(old, request.url, { ignoreSearch: true });
      if (!response || !response.ok || response.type === 'opaque') continue;
      try {
        const body = await response.arrayBuffer(), digest = await self.crypto.subtle.digest('SHA-256', body);
        const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
        if (hash !== revision) continue;
        const headers = new Headers(response.headers); headers.delete('content-encoding'); headers.set('content-length', String(body.byteLength));
        await cache.put(key, new Response(body, { status: response.status, statusText: response.statusText, headers }));
        const hit = await cacheMatch(cache, key); if (hit) return ready(hit, body.byteLength);
      } catch (_) { }
    }
    return null;
  });
}
async function offlineAsset(cache, request) {
  // An older revision can still make an offline game playable, but is never
  // promoted to the current revision unless its actual bytes have been verified.
  const sameFile = await cacheMatch(cache, request.url, { ignoreSearch: true }); if (sameFile) return sameFile;
  for (const name of await legacyNames()) { const old = await caches.open(name), hit = await cacheMatch(old, request.url, { ignoreSearch: true }); if (hit) return hit; }
  return null;
}
async function prepareAsset(task, request, key) {
  let cache;
  try { cache = await assetCache(); } catch (_) { }
  if (cache) {
    const hit = await cacheMatch(cache, key); if (hit) return ready(hit);
    try { const migrated = await migrate(task, cache, request, key); if (migrated) return migrated; } catch (_) { }
  }
  try {
    return await queued(task, () => deadline(async signal => {
      const response = await fetch(key, { signal, credentials: request.credentials || 'same-origin', mode: request.mode === 'no-cors' ? 'no-cors' : 'cors' });
      if (!response.ok && response.type !== 'opaque') return { response, bytes: 0, stored: false };
      let stored = false;
      if (cache) { try { await cache.put(key, response.clone()); stored = true; } catch (_) { } }
      return stored ? ready(response) : { response, bytes: bytesOf(response), stored: false };
    }, /\.glb(?:\?|$)/.test(key) ? 90000 : 25000));
  } catch (_) {
    let fallback = null; if (cache) { try { fallback = await offlineAsset(cache, request); } catch (_) { } }
    return { response: fallback || unavailable(), bytes: bytesOf(fallback), stored: false };
  }
}
async function asset(request, background = false) {
  const key = assetKey(request); if (!background) foregroundDemand++;
  try {
    let task = tasks.get(key);
    if (!task) {
      task = { background, promise: null }; tasks.set(key, task);
      task.promise = prepareAsset(task, request, key).catch(() => ({ response: unavailable(), bytes: 0, stored: false })).finally(() => { if (tasks.get(key) === task) tasks.delete(key); });
    } else if (!background) { task.background = false; pump(); pumpMigration(); }
    const result = await task.promise;
    // Background callers do not create an unused clone of a large model body.
    if (background) return result;
    if (result.stored) { try { return await cacheMatch(await assetCache(), key) || unavailable(); } catch (_) { return unavailable(); } }
    return result.response.clone();
  } finally { if (!background) { foregroundDemand--; pump(); } }
}
async function tell(source) {
  const message = { type: 'asset-cache-progress', version: VERSION, ...progress };
  if (source && source.postMessage) { source.postMessage(message); return; }
  try { for (const client of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) client.postMessage(message); } catch (_) { }
}
async function status(source) {
  if (!keepRun) {
    try {
      const cache = await assetCache(), keys = new Set((await cache.keys()).map(request => request.url));
      const done = entries.filter(url => keys.has(assetKey(url))).length;
      progress = { ...progress, done, total: entries.length, running: false, complete: done === entries.length, failed: Math.min(progress.failed, entries.length - done) };
    } catch (_) { progress = { ...progress, running: false, complete: false }; }
  }
  await tell(source);
}
function keepAll() {
  if (keepRun) return keepRun;
  keepRun = (async () => {
    let keys = new Set(); try { keys = new Set((await (await assetCache()).keys()).map(request => request.url)); } catch (_) { }
    const todo = entries.filter(url => !keys.has(assetKey(url)));
    progress = { done: entries.length - todo.length, total: entries.length, bytes: 0, failed: 0, running: true, complete: false }; await tell();
    const next = async () => {
      for (let url = todo.shift(); url; url = todo.shift()) {
        const result = await asset(new Request(url), true);
        if (result.stored) { progress.done++; progress.bytes += result.bytes; } else progress.failed++;
        await tell();
      }
    };
    await Promise.all([next(), next()]);
    progress.running = false; progress.complete = progress.done === progress.total && progress.failed === 0;
    // Verified current files now cover all offline assets; legacy caches no
    // longer need to consume space. Fonts and revision-keyed files are retained.
    if (progress.complete) { try { for (const name of await legacyNames()) await caches.delete(name); } catch (_) { } }
    await tell();
  })().catch(async () => { progress.running = false; progress.complete = false; progress.failed++; await tell(); }).finally(() => { keepRun = null; });
  return keepRun;
}
async function page(request) {
  let cache; try { cache = await caches.open(PAGE); } catch (_) { }
  try {
    return await deadline(async signal => {
      const response = await fetch(request, { cache: 'no-cache', signal });
      if (response.ok && cache) { try { await cache.put(request, response.clone()); } catch (_) { } }
      return response;
    }, 8000);
  } catch (_) { return (cache && (await cacheMatch(cache, request, { ignoreSearch: true }) || (request.mode === 'navigate' && (await cacheMatch(cache, new URL('index.html', SCOPE).href) || await cacheMatch(cache, SCOPE.href))))) || unavailable(); }
}
async function font(request) {
  try {
    const cache = await caches.open(FONTS), hit = await cacheMatch(cache, request); if (hit) return hit;
    return await deadline(async signal => { const response = await fetch(request, { signal }); if (response.ok || response.type === 'opaque') { try { await cache.put(request, response.clone()); } catch (_) { } } return response; }, 15000);
  } catch (_) { return unavailable(); }
}

function installError(code) { const error = new Error(code); error.code = code; return error; }
async function installMessage(state, detail) {
  try { for (const client of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) client.postMessage({ type: 'asset-cache-install-status', version: VERSION, state, detail }); } catch (_) { }
}
async function installShell() {
  await installMessage('installing', 'start');
  try {
    const cache = await caches.open(PAGE); let verified = false;
    // The two page URLs are the same generated document. One versioned download
    // saves a second large HTML transfer while the previous worker still runs.
    // Never label a stale CDN page as this worker's current offline shell.
    for (let attempt = 0; attempt < 2 && !verified; attempt++) {
      try {
        await deadline(async signal => {
          const url = new URL('index.html', SCOPE); url.searchParams.set('sw', VERSION); if (attempt) url.searchParams.set('retry', String(attempt));
          const response = await fetch(url.href, { cache: 'reload', signal, priority: 'high' });
          if (!response.ok) throw installError('shell-response-error');
          const html = await response.text(), match = /\bconst\s+BUILD\s*=\s*["']([^"']+)["']\s*;/.exec(html);
          if (!match || match[1] !== VERSION) throw installError('page-version-mismatch');
          const headers = new Headers(response.headers); headers.delete('content-encoding'); headers.delete('content-length');
          const pageResponse = () => new Response(html, { status: response.status, statusText: response.statusText, headers });
          await cache.put(new URL('index.html', SCOPE).href, pageResponse()); await cache.put(SCOPE.href, pageResponse()); verified = true;
        }, 90000);
      } catch (error) { if (attempt === 1) throw error; }
    }
    await installMessage('page-ready', 'verified-current-page');
    // Two small shell transfers at once leave bandwidth for the running game.
    const remaining = SHELL.filter(path => path !== './' && path !== 'index.html');
    const next = async () => {
      for (let path = remaining.shift(); path; path = remaining.shift()) await deadline(async signal => {
        const url = new URL(path, SCOPE).href, response = await fetch(url, { cache: 'no-cache', signal });
        if (!response.ok) throw installError('shell-response-error'); await cache.put(url, response);
      }, 90000);
    };
    await Promise.all([next(), next()]); await installMessage('shell-ready', 'offline-shell-cached');
    const libraries = await Promise.all(LIB.map(path => asset(new Request(new URL(path, SCOPE).href))));
    if (libraries.some(response => !response.ok)) throw installError('offline-libraries-unavailable');
    await installMessage('ready', 'offline-libraries-ready'); await self.skipWaiting();
  } catch (error) {
    const detail = error.code || (error.message === 'Download timed out' ? 'download-timeout' : ['QuotaExceededError', 'NotAllowedError', 'SecurityError'].includes(error.name) ? 'storage-error' : 'install-error');
    await installMessage('failed', detail); throw error;
  }
}
self.addEventListener('install', event => event.waitUntil(installShell()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  // Manifest housekeeping must not prevent an installed worker from activating
  // when storage becomes full. Gameplay can still use network-only responses.
  try {
    const cache = await assetCache(), current = entries.concat(LIB.map(path => new URL(path, SCOPE).href)).map(assetKey);
    let previous = []; try { const old = await cacheMatch(cache, META); if (old) { const manifest = await old.json(); previous = Array.isArray(manifest.keys) ? manifest.keys : []; } } catch (_) { }
    const retain = new Set([...current, ...previous, META]);
    for (const request of await cache.keys()) if (!retain.has(request.url)) await cache.delete(request);
    await cache.put(META, new Response(JSON.stringify({ version: VERSION, keys: current }), { headers: { 'content-type': 'application/json' } }));
  } catch (_) { }
  try { for (const name of await caches.keys()) if (name.startsWith('mamuli-page-') && name !== PAGE) await caches.delete(name); } catch (_) { }
  await self.clients.claim();
})()));
self.addEventListener('message', event => {
  const type = typeof event.data === 'string' ? event.data : event.data && event.data.type;
  if (type === 'keep-all') event.waitUntil(keepAll());
  else if (type === 'cache-status') event.waitUntil(status(event.source));
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url); if (request.method !== 'GET') return;
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') { event.respondWith(font(request)); return; }
  if (url.origin !== SCOPE.origin) return;
  if (url.pathname.includes('/art/') || url.pathname.includes('/vendor/')) { event.respondWith(asset(request)); return; }
  if (request.mode === 'navigate' || SHELL.some(path => path !== './' && url.pathname.endsWith('/' + path))) event.respondWith(page(request));
});
