// Real packed water pixels and terrain geometry, plus the production material
// hooks against vendored Three r149. Browser QA separately checks GPU compilation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('../vendor/three.min.js');
const base = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(base, 'src/board3d.js'), 'utf8');
function between(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert(a >= 0 && b > a, 'production block exists: ' + start);
  return source.slice(a, b);
}
function canvas() {
  const cv = { width: 0, height: 0, pixels: null };
  cv.getContext = () => ({
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData(im) { cv.pixels = im.data; }
  });
  return cv;
}
const context = vm.createContext({ window: { THREE }, T: THREE, console, Math,
  document: { createElement: canvas }, maxAniso: 8, TAU: Math.PI * 2,
  clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
  smooth: (lo, hi, x) => { const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo))); return t * t * (3 - 2 * t); }
});
for (const file of ['data.js', 'themes.js', 'terrain.js', 'models.js', 'sea.js', 'weather.js']) {
  vm.runInContext(fs.readFileSync(path.join(base, 'src', file), 'utf8'), context);
}
vm.runInContext(between('  const U = ', '  // a model from a file') +
  between('  function causticTexture()', '  // ===== building the board =====') +
  '\nglobalThis.water = { causticTexture, living, seaSurface, seaStormAt, seaHeight, U, LIVING, SEA_WAVES, STORM_WAVE };', context);
