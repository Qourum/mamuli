// Native Three.js geometry and resource lifetime checks, without needing a GPU in Node.
// Browser QA still verifies WebGL output. The renderer boundary is the only mocked Three class.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('../vendor/three.min.js');
const frames = new Map(), renderers = [], events = new Map();
let now = 0, next = 0, reduce = false;
const classList = () => { const set = new Set(); return { add: c => set.add(c), remove: c => set.delete(c), contains: c => set.has(c) }; };
function element() {
  return { classList: classList(), clientWidth: 300, clientHeight: 180, children: [],
    appendChild(c) { this.children.push(c); c.parent = this; },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); },
    setAttribute() {}, addEventListener() {}, removeEventListener() {},
    getContext() { return { fillRect() {}, strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, closePath() {}, createLinearGradient() { return { addColorStop() {} }; } }; }
  };
}
class Renderer {
  constructor() { this.domElement = element(); this.renderLists = { dispose() {} }; renderers.push(this); this.resources = new Set(); }
  setPixelRatio(v) { this.dpr = v; } setClearColor() {} setSize(w, h) { this.size = [w, h]; }
  render(scene) {
    this.scene = scene; this.draws = (this.draws || 0) + 1;
    if (scene.environment && !this.resources.has(scene.environment)) {
      this.resources.add(scene.environment);
      scene.environment.addEventListener('dispose', () => { scene.environment.userData.released = true; });
    }
    scene.traverse(o => {
      [o.geometry, o.material, o.material && o.material.map].filter(Boolean).forEach(r => {
        if (!this.resources.has(r)) { this.resources.add(r); r.addEventListener('dispose', () => { r.userData.released = true; }); }
      });
    });
  }
  dispose() { this.disposed = true; } forceContextLoss() { this.lost = true; }
}
const document = { visibilityState: 'visible', createElement: element,
  addEventListener: (type, fn) => { events.set(fn, type); }, removeEventListener: (_type, fn) => { events.delete(fn); } };
const context = vm.createContext({ window: { THREE: { ...THREE, WebGLRenderer: Renderer }, devicePixelRatio: 3 }, document,
  matchMedia: () => ({ matches: reduce }), performance: { now: () => now },
  requestAnimationFrame: f => { frames.set(++next, f); return next; }, cancelAnimationFrame: id => frames.delete(id),
  ResizeObserver: class { observe() {} disconnect() { this.disconnected = true; } }
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/card3d.js'), 'utf8'), context);
const cards = vm.runInContext('Card3D', context);
function tick(ms) { now += ms; const f = [...frames.values()]; frames.clear(); f.forEach(fn => fn(now)); }
function released(renderer) {
  assert.equal(renderer.disposed, true); assert.equal(renderer.lost, true);
  renderer.resources.forEach(r => assert.equal(r.userData.released, true));
}
const bottleHost = element(), bottle = cards.mount(bottleHost, 'bottle'), first = renderers[0];
assert.ok(bottle); assert.equal(first.dpr, 1.25); assert.equal(bottleHost.children.length, 1);
assert.ok(first.scene.environment.isCubeTexture); assert.equal(first.scene.environment.images.length, 6);
const paper = first.scene.children.find(o => o.isMesh && o.geometry.type === 'PlaneGeometry');
const initialPaper = [...paper.geometry.attributes.position.array];
tick(1500);
assert.equal(frames.size, 0, 'the reveal stops drawing when finished');
assert.notDeepEqual([...paper.geometry.attributes.position.array], initialPaper, 'the letter unrolls as geometry');
first.scene.updateMatrixWorld(true);
const bounds = new THREE.Box3().setFromObject(first.scene);
assert.ok(Number.isFinite(bounds.max.y));
const chestHost = element(), chest = cards.mount(chestHost, 'chest');
released(first); assert.equal(bottleHost.children.length, 0, 'replacing a card releases its old canvas');
tick(1500);
const second = renderers[1];
const chestGroup = second.scene.children.find(o => o.isGroup);
const lid = chestGroup.children.find(o => o.isGroup);
assert.ok(lid.rotation.x < -1, 'the chest has an open hinged lid');
assert.equal(frames.size, 0);
chest.dispose(); chest.dispose(); released(second);
assert.equal(events.size, 0); assert.equal(chestHost.children.length, 0);
const early = cards.mount(element(), 'scroll'), third = renderers[2];
assert.ok(frames.size > 0); early.dispose(); released(third); assert.equal(frames.size, 0);
reduce = true;
const still = cards.mount(element(), 'bottle'); assert.equal(frames.size, 0, 'reduced motion shows the completed model');
still.dispose(); assert.equal(events.size, 0);
context.window.THREE = null;
assert.equal(cards.mount(element(), 'bottle'), null, 'existing artwork is the fallback without WebGL/Three');
console.log('Card 3D: native unrolling, hinged chest, bounded frames, reduced motion, and resource cleanup passed.');
