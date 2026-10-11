// Real Three.js weather geometry, material shader chains and lifetime behavior.
// GPU output is verified separately in the browser; no timers/audio/network run here.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('../vendor/three.min.js');
const context = { window: { THREE }, console, Math };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/weather.js'), 'utf8') + '\nglobalThis.weatherAPI = Weather3D;', context);
const parent = new THREE.Group(), geometry = new THREE.BoxGeometry(1, 1, 1);
const native = new THREE.MeshStandardMaterial({ color: 0xd5bd8b });
native.userData.weatherPatched = true; // Deliberately copied metadata must not skip actual materials.
let priorCalls = 0;
native.onBeforeCompile = shader => { priorCalls++; shader.vertexShader = '#define EXISTING_WIND 1\n' + shader.vertexShader; };
native.customProgramCacheKey = () => 'existing-native-wind';
parent.add(new THREE.Mesh(geometry, native));
const instancedMat = new THREE.MeshLambertMaterial({ color: 0x47634d });
parent.add(new THREE.InstancedMesh(geometry, instancedMat, 2));
const custom = new THREE.ShaderMaterial({
  vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'void main() { gl_FragColor = vec4(1.0); }'
});
parent.add(new THREE.Points(geometry, custom));
const thunder = []; let sampleTime = 0;
const weather = context.weatherAPI.create({ parent, waterY: .02, outerWaterY: -.3, seed: 1729, reducedMotion: false, onThunder: event => thunder.push({ time: sampleTime, ...event }) });
function compile(mat, lib = 'standard') {
  const shader = { uniforms: {}, vertexShader: mat.isShaderMaterial ? mat.vertexShader : THREE.ShaderLib[lib].vertexShader, fragmentShader: mat.isShaderMaterial ? mat.fragmentShader : THREE.ShaderLib[lib].fragmentShader };
  mat.onBeforeCompile(shader); return shader;
}
const shader = compile(native), uniform = shader.uniforms.uWeatherZone;
assert.equal(priorCalls, 1); assert.equal(uniform.value.w, 0);
assert(shader.vertexShader.includes('EXISTING_WIND'));
assert(shader.vertexShader.indexOf('#include <morphtarget_vertex>') < shader.vertexShader.indexOf('vec4 weatherP'));
assert(shader.vertexShader.indexOf('#include <skinning_vertex>') < shader.vertexShader.indexOf('vec4 weatherP'));
assert(shader.vertexShader.indexOf('#include <project_vertex>') < shader.vertexShader.indexOf('vec4 weatherP'));
assert(shader.vertexShader.includes('weatherP = instanceMatrix * weatherP'));
assert(shader.fragmentShader.indexOf('outgoingLight *= 1.0 - localWeatherShade()') < shader.fragmentShader.indexOf('#include <output_fragment>'));
assert(native.customProgramCacheKey().startsWith('existing-native-wind'));
const customShader = compile(custom);
assert.equal(customShader.uniforms.uWeatherZone, uniform); assert(customShader.fragmentShader.includes('gl_FragColor.rgb *= 1.0 - localWeatherShade()'));
assert(customShader.vertexShader.includes('vec4 weatherP = vec4(position, 1.0)'));
const versions = [native.version, instancedMat.version, custom.version];
weather.update(0, 0);
assert.equal(weather.stats().scans, 1, 'creation and first update do not double-scan');
const cycles = new Set(), zones = [], flashLengths = []; let flashStart = null, maxShade = 0, maxRain = 0, rainyFrames = 0;
const rain = weather.group.getObjectByName('Local falling 3D rain');
const bolt = weather.group.getObjectByName('Thin branched 3D lightning');
const clouds = weather.group.getObjectByName('Four drifting 3D fair-weather clouds');
assert.equal(rain.count, 144); assert.equal(clouds.count, 4); assert(bolt.geometry.attributes.position.count > 300);
let sourcePointLights = 0; weather.group.traverse(o => { if (o.isPointLight) sourcePointLights++; }); assert.equal(sourcePointLights, 0, 'lightning has no scene-wide light flash');
for (let frame = 0; frame <= 180 * 60; frame++) {
  sampleTime = frame / 60; weather.update(sampleTime, 1 / 60);
  const stats = weather.stats(); assert(stats.strength >= 0 && stats.strength <= .4); maxShade = Math.max(maxShade, stats.strength);
  assert(Math.abs(stats.zone[0]) <= 4.25 && Math.abs(stats.zone[1]) <= 4.25); assert(stats.zone[2] >= 1.6 && stats.zone[2] <= 2.25);
  assert(stats.duration >= 12 && stats.duration <= 18); assert(stats.quiet >= 45 && stats.quiet <= 70);
  if (stats.active && !cycles.has(stats.cycle)) { cycles.add(stats.cycle); zones.push(stats.zone.slice(0, 2)); }
  if (stats.raining) { rainyFrames++; maxRain = Math.max(maxRain, rain.count); for (let j = 0; j < 5; j++) { const m = new THREE.Matrix4(); rain.getMatrixAt(j * 23, m); assert(m.elements.every(Number.isFinite)); } }
  if (stats.lightning && flashStart == null) flashStart = sampleTime;
  if (!stats.lightning && flashStart != null) { flashLengths.push(sampleTime - flashStart); flashStart = null; }
  assert.equal(uniform.value.w, stats.strength);
  assert(weather.group.children.every(o => o.position.toArray().every(Number.isFinite)));
}
assert(weather.stats().firstStorm >= 12 && weather.stats().firstStorm <= 25);
assert(cycles.size >= 2, 'more than one independently placed storm occurs'); assert.notDeepEqual(zones[0], zones[1]);
assert(maxShade > .25 && rainyFrames > 100); assert(thunder.length >= 4); assert(flashLengths.every(s => s <= .2));
for (let i = 1; i < thunder.length; i++) assert(thunder[i].time - thunder[i - 1].time >= 3.79, 'lightning intervals stay well above 1.5 seconds');
assert.deepEqual([native.version, instancedMat.version, custom.version], versions, 'periodic scans do not recompile unchanged materials');
assert(weather.stats().scans <= 182);