const water = context.water, texture = water.causticTexture(), image = texture.image;
assert.equal(image.width, 256); assert.equal(image.height, 256);
assert.equal(texture.wrapS, THREE.RepeatWrapping); assert.equal(texture.wrapT, THREE.RepeatWrapping);
assert.equal(texture.minFilter, THREE.LinearMipmapLinearFilter); assert.equal(texture.magFilter, THREE.LinearFilter);
assert.equal(texture.generateMipmaps, true); assert.equal(texture.anisotropy, 4);
assert.equal(texture.encoding, THREE.LinearEncoding, 'packed data is not sRGB colour data');
assert.equal(texture.userData.keep, true, 'texture survives board retheming');
const pixels = image.pixels, N = image.width;
const channels = [];
for (let c = 0; c < 3; c++) {
  let min = 255, max = 0, neighborSum = 0, neighborMax = 0, seamSum = 0, seamMax = 0, count = 0;
  const values = new Set();
  const at = (x, y) => pixels[(y * N + x) * 4 + c];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = at(x, y); min = Math.min(min, v); max = Math.max(max, v); values.add(v);
    assert.equal(pixels[(y * N + x) * 4 + 3], 255);
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      if (x + dx >= N || y + dy >= N) continue;
      const delta = Math.abs(v - at(x + dx, y + dy));
      neighborSum += delta; neighborMax = Math.max(neighborMax, delta); count++;
    }
  }
  for (let k = 0; k < N; k++) for (const delta of [Math.abs(at(0, k) - at(N - 1, k)), Math.abs(at(k, 0) - at(k, N - 1))]) {
    seamSum += delta; seamMax = Math.max(seamMax, delta);
  }
  const meanStep = neighborSum / count, meanSeam = seamSum / (2 * N);
  assert(max - min > 100 && values.size > 100, 'each packed channel contains a useful varying field');
  assert(meanSeam <= meanStep * 2.5 + 1, 'repeat boundary has no exceptional visible seam');
  assert(seamMax <= neighborMax * 1.5 + 2, 'repeat edge is bounded like neighboring pixels');
  if (c > 0) assert(neighborMax < 20, 'colour/foam fields change smoothly without pixel noise');
  channels.push({ channel: ['light', 'colour', 'foam'][c], min, max, meanStep: +meanStep.toFixed(2), meanSeam: +meanSeam.toFixed(2), neighborMax, seamMax });
}
let rg = 0, rb = 0, gb = 0;
for (let k = 0; k < pixels.length; k += 4) {
  rg += pixels[k] !== pixels[k + 1]; rb += pixels[k] !== pixels[k + 2]; gb += pixels[k + 1] !== pixels[k + 2];
}
assert(Math.min(rg, rb, gb) > N * N * .8, 'RGB fields are independent, not duplicate grayscale');
water.U.caustic.value = texture;
function compile(material) {
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.phong.vertexShader, fragmentShader: THREE.ShaderLib.phong.fragmentShader };
  material.onBeforeCompile(shader); return shader;
}
const fragmentSea = water.LIVING.f.split('#ifdef SEA')[1].split('#else')[0];
assert.equal((fragmentSea.match(/texture2D\s*\(/g) || []).length, 2, 'water uses two shared packed samples');
assert(!fragmentSea.includes('uDetail'), 'water does not sample the terrain detail texture');
assert(fragmentSea.includes('vViewPosition'), 'broad grazing sheen uses the actual view direction');
assert(THREE.ShaderChunk.lights_phong_pars_fragment.includes('vViewPosition'), 'view varying exists in the installed r149 shader');
for (const mobile of [false, true]) {
  const material = water.living(new THREE.MeshPhongMaterial({ transparent: true, depthWrite: false }), true);
  const parent = new THREE.Group();
  parent.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material));
  context.parent = parent; context.phone = mobile;
  const weather = vm.runInContext('Weather3D.create({ parent, mobile: phone, seed: 1729 })', context);
  const sh = compile(material);
  assert.equal(sh.uniforms.uCaustic, water.U.caustic); assert.equal(sh.uniforms.uTime, water.U.time);
  assert.equal(sh.uniforms.uSeaStorm, water.U.storm, 'water reuses the live weather envelope');
  assert.equal(sh.uniforms.uSeaWind, water.U.stormWind, 'short waves use the shared wind direction');
  assert(sh.uniforms.uWeatherZone, 'weather and water uniforms coexist');
  assert.equal(sh.uniforms.uSeaStorm, sh.uniforms.uWeatherZone, 'water height and local shading read the same cell');
  assert.equal(material.defines.SEA, ''); assert.equal(material.side, THREE.FrontSide);
  assert.equal(material.depthWrite, false, 'submerged scenery remains visible');
  assert(sh.fragmentShader.includes('waterA.b'), 'packed foam survives weather wrapping');
  assert(sh.vertexShader.includes('transformed.y -= 0.055 * ( 1.0 - nativeCoast )'), 'native coast keeps separation');
  assert(sh.fragmentShader.indexOf('specularStrength *=') < sh.fragmentShader.indexOf('#include <lights_phong_fragment>'), 'water specular edits run before r149 lighting');
  assert(sh.fragmentShader.indexOf('outgoingLight *= 1.0 - localWeatherShade()') < sh.fragmentShader.indexOf('#include <output_fragment>'));
  assert.equal((sh.vertexShader.match(/uniform float uTime;/g) || []).length, 1, 'clock is declared only once');
  assert.equal((sh.fragmentShader.match(/varying vec3 vWP;/g) || []).length, 1, 'world position is declared only once');
  assert(material.customProgramCacheKey().includes('livingsea-packed-depth-v3'));
  if (mobile) assert(sh.vertexShader.includes('vWeatherShade = clamp'));
  weather.dispose(); parent.children[0].geometry.dispose(); material.dispose();
}

