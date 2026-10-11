// Exercise the production menu scheduler and UI screen switch with a fake idle
// queue. Heavy reveal preparation must never run during play or model loading.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const app = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
const ui = fs.readFileSync(path.join(__dirname, '../src/ui.js'), 'utf8');
const scheduler = app.slice(app.indexOf('function prepareCardVisuals()'), app.indexOf('function boot()'));
const visibilityWiring = app.split('\n').find(line => line.includes("document.addEventListener('visibilitychange'") && line.includes('prepareCardVisuals()'));
assert(visibilityWiring, 'boot must resume menu card preparation after visibility returns');
const screenSwitch = ui.slice(ui.indexOf('const UI = (() => {'), ui.indexOf('  function toast(', ui.indexOf('const UI = (() => {')));

function harness(options = {}) {
  let clock = 0, nextId = 0;
  const timers = new Map(), idle = new Map(), prepared = [], listeners = new Map();
  const screens = ['menu', 'game', 'lobby'].map(s => ({ id: 'scr-' + s, hidden: s !== 'menu' }));
  const menu = screens[0], assets = { active: 0, queued: 0 }, board = { ok: true };
  const document = {
    visibilityState: 'visible',
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); }
  };
  const context = vm.createContext({
    ...(options.noCards ? {} : { Card3D: { prepare(kind) { prepared.push(kind); return options.prepare !== false; } } }),
    ...(options.noAssets ? {} : { GLB: { stats: () => assets } }),
    Board3D: board, document,
    window: options.noIdle ? {} : { requestIdleCallback(fn, config) { const id = ++nextId; idle.set(id, { fn, config }); return id; } },
    $: selector => selector === '#scr-menu' && !options.noMenu ? menu : null,
    $$: selector => selector === '.screen' ? screens : [],
    Menu: { render() {} }, Voice: { render() {} }, Sheet: { close() {} }, View: { fit() {} },
    requestAnimationFrame() {},
    performance: { now: () => clock },
    setTimeout(fn, delay = 0) { const id = ++nextId; timers.set(id, { at: clock + delay, fn }); return id; },
    clearTimeout(id) { timers.delete(id); }
  });
  vm.runInContext(scheduler + '\n' + screenSwitch + '\nreturn { go };})();\nglobalThis.testUI = UI;\n' + visibilityWiring, context);
  function runIdle() {
    const item = idle.entries().next().value;
    assert(item, 'expected a queued idle slice'); idle.delete(item[0]);
    item[1].fn({ didTimeout: false, timeRemaining: () => 50 });
  }
  return {
    prepared, menu, assets, board, document, idle, timers, context,
    start() { context.prepareCardVisuals(); },
    go(screen) { context.testUI.go(screen); },
    runIdle,
    visibility(state) { document.visibilityState = state; for (const fn of listeners.get('visibilitychange') || []) fn(); },
    advance(ms) {
      const end = clock + ms; let runs = 0;
      for (;;) {
        const task = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!task) break;
        assert(++runs < 1000, 'scheduler must not spin within one timer turn');
        timers.delete(task[0]); clock = task[1].at; task[1].fn();
      }
      clock = end;
    }
  };
}

