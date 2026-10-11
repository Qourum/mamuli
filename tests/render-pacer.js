const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../src/render-pacer.js'), 'utf8') + '\nglobalThis.pacer = RenderPacer;', context);
function simulate(hz, mobile, active, jitter = 0) {
  const pacer = context.pacer.create(mobile); let count = 0, elapsed = 0, last = 0;
  for (let i = 0; i <= hz * 10; i++) {
    const now = i * 1000 / hz + jitter * Math.sin(i * 1.618);
    if (pacer.step(now, active)) { count++; last = now; if (count > 1) elapsed += pacer.delta; }
  }
  assert(Math.abs(elapsed - last / 1000) < 1e-8, 'animation delta follows actual painted elapsed time');
  return {count, elapsed};
}
for (const hz of [60, 75, 90, 120]) {
  for (const active of [false, true]) {
    const r = simulate(hz, true, active);
    assert.equal(r.count, 301, hz + ' Hz phone paints at 30 Hz, both idle and moving');
    assert(Math.abs(r.elapsed - 10) < 1e-8, 'animations keep all elapsed time');
    for (const jitter of [.4, .7, 1]) {
      assert(Math.abs(simulate(hz, true, active, jitter).count - 301) <= 1, hz + ' Hz phone retains its 30 Hz target with ' + jitter + ' ms jitter');
    }
  }
  assert.equal(simulate(hz, false, false).count, 301, 'desktop idle work is bounded');
  assert.equal(simulate(hz, false, true).count, hz * 10 + 1, 'desktop interaction follows display refresh');
  for (const jitter of [.4, .7, 1]) {
    assert(Math.abs(simulate(hz, false, false, jitter).count - 301) <= 1, 'desktop idle target survives RAF jitter');
    assert.equal(simulate(hz, false, true, jitter).count, hz * 10 + 1, 'desktop interaction never gates a display callback');
  }
}
const p = context.pacer.create(true);
assert(p.step(0, true)); assert(!p.step(10, true)); assert(p.step(480, true)); assert.equal(p.delta, .48);
assert(!p.step(480, true)); assert(!p.step(481, true)); assert(!p.step(499, true));
assert(p.step(500, true)); assert.equal(p.delta, .02, 'animation time stays real after a stall');
assert(!p.step(500, true), 'the same missed deadline cannot paint twice');
assert(p.step(10000, true)); assert(!p.step(10000, true)); assert(!p.step(10001, true));
p.reset(); assert(p.step(100000, true)); assert.equal(p.delta, 1 / 60, 'resume excludes hidden time');
assert(!p.step(100010, false), 'phone active/idle change retains the 30 Hz clock');
assert(p.step(100034, false)); assert.equal(p.delta, .034);
const desktop = context.pacer.create(false);
assert(desktop.step(0, false)); assert(!desktop.step(10, false));
assert(desktop.step(16, true)); assert.equal(desktop.delta, .016, 'interaction immediately follows display callbacks');
assert(desktop.step(32, true)); assert(!desktop.step(48, false), 'idle restarts from the last actual paint');
assert(desktop.step(66, false)); assert.equal(desktop.delta, .034);
assert(!desktop.step(66, false));
assert(desktop.step(70, true)); assert.equal(desktop.delta, .004, 'mode changes do not lose elapsed animation time');
desktop.reset(); assert(desktop.step(200000, false)); assert.equal(desktop.delta, 1 / 60);
console.log('render pacing: 60/75/90/120 Hz, sub-ms jitter, idle/active transitions, elapsed animation time, stalled deadline skipping and resume passed');
