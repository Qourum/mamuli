// Exercise production warm-up scheduling with real Three materials and weather
// hooks. The renderer records submissions; browser QA checks actual GPU output.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('../vendor/three.min.js');
const source = fs.readFileSync(path.join(__dirname, '../src/board3d.js'), 'utf8');
const start = source.indexOf('  let materialWarm = null;');
const end = source.indexOf('  function nativeModel(', start);
assert(start >= 0 && end > start, 'production material warm-up exists');
const restoreStart = source.indexOf("    cv.addEventListener('webglcontextrestored',");
const restoreEnd = source.indexOf('\n    });', restoreStart) + '\n    });'.length;
assert(restoreStart >= 0 && restoreEnd > restoreStart, 'production context recovery exists');

function fixture() {
  const idle = [], compiles = [], uploads = [], callbacks = {};
  const root = new THREE.Group(), scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(); scene.add(root);
  const context = vm.createContext({
    window: { THREE }, console, Math, performance, T: THREE, root, scene, cam,
    built: false, done: true, prep: null, remake: null, lostAt: 0, ok: true,
    document: { visibilityState: 'visible' }, idle: fn => idle.push(fn),
    Diag: { note() {} }, relabelSoon() {}, start() {}, shadowDirty: false,
    cv: { addEventListener: (name, fn) => { callbacks[name] = fn; } },
    R: {
      compile(s, c) { assert.equal(s, context.scene); assert.equal(c, cam); compiles.push(s); },
      initTexture(texture) { uploads.push({ texture, version: texture.version }); }
    }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/weather.js'), 'utf8') + '\nvar weatherLife = Weather3D.create({ parent: root, mobile: true });', context);
  vm.runInContext(source.slice(start, end) + '\nglobalThis.prepare = prepareMaterials;', context);
  vm.runInContext(source.slice(restoreStart, restoreEnd), context);
  const step = () => { assert(idle.length, 'an idle callback is pending'); idle.shift()(); };
  const drain = () => { let n = 0; while (idle.length) { assert(n++ < 100, 'warm-up queue drains'); step(); } };
  function mesh(...textures) {
    const mat = new THREE.MeshStandardMaterial({ map: textures[0] || null, normalMap: textures[1] || null });
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat); m.visible = false; return m;
  }
  return { context, idle, compiles, uploads, callbacks, step, drain, mesh };
}
function texture(ready = true, versioned = true) {
  const t = new THREE.Texture({ width: 4, height: 4, complete: ready });
  if (versioned) t.needsUpdate = true;
  return t;
}
function patched(material) {
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  material.onBeforeCompile(shader);
  assert(shader.uniforms.uWeatherZone, 'weather is installed before the first render');
  assert(shader.vertexShader.includes('varying float vWeatherShade;'), 'phone shader variant is prepared');
}

// Even when compilation must wait, a newly attached material receives the
// correct shader immediately, rather than a replacement one second later.
for (const state of [{ built: true }, { done: false }, { prep: {} }, { remake: {} }, { lostAt: 1 }, { ok: false }, { hidden: true }]) {
  const f = fixture();
  Object.assign(f.context, state);
  if (state.hidden) f.context.document.visibilityState = 'hidden';
  const m = f.mesh(texture()); f.context.prepare(m); f.context.root.add(m); patched(m.material); f.drain();
  assert.equal(f.compiles.length, 0, 'unsafe state cannot compile: ' + JSON.stringify(state));
  assert.equal(f.uploads.length, 0, 'unsafe state cannot upload: ' + JSON.stringify(state));
}

// Multiple arrivals share one compile and one upload queue; repeated references
// in materials, hidden objects and later arrivals do not upload twice.
{
  const f = fixture(), a = texture(), b = texture(), c = texture();
  const one = f.mesh(a, a), two = f.mesh(b, a);
  f.context.prepare(one); f.context.root.add(one); f.context.prepare(two); f.context.root.add(two);
  assert.equal(f.idle.length, 1, 'arrivals coalesce'); f.step();
  assert.equal(f.compiles.length, 1); f.step(); assert.equal(f.uploads.length, 1, 'one upload per callback');
  const three = f.mesh(c, b); f.context.prepare(three); f.context.root.add(three);
  f.drain();
  assert.equal(f.uploads.filter(x => x.texture === a).length, 1);
  assert.equal(f.uploads.filter(x => x.texture === b).length, 1);
  assert.equal(f.uploads.filter(x => x.texture === c).length, 1);
  f.context.prepare(one); f.drain(); assert.equal(f.uploads.length, 3, 'unchanged texture versions remain resident');
  a.needsUpdate = true; f.context.prepare(one); f.drain();
  assert.equal(f.uploads.filter(x => x.texture === a).length, 2, 'changed canvas/image data uploads again');
}

// A game, remake, lost context or hidden page can interrupt either phase.
for (const state of [{ built: true }, { prep: {} }, { remake: {} }, { lostAt: 1 }, { ok: false }, { hidden: true }]) {
  for (const afterCompile of [false, true]) {
    const f = fixture(), m = f.mesh(texture()); f.context.root.add(m); f.context.prepare(m);
    if (afterCompile) f.step();
    Object.assign(f.context, state); if (state.hidden) f.context.document.visibilityState = 'hidden';
    f.drain();
    assert.equal(f.compiles.length, afterCompile ? 1 : 0, 'state checked again before compilation');
    assert.equal(f.uploads.length, 0, 'state checked again before each upload');
  }
}

// Old callbacks cannot upload disposed-world textures or reset the new queue.
{
  const f = fixture(), oldTexture = texture(), oldMesh = f.mesh(oldTexture);
  f.context.root.add(oldMesh); f.context.prepare(oldMesh); f.step();
  const oldRoot = f.context.root; f.context.root = new THREE.Group(); f.context.scene.remove(oldRoot); f.context.scene.add(f.context.root);
  const newTexture = texture(), newMesh = f.mesh(newTexture); f.context.root.add(newMesh); f.context.prepare(newMesh); f.drain();
  assert.equal(f.uploads.length, 1); assert.equal(f.uploads[0].texture, newTexture);
}

// Context restoration discards the former GPU residency, including when a
// callback from that context has not yet run.
{
  const f = fixture(), t = texture(), m = f.mesh(t); f.context.root.add(m); f.context.prepare(m); f.drain();
  assert.equal(f.uploads.length, 1);
  f.context.prepare(m); f.context.lostAt = 1; f.callbacks.webglcontextrestored(); f.drain();
  assert.equal(f.uploads.length, 2, 'same source texture is uploaded for the restored context');
  assert.equal(f.context.lostAt, 0); assert.equal(f.context.shadowDirty, true);
  f.context.built = true; f.context.lostAt = 2; f.callbacks.webglcontextrestored(); f.drain();
  assert.equal(f.uploads.length, 2, 'restoration during play defers extra warm-up work');
}

// Incomplete TextureLoader images are left for on-load or normal rendering.
{
  const f = fixture(), incomplete = texture(false), unversioned = texture(true, false);
  const m = f.mesh(incomplete, unversioned); f.context.root.add(m); f.context.prepare(m); f.drain();
  assert.equal(f.uploads.length, 0);
  incomplete.image.complete = true; f.context.prepare(m); f.drain();
  assert.equal(f.uploads.length, 1); assert.equal(f.uploads[0].texture, incomplete);
}

console.log(JSON.stringify({ passed: true, firstRenderWeather: true, safeMenuOnly: true, coalescedCompile: true, sharedTextureQueue: true, changedTextureVersions: true, staleWorldCancellation: true, contextRecovery: true }));