// A late GLB material clone has copied metadata but needs its own shader hook.
const clone = native.clone(); parent.add(new THREE.Mesh(geometry, clone)); weather.update(182, 1 / 60);
const clonedShader = compile(clone); assert.equal(clonedShader.uniforms.uWeatherZone, uniform); assert(clone.customProgramCacheKey().includes('weather3d-local'));
// Explicitly copied wrappers must still produce one varying/uniform declaration.
const copied = new THREE.MeshStandardMaterial(); copied.onBeforeCompile = native.onBeforeCompile; copied.customProgramCacheKey = native.customProgramCacheKey;
parent.add(new THREE.Mesh(geometry, copied)); weather.update(183, 1 / 60);
const copiedShader = compile(copied); assert.equal((copiedShader.vertexShader.match(/varying vec3 vWeatherWorld;/g) || []).length, 1); assert.equal((copied.customProgramCacheKey().match(/weather3d-local-v1/g) || []).length, 1);
// If native water/wind replaces a hook later, the next scan chains its new hook.
native.onBeforeCompile = s => { s.vertexShader = '#define NEW_NATIVE_WIND 1\n' + s.vertexShader; }; native.customProgramCacheKey = () => 'changed-native-wind';
weather.update(184, 1 / 60); const replaced = compile(native); assert(replaced.vertexShader.includes('NEW_NATIVE_WIND')); assert.equal(replaced.uniforms.uWeatherZone, uniform);
const previousKey = native.customProgramCacheKey(); native.onBeforeCompile = s => { s.vertexShader = '#define NEWER_WIND_ONLY 1\n' + s.vertexShader; };
weather.update(185, 1 / 60); assert.notEqual(native.customProgramCacheKey(), previousKey, 'hook-only replacement gets a different program key'); assert(compile(native).vertexShader.includes('NEWER_WIND_ONLY'));

// Detached async models are ready for their first render, including material
// arrays and hidden children; no periodic scan or visible frame is required.
const arriving = new THREE.Group(), arrivalMat = new THREE.MeshStandardMaterial(), arrivalGrey = arrivalMat.clone();
const arrivalMesh = new THREE.Mesh(geometry, [arrivalMat, arrivalGrey]); arrivalMesh.visible = false; arriving.add(arrivalMesh);
weather.patchObject(arriving);
for (const mat of [arrivalMat, arrivalGrey]) assert.equal(compile(mat).uniforms.uWeatherZone, uniform);
const arrivalVersions = [arrivalMat.version, arrivalGrey.version];
parent.add(arriving); weather.patchObject(arriving); weather.flush(); weather.update(186, .016);
assert.deepEqual([arrivalMat.version, arrivalGrey.version], arrivalVersions, 'first-render hooks are not replaced by flush or the fallback scan');
// The explicit warm-up flush catches objects made after Weather3D.create().
const lateTokenMat = new THREE.MeshLambertMaterial(); parent.add(new THREE.Mesh(geometry, lateTokenMat));
weather.flush(); assert.equal(compile(lateTokenMat, 'lambert').uniforms.uWeatherZone, uniform);
const tokenVersion = lateTokenMat.version, cloudVersion = clouds.material.version;
weather.flush(); weather.patchObject(weather.group); weather.update(186.5, .016);
assert.equal(lateTokenMat.version, tokenVersion); assert.equal(clouds.material.version, cloudVersion, 'weather-owned materials are excluded from explicit patching');

