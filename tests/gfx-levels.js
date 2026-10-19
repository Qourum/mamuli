// The graphics levels (src/gfx.js): what each draws on a phone and on a computer, the level kept on the device, the
// address's own (?lq, ?gfx=), a phone's 60 or 120, and the fall to a lower level after a visit that died or lost its
// graphics with a game on the screen. The model loader's picture limit follows the level (src/glb.js configure).
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..'), source = fs.readFileSync(path.join(root, 'src/gfx.js'), 'utf8');
const IPHONE = { maxTouchPoints: 5, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' };
const MAC = { maxTouchPoints: 0, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15' };
function load({ phone = true, store = new Map(), search = '', hidden = false } = {}) {
  const listeners = {}, timers = [];
  const ctx = vm.createContext({
    screen: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    navigator: phone ? IPHONE : MAC,
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) },
    location: { search },
    addEventListener: (type, fn) => { listeners[type] = fn; },
    document: { visibilityState: hidden ? 'hidden' : 'visible', addEventListener: (type, fn) => { listeners['document ' + type] = fn; } },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimeout: () => { }
  });
  vm.runInContext(source + '\nglobalThis.Gfx = Gfx;', ctx);
  return { Gfx: ctx.Gfx, ctx, store, listeners, timers, saved: () => JSON.parse(store.get('mamuli.gfx') || '{}') };
}
const kept = obj => new Map([['mamuli.gfx', JSON.stringify(obj)]]);

