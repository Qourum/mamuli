// Exercise the actual exported island with the game's bundled Three/glTF readers. Image decoding is the only browser
// service stubbed here; this checks scene preservation and playback, while the browser smoke test checks rendering.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
global.window = global;
global.THREE = require(path.join(root, 'vendor/three.min.js'));
global.createImageBitmap = async () => ({ width: 2048, height: 2048, close() {} });
// GLTFLoader probes browser WebP support with a one-pixel Image before using ImageBitmapLoader for actual textures.
global.Image = class {
  constructor() { this.width = this.height = 1; }
  set src(value) { queueMicrotask(() => { if (this.onload) this.onload(); }); }
};
global.self = global;
const realFetch = global.fetch;
let reads = 0;
global.fetch = async (url, options) => {
  if (String(url).startsWith('blob:')) return realFetch(url, options);
  reads++;
  const data = fs.readFileSync(path.join(root, url));
  return { ok: true, arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) };
};
vm.runInThisContext(fs.readFileSync(path.join(root, 'vendor/GLTFLoader.min.js'), 'utf8'));
vm.runInThisContext('const SITE = true;\n' + fs.readFileSync(path.join(root, 'src/glb.js'), 'utf8') + '\nglobal.__GLB = GLB;');

async function periphery() {
  const names = fs.readdirSync(path.join(root, 'art')).filter(n => /^m_.+_animated\.glb$/.test(n) && n !== 'm_volcano_animated.glb').sort();
  assert.equal(names.length, 18, '--all expects the complete peripheral asset batch');
  let vertices = 0;
  for (const name of names) {
    const url = `art/${name}`, startReads = reads;
    const [a, b] = await Promise.all([__GLB.loadScene(url), __GLB.loadScene(url)]);
    assert.equal(reads - startReads, 1, `${name}: one fetch for concurrent scene instances`);
    const staticArchitecture = name === 'm_gotland_animated.glb'; // Visby's masonry stays fixed; game actors supply life.
    assert.ok(staticArchitecture || a.animations.length, `${name}: native animation clips`);
    a.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(a.scene), size = box.getSize(new THREE.Vector3());
    assert.ok([box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z].every(Number.isFinite), `${name}: finite world bounds`);
    assert.ok(size.x > 0.8 && size.x < 1.2, `${name}: original width-one placement is preserved (${size.x})`);
    const morphs = [];
    let mapped = 0, meshes = 0;
    a.scene.traverse(o => {
      if (!o.isMesh) return;
      meshes++;
      const pos = o.geometry.attributes.position;
      vertices += pos.count;
      for (let i = 0; i < pos.count; i++) assert.ok(Number.isFinite(pos.getX(i)) && Number.isFinite(pos.getY(i)) && Number.isFinite(pos.getZ(i)), `${name}: finite decoded positions`);
      for (const target of o.geometry.morphAttributes.position || []) {
        assert.equal(target.count, pos.count, `${name}: sparse morph has a complete vertex range`);
        for (let i = 0; i < target.count; i++) assert.ok(Number.isFinite(target.getX(i)) && Number.isFinite(target.getY(i)) && Number.isFinite(target.getZ(i)), `${name}: finite sparse morph positions`);
      }
      for (const mat of Array.isArray(o.material) ? o.material : [o.material]) if (mat.isMeshStandardMaterial && mat.map) mapped++;
      if (o.morphTargetInfluences && o.morphTargetInfluences.length) morphs.push(o);
    });
    assert.ok(meshes && mapped, `${name}: textured PBR meshes survive parsing`);
    if (staticArchitecture && !a.animations.length) continue;
    assert.ok(morphs.length, `${name}: native deformation targets`);
    const before = morphs.map(o => o.morphTargetInfluences.slice());
    for (const o of morphs) assert.notEqual(o.morphTargetInfluences, b.scene.getObjectByName(o.name).morphTargetInfluences, `${name}: independent morph state`);
    const mixer = new THREE.AnimationMixer(a.scene);
    for (const clip of a.animations) mixer.clipAction(clip).play();
    const duration = Math.max(...a.animations.map(clip => clip.duration));
    assert.ok(Number.isFinite(duration) && duration > 0, `${name}: finite nonempty animation duration`);
    let changed = false;
    for (const fraction of [0.17, 0.53, 0.87]) {
      mixer.setTime(duration * fraction);
      changed ||= morphs.some((o, j) => before[j].some((weight, k) => Math.abs(weight - o.morphTargetInfluences[k]) > 0.0001));
    }
    assert.ok(changed, `${name}: actual morph playback changes the pose`);
    morphs.forEach((o, j) => assert.deepEqual(b.scene.getObjectByName(o.name).morphTargetInfluences, before[j], `${name}: the other scene remains unchanged`));
    mixer.stopAllAction(); mixer.uncacheRoot(a.scene);
  }
  console.log(`peripheral GLBs: ${names.length} assets, ${vertices} decoded vertices; quantized bounds, sparse morph playback, textures and instance isolation passed`);
}