// Disposal frees every cached bolt variant and the whole effect pool exactly once.
let geometriesDisposed = 0, materialsDisposed = 0, worldDisposed = 0;
let instanceDisposals = 0;
weather.group.traverse(o => { if (o.isInstancedMesh) o.addEventListener('dispose', () => instanceDisposals++); });
geometry.addEventListener('dispose', () => worldDisposed++); native.addEventListener('dispose', () => worldDisposed++);
const originalGeoDispose = THREE.BufferGeometry.prototype.dispose, originalMatDispose = THREE.Material.prototype.dispose;
THREE.BufferGeometry.prototype.dispose = function () { geometriesDisposed++; return originalGeoDispose.call(this); };
THREE.Material.prototype.dispose = function () { materialsDisposed++; return originalMatDispose.call(this); };
weather.dispose(); weather.dispose();
assert.equal(instanceDisposals, 3, 'cloud, rain and ripple GPU instance buffers released once');
THREE.BufferGeometry.prototype.dispose = originalGeoDispose; THREE.Material.prototype.dispose = originalMatDispose;
assert.equal(geometriesDisposed, 7); assert.equal(materialsDisposed, 5); assert.equal(worldDisposed, 0); assert.equal(uniform.value.w, 0); assert(!parent.children.includes(weather.group));

// Cached material shader hooks use the same source uniform in a later world.
const nextParent = new THREE.Group(); nextParent.add(new THREE.Mesh(geometry, native));
const next = context.weatherAPI.create({ parent: nextParent, seed: 2751, waterY: .02, reducedMotion: false });
next.update(0, 0); next.update(next.stats().firstStorm + 5, .016); assert(uniform.value.w > .2); assert.equal(compile(native).uniforms.uWeatherZone, uniform);
weather.update(500, .1); weather.dispose(); assert(uniform.value.w > .2, 'an old world cannot reset its replacement'); next.dispose(); assert.equal(uniform.value.w, 0);
const orphanMat = new THREE.MeshStandardMaterial(), orphan = new THREE.Mesh(geometry, orphanMat);
weather.patchObject(orphan); weather.flush(); assert.equal(orphanMat.version, 0, 'disposed weather cannot mutate later models');
// nextFlash always names an eligible future bolt, including the quiet interval.
const fixture=context.weatherAPI.create({parent:nextParent,seed:256,reducedMotion:false});fixture.update(0,0);fixture.update(40,.016);
const future=fixture.stats().nextFlash;fixture.update(future+.04,.016);assert(fixture.stats().lightning,'nextFlash in quiet time resolves to a real next-storm bolt');
fixture.update(21.887777,.016);assert(fixture.stats().lightning,'front-right deterministic first-bolt QA frame');fixture.dispose();
const quiet = context.weatherAPI.create({ parent: nextParent, seed: 99, reducedMotion: true, onThunder: () => assert.fail('reduced motion must not produce thunder') });
quiet.update(0, 0); quiet.update(60, .1);
const quietClouds = quiet.group.getObjectByName('Four drifting 3D fair-weather clouds'), quietSnapshot = quietClouds.instanceMatrix.array.slice(); quiet.update(600, .1);
assert.deepEqual(quietClouds.instanceMatrix.array, quietSnapshot); assert.equal(quiet.stats().strength, 0); assert.equal(quiet.stats().raining, false); assert.equal(quiet.stats().lightning, false); assert.equal(uniform.value.w, 0); quiet.dispose();
const phoneParent = new THREE.Group(), phoneWeather = context.weatherAPI.create({ parent: phoneParent, mobile: true });
const phoneMat = new THREE.MeshStandardMaterial(); phoneWeather.patchObject(new THREE.Mesh(geometry, phoneMat));
const phoneShader = compile(phoneMat);
assert(phoneShader.vertexShader.includes('varying float vWeatherShade;')); assert(!phoneShader.vertexShader.includes('varying vec3 vWeatherWorld;'));
assert(phoneMat.customProgramCacheKey().endsWith('weather3d-local-v1-vertex')); phoneWeather.dispose();
console.log(JSON.stringify({ passed: true, seconds: 180, frames: 10800, storms: cycles.size, zones, maxShade, raindrops: maxRain, thunderEvents: thunder.length, longestFlash: Math.max(...flashLengths), shaderHooksPreserved: true, clonedMaterialsPatched: true, sourceUniformSurvivesRemake: true, geometryDisposals: geometriesDisposed, materialDisposals: materialsDisposed, reducedMotion: true }, null, 2));
