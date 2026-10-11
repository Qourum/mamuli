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
const clothPools = pools.filter(p => p.geometry.userData.cloth), clothSnapshots = new Map(), clothShaders = [];
let clothNormalRebuilds = 0, clothVertexWrites = 0;
function compileCloth(material) {
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  material.onBeforeCompile(shader); return shader;
}
for (const p of clothPools) {
  const geometry = p.geometry, positions = geometry.attributes.position, coefficients = geometry.attributes.aPlaceCloth;
  assert.equal(coefficients.count, positions.count); assert.equal(coefficients.itemSize, 2);
  assert.equal(p.castShadow, false, 'cloth retains its existing shadow behavior');
  clothSnapshots.set(p, { position: positions.array.slice(), normal: geometry.attributes.normal.array.slice(), versions: [positions.version, geometry.attributes.normal.version] });
  const computeNormals = geometry.computeVertexNormals, setVertex = positions.setXYZ;
  geometry.computeVertexNormals = function (...args) { clothNormalRebuilds++; return computeNormals.apply(this, args); };
  positions.setXYZ = function (...args) { clothVertexWrites++; return setVertex.apply(this, args); };
  const shader = compileCloth(p.material); clothShaders.push(shader);
  assert(shader.vertexShader.includes('objectNormal.xy -= clothWave.yz * objectNormal.z;'), 'inverse-transpose normal correction is applied');
  assert(shader.vertexShader.includes('transformed.z += clothWave.x;'), 'the wave deforms the rendered cloth');
  assert(shader.vertexShader.indexOf('vec3 clothWave =') < shader.vertexShader.indexOf('transformed.z += clothWave.x;'));
  // Evaluate the actual small shader expression against the original CPU wave.
  // This catches a scale/frequency/edge-pinning change without a WebGL mock.
  const waveBody = shader.vertexShader.match(/vec3 placeClothWave\(vec3 p\)\s*\{([\s\S]*?)\}/)[1].replace(/\bfloat\b/g, 'let');
  const wave = new Function('p', 'aPlaceCloth', 'uPlaceClothTime', 'const sin=Math.sin, cos=Math.cos, vec3=(...values)=>values;' + waveBody);
  const width = geometry.userData.width, tent = geometry.userData.tent;
  const freeAt = x => tent ? Math.abs(x / width) : Math.max(0, Math.min(1, x / width));
  const reference = (x, y, time) => freeAt(x) * .0045 * Math.sin(time * 2.1 + x * 49 + y * 18);
  for (const time of [0, .25, 1.7, 19.4]) for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), actual = wave({ x, y }, { x: coefficients.getX(i), y: coefficients.getY(i) }, time);
    assert(Math.abs(actual[0] - reference(x, y, time)) < 1e-8, 'GPU wave retains the original cloth position');
    const h = 1e-6;
    // At a clamp/cusp the derivative is one-sided, so check smooth interiors.
    if (Math.abs(x) > h * 2 && (tent || Math.abs(x - width) > h * 2)) {
      assert(Math.abs(actual[1] - (reference(x + h, y, time) - reference(x - h, y, time)) / (2 * h)) < 1e-6, 'cloth X normal derivative matches the surface');
      assert(Math.abs(actual[2] - (reference(x, y + h, time) - reference(x, y - h, time)) / (2 * h)) < 1e-6, 'cloth Y normal derivative matches the surface');
    }
  }
}
assert.equal(clothPools.length, 4, 'flags, flag glyphs, sails and tents keep their animated surfaces');
assert(clothShaders.every(s => s.uniforms.uPlaceClothTime === clothShaders[0].uniforms.uPlaceClothTime), 'all cloth shares one clock');
const rings = pools.find(p => p.name.includes('arrival-rings')), coins = pools.find(p => p.name.includes('reward-coins'));
assert.ok(rings && coins);
let reactionMatrixWrites = 0;
for (const p of [rings, coins]) {
  const write = p.setMatrixAt; p.setMatrixAt = function (...args) { reactionMatrixWrites++; return write.apply(this, args); };
  assert.equal(p.count, 0); assert.equal(p.visible, false);
}
const idleReactionVersions = [rings.instanceMatrix.version, coins.instanceMatrix.version, rings.instanceColor.version, coins.instanceColor.version];
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
assert.equal(clothShaders[0].uniforms.uPlaceClothTime.value, 30, 'the shader clock advances with the board clock');
assert.equal(clothNormalRebuilds, 0, 'animation never rebuilds cloth normals on the CPU');
assert.equal(clothVertexWrites, 0, 'animation never rewrites cloth vertices on the CPU');
for (const [p, snapshot] of clothSnapshots) {
  assert.deepEqual(p.geometry.attributes.position.array, snapshot.position, 'rest positions remain in their existing GPU buffer');
  assert.deepEqual(p.geometry.attributes.normal.array, snapshot.normal, 'rest normals remain in their existing GPU buffer');
  assert.deepEqual([p.geometry.attributes.position.version, p.geometry.attributes.normal.version], snapshot.versions, 'no position or normal GPU buffer upload is requested');
}
assert.equal(reactionMatrixWrites, 0, 'idle reaction pools never rewrite instance matrices');
assert.deepEqual([rings.instanceMatrix.version, coins.instanceMatrix.version, rings.instanceColor.version, coins.instanceColor.version], idleReactionVersions, 'idle reactions do not upload matrix or color buffers');
assert.ok(pools.some((p,i) => p.instanceMatrix.array.some((v,j) => v !== firstMatrices[i][j])), 'parts really animate');
for (const [mesh, positions] of staticPositions) assert.deepEqual([...mesh.geometry.attributes.position.array], positions, 'architecture never wobbles');
const unaffected = model.getObject(8).children.map(o => o.material), affectedBase = model.getObject(6).children.map(o => o.material);
model.setMort(6, true);
for (const mesh of model.getObject(6).children) { assert.ok(!affectedBase.includes(mesh.material)); resources.add(mesh.material); }
assert.deepEqual(model.getObject(8).children.map(o => o.material), unaffected, 'mortgage does not dim another place');
model.setMort(6, false); assert.deepEqual(model.getObject(6).children.map(o => o.material), affectedBase);
model.update(31, 1); assert.equal(model.trigger(6, 'buy', '#e64c62'), true); model.update(31.6, .6);
assert.equal(rings.count, 1); assert.equal(coins.count, 6); assert(rings.visible && coins.visible);
assert.ok(rings.instanceMatrix.array.some(v => v !== 0)); assert.ok(coins.instanceMatrix.array.some(v => v !== 0));
model.update(35, 3.4); assert.equal(rings.count, 0, 'reaction rings expire'); assert.equal(coins.count, 0, 'reward coins expire');
assert.equal(rings.visible, false); assert.equal(coins.visible, false);
const writesAfterExpiry = reactionMatrixWrites; model.update(35.5, .5); assert.equal(reactionMatrixWrites, writesAfterExpiry, 'expired pools remain untouched');
// High original indices pack into the first live slot, retain their player
// colors, and continue moving each frame at a 60 Hz update rate.
const readColor = (p, i) => { const color = new THREE.Color(); p.getColorAt(i, color); return color; };
const expectColor = (actual, expected, message) => assert(Math.max(Math.abs(actual.r-expected.r),Math.abs(actual.g-expected.g),Math.abs(actual.b-expected.b)) < 1e-6, message);
model.update(36, .5); model.trigger(34, 'buy', '#4c89e6');
assert.equal(rings.count, 1); assert.equal(coins.count, 6);
expectColor(readColor(rings, 0), new THREE.Color('#4c89e6'), 'packed ring retains its player color');
model.setMort(6, true); expectColor(readColor(rings, 0), new THREE.Color('#4c89e6'), 'inactive-place mortgage cannot recolor another packed effect');
model.setMort(34, true); expectColor(readColor(rings, 0), new THREE.Color('#4c89e6').multiplyScalar(.43), 'active mortgage updates the packed slot');
for (const mesh of model.getObject(34).children) resources.add(mesh.material);
model.setMort(34, false); model.setMort(6, false);
model.update(36.2, .2); model.trigger(8, 'arrival', '#51a97d');
assert.equal(rings.count, 2); assert.equal(coins.count, 12);
expectColor(readColor(rings, 0), new THREE.Color('#51a97d'), 'earlier place occupies the first packed slot');
expectColor(readColor(rings, 1), new THREE.Color('#4c89e6'), 'previously active place moves slots with its color');
let previousLive = rings.instanceMatrix.array.slice(0, 32);
for (let k = 1; k <= 60; k++) {
  model.update(36.2 + k / 60, 1 / 60);
  assert(rings.instanceMatrix.array.slice(0, 32).some((v, i) => v !== previousLive[i]), 'active reactions advance every 60 Hz frame');
  previousLive = rings.instanceMatrix.array.slice(0, 32);
}
model.update(38.05, .85); assert.equal(rings.count, 1); assert.equal(coins.count, 6);
expectColor(readColor(rings, 0), new THREE.Color('#51a97d'), 'remaining effect survives another effect expiring');
model.update(39, .95); assert.equal(rings.count, 0); assert.equal(coins.count, 0);
assert.equal(model.trigger(999,'arrival'), false); model.update(NaN, .1);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/weather.js'), 'utf8'), ctx);
const weather = vm.runInContext('Weather3D', ctx).create({ parent, mobile: true, seed: 17 });
for (const p of clothPools) {
  const combined = compileCloth(p.material);
  assert.equal(combined.uniforms.uPlaceClothTime, clothShaders[0].uniforms.uPlaceClothTime, 'weather preserves the live cloth clock');
  assert(combined.uniforms.uWeatherZone, 'cloth still receives local storm shade');
  assert(combined.vertexShader.includes('transformed.z += clothWave.x;'));
  assert(combined.vertexShader.indexOf('transformed.z += clothWave.x;') < combined.vertexShader.indexOf('vec4 weatherP'), 'storm shade uses the deformed cloth position');
  assert(p.material.customProgramCacheKey().includes('place-cloth-wave-v1'));
  assert(p.material.customProgramCacheKey().includes('weather3d-local-v1-vertex'));
}
weather.dispose();
for (const resource of resources) resource.addEventListener('dispose', () => disposed.set(resource, (disposed.get(resource) || 0) + 1));
model.dispose(); model.dispose(); model.update(40, 1); assert.equal(parent.children.length, 0); assert.equal(model.stats().disposed, true);
for (const resource of resources) assert.equal(disposed.get(resource), 1, 'every GPU resource is disposed exactly once');
const still = PM.create({ parent, places, reducedMotion: true }), stillPools = parent.children[0].children.filter(o => o.isInstancedMesh), stillMatrices = stillPools.map(p => [...p.instanceMatrix.array]);
const stillClothShader = compileCloth(stillPools.find(p => p.geometry.userData.cloth).material);
still.update(150, 150); still.trigger(14,'build','#51a97d'); still.update(155, 5);
assert.equal(stillClothShader.uniforms.uPlaceClothTime.value, 0, 'reduced motion keeps the cloth shader stationary');
stillPools.forEach((p,i) => assert.deepEqual([...p.instanceMatrix.array], stillMatrices[i], 'reduced motion has no animation/reaction movement'));
for (const p of stillPools.filter(p => /arrival-rings|reward-coins/.test(p.name))) { assert.equal(p.count, 0); assert.equal(p.visible, false); }
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
const clothVertices = clothPools.reduce((n, p) => n + p.geometry.attributes.position.count, 0);
console.log(JSON.stringify({ cloth: { pools: clothPools.length, vertices: clothVertices, normalRebuildsPerFrame: 0, eliminatedVertexWritesPerFrame: clothVertices, eliminatedBufferUploadBytesPerFrame: clothVertices * 3 * 4 * 2, sharedTimeUniform: true, weatherComposition: true } }));
