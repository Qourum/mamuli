// Exercise the production worker with real request/response streams and SHA-256.
// CacheStorage and network scheduling are controlled; no browser/network needed.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { webcrypto, createHash } = require('node:crypto');
const source = fs.readFileSync(path.join(__dirname, '../src/sw.js'), 'utf8');
const SCOPE = 'https://qourum.github.io/mamuli/', digest = value => createHash('sha256').update(value).digest('hex');
const absolute = value => new URL(typeof value === 'string' ? value : value.url, SCOPE).href;
const response = (body, status = 200) => new Response(body, { status, headers: { 'content-length': String(Buffer.byteLength(body)), 'content-type': 'application/octet-stream' } });
class Store {
  constructor() { this.data = new Map(); this.failPuts = false; this.clones = 0; }
  async match(input, options = {}) {
    const url = absolute(input); let value = this.data.get(url);
    if (!value && options.ignoreSearch) { const target = new URL(url); target.search = ''; for (const [key, candidate] of this.data) { const current = new URL(key); current.search = ''; if (current.href === target.href) { value = candidate; break; } } }
    if (!value) return undefined;
    const result = response(value.body, value.status), clone = result.clone.bind(result); result.clone = () => { this.clones++; return clone(); }; return result;
  }
  async put(input, value) { if (this.failPuts) throw Error('Quota exceeded'); const body = Buffer.from(await value.arrayBuffer()); this.data.set(absolute(input), { body, status: value.status }); }
  async keys() { return [...this.data.keys()].map(url => new Request(url)); }
  async delete(input) { return this.data.delete(absolute(input)); }
}
class CacheStorage {
  constructor() { this.stores = new Map(); }
  async open(name) { if (!this.stores.has(name)) this.stores.set(name, new Store()); return this.stores.get(name); }
  async keys() { return [...this.stores.keys()]; }
  async delete(name) { return this.stores.delete(name); }
}
function worker({ version = 'test-one', bodies, storage = new CacheStorage(), arts = Object.keys(bodies).filter(name => name.startsWith('art/')).map(name => name.slice(4)) }) {
  const revisions = Object.fromEntries(Object.entries(bodies).map(([name, body]) => [name, digest(body)])), handlers = new Map(), requests = [], timers = new Map(), messages = [];
  let timerId = 0, network = async url => response(bodies[new URL(url).pathname.slice('/mamuli/'.length)] || 'shell'), active = 0, maxActive = 0, digestActive = 0, maxDigest = 0, skipped = 0, claimed = 0;
  const client = { postMessage(value) { messages.push(value); } };
  const self = { registration: { scope: SCOPE }, crypto: { subtle: { async digest(...args) { digestActive++; maxDigest = Math.max(maxDigest, digestActive); try { return await webcrypto.subtle.digest(...args); } finally { digestActive--; } } } },
    clients: { async matchAll() { return [client]; }, async claim() { claimed++; } }, async skipWaiting() { skipped++; }, addEventListener: (type, callback) => handlers.set(type, callback) };
  const context = vm.createContext({ self, caches: storage, URL, Request, Response, Headers, AbortController, Uint8Array, console,
    setTimeout(fn, milliseconds) { timers.set(++timerId, { fn, milliseconds }); return timerId; }, clearTimeout(id) { timers.delete(id); },
    async fetch(input, options = {}) { const url = absolute(input); requests.push({ url, options }); active++; maxActive = Math.max(maxActive, active); try { return await network(url, options); } finally { active--; } } });
  const code = source.replace("'__VERSION__'", JSON.stringify(version)).replace('__ARTS__', JSON.stringify(arts)).replace('__ASSET_REVISIONS__', JSON.stringify(revisions));
  vm.runInContext(code + '\nglobalThis.debug={assetKey,stats:()=>({tasks:tasks.size,queued:queue.length,networkActive,backgroundActive,foregroundDemand,migrationActive})};', context);
  async function lifecycle(type) { let completion; handlers.get(type)({ waitUntil(value) { completion = value; } }); await completion; }
  function message(data, source = client) { let completion; handlers.get('message')({ data, source, waitUntil(value) { completion = value; } }); return completion || Promise.resolve(); }
  function fetchAsset(file) { let result; handlers.get('fetch')({ request: new Request(absolute(file)), respondWith(value) { result = value; } }); return result; }
  return { storage, requests, messages, timers, client, lifecycle, message, fetchAsset, key: input => context.debug.assetKey(input), stats: () => context.debug.stats(), setNetwork(value) { network = value; }, maxActive: () => maxActive, maxDigest: () => maxDigest, skipped: () => skipped, claimed: () => claimed };
}
async function flush() { for (let i = 0; i < 4; i++) { for (let j = 0; j < 12; j++) await Promise.resolve(); await new Promise(setImmediate); } }
async function waitFor(predicate) { for (let i = 0; i < 100 && !predicate(); i++) await flush(); assert(predicate(), 'scheduled operation became ready'); }
const bodies = { 'art/model.glb': 'model version one', 'art/image.webp': 'small picture', 'art/other.glb': 'other native mesh', 'art/broken.glb': 'repaired mesh', 'vendor/three.min.js': 'three source', 'vendor/GLTFLoader.min.js': 'loader source' };
(async () => {
  const w = worker({ bodies }); await w.lifecycle('activate');
  let releaseModel, broken = true;
  w.setNetwork(async url => { const name = new URL(url).pathname.slice('/mamuli/'.length); if (name === 'art/model.glb') await new Promise(resolve => { releaseModel = resolve; }); if (name === 'art/broken.glb' && broken) return response('temporary failure', 503); return response(bodies[name] || 'shell'); });
  const preparation = w.message({ type: 'keep-all' }); await waitFor(() => !!releaseModel);
  const a = w.fetchAsset('art/model.glb?request=one'), b = w.fetchAsset('art/model.glb?request=two'); await flush();
  assert.equal(w.requests.filter(r => r.url.includes('/art/model.glb')).length, 1, 'keep-all and two requested instances share one transfer'); releaseModel();
  assert.equal(await (await a).text(), bodies['art/model.glb']); assert.equal(await (await b).text(), bodies['art/model.glb']); await preparation;
  assert.equal(w.messages.at(-1).done, 3); assert.equal(w.messages.at(-1).failed, 1); assert.equal(w.messages.at(-1).running, false); assert.equal(w.messages.at(-1).complete, false); assert(w.maxActive() <= 4);
  const coldTransfers = w.requests.length, warmStore = await w.storage.open('mamuli-files-v2'), cloneCount = warmStore.clones; const warm = await w.fetchAsset('art/model.glb'); assert.equal(await warm.text(), bodies['art/model.glb']); assert.equal(w.requests.length, coldTransfers, 'warm GLB performs no background fetch'); assert.equal(warmStore.clones, cloneCount, 'warm model stream is not cloned into an unread large body');
  broken = false; const retry1 = w.message('keep-all'), retry2 = w.message({ type: 'keep-all' }); await Promise.all([retry1, retry2]); assert.equal(w.requests.length, coldTransfers + 1, 'retry downloads only the failed revision once');
  const ready = w.messages.at(-1); assert.equal(ready.done, 4); assert.equal(ready.total, 4); assert.equal(ready.failed, 0); assert.equal(ready.complete, true); assert.equal(ready.type, 'asset-cache-progress'); assert(ready.bytes > 0);
  await w.message({ type: 'cache-status' }); assert.equal(w.messages.at(-1).done, 4);
  const unchanged = worker({ version: 'code-update', bodies, storage: w.storage }); await unchanged.lifecycle('activate');
  for (const name of Object.keys(bodies).filter(name => name.startsWith('art/'))) assert.equal(await (await unchanged.fetchAsset(name)).text(), bodies[name]);
  assert.equal(unchanged.requests.length, 0, 'code updates retain every unchanged asset without network');
  const changedBodies = { ...bodies, 'art/model.glb': 'model version two' }, changed = worker({ version: 'asset-update', bodies: changedBodies, storage: w.storage }); await changed.lifecycle('activate');
  assert.equal(await (await changed.fetchAsset('art/model.glb')).text(), changedBodies['art/model.glb']); assert.equal(changed.requests.length, 1); assert.equal(new URL(changed.requests[0].url).searchParams.get('v'), digest(changedBodies['art/model.glb']), 'changed filename is fetched through its new content hash URL');
  const offlineBodies = { ...changedBodies, 'art/model.glb': 'model version three' }, offline = worker({ version: 'offline-update', bodies: offlineBodies, storage: w.storage }); await offline.lifecycle('activate'); offline.setNetwork(async () => { throw Error('Offline'); });
  assert.equal(await (await offline.fetchAsset('art/model.glb')).text(), changedBodies['art/model.glb'], 'offline update can use the last model revision'); await offline.message({ type: 'cache-status' }); assert.equal(offline.messages.at(-1).done, 3); assert.equal(offline.messages.at(-1).complete, false, 'old offline bytes are never marked as current');
  offline.setNetwork(async url => response(offlineBodies[new URL(url).pathname.slice('/mamuli/'.length)])); assert.equal(await (await offline.fetchAsset('art/model.glb')).text(), offlineBodies['art/model.glb']); assert.equal(offline.requests.length, 2, 'offline failed request is removed and can recover');

  const legacyStorage = new CacheStorage(), legacy = await legacyStorage.open('mamuli-files'); await legacy.put(absolute('art/model.glb'), response(bodies['art/model.glb'])); await legacy.put(absolute('art/other.glb'), response('wrong old contents'));
  const migration = worker({ bodies, storage: legacyStorage }); const migratedA = migration.fetchAsset('art/model.glb'), migratedB = migration.fetchAsset('art/model.glb?duplicate=1'), mismatch = migration.fetchAsset('art/other.glb');
  assert.equal(await (await migratedA).text(), bodies['art/model.glb']); assert.equal(await (await migratedB).text(), bodies['art/model.glb']); assert.equal(await (await mismatch).text(), bodies['art/other.glb']);
  assert.equal(migration.requests.length, 1, 'verified legacy asset migrates without network; changed bytes download'); assert.equal(migration.maxDigest(), 1, 'large legacy bodies are verified one at a time');
  const assetStore = await migration.storage.open('mamuli-files-v2'); assert(await assetStore.match(migration.key('art/model.glb')));
  const quota = worker({ bodies }); const quotaStore = await quota.storage.open('mamuli-files-v2'); quotaStore.failPuts = true; assert.equal(await (await quota.fetchAsset('art/model.glb')).text(), bodies['art/model.glb'], 'storage quota never prevents the requested network model from loading');
  await quota.message({ type: 'keep-all' }); assert.equal(quota.messages.at(-1).complete, false); assert.equal(quota.messages.at(-1).failed, 4);
  quotaStore.failPuts = false; await quota.message({ type: 'keep-all' }); assert.equal(quota.messages.at(-1).complete, true, 'retry recovers after storage becomes available');

  const hung = worker({ bodies }); hung.setNetwork(() => new Promise(() => {})); const pendingHung = hung.fetchAsset('art/model.glb'); await waitFor(() => hung.requests.length === 1 && hung.timers.size > 0);
  for (const timer of [...hung.timers.values()]) timer.fn(); assert.equal((await pendingHung).status, 504); await flush(); assert.equal(hung.stats().tasks, 0); assert.equal(hung.stats().networkActive, 0, 'even an uncooperative hung fetch frees its queue slot');
  hung.setNetwork(async () => response(bodies['art/model.glb'])); assert.equal(await (await hung.fetchAsset('art/model.glb')).text(), bodies['art/model.glb']);
  const poolBodies = Object.fromEntries(Array.from({ length: 8 }, (_, i) => ['art/q' + i + '.glb', 'q' + i])), pool = worker({ bodies: poolBodies }); const held = new Map();
  pool.setNetwork(url => new Promise(resolve => held.set(new URL(url).pathname.split('/').at(-1), resolve)));
  const demands = Array.from({ length: 5 }, (_, i) => pool.fetchAsset('art/q' + i + '.glb')); const batch = pool.message({ type: 'keep-all' }); await waitFor(() => held.size === 4);
  assert.equal(pool.requests.length, 4); assert(pool.requests.every(r => /q[0-3]\.glb/.test(r.url)), 'background jobs do not overtake requested assets');
  held.get('q0.glb')(response('q0')); await waitFor(() => held.has('q4.glb')); assert.equal(pool.requests.at(-1).url.split('?')[0], absolute('art/q4.glb'), 'next free slot serves foreground demand first');
  for (const name of ['q1.glb', 'q2.glb', 'q3.glb', 'q4.glb']) held.get(name)(response(name)); await Promise.all(demands); await waitFor(() => held.has('q5.glb') && held.has('q6.glb'));
  assert.equal(pool.stats().backgroundActive, 2); assert(!held.has('q7.glb'), 'idle preparation has only two network streams'); held.get('q5.glb')(response('q5')); held.get('q6.glb')(response('q6')); await waitFor(() => held.has('q7.glb')); held.get('q7.glb')(response('q7')); await batch; assert(pool.maxActive() <= 4);
  const installed = worker({ bodies }); await installed.lifecycle('install'); await installed.lifecycle('activate'); assert.equal(installed.skipped(), 1); assert.equal(installed.claimed(), 1); assert.equal((await (await installed.storage.open('mamuli-page-test-one')).keys()).length, 8);
  assert(await (await installed.storage.open('mamuli-files-v2')).match(installed.key('vendor/three.min.js'))); assert(await (await installed.storage.open('mamuli-files-v2')).match(installed.key('vendor/GLTFLoader.min.js')));
  const quotaActivation = worker({ bodies, storage: installed.storage }); (await quotaActivation.storage.open('mamuli-files-v2')).failPuts = true; await quotaActivation.lifecycle('activate'); assert.equal(quotaActivation.claimed(), 1, 'optional manifest quota failure never strands worker activation');
  console.log(JSON.stringify({ passed: true, sharedDemandAndPrefetch: true, warmAssetsNetwork: 0, warmLargeBodyClones: 0, unchangedBuildNetwork: 0, changedRevisionTransfers: 1, verifiedLegacyMigration: true, serialDigest: true, progressAndRetry: true, offlineRecovery: true, quotaRecovery: true, quotaActivationPreserved: true, hungTransferRecovery: true, foregroundPriority: true, backgroundStreams: 2, maximumNetworkStreams: 4, offlineShellAndLibraries: true }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
