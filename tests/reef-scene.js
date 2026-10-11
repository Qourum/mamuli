// Actual Three geometry/matrices verify the submerged reef and fixed fish pools.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../vendor/three.min.js');
THREE.ColorManagement.legacyMode = false;
const context = vm.createContext({ window: { THREE } });
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../src/reef.js'), 'utf8'), context);
const Reef3D = vm.runInContext('Reef3D', context);
const parent = new THREE.Group(), scene = Reef3D.create({ parent, waterY: .02, outerWaterY: -.3 });
const group = parent.children[0], reef = group.children[0], bodies = group.children[1], tails = group.children[2];
assert.equal(group.children.length, 3, 'reef and fish need three draws');
assert.equal(scene.stats().patches, 12); assert.equal(scene.stats().fish, 36);
assert.ok(scene.stats().triangles < 35000, 'geometry cost remains bounded');
for (const mesh of group.children) {
  for (const attr of ['position', 'normal', 'color']) {
    assert.ok(Array.from(mesh.geometry.attributes[attr].array).every(Number.isFinite), `${attr} stays finite`);
  }
  const normal = mesh.geometry.attributes.normal;
  for (let i = 0; i < normal.count; i++) {
    const length = Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i));
    assert.ok(length > .99 && length < 1.01, 'coral and fish normals are unit vectors');
  }
}
const pos = reef.geometry.attributes.position;
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), radius = Math.hypot(x, z);
  if (radius < 6) {
    assert.ok(radius > 3.2 && radius < 3.82, 'lagoon coral does not cover the native central reef');
    assert.ok(Math.max(Math.abs(x), Math.abs(z)) < 3, 'lagoon reef stays away from deed models');
    assert.ok(y < .004, 'all lagoon coral remains submerged');
  } else {
    assert.ok(Math.max(Math.abs(x), Math.abs(z)) > 7.8, 'outer reef is outside the board');
    assert.ok(y < -.315, 'outer coral remains submerged');
  }
}
const initial = [...bodies.instanceMatrix.array], initialTails = [...tails.instanceMatrix.array];
const matrix = new THREE.Matrix4(), location = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3();
for (let tick = 1; tick <= 720; tick++) {
  scene.update(tick / 2, .5);
  for (let i = 0; i < bodies.count; i++) {
    bodies.getMatrixAt(i, matrix); matrix.decompose(location, quaternion, scale);
    assert.ok([...matrix.elements, ...quaternion.toArray()].every(Number.isFinite));
    assert.ok(Math.abs(quaternion.length() - 1) < 1e-5);
    if (i < 24) {
      assert.ok(Math.hypot(location.x, location.z) > 3.2, 'fish avoid the native central island');
      assert.ok(location.y < .004, 'lagoon fish stay below the water');
    } else {
      assert.ok(Math.max(Math.abs(location.x), Math.abs(location.z)) > 7.8);
      assert.ok(location.y < -.315, 'outer fish stay below the water');
    }
    tails.getMatrixAt(i, matrix); assert.ok(matrix.elements.every(Number.isFinite));
  }
}
assert.notDeepEqual([...bodies.instanceMatrix.array], initial, 'fish follow their school routes');
assert.notDeepEqual([...tails.instanceMatrix.array], initialTails, 'fish tails move as real geometry');
const resources = new Set(group.children.flatMap(mesh => [mesh.geometry, mesh.material, ...(mesh.isInstancedMesh ? [mesh] : [])]));
const disposed = new Map();
for (const resource of resources) resource.addEventListener('dispose', () => disposed.set(resource, (disposed.get(resource) || 0) + 1));
scene.dispose(); scene.dispose(); scene.update(400, .5);
assert.equal(parent.children.length, 0); assert.equal(scene.stats().disposed, true);
for (const resource of resources) assert.equal(disposed.get(resource), 1, 'every owned GPU resource releases exactly once');
const still = Reef3D.create({ parent, waterY: .02, outerWaterY: -.3, reducedMotion: true });
const stillMatrices = parent.children[0].children.map(mesh => mesh.instanceMatrix ? [...mesh.instanceMatrix.array] : null);
still.update(50, 50);
parent.children[0].children.forEach((mesh, i) => { if (mesh.instanceMatrix) assert.deepEqual([...mesh.instanceMatrix.array], stillMatrices[i]); });
still.dispose();
assert.equal(Reef3D.create({}), null);
console.log('Reef 3D: submerged coral geometry, 36 fish routes/tails, three draws, reduced motion, and complete resource cleanup passed.');