{
  const h = harness(); h.go('menu'); h.start(); h.start();
  assert.equal(h.idle.size, 1, 'screen entry and repeated requests share one queue');
  assert.equal(h.prepared.length, 0, 'screen entry does not synchronously compile card shaders');
  for (const [index, kind] of ['bottle', 'chest', 'scroll'].entries()) {
    h.runIdle(); assert.equal(h.prepared.length, index + 1, 'at most one kind per idle slice'); assert.equal(h.prepared[index], kind);
  }
  assert.equal(h.idle.size, 0); assert.equal(h.timers.size, 0);
  h.go('game'); h.go('menu'); assert.equal(h.idle.size, 0, 'completed preparation never repeats');
}
{
  const h = harness(); h.board.ok = false; h.start(); h.runIdle();
  assert.equal(h.prepared.length, 0, 'wait until board is built');
  h.board.ok = true; h.assets.active = 1; h.advance(400); h.runIdle();
  assert.equal(h.prepared.length, 0, 'do not compete with active model parsing');
  h.assets.active = 0; h.assets.queued = 2; h.advance(400); h.runIdle();
  assert.equal(h.prepared.length, 0, 'queued models also take priority');
  h.assets.queued = 0; h.advance(400);
  assert.equal(h.prepared.length, 0, 'model-wait timer yields preparation to a fresh idle slice');
  h.runIdle();
  assert.deepEqual(h.prepared, ['bottle']);
}
{
  const h = harness(); h.go('menu'); h.runIdle(); h.go('game'); h.runIdle();
  assert.deepEqual(h.prepared, ['bottle'], 'queued idle work cannot run after game starts');
  assert.equal(h.idle.size, 0); assert.equal(h.timers.size, 0);
  h.go('menu'); h.runIdle(); assert.deepEqual(h.prepared, ['bottle', 'chest'], 'returning to menu resumes at next unfinished kind');
  h.runIdle(); assert.deepEqual(h.prepared, ['bottle', 'chest', 'scroll']);
}
{
  const h = harness(); h.assets.active = 1; h.go('menu'); h.runIdle();
  h.go('game'); h.assets.active = 0; h.advance(400); h.runIdle();
  assert.equal(h.prepared.length, 0, 'model wait cannot resume card preparation during play');
  assert.equal(h.timers.size, 0); assert.equal(h.idle.size, 0);
  h.go('menu'); h.runIdle(); assert.deepEqual(h.prepared, ['bottle']);
}
{
  const h = harness(); h.start(); h.document.visibilityState = 'hidden'; h.runIdle();
  assert.equal(h.prepared.length, 0, 'hidden document never prepares');
  assert.equal(h.idle.size, 0); assert.equal(h.timers.size, 0);
  h.visibility('visible'); h.visibility('visible'); assert.equal(h.idle.size, 1, 'visibility return resumes one preparation queue');
  h.runIdle(); assert.deepEqual(h.prepared, ['bottle']);
  h.go('game'); h.runIdle(); h.visibility('hidden'); h.visibility('visible'); h.runIdle();
  assert.deepEqual(h.prepared, ['bottle'], 'visibility return during play cannot prepare a card');
}
{
  const h = harness({ noIdle: true }); h.start(); assert.equal(h.prepared.length, 0);
  h.advance(99); assert.equal(h.prepared.length, 0); h.advance(1); assert.deepEqual(h.prepared, ['bottle']);
  h.menu.hidden = true; h.advance(100); assert.deepEqual(h.prepared, ['bottle'], 'timer fallback also stops for gameplay');
}
for (const options of [{ noCards: true }, { noMenu: true }]) {
  const h = harness(options); h.start(); if (h.idle.size) h.runIdle();
  assert.equal(h.prepared.length, 0); assert.equal(h.timers.size, 0); assert.equal(h.idle.size, 0);
}
{
  const h = harness({ noAssets: true }); h.start(); h.runIdle(); assert.deepEqual(h.prepared, ['bottle'], 'optional GLB statistics do not block card preparation');
}
{
  const h = harness({ prepare: false }); h.start(); h.runIdle();
  assert.deepEqual(h.prepared, ['bottle']); assert.equal(h.idle.size, 0); assert.equal(h.timers.size, 0);
  h.start(); h.runIdle(); assert.deepEqual(h.prepared, ['bottle', 'bottle'], 'unavailable kind stays unfinished for a future menu attempt');
}
{
  const h = harness(); h.board.ok = false; h.start(); let attempts = 0;
  while (h.idle.size || h.timers.size) {
    assert(++attempts < 100, 'unavailable WebGL must not be polled indefinitely');
    if (h.idle.size) h.runIdle();
    h.advance(400);
  }
  assert.equal(h.prepared.length, 0); assert(attempts > 1, 'temporary board loading is given time to finish');
  assert.equal(h.context.prepareCardVisuals.pending, false, 'exhausted wait releases scheduler');
  h.board.ok = true; h.visibility('hidden'); h.visibility('visible'); h.runIdle();
  assert.deepEqual(h.prepared, ['bottle'], 'a later visible menu may retry after bounded wait expires');
}
console.log(JSON.stringify({ passed: true, menuOnly: true, oneKindPerIdle: true, loadingPriority: true, stopOnPlay: true, resumeOnMenu: true, resumeOnVisible: true, boundedModelWait: true, noDuplicateQueue: true, timerFallback: true }, null, 2));