// a phone starts at high: its own models and pictures, two pixels per point, smoothed edges, a finer shadow map
{
  const { Gfx } = load();
  assert.equal(Gfx.phone, true); assert.equal(Gfx.level, 'high'); assert.equal(Gfx.def, 'high'); assert.equal(Gfx.name, 'მაღალი');
  assert.deepEqual({ ...Gfx.spec }, { lite: true, phoneModels: true, cap: 512, pr: 2, aa: true, shadow: 1024, soft: false, aniso: 8, net: true });
  assert.equal(Gfx.fps, 60); assert.equal(Gfx.meter, false);
  assert.equal(Gfx.specOf('standard').pr, 1.5, 'the standard level is the phone drawing as it was');
  assert.equal(Gfx.specOf('standard').aa, false); assert.equal(Gfx.specOf('standard').net, false);
  assert.equal(Gfx.specOf('low').shadow, 0);
}
// ultra on a phone: what a computer draws, every pixel of the screen (up to three per point)
{
  const { Gfx } = load({ store: kept({ level: 'ultra' }) });
  assert.equal(Gfx.level, 'ultra');
  assert.deepEqual({ ...Gfx.spec }, { lite: false, phoneModels: false, cap: 0, pr: 3, aa: true, shadow: 2048, soft: true, aniso: 16, net: true });
}
// a computer keeps its own drawing at the standard level
{
  const { Gfx } = load({ phone: false });
  assert.equal(Gfx.phone, false); assert.equal(Gfx.level, 'standard');
  assert.deepEqual({ ...Gfx.spec }, { lite: false, phoneModels: false, cap: 0, pr: 1.75, aa: true, shadow: 2048, soft: true, aniso: 8, net: true });
  assert.equal(Gfx.setFps(120), 60, 'a computer draws every frame its screen offers: no 60/120 choice');
}
// nonsense kept on the device is ignored
assert.equal(load({ store: new Map([['mamuli.gfx', '{"level":"8k","fps":999}']]) }).Gfx.level, 'high');
assert.equal(load({ store: new Map([['mamuli.gfx', 'not json']]) }).Gfx.level, 'high');
assert.equal(load({ store: new Map([['mamuli.gfx', '{"level":"ultra","fps":999}']]) }).Gfx.fps, 60);
// the address: ?lq is the low level for this visit, ?gfx= another one; neither is kept
{
  const { Gfx, saved } = load({ store: kept({ level: 'ultra' }), search: '?lq' });
  assert.equal(Gfx.level, 'low'); assert.equal(Gfx.chosen, 'ultra'); assert.equal(saved().level, 'ultra');
  assert.equal(load({ search: '?test&gfx=ultra' }).Gfx.level, 'ultra');
  assert.equal(load({ search: '?gfx=8k' }).Gfx.level, 'high');
}
// choosing: kept for the next visit, this one goes on as it was made
{
  const { Gfx, saved, store } = load();
  assert.equal(Gfx.choose('ultra'), 'ultra'); assert.equal(Gfx.level, 'high'); assert.equal(Gfx.chosen, 'ultra'); assert.equal(saved().level, 'ultra');
  assert.equal(Gfx.choose('8k'), 'ultra', 'an unknown level is not taken');
  assert.equal(Gfx.setFps(120), 120); assert.equal(saved().fps, 120); assert.equal(Gfx.setMeter(true), true); assert.equal(saved().meter, true);
  const next = load({ store }).Gfx;
  assert.equal(next.level, 'ultra'); assert.equal(next.fps, 120); assert.equal(next.meter, true);
}
// a visit at ultra that died with a game on the screen: the next one opens at high and says what it fell from
{
  const first = load({ store: kept({ level: 'ultra' }) });
  first.Gfx.playing();
  assert.equal(first.saved().trying, 'ultra', 'a game on the screen is written down');
  assert.equal(first.timers.at(-1).ms, 60000);
  const next = load({ store: first.store });
  assert.equal(next.Gfx.level, 'high'); assert.equal(next.Gfx.fell, 'ultra'); assert.equal(next.saved().level, 'high');
  assert.equal(next.saved().trying, undefined, 'the mark is cleared');
  assert.equal(load({ store: next.store }).Gfx.fell, '', 'it says so once');
  // and at high too: the fall is to the standard level, never further by itself
  next.Gfx.playing();
  const third = load({ store: next.store });
  assert.equal(third.Gfx.level, 'standard'); assert.equal(third.Gfx.fell, 'high');
  third.Gfx.playing(); assert.equal(third.saved().trying, undefined, 'the standard level is not watched');
}
// a game that ran its minute, or a page put away in order, is no reason to fall
{
  const a = load({ store: kept({ level: 'ultra' }) });
  a.Gfx.playing(); a.timers.at(-1).fn();
  assert.equal(load({ store: a.store }).Gfx.level, 'ultra');
  const b = load({ store: kept({ level: 'ultra' }) });
  b.Gfx.playing(); b.listeners.pagehide();
  assert.equal(load({ store: b.store }).Gfx.level, 'ultra');
  const c = load({ store: kept({ level: 'ultra' }) });
  c.Gfx.playing(); c.ctx.document.visibilityState = 'hidden'; c.listeners['document visibilitychange']();
  assert.equal(load({ store: c.store }).Gfx.level, 'ultra');
}
// a minute is not enough while the models are still arriving (a slow network): the mark waits for them
{
  const a = load({ store: kept({ level: 'ultra' }) });
  let loading = 3; a.ctx.GLB = { stats: () => ({ active: loading ? 1 : 0, queued: loading ? loading - 1 : 0 }) };
  a.Gfx.playing(); assert.equal(a.timers.at(-1).ms, 60000);
  a.timers.at(-1).fn();
  assert.equal(a.saved().trying, 'ultra', 'models still loading: still watched'); assert.equal(a.timers.at(-1).ms, 15000);
  loading = 0; a.timers.at(-1).fn();
  assert.equal(a.saved().trying, undefined, 'all arrived: cleared');
}
// graphics lost on the screen at ultra: the next visit falls; lost in the background: no
{
  const a = load({ store: kept({ level: 'ultra' }) });
  a.Gfx.lost(); a.Gfx.playing(); a.listeners.pagehide();
  assert.equal(load({ store: a.store }).Gfx.level, 'high', 'a loss is not cleared by an orderly close');
  const b = load({ store: kept({ level: 'ultra' }), hidden: true });
  b.Gfx.lost();
  assert.equal(load({ store: b.store }).Gfx.level, 'ultra');
}
// a visit asked for by the address is not watched (the level kept is not the one drawn)
{
  const a = load({ store: kept({ level: 'ultra' }), search: '?gfx=ultra&x' });
  a.Gfx.choose('high'); a.Gfx.playing();
  assert.equal(a.saved().trying, undefined);
}
// a computer is never made to fall
{
  const a = load({ phone: false, store: kept({ level: 'ultra' }) });
  a.Gfx.playing(); a.Gfx.lost();
  assert.equal(load({ phone: false, store: a.store }).Gfx.level, 'ultra');
}

// the loader: the phone models' pictures at 512 unless the level says otherwise; none at all for the full models
{
  global.window = global; global.THREE = require('../vendor/three.min.js');
  const ctx = vm.createContext({ window: { THREE: global.THREE }, document: {}, fetch: () => { throw new Error('no fetch'); }, console, setTimeout, clearTimeout, TextDecoder, URL });
  vm.runInContext(fs.readFileSync(path.join(root, 'src/glb.js'), 'utf8') + '\nglobalThis.__GLB = GLB;', ctx);
  const GLB = ctx.__GLB;
  assert.equal(GLB.stats().cap, 0, 'a computer keeps the pictures as made');
  assert.equal(GLB.configure({ mobile: true }).cap, 512, 'the phone models default to 512');
  assert.equal(GLB.configure({ mobile: true, cap: 1024 }).cap, 1024);
  assert.equal(GLB.configure({ mobile: false, cap: 0 }).cap, 0, 'ultra on a phone: the full pictures');
  assert.equal(GLB.configure({ mobile: false }).cap, 0);
  assert.equal(GLB.configure({ mobile: true, cap: 512, concurrency: 2 }).concurrency, 2);
}
console.log('graphics levels: phone high by default, ultra = the computer drawing at full resolution, computers unchanged; kept choices, address overrides, 60/120, crash and graphics-loss fallback, loader picture limits passed');