(async () => {
  const [a, b] = await Promise.all([__GLB.loadScene('art/m_volcano_animated.glb'), __GLB.loadScene('art/m_volcano_animated.glb')]);
  assert.equal(reads, 1, 'the GLB is fetched once even during concurrent loads');
  assert.notEqual(a.scene, b.scene, 'boards own separate scene instances');
  const ocean = a.scene.getObjectByName('Ocean_Surface');
  ocean.parent.remove(ocean);
  assert.ok(b.scene.getObjectByName('Ocean_Surface'), 'removing the prototype sea does not change cached scene instances');
  assert.ok(a.animations.length, 'the native clips are retained');
  const morphs = [];
  a.scene.traverse(o => { if (o.morphTargetInfluences && o.morphTargetInfluences.length) morphs.push(o); });
  assert.ok(morphs.length, 'foliage/smoke keep their native morph targets');
  const leaf = morphs[0], other = b.scene.getObjectByName(leaf.name);
  assert.notEqual(leaf.morphTargetInfluences, other.morphTargetInfluences, 'morph weights belong to each instance');
  assert.equal(leaf.geometry, other.geometry, 'immutable geometry is reused');
  const island = a.scene.getObjectByName('Island_High_Detail_PBR');
  assert.ok(island, 'the authored scene structure is preserved');
  const materials = [];
  island.traverse(o => { if (o.isMesh) materials.push(...(Array.isArray(o.material) ? o.material : [o.material])); });
  assert.ok(materials.some(m => m.isMeshStandardMaterial && m.map && m.normalMap && m.roughnessMap), 'the original PBR maps survive');
  assert.ok(materials.every(m => m.userData.keep), 'cached materials survive a world rebuild');
  const ship = a.scene.getObjectByName('Galleon_Sea_Motion'), untouchedShip = b.scene.getObjectByName('Galleon_Sea_Motion');
  const before = ship.position.clone(), weights = leaf.morphTargetInfluences.slice(), untouched = untouchedShip.position.clone();
  const mixer = new THREE.AnimationMixer(a.scene);
  for (const clip of a.animations) mixer.clipAction(clip).play();
  mixer.update(1.37);
  assert.ok(before.distanceTo(ship.position) > 0.001, 'the native ship clip advances');
  assert.ok(weights.some((w, i) => Math.abs(w - leaf.morphTargetInfluences[i]) > 0.001), 'the native wind clip advances');
  assert.ok(untouched.distanceTo(untouchedShip.position) < 1e-9, 'playing one scene does not move the next board');
  assert.deepEqual(other.morphTargetInfluences, weights, 'playing one scene does not deform another');
  mixer.stopAllAction(); mixer.uncacheRoot(a.scene);
  assert.equal(mixer.stats.actions.inUse, 0, 'actions are released when a board is replaced');
  console.log(`native GLB: ${a.animations.length} clips, ${morphs.length} morph meshes; PBR, playback, cache and instance isolation passed`);
  if (process.argv.includes('--all')) await periphery();
})().catch(e => { console.error(e); process.exitCode = 1; });
