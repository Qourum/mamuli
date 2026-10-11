// Execute the production menu helper with a fake worker and clock. No network or download is needed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const app = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
const helper = app.slice(app.indexOf('function offlineHelper()'), app.indexOf('// ----- the lobby:'));

function harness(options = {}) {
  let now = 0, nextTimer = 0, resolveReady, updates = 0;
  const notes = [], registrationListeners = new Map();
  const timers = new Map(), listeners = new Map(), loadListeners = [], posts = [], calls = [];
  const elements = {};
  for (const id of ['assetDownload', 'assetDownloadStatus', 'assetDownloadProgress', 'bAssetDownload']) {
    elements[id] = { hidden: true, disabled: false, dataset: {}, textContent: '', handlers: {},
      addEventListener(type, fn) { this.handlers[type] = fn; },
      removeAttribute(name) { delete this[name]; } };
  }
  const workerListeners = new Set();
  const worker = { state: options.state || 'activated', postMessage(message) { posts.push(message); },
    addEventListener(type, fn) { if (type === 'statechange') workerListeners.add(fn); },
    removeEventListener(type, fn) { if (type === 'statechange') workerListeners.delete(fn); } };
  const registration = { active: worker,
    addEventListener(type, fn) { registrationListeners.set(type, fn); },
    update() { updates++; return options.updateReject ? Promise.reject(Object.assign(Error('private URL must not be logged'), { name: 'NetworkError' })) : Promise.resolve(registration); } };
  const serviceWorker = {
    controller: options.controller === false ? null : worker,
    ready: new Promise(resolve => { resolveReady = resolve; }),
    addEventListener(type, fn) { listeners.set(type, fn); },
    register(url, config) { calls.push({ url, config }); return options.reject ? Promise.reject(Error('offline')) : Promise.resolve(registration); }
  };
  const context = vm.createContext({
    ...(options.noDiag ? {} : { Diag: { note(kind, text) { notes.push({ kind, text }); } } }),
    $: selector => elements[selector.slice(1)], SITE: options.site !== false, BUILD: 'test-version',
    navigator: options.noSW ? {} : { serviceWorker },
    location: { protocol: options.protocol || 'http:', hostname: options.hostname || '127.0.0.1' },
    document: { readyState: options.loading ? 'loading' : 'complete' },
    addEventListener(type, fn) { if (type === 'load') loadListeners.push(fn); },
    setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { at: now + delay, fn }); return id; },
    clearTimeout(id) { timers.delete(id); }
  });
  vm.runInContext(helper + '\nofflineHelper();', context);
  return { elements, worker, registration, serviceWorker, calls, posts, notes,
    load() { loadListeners.splice(0).forEach(fn => fn()); },
    ready(activate = true) { if (activate) worker.state = 'activated'; resolveReady(registration); },
    transition(state) { worker.state = state; [...workerListeners].forEach(fn => fn()); },
    emit(data, source = worker) { listeners.get('message')?.({ data: { type: 'asset-cache-progress', version: 'test-version', ...data }, source }); },
    change() { listeners.get('controllerchange')?.(); },
    updateFound() { registrationListeners.get('updatefound')?.(); },
    click() { elements.bAssetDownload.handlers.click?.(); },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const candidate = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!candidate) break;
        const [id, timer] = candidate; timers.delete(id); now = timer.at; timer.fn();
      }
      now = end;
    },
    get autoDownloads() { return posts.filter(message => message && message.type === 'keep-all').length; },
    get updates() { return updates; }
  };
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const state = h => h.elements.assetDownload.dataset.state;
const button = h => h.elements.bAssetDownload;
const progress = h => h.elements.assetDownloadProgress;

