const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const game=path.resolve(__dirname,'..'),THREE=require(path.join(game,'vendor/three.min.js'));
const pending=[],context={window:{THREE},console,GLB:{loadScene(url){return new Promise(resolve=>pending.push({url,resolve}));}}};
vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(game,'src/lagoon.js'),'utf8')+'\nglobalThis.api=Lagoon3D;',context);
const parent=new THREE.Group(),lagoon=context.api.create({parent,center:{x:3.45,z:3},radius:.56,waterY:.02,reducedMotion:false,waterHeight:(x,z,t)=>.02+.005*Math.sin(x+z+t)});
assert.equal(lagoon.mask.radius,.55);assert.equal(pending.length,2);
const funnel=lagoon.group.getObjectByName('Round concave water funnel');assert(funnel);
const normals=funnel.geometry.attributes.normal,positions=funnel.geometry.attributes.position;
let minNormalY=Infinity,minY=Infinity,maxY=-Infinity;
for(let i=0;i<normals.count;i++){minNormalY=Math.min(minNormalY,normals.getY(i));minY=Math.min(minY,positions.getY(i));maxY=Math.max(maxY,positions.getY(i));}
assert(minNormalY>0,'water funnel front faces point upwards');assert(minY<-.55&&maxY>.005,'funnel has genuine depth');
const ships=lagoon.group.children.filter(o=>o.isGroup&&o.name.startsWith('Lagoon '));assert.equal(ships.length,3);
const ranges=ships.map(()=>({minY:Infinity,maxY:-Infinity,sank:false,minRadius:Infinity,maxStep:0})),before=ships.map(()=>null);
for(let frame=0;frame<120*30;frame++){
 const t=frame/30;lagoon.update(t,1/30);
 for(let i=0;i<ships.length;i++){
  const s=ships[i],r=ranges[i],v=s.position;assert(Number.isFinite(v.x+v.y+v.z));assert(Math.abs(s.quaternion.length()-1)<1e-5);
  assert(Math.max(Math.abs(v.x),Math.abs(v.z))<4.5,'boat stays inside board water');
  r.minRadius=Math.min(r.minRadius,Math.hypot(v.x,v.z));r.minY=Math.min(r.minY,v.y);r.maxY=Math.max(r.maxY,v.y);r.sank ||=v.y<-.9;
  if(s.visible&&before[i]?.visible){const speed=v.distanceTo(before[i].position);r.maxStep=Math.max(r.maxStep,speed);assert(speed<.10,'no visible boat teleport');}
  before[i]={visible:s.visible,position:v.clone()};
 }
}
for(const r of ranges){assert(r.minRadius>=3.34,'boats clear central island');assert(r.sank,'each boat eventually sinks');}
const stats=lagoon.stats();assert.equal(stats.props,12);assert.equal(stats.foam,96);assert.equal(stats.wakes,21);
const disposables=new Set();lagoon.group.traverse(o=>{if(o.geometry)disposables.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])disposables.add(m);});
let disposeEvents=0;for(const o of disposables)o.addEventListener('dispose',()=>disposeEvents++);
let instanceDisposals=0;lagoon.group.traverse(o=>{if(o.isInstancedMesh)o.addEventListener('dispose',()=>instanceDisposals++);});
lagoon.dispose();lagoon.dispose();assert.equal(parent.children.length,0);assert.equal(disposeEvents,disposables.size);
assert.equal(instanceDisposals,5,'GPU instance buffers are released once');
for(const p of pending)p.resolve({scene:new THREE.Group(),animations:[]});
Promise.resolve().then(async()=>{
 assert.equal(parent.children.length,0);assert.equal(lagoon.stats().native,0);
 const frozen=context.api.create({parent,center:{x:3.45,z:3},reducedMotion:true});frozen.update(10,.1);const snapshot=frozen.stats().states;frozen.update(115,.1);assert.deepEqual(frozen.stats().states,snapshot);frozen.dispose();
 // A cached native fixture shares its immutable geometry/texture/material like
 // GLB.loadScene. Instances need independent mixers and opacity materials.
 const texture=new THREE.Texture(),originalMaterial=new THREE.MeshStandardMaterial({color:0x405a68,opacity:.71,map:texture});
 const cachedGeometries=[];let cachedDisposals=0,textureDisposals=0;
 texture.addEventListener('dispose',()=>textureDisposals++);
 context.GLB.loadScene=async()=>{
  const scene=new THREE.Group(),geo=new THREE.BoxGeometry(1,.7,.32),delta=new Float32Array(geo.attributes.position.array.length);
  for(let i=0;i<geo.attributes.position.count;i++)if(geo.attributes.position.getX(i)<0)delta[i*3+2]=.045;
  geo.morphAttributes.position=[new THREE.BufferAttribute(delta,3)];geo.morphTargetsRelative=true;
  geo.userData.keep=true;geo.addEventListener('dispose',()=>cachedDisposals++);cachedGeometries.push(geo);
  const body=new THREE.Mesh(geo,originalMaterial);body.name='NativeHull';scene.add(body);
  return {scene,animations:[new THREE.AnimationClip('Native wind',2.5,[new THREE.NumberKeyframeTrack('NativeHull.morphTargetInfluences[0]',[0,1.25,2.5],[0,1,0])])]};
 };
 const native=context.api.create({parent,center:{x:3.45,z:3},waterY:.02,reducedMotion:false});await Promise.resolve();await Promise.resolve();
 assert.equal(native.stats().native,2);native.update(13,1/30);
 const nativeShips=native.group.children.filter(o=>o.name.startsWith('Lagoon ')).slice(0,2),nativeBodies=nativeShips.map(o=>o.getObjectByName('NativeHull'));
 assert(nativeBodies.every(Boolean));assert.notEqual(nativeBodies[0].material,nativeBodies[1].material);assert.notEqual(nativeBodies[0].material,originalMaterial);
 assert(nativeBodies.every(o=>o.material.map===texture));assert.equal(originalMaterial.opacity,.71);
 assert(Math.abs(nativeBodies[0].morphTargetInfluences[0]-nativeBodies[1].morphTargetInfluences[0])>.1,'native mixers have independent phases');
 native.update(67,1/30);assert.equal(originalMaterial.opacity,.71,'sinking fade does not change cached material');
 native.dispose();assert.equal(cachedDisposals,0,'cached native geometry survives world disposal');assert.equal(textureDisposals,0,'cached native texture survives world disposal');
 for(const geo of cachedGeometries)geo.dispose();originalMaterial.dispose();texture.dispose();
 console.log(JSON.stringify({passed:true,seconds:120,frames:3600,upwardNormal:minNormalY,funnelY:[minY,maxY],routes:ranges,pooledProps:stats.props,foam:stats.foam,wakes:stats.wakes,disposeEvents,lateLoadGuard:true,reducedMotion:true,nativeInstances:true,independentMixers:true,cachedAssetsRetained:true},null,2));
});
