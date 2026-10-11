// Production building layout/tween functions with real Three instance buffers.
// Verify which visible state changes upload matrices, without creating WebGL.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/board3d.js'), 'utf8');
const T = require('../vendor/three.min.js');
function production(name) {
  const start = source.indexOf('  function ' + name + '('); assert(start >= 0, name + ' exists');
  let h = source.indexOf('(', start), parens = 0;
  for (; h < source.length; h++) { if (source[h] === '(') parens++; if (source[h] === ')' && !--parens) break; }
  let k = source.indexOf('{', h), depth = 0, quote = null;
  for (; k < source.length; k++) {
    const c = source[k];
    if (quote) { if (c === '\\') k++; else if (c === quote) quote = null; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '/' && source[k + 1] === '/') { k = source.indexOf('\n', k); continue; }
    if (c === '/' && source[k + 1] === '*') { k = source.indexOf('*/', k) + 1; continue; }
    if (c === '{') depth++;
    if (c === '}' && !--depth) return source.slice(start, k + 1);
  }
  throw Error('Unclosed function ' + name);
}
let now = 0;
const timers = [];
const context = vm.createContext({ T, console, performance: { now: () => now },
  document: { visibilityState: 'visible' },
  setTimeout(fn, milliseconds) { timers.push({ at: now + milliseconds, fn }); }
});
vm.runInContext(source.slice(source.indexOf('  const S ='), source.indexOf('\n  let ok =')) + `
let ok=true, shadowLate=false, shadowDirty=false, riseAt=0, frame=0, REDUCED=false, epoch=0;
const root=new T.Group(), landG=new T.Group(), U={fade:{value:1}}, tweens=[];
const tiles=Array.from({length:40},()=>new T.Group()), mark=[], flags=[], lotMesh=[];
const sideMat=tiles.map(()=>new T.MeshBasicMaterial()), labelMat=tiles.map(()=>new T.MeshBasicMaterial());
const BOARD=tiles.map(()=>({k:'p'})), OWNABLE=()=>true, SEAT_COLORS=['#ff3311','#1133ff'];
const CREAM=new T.Color(0xe9d6a8), mats={stone:new T.MeshBasicMaterial()};
const pinCam=new Float32Array(18), geometry=()=>({body:new T.BoxGeometry(),roof:new T.BoxGeometry()});
const MOD={tower:geometry,castle:geometry}, Sound={rumble(){}}, Dice3D={busy:false,skip(){}};
const wantWorld=()=>'sea', updateTileLabel=()=>{}, colorFlag=()=>{}, dust=()=>{}, pop=()=>{}, placeEvent=()=>{};
const flagFor=i=>flags[i]||(flags[i]={g:new T.Group(),cloth:new T.Group()});
let placeModelsLife=null;
`, context);
const buildingsStart = source.indexOf('  const towerSlots ='), buildingsEnd = source.indexOf('  // ----- the signs', buildingsStart);
vm.runInContext(source.slice(buildingsStart, buildingsEnd), context);
const topStart = source.indexOf('  const topOf =');
vm.runInContext(source.slice(topStart, source.indexOf('\n', topStart)), context);
const laterStart = source.indexOf('  const later =');
vm.runInContext(source.slice(laterStart, source.indexOf('\n', laterStart)), context);
for (const name of ['centerOf', 'toWorld', 'tween', 'stepTweens', 'halt', 'setOwner', 'setLevel', 'setMort', 'bounceTile', 'rise', 'riseGo']) vm.runInContext(production(name), context);
vm.runInContext(`buildingMeshes(); globalThis.api={BLD,tiles,mark,tweens,setOwner,setLevel,setMort,bounceTile,rise,riseGo,
updateBuildings,layoutBuildings,stepTweens,tween,halt, get dirty(){return BLD.dirty;}, get riseAt(){return riseAt;}};`, context);
const a = context.api;
const versions = () => [a.BLD.tb, a.BLD.tr, a.BLD.cb, a.BLD.cr].map(m => [m.instanceMatrix.version, m.instanceColor?.version || 0]);
const matrix = (mesh, index = 0) => { const m = new T.Matrix4(); mesh.getMatrixAt(index, m); return m; };
const y = () => matrix(a.BLD.tb).elements[13];
const color = () => { const c = new T.Color(); a.BLD.tr.getColorAt(0, c); return c; };
const unchanged = (before, message) => assert.deepEqual(versions(), before, message);
const changed = (before, message) => assert.notDeepEqual(versions(), before, message);
const near = (got, expected, message) => assert(Math.abs(got - expected) < 1e-6, message + ': ' + got + ' vs ' + expected);
const flush = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };
async function tick(ms) {
  now += ms;
  for (;;) { const i = timers.findIndex(t => t.at <= now); if (i < 0) break; timers.splice(i, 1)[0].fn(); }
  await flush(); a.stepTweens(ms / 1000); a.updateBuildings(now); await flush();
}
(async () => {
  // These actions must upload immediately, before the next animation frame.
  let before = versions(); a.setOwner(1, 0, false); changed(before, 'ownership directly updates layout');
  before = versions(); a.setLevel(1, 2, false); changed(before, 'level directly updates layout');
  assert.equal(a.BLD.tb.count, 2); assert.equal(a.BLD.cb.count, 0); near(y(), .2, 'huts sit on the tile');
  const ownerColor = color(); before = versions(); a.setMort(1, true, false); changed(before, 'mortgage directly updates layout');
  assert.notDeepEqual(color().toArray(), ownerColor.toArray(), 'mortgage changes roof tint');
  a.setMort(1, false, false); near(color().r, ownerColor.r, 'redeeming restores ownership tint');
  before = versions(); a.setOwner(1, 1, false); changed(before, 'ownership transfer uploads immediately');
  assert.notDeepEqual(color().toArray(), ownerColor.toArray(), 'ownership transfer changes roof color');
  a.setOwner(1, -1, false); assert.equal(a.BLD.tb.count, 0, 'unowned buildings are removed immediately');
  a.setOwner(1, 0, false); a.setLevel(1, 5, false); assert.equal(a.BLD.tb.count, 0); assert.equal(a.BLD.cb.count, 1, 'hotel replaces huts');
  a.setLevel(1, 2, false);

  before = versions(); for (let i = 0; i < 100; i++) a.updateBuildings(now + i * 16);
  unchanged(before, 'idle frames never upload building buffers');
  let coin = 0; a.tween(.5, e => { coin = e; });
  for (let i = 0; i < 31; i++) await tick(1000 / 60);
  assert.equal(coin, 1); assert.equal(a.tweens.length, 0); unchanged(before, 'unrelated coin-like tween never uploads building buffers');

  a.setLevel(1, 4, true); assert.equal(a.BLD.busy, 2); assert.equal(a.BLD.tb.count, 4);
  near(matrix(a.BLD.tb, 2).elements[0], .001, 'new huts begin at their initial growth scale');
  before = versions(); await tick(225); changed(before, 'building growth continues without any unrelated tween'); assert.equal(a.BLD.busy, 2);
  before = versions(); await tick(225); changed(before, 'growth commits its final full-size matrix');
  assert.equal(a.BLD.busy, 0); assert.equal(Object.keys(a.BLD.grow).length, 0); near(matrix(a.BLD.tb, 2).elements[0], 1, 'completed hut has full scale');
  before = versions(); await tick(16); unchanged(before, 'completed growth stops uploading');

  a.bounceTile(1); before = versions(); await tick(140); changed(before, 'tile bounce moves buildings on every painted frame');
  near(y(), a.tiles[1].position.y + .2, 'buildings follow bounced tile');
  before = versions(); await tick(140); assert.equal(a.tweens.length, 0); changed(before, 'final bounce frame uploads even after tween removes itself');
  near(y(), .2, 'buildings return to tile height'); assert.equal(a.dirty, false);
  before = versions(); await tick(16); unchanged(before, 'bounce completion returns to idle');

  // A throttled/skipped frame must retain invalidation until the next layout.
  a.bounceTile(1); a.stepTweens(.14); assert.equal(a.dirty, true);
  a.stepTweens(.14); assert.equal(a.tweens.length, 0); assert.equal(a.dirty, true);
  before = versions(); a.updateBuildings(now); changed(before, 'skipped bounce frames still commit the final tile position'); near(y(), .2, 'final skipped pose is correct');
  a.bounceTile(1); a.stepTweens(.10); a.halt(); assert.equal(a.dirty, true); a.updateBuildings(now); near(y(), .2, 'halt also commits final pose');

  a.rise(); assert.equal(a.dirty, true); a.updateBuildings(now); near(y(), -.4, 'initial sunk tile moves its buildings immediately');
  a.riseGo();
  for (let i = 0; i < 20; i++) {
    before = versions(); const previousHeight = a.tiles[1].position.y;
    await tick(75);
    if (a.tiles[1].position.y !== previousHeight) changed(before, 'each rising tile frame refreshes the building transform');
    near(y(), a.tiles[1].position.y + .2, 'buildings stay attached throughout tile rise');
  }
  assert.equal(a.tiles[1].position.y, 0); near(y(), .2, 'rise ends at exact building height');
  before = versions();
  for (let i = 0; i < 30; i++) await tick(75);
  unchanged(before, 'remaining land/fade rise tweens do not upload building buffers');
  assert.equal(a.tweens.length, 0); assert.equal(a.BLD.busy, 0); assert.equal(a.dirty, false);
  console.log('building updates: direct owner/level/mortgage changes, growth, bounce/rise final frames, skipped frames and halt preserve transforms; idle and unrelated tweens upload nothing');
})().catch(error => { console.error(error); process.exitCode = 1; });
