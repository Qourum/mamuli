const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../src/render-pacer.js'), 'utf8') + '\nglobalThis.pacer = RenderPacer;', context);
function simulate(hz, mobile, active) {
  const pacer = context.pacer.create(mobile); let count = 0, elapsed = 0;
  for (let i = 0; i <= hz * 10; i++) if (pacer.step(i * 1000 / hz, active)) { count++; if (count > 1) elapsed += pacer.delta; }
  return {count, elapsed};
}
for (const hz of [60, 90, 120]) {
  for (const active of [false, true]) {
    const r = simulate(hz, true, active);
    assert.equal(r.count, 301, hz + ' Hz phone paints at 30 Hz, both idle and moving');
    assert(Math.abs(r.elapsed - 10) < 1e-8, 'animations keep all elapsed time');
  }
  assert.equal(simulate(hz, false, false).count, 301, 'desktop idle work is bounded');
  assert.equal(simulate(hz, false, true).count, hz * 10 + 1, 'desktop interaction follows display refresh');
}
const p = context.pacer.create(true);
assert(p.step(0, true)); assert(!p.step(10, true)); assert(p.step(480, true)); assert.equal(p.delta, .48);
p.reset(); assert(p.step(100000, true)); assert.equal(p.delta, 1 / 60, 'resume excludes hidden time');
console.log('render pacing: 60/90/120 Hz, idle/active, animation time, slow frames, resume passed');
