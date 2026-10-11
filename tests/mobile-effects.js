// Phone budgets keep all animated actors and the same event timelines, while
// submitting only live particle instances and less decorative cloud/foam geometry.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('../vendor/three.min.js');
function api(name, file) {
  const context = { window: { THREE }, console, Math }; vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/' + file), 'utf8') + `\nglobalThis.api = ${name};`, context);
  return context.api;
}
const Weather = api('Weather3D', 'weather.js'), Marine = api('Marine3D', 'marine.js'), Lagoon = api('Lagoon3D', 'lagoon.js');
function triangles(geometry) { return (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3; }
function compile(material) {
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  material.onBeforeCompile(shader); return shader;
}
const desktopWeather = Weather.create({ parent: new THREE.Group(), seed: 1729 });
const desktopCloud = desktopWeather.group.getObjectByName('Four drifting 3D fair-weather clouds');
const desktopCloudTriangles = triangles(desktopCloud.geometry) * desktopCloud.count; desktopWeather.dispose();
const world = new THREE.Group(), material = new THREE.MeshStandardMaterial();
world.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material));
const weather = Weather.create({ parent: world, mobile: true, seed: 1729 });
const shader = compile(material);
assert(shader.vertexShader.includes('vWeatherShade = clamp'));
assert(!shader.fragmentShader.includes('length('), 'storm distance no longer runs per fragment on phones');
assert(shader.fragmentShader.includes('return vWeatherShade'));
const clouds = weather.group.getObjectByName('Four drifting 3D fair-weather clouds');
const rain = weather.group.getObjectByName('Local falling 3D rain');
assert.equal(clouds.count, 4, 'all fair-weather clouds remain');
const mobileCloudTriangles = triangles(clouds.geometry) * clouds.count;
assert(mobileCloudTriangles < desktopCloudTriangles * .4);
weather.update(0, 0); const quietRainVersion = rain.instanceMatrix.version;
weather.update(1, 1/30); assert.equal(rain.instanceMatrix.version, quietRainVersion, 'hidden rain uploads no matrices');
weather.update(weather.stats().firstStorm + 5, 1/30);
assert(weather.stats().raining); assert.equal(rain.count, 48); assert(rain.instanceMatrix.version > quietRainVersion);
assert(weather.stats().strength > .2); assert.equal(weather.stats().shade, 'vertex');
const hookVersion = material.version; weather.update(weather.stats().firstStorm + 6, 1/30); assert.equal(material.version, hookVersion);
weather.dispose();

const marine = Marine.create({ parent: new THREE.Group(), mobile: true });
assert.equal(marine.stats().animals, 8, 'sharks, orcas, mother/calf and dolphins all remain');
assert.equal(marine.stats().rings, 18); assert.equal(marine.stats().droplets, 48);
let peakSpray = 0, packedFrames = 0, leapFrames = 0;
for (let f = 0; f < 90 * 30; f++) {
  marine.update(f/30, 1/30); const stats = marine.stats();
  assert(stats.activeRings <= 18 && stats.activeDrops <= 48);
  peakSpray = Math.max(peakSpray, stats.activeDrops);
  if (stats.activeDrops < stats.droplets) packedFrames++;
  for (const mesh of marine.group.children.filter(o => o.isInstancedMesh)) {
    assert.equal(mesh.visible, mesh.count > 0);
    for (let i = 0; i < mesh.count; i++) { const m = new THREE.Matrix4(); mesh.getMatrixAt(i,m); assert(m.elements.every(Number.isFinite)); }
  }
  if (marine.group.children.some(o => o.name === 'orca' && o.position.y > 1.5)) leapFrames++;
}
assert(peakSpray > 10 && packedFrames > 2000 && leapFrames > 60, 'sprays/breaches still run across multiple cycles');
marine.dispose();

const options = { center: { x: 3.45, z: 3 }, radius: .59, waterY: .02 };
const desktopLagoon = Lagoon.create({ parent: new THREE.Group(), ...options });
const originalFunnel = triangles(desktopLagoon.group.getObjectByName('Round concave water funnel').geometry); desktopLagoon.dispose();
const lagoon = Lagoon.create({ parent: new THREE.Group(), mobile: true, ...options });
const mobileFunnel = triangles(lagoon.group.getObjectByName('Round concave water funnel').geometry);
assert(mobileFunnel < originalFunnel * .4); assert.equal(lagoon.stats().foam, 40);
assert.equal(lagoon.stats().boats, 3); assert.equal(lagoon.stats().props, 12);
const sunken = new Set();
for (let f = 0; f < 120 * 30; f++) {
  lagoon.update(f/30, 1/30);
  lagoon.stats().states.forEach((boat, i) => { assert(boat.position.every(Number.isFinite)); if (boat.position[1] < -.8) sunken.add(i); });
  const wake = lagoon.group.children.find(o => o.isInstancedMesh && o.geometry.type === 'TorusGeometry');
  assert.equal(wake.count, lagoon.stats().activeWakes); assert(wake.count <= 21);
}
assert.equal(sunken.size, 3, 'all boats still enter the vortex'); lagoon.dispose();
console.log(JSON.stringify({ passed: true, mobileCloudTriangles, desktopCloudTriangles, mobileFunnel, originalFunnel, animals: 8, boats: 3, leapFrames, peakSpray, packedFrames }, null, 2));
