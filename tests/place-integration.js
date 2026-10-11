// Extract production board functions, with native Three meshes and only the
// async file boundary / pointer ray result controlled. Protect real regressions.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const rootPath = path.resolve(__dirname, '..'), THREE = require('../vendor/three.min.js');
const source = fs.readFileSync(path.join(rootPath, 'src/board3d.js'), 'utf8');
function production(name) {
  const start = source.indexOf('  function ' + name + '('); assert(start >= 0, name);
  let h = source.indexOf('(', start), parens = 0;
  for (; h < source.length; h++) { if (source[h] === '(') parens++; if (source[h] === ')' && !--parens) break; }
  let k = source.indexOf('{', h), depth = 0, quote = null;
  for (; k < source.length; k++) { const c = source[k]; if (quote) { if (c === '\\') k++; else if (c === quote) quote = null; continue; } if (c === "'" || c === '"' || c === '`') { quote = c; continue; } if (c === '/' && source[k + 1] === '/') { k = source.indexOf('\n', k); continue; } if (c === '/' && source[k + 1] === '*') { k = source.indexOf('*/', k) + 1; continue; } if (c === '{') depth++; if (c === '}' && !--depth) return source.slice(start, k + 1); }
  throw Error('Unclosed ' + name);
}
const pending = [], context = vm.createContext({ window: { THREE }, T: THREE, console, GLB: { loadScene(url) { return new Promise(resolve => pending.push({ url, resolve })); } }, Diag: { note() {} } });
for (const file of ['data.js', 'themes.js']) vm.runInContext(fs.readFileSync(path.join(rootPath, 'src', file), 'utf8'), context);
vm.runInContext(`
useTheme('archipelago');
const S=12,C=1.5,D=1.5,TW=1,TH=.2,LOT=1.25,maxAniso=4;
const OUT=[[0,1],[-1,0],[0,-1],[1,0]],ALONG=[[-1,0],[0,-1],[1,0],[0,1]];
const sideOf=i=>Math.floor(i/10)%4,yawOf=s=>-s*Math.PI/2,wantWorld=()=>THEME.world;
let ok=true,root=new T.Group(),landG=new T.Group(),cam={},shadowDirty=false,modelDelta=0,turnSeat=0;
const lotMesh=[],lotGround=[],tiles=[],flags=[],mark=[],labelMat=[],animatedModels=[],events=[],picked=[],mortLabels=[];
const life={models:[],groups:[],ready:true,pts:null},U={time:{value:2},fade:{value:1}};
const POSE={p:new T.Vector3()},O=new T.Object3D(),_lm=new T.Matrix4();
const mats={scenery:new T.MeshLambertMaterial()},updateTileLabel=i=>mortLabels.push(i),layoutBuildings=()=>{},modelWater=m=>m,living=m=>m;
const topOf=k=>k.m?.4:.78,tween=(duration,fn)=>{fn(1);return Promise.resolve();},colorFlag=()=>{};
let placeModelsLife=null,mapPropsLife={group:new T.Group(),trigger(i,kind,color){events.push({source:'props',i,kind,color});}},placeEffects={trigger(i,kind,color){events.push({source:'effects',i,kind,color});}};
let down=null,now=100,hit=null;
const performance={now:()=>now},host={getBoundingClientRect:()=>({left:0,top:0,width:600,height:400})};
const ray={objects:[],setFromCamera(){},intersectObjects(objects,recursive){this.objects=objects;this.recursive=recursive;return hit?[hit]:[];}};
let pickCb=i=>picked.push(i);
`, context);
for (const name of ['centerOf', 'toWorld', 'nativeModel', 'clearAnimatedModels', 'modelActor', 'lifeStep', 'setMort', 'placeEvent', 'onDown', 'onUp']) vm.runInContext(production(name), context);
vm.runInContext(`globalThis.api={modelActor,setMort,clearAnimatedModels,placeEvent,onDown,onUp,toWorld,life,lotMesh,mark,labelMat,animatedModels,events,picked,mortLabels,ray,propsGroup:mapPropsLife.group,get root(){return root;},get land(){return landG;},set hit(v){hit=v;},set now(v){now=v;},remake(){landG=new T.Group();},set procedural(v){placeModelsLife=v;}};`, context);
const api = context.api;
function fixture(i) {
  const native = new THREE.Group(), geometry = new THREE.BoxGeometry(.45, .22, .16), one = new THREE.MeshStandardMaterial({ color: 0x78482b }), two = new THREE.MeshStandardMaterial({ color: 0xe3c87c });
  geometry.userData.keep = one.userData.keep = two.userData.keep = true;
  const hull = new THREE.Mesh(geometry, [one, two]); hull.name = 'ShipHull' + i; native.add(hull);
  return { pack: { scene: native, animations: [new THREE.AnimationClip('Sway', 2, [new THREE.NumberKeyframeTrack(hull.name + '.rotation[y]', [0, 1, 2], [0, .08, 0])])] }, hull, base: hull.material.slice() };
}
async function settle() { await Promise.resolve(); await Promise.resolve(); }
(async () => {
  const owned = [];
  for (const i of [5, 15, 25, 35]) {
    api.mark[i] = { o: 0, lv: 0, m: true }; api.labelMat[i] = new THREE.MeshLambertMaterial();
    const dock = new THREE.Mesh(new THREE.BoxGeometry(.2, .02, .1), new THREE.MeshLambertMaterial()); api.lotMesh[i] = dock;
    const f = fixture(i); owned.push(f); const act = { up(t, pose) { pose.p.set(i / 10, .02 + .003 * Math.sin(t), 3); pose.yaw = .2; pose.s = 1; } };
    api.modelActor(act, { url: 'fixture-' + i, animated: true, s: .82, y: -.04, ry: Math.PI }, i); pending.at(-1).resolve(f.pack); await settle();
    assert.equal(api.lotMesh[i], f.pack.scene, 'owned native ship replaces the dock selection/mortgage target');
    assert.equal(f.pack.scene.userData.nativeScene, true); assert.equal(f.hull.userData.i, i, 'native ship descendant carries its actual tile index');
    assert.notEqual(f.hull.material, f.base, 'saved mortgage applies after late native loading');
    assert(f.hull.material.every((m, k) => m !== f.base[k] && Math.abs(m.color.r - f.base[k].color.r * .55) < 1e-8));
    assert(f.base.every(m => m.userData.keep), 'cached source materials remain owned by the GLB cache');
    api.setMort(i, false, false); assert.equal(f.hull.material, f.hull.userData.nativeBase, 'unmortgage restores original source material array');
    api.setMort(i, true, false); assert.equal(f.hull.material, f.hull.userData.nativeGrey, 'repeat mortgage reuses its isolated grey materials');
    api.hit = { object: f.hull, point: new THREE.Vector3() }; api.onDown({ clientX: 50, clientY: 50 }); api.onUp({ clientX: 50, clientY: 50 });
    assert(api.ray.objects.includes(f.pack.scene), 'raycast selection contains the registered native ship'); assert.equal(api.picked.at(-1), i);
    assert(api.events.some(e => e.i === i && e.kind === 'inspect'), 'clicking a native ship triggers its 3D response');
  }
  const ground = new THREE.Mesh(); ground.userData.ground = true; let groundPicks = 0;
  for (let i = 0; i < 40; i++) {
    const object = i % 10 ? ground : new THREE.Mesh(); if (!(i % 10)) object.userData.i = i;
    api.hit = { object, point: api.toWorld(i, 0, -(1.5 / 2 + 1.25 / 2)) }; const before = api.events.length;
    api.onDown({ clientX: 50, clientY: 50 }); api.onUp({ clientX: 50, clientY: 50 });
    assert.equal(api.picked.at(-1), i, 'correct place selected on all four board sides');
    assert.equal(api.events.length - before, 2, 'ground/corner selection routes inspect once to each effect subsystem');
    assert(api.events.slice(before).every(e => e.i === i && e.kind === 'inspect')); if (i % 10) groundPicks++;
  }
  const count = api.picked.length; api.onDown({ clientX: 50, clientY: 50 }); api.onUp({ clientX: 80, clientY: 50 }); assert.equal(api.picked.length, count, 'dragging does not inspect/select');
  const bottle = new THREE.Mesh(new THREE.SphereGeometry(.04), new THREE.MeshStandardMaterial()); bottle.userData.i = 7; api.propsGroup.add(bottle); api.hit = { object: bottle, point: new THREE.Vector3() }; api.onDown({ clientX: 50, clientY: 50 }); api.onUp({ clientX: 50, clientY: 50 }); assert.equal(api.picked.at(-1), 7); assert(api.ray.objects.includes(api.propsGroup), 'actual chest/bottle group participates in scene picking');
  let delegated = null; context.PlaceModels3D = { indices: [6] }; api.procedural = { setMort(i, m) { delegated = [i, m]; } }; api.mark[6] = { o: 0, lv: 0, m: false }; api.labelMat[6] = new THREE.MeshLambertMaterial(); api.setMort(6, true, false); assert.deepEqual(delegated, [6, true], 'new procedural model receives mortgage state'); api.procedural = null;
  const stale = fixture(5), children = api.root.children.length, animations = api.animatedModels.length;
  api.modelActor({ up() {} }, { url: 'stale', animated: true }, 5); api.remake(); pending.at(-1).resolve(stale.pack); await settle();
  assert.equal(api.root.children.length, children, 'late ship load cannot attach after world remake'); assert.equal(api.animatedModels.length, animations);
  let greyDisposed = 0, cachedDisposed = 0; for (const f of owned) { for (const m of f.hull.userData.nativeGrey) m.addEventListener('dispose', () => greyDisposed++); for (const m of f.base) m.addEventListener('dispose', () => cachedDisposed++); }
  api.clearAnimatedModels(); assert.equal(greyDisposed, 8); assert.equal(cachedDisposed, 0); assert.equal(api.animatedModels.length, 0); assert(owned.every(f => f.hull.material === f.hull.userData.nativeBase));
  const metadata = vm.createContext({ window: { THREE }, Terrain: { SEA_Y: .02, OCEAN_Y: -.3 } }); for (const file of ['models.js', 'sea.js', 'place-models.js']) vm.runInContext(fs.readFileSync(path.join(rootPath, 'src', file), 'utf8'), metadata);
  const categories = vm.runInContext(`({native:Object.keys(SeaModels.models).map(Number),corners:Object.keys(SeaModels.cornerModels).map(Number),ships:[5,15,25,35].filter(i=>SeaModels.fx(i).actors.some(a=>a.model&&a.model.animated)),props:[2,7,17,22,33,36],landmarks:PlaceModels3D.indices,vortex:[38]})`, metadata);
  const coverage = Object.values(categories).flat(); assert.equal(coverage.length, 40); assert.equal(new Set(coverage).size, 40, 'all forty places have exactly one primary 3D representation'); assert(Array.from({ length: 40 }, (_, i) => i).every(i => coverage.includes(i)));
  console.log(JSON.stringify({ passed: true, nativeOwnedShips: 4, lateMortgageApplied: true, sharedSourcesPreserved: true, proceduralMortgageDelegated: true, groundSelections: groundPicks, cornersSelected: 4, all40InspectTriggers: true, directPropSelection: true, all40Models: true, coverage: Object.fromEntries(Object.entries(categories).map(([kind, list]) => [kind, list.length])), lateWorldGuard: true, greyResourcesReleased: greyDisposed }));
})().catch(error => { console.error(error); process.exitCode = 1; });
