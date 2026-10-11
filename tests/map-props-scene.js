// Native Three geometry and complete timelines; no WebGL, network, or timers.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const THREE = require('../vendor/three.min.js');
const document = { createElement() { return { getContext() { return { fillRect() {}, strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, closePath() {} }; } }; } };
const context = vm.createContext({ window: { THREE }, document, console });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/map-props.js'), 'utf8') + '\nglobalThis.props = MapProps3D;', context);
const ids = [2, 17, 33, 7, 22, 36], places = ids.map((i, k) => {
  const yaw = k * Math.PI / 2, cx = (k % 3 - 1) * 3.6, cz = k < 3 ? 4.5 : -4.5, sy = 1.25;
  return { i, frame: { cx, cz, yaw, sy, ground: () => .088 / sy, at(x, z, h = 0) { return new THREE.Vector3(cx + x * 1.5 * Math.cos(yaw) + z * 1.35 * Math.sin(yaw), .088 + h * sy, cz - x * 1.5 * Math.sin(yaw) + z * 1.35 * Math.cos(yaw)); } } };
});
let reduced = false;
const parent = new THREE.Group(), life = context.props.create({ parent, places, waterY: .02, reducedMotion: () => reduced });
assert(life); assert.equal(parent.children.length, 1); assert.equal(life.stats().places, 6); assert.equal(life.stats().chests, 3); assert.equal(life.stats().bottles, 3); assert(life.stats().draws <= 42, 'bounded shared scene mesh budget');
assert.equal(life.trigger(99, 'arrival'), false); assert.equal(life.stats().triggers, 0);
const roots = ids.map(i => life.group.getObjectByName('Animated ' + (i === 2 || i === 17 || i === 33 ? 'chest' : 'bottle') + ' place ' + i));
for (let k = 0; k < roots.length; k++) {
  const root = roots[k], chest = k < 3, point = places[k].frame.at(chest ? .02 : 0, chest ? -.10 : .12, chest ? .009 : 0);
  assert(root); assert.equal(root.position.x, point.x); assert.equal(root.position.z, point.z); root.traverse(o => assert.equal(o.userData.i, ids[k], 'each prop part carries its pickable place index'));
  if (chest) assert.equal(root.position.y, point.y); else assert(root.position.y > -.015 && root.position.y < 0, 'bottle floats at its actual waterline');
}
const chestRoots = roots.slice(0, 3), bottleRoots = roots.slice(3), body = chestRoots[0].getObjectByName('Hollow plank chest');
assert(chestRoots.every(r => r.getObjectByName('Hollow plank chest').geometry === body.geometry), 'chest geometry shared within this world');
assert(bottleRoots.every(r => r.getObjectByName('Thick hollow glass with neck').geometry === bottleRoots[0].getObjectByName('Thick hollow glass with neck').geometry), 'curved glass geometry shared');
assert(body.material.map?.isCanvasTexture, 'weathered real plank grain');
life.group.updateMatrixWorld(true);
const rayStart = chestRoots[0].localToWorld(new THREE.Vector3(0, .105, 0));
assert.equal(new THREE.Raycaster(rayStart, new THREE.Vector3(0, 1, 0)).intersectObject(body, false).length, 0, 'chest body is hollow');
assert(new THREE.Raycaster(rayStart, new THREE.Vector3(0, -1, 0)).intersectObject(body, false).length > 0, 'hollow chest has a true bottom');
const hinge = chestRoots[0].getObjectByName('Back hinge lid'), anchor = hinge.position.clone();
const letters = bottleRoots.map(r => ({ root: r, paper: r.getObjectByName('Physical rolled parchment'), rig: r.getObjectByName('Neck-sized letter rig'), cork: r.getObjectByName('Bottle cork') }));
for (const letter of letters) {
  letter.paper.geometry.computeBoundingBox(); const box = letter.paper.geometry.boundingBox;
  assert(box.max.x - box.min.x < .028, 'letter begins in a genuinely narrow roll');
  assert(box.min.y + letter.rig.position.y > .023 && box.max.y + letter.rig.position.y < .441, 'letter starts entirely inside bottle');
}
const before = roots.map(r => r.quaternion.clone()), idleVersions = letters.map(l => l.paper.geometry.attributes.position.version); life.update(5, .016);
assert.deepEqual(letters.map(l => l.paper.geometry.attributes.position.version), idleVersions, 'idle bottles reuse their unchanged roll vertices and normals');
assert(bottleRoots.some((r, i) => !r.quaternion.equals(before[i + 3])), 'idle bottle orientation changes naturally');
assert(chestRoots[0].getObjectByName('Back hinge lid').rotation.x < 0, 'idle chest breath leaves a narrow gold-filled opening');
for (const i of ids) assert.equal(life.trigger(i, 'arrival', 0x3f9fea), true);
let maxLetterWidth = 0, neckChecks = 0, maxHeight = 0, maxSpan = 0;
const finite = scene => scene.traverse(o => {
  assert(o.position.toArray().every(Number.isFinite)); assert(Math.abs(o.quaternion.length() - 1) < 1e-6);
  if (o.geometry) for (const attr of Object.values(o.geometry.attributes)) assert(attr.array.every(Number.isFinite), o.name + ' attributes remain finite');
});
for (let frame = 0; frame <= 180; frame++) {
  const age = frame / 30; life.update(5 + age, 1 / 30); life.group.updateMatrixWorld(true); finite(life.group);
  for (const letter of letters) {
    const p = letter.paper.geometry.attributes.position, local = new THREE.Vector3();
    letter.paper.geometry.computeBoundingBox(); const width = letter.paper.geometry.boundingBox.max.x - letter.paper.geometry.boundingBox.min.x;
    maxLetterWidth = Math.max(maxLetterWidth, width);
    const phase = life.stats().states.find(s => s.type === 'bottle').phase;
    for (let k = 0; k < p.count; k += 7) {
      local.fromBufferAttribute(p, k).applyMatrix4(letter.paper.matrixWorld); letter.root.worldToLocal(local);
      if (local.y > .342 && local.y < .441 && phase <= 1.45) { assert(Math.hypot(local.x, local.z) < .015, 'moving roll passes through neck without clipping'); neckChecks++; }
      if (local.y > .025 && local.y < .441 && phase > 1.45) assert(Math.hypot(local.x, local.z) > .081, 'unfurled sheet clears all glass before lowering and during retraction');
    }
    if (age >= 1.45 && age <= 1.51) { assert(width < .028, 'letter is still rolled after clearing neck'); assert(letter.rig.position.y + letter.paper.geometry.boundingBox.min.y > .441, 'entire roll clears mouth before unfurl'); }
    if (age >= 2.5 && age <= 3.3) assert(width > .285, 'letter unfolds into a readable wide parchment');
  }
  for (const root of roots) {
    const localBox = new THREE.Box3(), inverse = root.matrixWorld.clone().invert(), v = new THREE.Vector3();
    root.traverse(o => { if (!o.geometry) return; const p = o.geometry.attributes.position; for (let k = 0; k < p.count; k += Math.max(1, Math.floor(p.count / 90))) { v.fromBufferAttribute(p, k).applyMatrix4(o.matrixWorld).applyMatrix4(inverse); localBox.expandByPoint(v); } });
    maxHeight = Math.max(maxHeight, localBox.max.y); maxSpan = Math.max(maxSpan, localBox.max.x - localBox.min.x, localBox.max.z - localBox.min.z);
  }
}
assert(neckChecks > 500); assert(maxLetterWidth > .289); assert(maxHeight < .73, 'reveal remains bounded above its place'); assert(maxSpan < .52, 'all moving parts fit the place footprint');
assert.equal(life.stats().states.some(s => s.revealing), false, 'each reveal returns to idle after 5.8s');
assert(hinge.position.equals(anchor), 'hinge anchor stays fixed');
life.trigger(2, 'arrival'); life.update(12, .016); life.update(13.1, .016); const partlyOpen = hinge.rotation.x;
life.trigger(2, 'arrival'); life.update(13.1, 0); assert(Math.abs(hinge.rotation.x - partlyOpen) < 1e-8, 'retrigger keeps current pose without a snap');
life.update(14, .016); assert(hinge.rotation.x < -1.15, 'chest opens deeply with a true back hinge');
const lidFront = hinge.localToWorld(new THREE.Vector3(0, 0, .272)), lidBack = hinge.localToWorld(new THREE.Vector3()); assert(lidFront.y > lidBack.y + .22, 'lid rises up and back');
life.update(20, .016); reduced = true; life.update(21, .1); const transforms = () => roots.map(r => [...r.position.toArray(), ...r.quaternion.toArray()]); const snapshot = transforms(); life.update(91, .1);
assert.deepEqual(transforms(), snapshot, 'reduced motion has no ambient sway');
for (const i of ids) life.trigger(i, 'arrival'); life.update(92, .1); life.group.updateMatrixWorld(true); const staticPose = life.stats().states.map(s => [s.phase, s.lid, s.letter]); life.update(120, .1);
assert.deepEqual(life.stats().states.map(s => [s.phase, s.lid, s.letter]), staticPose, 'reduced motion reveals stay readable without animation');
const resources = new Set(); let instanceDisposals = 0;
life.group.traverse(o => { if (o.geometry) resources.add(o.geometry); if (o.isInstancedMesh) o.addEventListener('dispose', () => instanceDisposals++); for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) { resources.add(m); for (const value of Object.values(m)) if (value?.isTexture) resources.add(value); } });
let releases = 0; for (const resource of resources) resource.addEventListener('dispose', () => releases++);
const count = life.stats().resources; life.dispose(); life.dispose(); life.update(121, .1); assert.equal(life.trigger(2, 'arrival'), false); assert.equal(parent.children.length, 0); assert.equal(releases, resources.size, 'shared GPU resources released exactly once'); assert.equal(instanceDisposals, 1); assert.equal(life.stats().resources, 0);
const empty = context.props.create({ parent, places: [], reducedMotion: true }); empty.update(0, 0); empty.dispose(); assert.equal(parent.children.length, 0); assert.equal(context.props.create({}), null);
console.log(JSON.stringify({ passed: true, places: 6, duration: 5.8, neckChecks, maxLetterWidth, maxHeight, maxSpan, resources: count, draws: 40, realHollowChests: true, fixedHinge: true, idleDeformationCached: true, pickablePropParts: true, retriggerContinuous: true, reducedMotion: true, allResourcesReleased: true }, null, 2));