// Execute the actual scalar GLSL envelope expression after replacing vector
// access and built-ins with their JS equivalents; compare it to the production
// CPU query across the centre, falloff, outside, and degenerate-radius cases.
const weatherUniforms = vm.runInContext('Weather3D.waterUniforms', context);
assert.equal(water.U.storm, weatherUniforms.zone, 'the uniform is shared across world remakes');
assert.equal(water.U.stormWind, weatherUniforms.wind, 'wind direction shares the weather lifecycle');
const envelopeMatch = /vSeaStorm\s*=\s*([^;]+);/.exec(water.LIVING.v);
assert(envelopeMatch, 'vertex shader has a local storm envelope');
const glslEnvelope = envelopeMatch[1]
  .replace(/distance\(\s*wp4\.xz\s*,\s*uSeaStorm\.xy\s*\)/g, 'Math.hypot(x - zone.x, z - zone.y)')
  .replace(/uSeaStorm\./g, 'zone.').replace(/smoothstep\(/g, 'smooth(').replace(/\bmax\(/g, 'Math.max(');
context.glslEnvelope = vm.runInContext(`(x,z,zone)=>${glslEnvelope}`, context);
let stormSamples = 0;
for (const zone of [[0,0,2,0], [3.4,2.8,1.4,.4], [-7.5,1.2,2.2,.19], [0,0,0,.4], [0,0,-1,.4], [0,0,1,-.1], [0,0,1,.8]]) {
  water.U.storm.value.set(...zone);
  for (let i = -20; i <= 20; i++) for (const angle of [0, .79, 2.31]) {
    const x = zone[0] + Math.cos(angle) * i * .11, z = zone[1] + Math.sin(angle) * i * .11;
    const cpu = water.seaStormAt(x,z), gpu = context.glslEnvelope(x,z,water.U.storm.value);
    assert(Number.isFinite(cpu) && cpu >= 0 && cpu <= 1, 'weather strength is finite and bounded');
    assert(Math.abs(cpu - gpu) < 1e-12, 'CPU craft and GPU waves use the same envelope');
    if (zone[3] === 0) assert.equal(cpu, 0, 'quiet weather preserves calm-water amplitude exactly');
    stormSamples++;
  }
}
water.U.storm.value.set(3.4,2.8,2,.4);
assert.equal(water.seaStormAt(3.4,2.8), 1, 'storm reaches full strength at its centre');
assert.equal(water.seaStormAt(5.4,2.8), 0, 'storm does not change water outside its radius');
let lastEnvelope = 1;
for (let k = 0; k <= 1000; k++) {
  const value = water.seaStormAt(3.4 + 2*k/1000, 2.8);
  assert(value <= lastEnvelope + 1e-12, 'cell strength falls off monotonically');
  assert(lastEnvelope - value < .002, 'cell strength has no hard boundary or amplitude step');
  lastEnvelope = value;
}
const vertexStormScale = /\(\s*1\.0\s*\+\s*([\d.]+)\s*\*\s*vSeaStorm\s*\)/.exec(water.LIVING.v);
const fragmentStormScale = /\(\s*1\.0\s*\+\s*([\d.]+)\s*\*\s*vSeaStorm\s*\)/.exec(fragmentSea);
assert(vertexStormScale && fragmentStormScale);
assert.equal(+vertexStormScale[1], +fragmentStormScale[1], 'normal slopes and wave mesh receive the same storm amplitude');
const peakBroadSwell = water.SEA_WAVES.reduce((n,w) => n + w[3], 0) * (1 + +vertexStormScale[1]);
const peakSwell=peakBroadSwell+water.STORM_WAVE.amplitude;
assert(peakBroadSwell > .15 && peakBroadSwell < .23 && peakSwell<.32, 'broad and short storm waves remain geometrically bounded');
assert(water.LIVING.v.includes('if ( vSeaStorm > 0.001 )') && fragmentSea.includes('if ( vSeaStorm > 0.001 )'), 'short wave and its normals use the same calm cutoff');
assert(/float whitecaps\s*=\s*vSeaStorm\s*\*/.test(fragmentSea), 'whitecaps vanish exactly in calm weather');
assert(/turquoise\s*=\s*mix\([^;]+vSeaStorm/.test(fragmentSea), 'local water tint responds to the same cell');
assert(source.indexOf('if (weatherLife) weatherLife.update', source.indexOf('const visualDt =')) < source.indexOf('if (marineLife) marineLife.update', source.indexOf('const visualDt =')), 'weather advances before craft query its height');
water.U.storm.value.set(0,0,1,0);

// Build real archipelago relief in the same transformed lot frames as the board.
vm.runInContext(`
const S=12, C=1.5, D=1.5, TW=1, LOT=1.25;
const OUT=[[0,1],[-1,0],[0,-1],[1,0]], ALONG=[[-1,0],[0,-1],[1,0],[0,1]];
const sideOf=i=>Math.floor(i/10)%4, yawOf=s=>-s*Math.PI/2;
` + between('  function centerOf(', '  // ----- small animations') +
  between('  function frameOf(', '  // made in steps') + `
Terrain.setWorld('sea');
for(let i=0;i<40;i++) {
  if(i%10===0) continue;
  const c=toWorld(i,0,-(D/2+LOT/2));
  SeaModels.relief(i,frameOf(c.x,c.z,yawOf(sideOf(i)),[1.18,1.25,1.12]));
}
for(let k=0;k<4;k++) {
  const [ox,oz]=OUT[k],[ax,az]=ALONG[k],a=S/2-D-LOT/2;
  SeaModels.ringRelief(k,frameOf(ox*a-ax*a,oz*a-az*a,yawOf(k),[1.2,1.3,1.2]));
}
SeaModels.centerRelief(Terrain); SeaModels.centerWater(Terrain);
globalThis.terrain=Terrain;
`, context);
function finish(generator) { let step; do { step = generator.next(); } while (!step.done); return step.value; }
function triangles(g) { return g.index.count / 3; }
function validateGeometry(g) {
  const p = g.attributes.position;
  assert(Array.from(p.array).every(Number.isFinite));
  assert(Array.from(g.attributes.normal.array).every(Number.isFinite));
  assert(Array.from(g.index.array).every(i => i < p.count));
  assert(Number.isFinite(g.boundingSphere.radius));
}
// Evaluate production resolution expressions so a future caller change cannot
// silently invalidate the tested phone budget or change the other world.
const boardArgs = /Terrain\.board\(([^\n]+?)\);/.exec(source)[1];
const oceanArgs = /Terrain\.outer\(([^\n]+?)\), MOD\.world/.exec(source)[1];
const lagoonArgs = /Terrain\.seaGeo\(([^\n]+?)\), mats\.sea/.exec(source)[1];
function settings(mobile, world) {
  context.mobile = mobile; context.MOD = { world };
  return vm.runInContext(`({bed:${boardArgs},outer:[${oceanArgs}],lagoon:${lagoonArgs}})`, context);
}
const phone = settings(true, 'sea'), desktop = settings(false, 'sea'), land = settings(true, 'land');
assert.equal(phone.bed, 112); assert.deepEqual(Array.from(phone.outer), [26, 72]); assert.equal(phone.lagoon, 72);
assert.equal(land.bed, 136); assert.deepEqual(Array.from(land.outer), [34, 80]);
assert.equal(desktop.bed, 160); assert.deepEqual(Array.from(desktop.outer), [42, 104]); assert.equal(desktop.lagoon, 96);
const terrain = context.terrain;
const bed = finish(terrain.board(phone.bed)), ocean = terrain.outer(...phone.outer), lagoon = finish(terrain.seaGeo(phone.lagoon));
for (const g of [bed, ocean, lagoon]) validateGeometry(g);
assert.equal(triangles(bed), 25088); assert.equal(triangles(ocean), 3744);
assert(triangles(lagoon) > 0 && triangles(lagoon) <= 72 * 72 * 2);
assert(terrain.height(terrain.VORTEX.x, terrain.VORTEX.z) <= terrain.SEA_Y - .81, 'vortex bed stays open beneath the real funnel');
for (let i = 0; i < lagoon.attributes.normal.count; i++) assert.equal(lagoon.attributes.normal.getY(i), 1);
const totalBefore = 136 * 136 * 2 + 34 * 80 * 2 + triangles(lagoon);
const totalAfter = triangles(bed) + triangles(ocean) + triangles(lagoon);
assert.equal(totalBefore - totalAfter, 13600);

// Sample actual indexed triangles, including both halves of each grid cell.
// Their barycentric shader attributes must match the O(1) CPU shore cache.
const shorePosition = lagoon.attributes.position, shoreAttribute = lagoon.attributes.anim;
let shoreSamples = 0, wetShorePoint = null;
for (let i = 0; i < shorePosition.count; i++) {
  const x=shorePosition.getX(i), z=shorePosition.getZ(i), shore=shoreAttribute.getX(i);
  assert(Math.abs(terrain.seaShore(x,z)-shore)<.00002, 'shore cache matches each rendered vertex');
  if(shore>.3 && Math.hypot(x,z)>3.2) wetShorePoint={x,z};
  shoreSamples++;
}
assert(wetShorePoint, 'real island fixture contains a shore outside the central coast');
for (let tri = 0; tri < lagoon.index.count; tri += 3) {
  const indices=[lagoon.index.getX(tri),lagoon.index.getX(tri+1),lagoon.index.getX(tri+2)];
  for (const weights of [[1/3,1/3,1/3],[.12,.33,.55]]) {
    let x=0,z=0,expected=0;
    indices.forEach((i,k)=>{x+=weights[k]*shorePosition.getX(i);z+=weights[k]*shorePosition.getZ(i);expected+=weights[k]*shoreAttribute.getX(i);});
    assert(Math.abs(terrain.seaShore(x,z)-expected)<.00002, 'shore cache matches triangle interpolation, not bilinear interpolation');
    shoreSamples++;
  }
}
for(const [x,z] of [[-100,0],[100,0],[0,-100],[0,100],[-100,-100],[100,100]]) {
  const v=terrain.seaShore(x,z); assert(Number.isFinite(v) && v>=0 && v<=1, 'sampling beyond the mesh clamps safely');
}

// Evaluate the production GLSL's generated phase and scalar swell expressions.
// CPU height callbacks may differ only by the shader's five-decimal constants.
function scalarGLSL(expr) {
  return expr.replace(/dot\(\s*vec2\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)\s*,\s*wp4\.xz\s*\)/g,'($1*x+$2*z)')
    .replace(/dot\(\s*uSeaWind\s*,\s*wp4\.xz\s*\)/g,'(U.stormWind.value.x*x+U.stormWind.value.y*z)')
    .replace(/length\(\s*wp4\.xz\s*\)/g,'Math.hypot(x,z)').replace(/wp4\.x/g,'x').replace(/wp4\.z/g,'z')
    .replace(/anim\.x/g,'shore').replace(/uTime/g,'t').replace(/vSeaStorm/g,'storm')
    .replace(/smoothstep\s*\(/g,'smooth(').replace(/\bmax\s*\(/g,'Math.max(').replace(/\babs\s*\(/g,'Math.abs(').replace(/\bsin\s*\(/g,'Math.sin(');
}
context.mix=(a,b,t)=>a+(b-a)*t;
const scalarAssignment=name=>scalarGLSL(new RegExp('float '+name+' = ([^;]+);').exec(water.LIVING.v)[1]);
let heightProgram=`const open=${scalarAssignment('open')},nativeCoast=${scalarAssignment('nativeCoast')},baseSwell=${scalarAssignment('baseSwell')},swell=${scalarAssignment('swell')}; let y=base-.055*(1-nativeCoast);`;
for(const match of water.LIVING.v.matchAll(/float (ph\d+) = ([^;]+);\s*transformed\.y \+= ([^;]+);/g)) heightProgram+=`const ${match[1]}=${scalarGLSL(match[2])}; y+=${scalarGLSL(match[3])};`;
const chop=/if \( vSeaStorm > ([\d.]+) \) \{\s*float chopPhase = ([^;]+);\s*transformed\.y \+= ([^;]+);/.exec(water.LIVING.v);
assert(chop,'localized short wave has a GPU displacement');
heightProgram+=`if(storm>${chop[1]}) { const chopPhase=${scalarGLSL(chop[2])}; y+=${scalarGLSL(chop[3])}; }`;
heightProgram+='return y;';
const shaderHeight=vm.runInContext(`(x,z,t,shore,storm,base)=>{${heightProgram}}`,context);
const callbacks=Array.from(source.matchAll(/waterHeight:\s*([^\n]+)/g),m=>m[1].replace(/,\s*$/,''));
assert.equal(callbacks.length,3, 'marine, lagoon and weather all expose a height callback');
const sampledCallbacks=callbacks.map(fn=>vm.runInContext(fn.startsWith('(')?`(${fn})`:fn,context));
let heightSamples=0, maximumHeightError=0;
const windAngles=[0,Math.PI/2,Math.PI,-Math.PI/2,.73,2.31];
for(const windAngle of windAngles) {
water.U.stormWind.value.set(Math.cos(windAngle),Math.sin(windAngle));
for(const strength of [0,.0003,.19,.4]) for(const [x,z] of [[0,0],[3.19,0],[3.45,0],[3.71,0],[4.2,3.7],[6.05,0],[6.15,0],[6.2,0],[6.21,0],[6.44,0],[6.6,0],[6.89,0],[7.01,0],[7.2,0],[8.2,2],[19,2],[39,0]]) {
  water.U.storm.value.set(x,z,1.5,strength);
  for(const t of [0,1.7,17,101]) {
    const outer=Math.max(Math.abs(x),Math.abs(z))>6.2;
    const shore=outer?1-context.smooth(0,.45,Math.max(Math.abs(x),Math.abs(z))-6.45):terrain.seaShore(x,z);
    const expected=shaderHeight(x,z,t,shore,water.seaStormAt(x,z),outer?terrain.OCEAN_Y:terrain.SEA_Y);
    const actual=water.seaHeight(x,z,t);
    maximumHeightError=Math.max(maximumHeightError,Math.abs(actual-expected));
    assert(Math.abs(actual-expected)<.00006,'CPU height tracks the actual water shader at coast, transition and storm peak');
    assert.equal(sampledCallbacks[2](x,z,t),actual,'rain samples the shared height function');
    assert.equal(sampledCallbacks[outer?0:1](x,z,t),actual,'craft samples the shared height function in its water region');
    if(Math.hypot(x,z)<=3.2 && !outer)assert.equal(actual,terrain.SEA_Y-.055,'storm cannot lift water through the authored central coast');
    heightSamples++;
  }
}
}
for(const [x,z] of [[3.9,3.1],[6.15,0],[7.2,0],[8.2,2]]) {
  const heights=[];
  for(const angle of windAngles) {
    water.U.stormWind.value.set(Math.cos(angle),Math.sin(angle));
    water.U.storm.value.set(x,z,2,0);
    const quiet=water.seaHeight(x,z,3.71);
    if(heights.length)assert.equal(quiet,heights[0].quiet,'calm water is independent of storm wind direction');
    water.U.storm.value.w=.4;
    heights.push({quiet,storm:water.seaHeight(x,z,3.71)});
  }
  const spread=Math.max(...heights.map(h=>h.storm))-Math.min(...heights.map(h=>h.storm));
  if(x<6.2)assert(spread>.005,'wind direction changes the inner short crest');
  else assert.equal(spread,0,'outer coarse water excludes the short wave to prevent mesh aliasing');
}

// Attach real water meshes, pad their actual culling bounds, and verify sampled
// storm vertices including horizontal wave displacement remain inside the sphere.
context.mats={sea:new THREE.MeshPhongMaterial({transparent:true,depthWrite:false})};
let boundedVertices=0;
for(const [geometry,outer] of [[lagoon,false],[ocean,true]]) {
  const before=geometry.boundingSphere.radius, mesh=new THREE.Mesh(geometry,context.mats.sea);
  water.seaSurface(mesh); assert(Math.abs(geometry.boundingSphere.radius-before-.4)<1e-9,'surface expands real bounds for storm crests');
  assert.equal(compile(mesh.material).uniforms.uSeaStorm,water.U.storm);
  const position=geometry.attributes.position, anim=geometry.attributes.anim;
  for(const [zx,zz] of [[4.4,4.4],[-4.4,-4.4],[7,0],[0,-9]]) {
    water.U.storm.value.set(zx,zz,2,.4);
    water.U.stormWind.value.set(Math.cos(zx),Math.sin(zx));
    for(let i=0;i<position.count;i+=7) for(const t of [0,2.1,7.5]) {
      const x=position.getX(i),z=position.getZ(i),radius=Math.hypot(x,z),shore=anim.getX(i),extent=Math.max(Math.abs(x),Math.abs(z));
      const swell=(.48+.52*context.smooth(6.2,7.2,extent))*(1-shore)*context.smooth(3.2,3.7,radius)*(1-context.smooth(18,38,radius))*(1+2.6*water.seaStormAt(x,z));
      let dx=0,dz=0;
      for(const w of water.SEA_WAVES){const shift=swell*w[3]*.32*Math.cos(Math.PI*2/w[2]*(w[0]*x+w[1]*z-w[4]*t));dx+=shift*w[0];dz+=shift*w[1];}
      const y=shaderHeight(x,z,t,shore,water.seaStormAt(x,z),outer?terrain.OCEAN_Y:terrain.SEA_Y);
      assert(geometry.boundingSphere.containsPoint(new THREE.Vector3(x+dx,y,z+dz)),'animated water stays within padded culling bounds');
      boundedVertices++;
    }
  }
  mesh.material.dispose();
}
context.mats.sea.dispose();
water.U.storm.value.set(0,0,1,0);
water.U.stormWind.value.set(1,0);
terrain.setWorld('land');
assert.equal(terrain.seaShore(wetShorePoint.x,wetShorePoint.z),0,'retheming the world clears the cached sea field');
terrain.setWorld('sea');
assert.equal(terrain.seaShore(wetShorePoint.x,wetShorePoint.z),0,'new sea starts without stale shore data');
const resetLagoon=finish(terrain.seaGeo(8));
terrain.reset();
assert.equal(terrain.seaShore(4.5,4.5),0,'reset clears a newly populated shore cache');
resetLagoon.dispose();
// At the native island's radius <=3.2, its attenuation forces waves to zero;
// the board water remains strictly under the authored y=-.013 coast.
assert(water.LIVING.v.includes('smoothstep( 3.2, 3.7, length( wp4.xz ) )'));
assert(water.LIVING.v.includes('* nativeCoast *'));
assert(terrain.SEA_Y - .055 < -.013 - .02, 'native coast has more than .02 vertical clearance');
const report = { passed: true, channels, waterTextureSamples: 2, shaderHooks: ['phong-r149', 'desktop-weather', 'mobile-weather'], phoneGeometry: { bed: triangles(bed), outer: triangles(ocean), lagoon: triangles(lagoon), totalBefore, totalAfter, savedTriangles: totalBefore - totalAfter }, storm: { envelopeComparisons: stormSamples, heightSamples, maximumHeightError, boundedVertices, maxTheoreticalWave: +peakSwell.toFixed(3), sharedUniform: true, quietParity: true }, shore: { samples:shoreSamples, cacheReset:true }, nativeCoastSeparated: true };
for (const g of [bed, ocean, lagoon]) g.dispose(); texture.dispose();
console.log(JSON.stringify(report, null, 2));