(async () => {
  for (const options of [{}, { hostname: 'localhost' }, { hostname: '[::1]' }, { hostname: 'qourum.github.io', protocol: 'https:' }]) {
    const h = harness(options); await flush();
    assert.equal(h.calls.length, 1, 'local hosts and HTTPS register');
    assert.equal(h.calls[0].url, 'sw.js');
    assert.equal(h.calls[0].config.updateViaCache, 'none');
    assert(h.posts.some(message => message.type === 'cache-status'), 'active worker gets immediate status');
    assert.equal(h.autoDownloads, 0, 'downloads do not gate menu/startup');
  }
  for (const options of [{ hostname: 'example.com' }, { site: false }, { noSW: true }]) {
    const h = harness(options); await flush();
    assert.equal(h.calls.length, 0);
    assert.equal(button(h).hidden, true);
    assert.equal(progress(h).hidden, true);
    assert.match(h.elements.assetDownloadStatus.textContent, /თამაშის გახსნისას/);
  }
  {
    const h = harness({ loading: true }); await flush();
    assert.equal(h.calls.length, 0); h.load(); await flush(); assert.equal(h.calls.length, 1);
  }
  {
    const h = harness({ state: 'installing', controller: false }); await flush();
    assert.equal(h.posts.length, 0, 'installing worker is never messaged');
    h.advance(9000); assert.equal(button(h).disabled, false);
    h.click(); await flush(); h.click(); await flush();
    assert.equal(h.posts.length, 0);
    h.ready(); await flush();
    assert(h.posts.some(message => message.type === 'cache-status'));
    h.advance(11999); assert.equal(h.autoDownloads, 0);
    h.advance(1); assert.equal(h.autoDownloads, 1, 'retries attach only one ready warm timer');
  }
  {
    const h = harness({ state: 'activating', controller: false }); await flush();
    h.emit({ type: 'asset-cache-install-status', state: 'shell-ready', detail: 'https://private.example/' });
    assert(h.notes.some(note => note.text === 'install shell-ready, version test-version'), 'observed installer can report health before activation');
    assert.equal(h.posts.length, 0, 'installer health authorization does not send it requests');
    assert(!h.notes.some(note => note.text.includes('private.example')));
    h.emit({ type: 'asset-cache-install-status', state: 'failed', detail: 'download-timeout' });
    assert(h.notes.some(note => note.text.endsWith(', download-timeout')), 'known installer failure reason is recorded');
    h.ready(false); await flush();
    assert.equal(h.posts.length, 0, 'ready may resolve before the worker is activated');
    h.advance(9000); assert.equal(button(h).disabled, false);
    h.transition('activated');
    assert.equal(h.posts.at(-1).type, 'cache-status', 'first visit refreshes status on activation without page reload');
    h.emit({ done: 66, total: 116, failed: 0, running: false });
    assert.equal(progress(h).value, 66);
    h.advance(12000); assert.equal(h.autoDownloads, 1);
  }
  {
    const h = harness({ state: 'activating' }); await flush();
    h.ready(false); await flush(); h.change();
    assert.equal(h.posts.length, 0, 'controllerchange can precede activation too');
    h.transition('activated');
    assert.deepEqual(h.posts.map(message => message.type), ['cache-status', 'keep-all']);
    h.emit({ done: 0, total: 116, failed: 0, running: true });
    h.advance(12000); assert.equal(h.autoDownloads, 1, 'activation handshake avoids duplicate warmups');
  }
  {
    const h = harness(); await flush(); h.ready(); await flush();
    h.emit({ done: 7, total: 20, bytes: 2097152, failed: 0, running: true, complete: false });
    assert.equal(state(h), 'running'); assert.equal(progress(h).max, 20); assert.equal(progress(h).value, 7);
    assert.equal(button(h).disabled, true); assert.match(h.elements.assetDownloadStatus.textContent, /7 \/ 20 ფაილი · 2.0 მბ/);
    h.emit({ done: 19, total: 20, failed: 1, running: false, complete: true });
    assert.equal(state(h), 'failed', 'failed downloads cannot display complete');
    assert.equal(button(h).textContent, 'ხელახლა ცდა'); assert.equal(button(h).disabled, false);
    h.click(); assert.equal(h.autoDownloads, 1);
    h.emit({ done: 20, total: 20, failed: 0, running: false, complete: true });
    assert.equal(state(h), 'complete'); assert.equal(button(h).textContent, 'შემოწმება');
    const before = h.posts.length; h.click(); assert.equal(h.posts[before].type, 'cache-status');
    h.emit({ done: 0, total: 20, failed: 0, running: true }, { state: 'activated' });
    assert.equal(state(h), 'checking', 'unrelated worker progress is ignored');
    h.emit({ done: 20, total: 20, failed: 0, complete: true, version: 'old-version' });
    assert.equal(state(h), 'update-ready', 'old build cannot claim current files are complete');
    assert.match(h.elements.assetDownloadStatus.textContent, /განაახლე გვერდი თამაშის დასრულების შემდეგ/);
    assert.equal(button(h).textContent, 'შემოწმება');
    const oldVersionPosts = h.posts.length; h.click();
    assert.equal(h.posts[oldVersionPosts].type, 'cache-status', 'version mismatch checks instead of repeatedly downloading');
    h.emit({ done: 20, total: 20, failed: 0, complete: true, version: 'old-version' });
    h.advance(12000); assert.equal(h.autoDownloads, 1, 'version mismatch cancels delayed download');
    h.emit({ done: Infinity, total: Infinity, bytes: Infinity, failed: 0, complete: true });
    assert.equal(state(h), 'available'); assert.equal(progress(h).value, 0); assert.equal(progress(h).max, 1);
  }
  {
    const h = harness(); await flush(); h.ready(); await flush();
    h.emit({ done: 1, total: 20, failed: 0, running: false });
    h.advance(11999); assert.equal(h.autoDownloads, 0);
    h.advance(1); assert.equal(h.autoDownloads, 1);
    h.emit({ done: 20, total: 20, failed: 1, running: false, complete: true });
    assert.equal(state(h), 'failed', 'a full count with failures still needs retry');
  }
  {
    const h = harness(); await flush();
    h.advance(9000); assert.equal(state(h), 'available'); assert.equal(button(h).disabled, false);
    h.click(); await flush();
    assert.equal(h.posts.at(-2).type, 'keep-all'); assert.equal(h.posts.at(-1), 'keep-all', 'legacy download compatibility');
    assert.equal(h.updates, 1, 'manual legacy retry also retries a failed new worker installation');
    h.advance(9000); assert.equal(button(h).disabled, false, 'legacy helper never leaves a permanent spinner');
    assert.equal(h.updates, 1, 'worker updates are not polled');
    assert(h.notes.some(note => note.text.includes('progress timeout after 9s')));
    assert(h.notes.some(note => note.text.includes('manual update checked')));
  }
  {
    const h = harness(); await flush();
    const newMessages = [], fresh = { state: 'activated', postMessage(message) { newMessages.push(message); } };
    // A controller change can briefly precede the registration.active object's update.
    h.serviceWorker.controller = fresh;
    const oldPosts = h.posts.length; h.change();
    assert.equal(h.posts.length, oldPosts, 'stale registration.active must not win over the new controller');
    assert.deepEqual(newMessages.map(message => message.type), ['cache-status', 'keep-all']);
    h.emit({ done: 116, total: 116, failed: 0, complete: true }, fresh);
    assert.equal(state(h), 'complete');
  }
  {
    const h = harness(); await flush();
    const transitions = new Set(), installing = { state: 'installing',
      addEventListener(type, fn) { transitions.add(fn); }, removeEventListener(type, fn) { transitions.delete(fn); } };
    h.registration.installing = installing; h.updateFound();
    installing.state = 'redundant'; [...transitions].forEach(fn => fn());
    assert(h.notes.some(note => note.text.includes('update found')));
    assert(h.notes.some(note => note.text.includes('installing state redundant')), 'late update installation failure is diagnosed');
    assert.equal(transitions.size, 0, 'terminal worker observer is removed');
  }
  {
    const h = harness({ updateReject: true }); await flush(); h.advance(9000); h.click(); await flush();
    assert(h.notes.some(note => note.text.includes('manual update failed: NetworkError')));
    assert(!h.notes.some(note => note.text.includes('private URL')), 'diagnostics never include arbitrary exception text');
    h.emit({ done: 20, total: 20, failed: 0, complete: true, version: 'https://private.example/secret' });
    assert(!h.notes.some(note => note.text.includes('private.example')), 'worker version diagnostics are bounded identifiers');
  }
  {
    const h = harness({ noDiag: true }); await flush(); h.ready(); await flush();
    h.emit({ done: 116, total: 116, failed: 0, complete: true });
    assert.equal(state(h), 'complete', 'diagnostics are optional');
  }
  {
    const h = harness(); await flush(); h.ready(); await flush();
    h.emit({ done: 0, total: 20, failed: 0, running: false });
    const before = h.posts.length; h.change();
    assert.deepEqual(h.posts.slice(before).map(message => message.type), ['cache-status', 'keep-all']);
    h.advance(12000); assert.equal(h.autoDownloads, 1, 'controller change cancels duplicate delayed download');
  }
  {
    const h = harness({ reject: true }); await flush();
    assert.equal(state(h), 'available'); assert.equal(button(h).disabled, false);
    h.serviceWorker.controller = null; h.click(); await flush();
    assert.equal(h.calls.length, 2, 'registration failure remains retryable');
  }
  console.log('Offline menu: activated-worker handshake, counted progress, retry, secure/local hosts, delayed warmup and legacy fallback passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
