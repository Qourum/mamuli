// Parse every mobile GLB through the game's shipped Three/glTF loader and play
// its real animation clips. CPU structure tests complement browser visual QA.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');global.window=global;global.THREE=require('../vendor/three.min.js');
global.createImageBitmap=async()=>({width:1,height:1,close(){}});global.self=global;
vm.runInThisContext(fs.readFileSync(path.join(root,'vendor/GLTFLoader.min.js'),'utf8'));
function load(file){const bytes=fs.readFileSync(file);return new Promise((resolve,reject)=>new MamuliGLTFLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'',resolve,reject));}
(async()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'art/mobile/manifest.json')));let morphed=0,animated=0;
 for(const asset of manifest.assets){
  const pack=await load(path.join(root,asset.mobile));assert.equal(pack.animations.length,asset.clips);pack.scene.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(pack.scene);assert.ok([box.min.x,box.min.y,box.min.z,box.max.x,box.max.y,box.max.z].every(Number.isFinite));
  const morphs=[];pack.scene.traverse(o=>{if(!o.isMesh)return;const pos=o.geometry.attributes.position;
   for(const target of o.geometry.morphAttributes.position||[]){assert.equal(target.count,pos.count);for(let k=0;k<target.count;k++)assert.ok(Number.isFinite(target.getX(k))&&Number.isFinite(target.getY(k))&&Number.isFinite(target.getZ(k)));}
   if(o.morphTargetInfluences?.length)morphs.push(o);
  });
  if(!pack.animations.length)continue;animated++;assert.ok(morphs.length);morphed+=morphs.length;
  const before=morphs.map(o=>o.morphTargetInfluences.slice()),mixer=new THREE.AnimationMixer(pack.scene);for(const clip of pack.animations)mixer.clipAction(clip).play();
  const duration=Math.max(...pack.animations.map(c=>c.duration));assert.ok(duration>0);let changed=false;
  for(const f of [.17,.53,.87]){mixer.setTime(duration*f);changed ||= morphs.some((o,k)=>o.morphTargetInfluences.some((w,j)=>Math.abs(w-before[k][j])>.0001));}
  assert.ok(changed,asset.mobile+': real morph animation changes pose');mixer.stopAllAction();mixer.uncacheRoot(pack.scene);
 }
 console.log(`Mobile GLTF playback: ${manifest.assets.length} assets, ${animated} animated scenes, ${morphed} morph meshes, finite geometry and real clips passed.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
