// Real Three.js geometry and matrices: place coverage, grounded architecture,
// moving parts, bounded effects, mortgage isolation and complete GPU ownership.
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const THREE = require('../vendor/three.min.js');
THREE.ColorManagement.legacyMode = false;
const ctx = vm.createContext({ window: { THREE } });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/place-models.js'), 'utf8'), ctx);
const PM = vm.runInContext('PlaceModels3D', ctx);
const expected = [6, 8, 11, 13, 14, 16, 18, 19, 21, 23, 24, 26, 27, 29, 32, 34];
assert.deepEqual([...PM.indices], expected);
function frame(k) {
  const cx = k * 2, cz = (k % 3) * 2, yaw = (k % 4) * Math.PI / 2, cs = Math.cos(yaw), sn = Math.sin(yaw);
  return { cx, cz, yaw, sy: 1.25, ground: (x, z) => .06 + x * .03 + z * .015,
    at(x, z, h = 0) { return new THREE.Vector3(cx + x * 1.18 * cs + z * 1.12 * sn, (.06 + x * .03 + z * .015 + h) * 1.25, cz - x * 1.18 * sn + z * 1.12 * cs); } };
}
const places = expected.map((i, k) => ({ i, name: 'Place ' + i, frame: frame(k) }));
const parent = new THREE.Group(), model = PM.create({ parent, places });
assert.equal(model.stats().places, 16); assert.ok(model.stats().drawCalls < 60); assert.ok(model.stats().triangles < 70000);
const root = parent.children[0], pools = root.children.filter(o => o.isInstancedMesh);
assert.equal(pools.length, model.stats().pools);
const resources = new Set(), disposed = new Map(), staticPositions = new Map(), inverse = new THREE.Matrix4(), world = new THREE.Vector3();
for (const place of places) {
  const group = model.getObject(place.i); assert.equal(group.userData.i, place.i); assert.equal(group.userData.nativeProcedural, true);
  inverse.compose(new THREE.Vector3(place.frame.cx, 0, place.frame.cz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), place.frame.yaw), new THREE.Vector3(1.18,1.25,1.12)).invert();
  for (const mesh of group.children) {
    staticPositions.set(mesh, [...mesh.geometry.attributes.position.array]);
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      world.fromBufferAttribute(pos, i).applyMatrix4(inverse);
      assert.ok(Math.abs(world.x) <= .391, `${place.i}: footprint x ${world.x}`);
      assert.ok(world.z >= -.401 && world.z <= .251, `${place.i}: footprint z ${world.z}`);
      assert.ok(world.y < .83, `${place.i}: excessive landmark height ${world.y}`);
    }
  }
}
root.traverse(o => {
  if (!o.isMesh) return;
  resources.add(o.geometry); resources.add(o.material); if (o.isInstancedMesh) resources.add(o);
  for (const attr of ['position', 'normal']) {
    const a = o.geometry.attributes[attr]; assert.ok(Array.from(a.array).every(Number.isFinite), o.name + ' ' + attr);
    if (attr === 'normal') for (let i = 0; i < a.count; i++) assert.ok(Math.hypot(a.getX(i), a.getY(i), a.getZ(i)) > .90, o.name + ' zero normal');
  }
});
const firstMatrices = pools.map(p => [...p.instanceMatrix.array]);
for (let k = 1; k <= 180; k++) { model.update(k / 6, 1 / 6); for (const p of pools) assert.ok(Array.from(p.instanceMatrix.array).every(Number.isFinite)); }
assert.ok(pools.some((p,i) => p.instanceMatrix.array.some((v,j) => v !== firstMatrices[i][j])), 'parts really animate');
for (const [mesh, positions] of staticPositions) assert.deepEqual([...mesh.geometry.attributes.position.array], positions, 'architecture never wobbles');
const unaffected = model.getObject(8).children.map(o => o.material), affectedBase = model.getObject(6).children.map(o => o.material);
model.setMort(6, true);
for (const mesh of model.getObject(6).children) { assert.ok(!affectedBase.includes(mesh.material)); resources.add(mesh.material); }
assert.deepEqual(model.getObject(8).children.map(o => o.material), unaffected, 'mortgage does not dim another place');
model.setMort(6, false); assert.deepEqual(model.getObject(6).children.map(o => o.material), affectedBase);
const rings = pools.find(p => p.name.includes('arrival-rings')), coins = pools.find(p => p.name.includes('reward-coins'));
assert.ok(rings && coins);
model.update(31, 1); assert.equal(model.trigger(6, 'buy', '#e64c62'), true); model.update(31.6, .6);
assert.ok(rings.instanceMatrix.array.some(v => v !== 0)); assert.ok(coins.instanceMatrix.array.some(v => v !== 0));
model.update(35, 3.4); assert.ok([...rings.instanceMatrix.array].filter((_,i) => i % 16 !== 15).every(v => v === 0), 'reaction rings expire');
assert.ok([...coins.instanceMatrix.array].filter((_,i) => i % 16 !== 15).every(v => v === 0), 'reward coins expire');
assert.equal(model.trigger(999,'arrival'), false); model.update(NaN, .1);
for (const resource of resources) resource.addEventListener('dispose', () => disposed.set(resource, (disposed.get(resource) || 0) + 1));
model.dispose(); model.dispose(); model.update(40, 1); assert.equal(parent.children.length, 0); assert.equal(model.stats().disposed, true);
for (const resource of resources) assert.equal(disposed.get(resource), 1, 'every GPU resource is disposed exactly once');
const still = PM.create({ parent, places, reducedMotion: true }), stillPools = parent.children[0].children.filter(o => o.isInstancedMesh), stillMatrices = stillPools.map(p => [...p.instanceMatrix.array]);
still.update(150, 150); still.trigger(14,'build','#51a97d'); still.update(155, 5);
stillPools.forEach((p,i) => assert.deepEqual([...p.instanceMatrix.array], stillMatrices[i], 'reduced motion has no animation/reaction movement'));
still.dispose(); assert.equal(PM.create({}), null);
// The original Tortuga mesa is a narrow additive terrain peak. Verify the
// widened retaining rock actually reaches its uneven hillside at all edges.
const terrainContext = vm.createContext({ window: { THREE } });
const boardSource = fs.readFileSync(path.join(__dirname, '../src/board3d.js'), 'utf8');
const frameStart = boardSource.indexOf('  function frameOf('), frameEnd = boardSource.indexOf('  // made in steps', frameStart);
const terrainSource = ['data.js','terrain.js','models.js','sea.js','place-models.js'].map(n => fs.readFileSync(path.join(__dirname, '../src', n), 'utf8')).join('\n');
vm.runInContext(terrainSource + '\nconst T = window.THREE;\n' + boardSource.slice(frameStart, frameEnd) + `
Terrain.setWorld('sea');
const F = frameOf(0,0,0,[1.18,1.25,1.12]); SeaModels.relief(18,F);
const parent = new T.Group(), model = PlaceModels3D.create({parent,places:[{i:18,frame:F,name:'Tortuga'}]});
globalThis.supported = [];
for (const [px,pz] of [[-.122,-.125],[.122,-.125],[.14,-.107],[.14,.107],[.122,.125],[-.122,.125],[-.14,.107],[-.14,-.107]]) {
  const floor = F.at(-.15+px,-.15+pz,0); let reaches = false;
  for (const mesh of model.getObject(18).children) {
    const p=mesh.geometry.attributes.position;
    for(let k=0;k<p.count;k++) if(Math.abs(p.getX(k)-floor.x)<.00001 && Math.abs(p.getZ(k)-floor.z)<.00001 && p.getY(k)<floor.y-.005) reaches=true;
  }
  supported.push(reaches);
}
model.dispose();`, terrainContext);
assert.ok([...terrainContext.supported].every(Boolean), 'Tortuga retaining foundation reaches the actual sampled terrain at every edge');
console.log('Place models: all16 distinctive scenes, ground/footprints, real part animation, bounded effects, isolated mortgages, reduced motion and complete resource cleanup passed.');
