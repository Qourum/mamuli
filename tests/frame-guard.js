// The phone's safety net (src/render-pacer.js FrameGuard): steady or merely uneven frames are left alone, lagging ones
// make it step down (a phone at 120 goes back to 60 first), a step that did not help is taken back, isolated stalls and
// very slow frames are judged right.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/render-pacer.js'), 'utf8') + '\nglobalThis.FG = FrameGuard; globalThis.RP = RenderPacer;', context);
const run = (guard, frames, interval = 1 / 60, rated = 60) => frames.map(ms => guard.sample(ms / 1000, interval, rated)).filter(Boolean);
const repeat = (pattern, n) => Array.from({ length: n }, (_, i) => pattern[i % pattern.length]);
// the frames a pacer at 60 really gives on screens of different rates (with RAF jitter): none lag
for (const hz of [60, 75, 90, 120, 144]) for (const jitter of [0, .6]) {
  const pacer = context.RP.create(true), g = context.FG.create(), deltas = [];
  for (let i = 0; i <= hz * 30; i++) if (pacer.step(i * 1000 / hz + jitter * Math.sin(i * 2.1), true)) deltas.push(pacer.delta * 1000);
  assert.deepEqual(run(g, deltas.slice(1)), [], `${hz} Hz at a 60 target, jitter ${jitter}: not lagging`);
}
// an isolated stall in steady frames, one per two seconds: not lagging
assert.deepEqual(run(context.FG.create(), repeat([...Array(119).fill(16.7), 500], 1200)), []);
// three frames in ten shown twice: down a step; when that helps, nothing more
{
  const g = context.FG.create(), a = run(g, repeat([16.7, 16.7, 33.3, 16.7, 16.7, 33.3, 16.7, 16.7, 16.7, 33.3], 100));
  assert.equal(a.length, 1); assert.equal(a[0].do, 'down'); assert.equal(a[0].step, 1); assert.ok(a[0].over > .15 && a[0].fps < 52);
  assert.deepEqual(run(g, repeat([16.7, 16.7, 16.7, 16.7, 16.7, 16.7, 16.7, 16.7, 16.7, 33.3], 600)), [], 'one in ten late is fine');
  assert.equal(g.step, 1);
}
// each step helps a little, never enough: down to the last step, then stuck (and quiet)
{
  const g = context.FG.create(5), acts = [];
  // how far over the target the frames are after each step: each step takes away a third of it, never enough
  for (const over of [1.5, 1.0, 0.66, 0.44, 0.29, 0.29]) { const ms = 1000 / 60 * (1 + over); acts.push(...run(g, repeat([ms], Math.ceil(2000 / ms) + 1)).slice(0, 1)); }
  assert.deepEqual(acts.map(a => a.do), ['down', 'down', 'down', 'down', 'stuck']);
  assert.equal(g.step, 4); assert.ok(g.stuck);
  assert.deepEqual(run(g, repeat([33.3], 600)), [], 'stuck says nothing more');
}
// a step that did not help (the models are slow, not the pixels): back up, and stop
{
  const g = context.FG.create();
  const a = run(g, repeat([16.7, 33.3], 100)); assert.deepEqual(a.map(x => x.do), ['down']);
  const b = run(g, repeat([16.7, 33.3, 33.3, 16.7, 33.3, 33.3, 16.7, 33.3, 16.7, 33.3], 100));
  assert.deepEqual(b.map(x => x.do), ['up']); assert.equal(b[0].step, 0); assert.ok(g.stuck);
}
// a phone at 120 that cannot keep it: back to 60 first, before any pixels
{
  const g = context.FG.create(), a = run(g, repeat([8.33, 16.7, 16.7, 8.33], 400), 1 / 120, 120);
  assert.equal(a[0].do, 'rate'); assert.equal(g.step, 0);
  assert.deepEqual(run(context.FG.create(), repeat([8.33, 8.33, 8.33, 8.33, 8.33, 16.7, 8.33, 8.33, 8.33, 8.33], 600), 1 / 120, 120), [], 'a 120 Hz phone at 120 with a few doubled frames is fine');
  // a 120 Hz phone whose pacer was set to 120 but whose frames come at 60 cannot be at 120: back to 60
  assert.equal(run(context.FG.create(), repeat([16.7], 300), 1 / 120, 120)[0].do, 'rate');
}
// very slow frames (five seconds each) are still judged, after six of them
{
  const g = context.FG.create(), a = run(g, repeat([5000], 6));
  assert.equal(a.length, 1); assert.equal(a[0].do, 'down');
}
// not judged while paused; reset starts again
{
  const g = context.FG.create();
  run(g, repeat([33.3], 50)); g.pause(); assert.deepEqual(run(g, repeat([16.7], 200)), [], 'what came before the pause is forgotten');
  run(g, repeat([33.3], 70)); assert.equal(g.step, 1); g.reset(); assert.equal(g.step, 0); assert.equal(g.stuck, false);
}
// a phone at 120 that moves and stands still in turn (targets of 120 and 60), every frame on time: not lagging
{
  const g = context.FG.create(), acts = [];
  for (let i = 0; i < 2400; i++) { const moving = Math.floor(i / 90) % 2 === 0; const a = g.sample(moving ? 1 / 120 : 1 / 60, moving ? 1 / 120 : 1 / 60, 120); if (a) acts.push(a); }
  assert.deepEqual(acts, []);
}
// a steady 52 frames a second is not lagging; a steady 50 is
assert.deepEqual(run(context.FG.create(), repeat([1000 / 53], 300)), []);
assert.equal(run(context.FG.create(), repeat([1000 / 50], 300))[0].do, 'down');
console.log('frame guard: steady and uneven (60-144 Hz) frames left alone, isolated stalls ignored, lagging frames step down, useless steps undone, 120 back to 60 first, very slow frames judged');
