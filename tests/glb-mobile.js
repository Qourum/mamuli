// Real GLBs/glTF reader, with only browser image decoding/canvas services mocked.
// Queue priority/caps, image sharing, mobile budgets and recovery use the public API.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),THREE=require('../vendor/three.min.js'),realFetch=global.fetch;
THREE.ColorManagement.legacyMode=false;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function dimensions(bytes){
  const b=Buffer.from(bytes);
  if(b[0]===255&&b[1]===216){
    let at=2;while(at+8<b.length){if(b[at++]!==255)continue;const marker=b[at++];if(marker===216||marker===217)continue;const n=b.readUInt16BE(at);if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return{width:b.readUInt16BE(at+5),height:b.readUInt16BE(at+3)};if(n<2)break;at+=n;}
  }
  if(b.toString('ascii',0,4)==='RIFF'){
    const type=b.toString('ascii',12,16);
    if(type==='VP8X')return{width:1+b.readUIntLE(24,3),height:1+b.readUIntLE(27,3)};
    if(type==='VP8L'){const n=b.readUInt32LE(21);return{width:1+(n&16383),height:1+((n>>>14)&16383)};}
    if(type==='VP8 ')return{width:b.readUInt16LE(26)&16383,height:b.readUInt16LE(28)&16383};
  }
  throw new Error('Unknown embedded image test fixture');
}
const bitmaps=[];
global.window=global;global.self=global;global.THREE=THREE;
global.fetch=(url,options)=>realFetch(url,options);
global.createImageBitmap=async blob=>{
  const d=dimensions(await blob.arrayBuffer());const image={...d,closed:0,close(){this.closed++;}};bitmaps.push(image);await sleep(1);return image;
};
global.Image=class{
  constructor(){this.width=this.height=1;}
  set src(value){this.url=value;queueMicrotask(()=>{if(this.onload)this.onload();});}
  async decode(){const response=await realFetch(this.url),d=dimensions(await response.arrayBuffer());this.width=this.naturalWidth=d.width;this.height=this.naturalHeight=d.height;}
};
vm.runInThisContext(fs.readFileSync(path.join(root,'vendor/GLTFLoader.min.js'),'utf8'));
const NativeLoader=global.MamuliGLTFLoader,source=fs.readFileSync(path.join(root,'src/glb.js'),'utf8');
function harness(options={}){
  const draws=[],order=[],calls=new Map(),warnings=[],deadlines=new Set();let fetchActive=0,fetchPeak=0;
  const document={createElement(kind){assert.equal(kind,'canvas');const canvas={width:0,height:0,getContext(){return{drawImage(image,...args){assert.ok(!image.closed,'a closed bitmap cannot be drawn');draws.push({image,args,canvas});},getImageData(_x,_y,w,h){return{data:new Uint8ClampedArray(w*h*4)};}};}};return canvas;}};
  const fetcher=async(url,request)=>{
    const name=String(url);order.push(name);calls.set(name,(calls.get(name)||0)+1);fetchActive++;fetchPeak=Math.max(fetchPeak,fetchActive);
    try{if(options.fetch)return await options.fetch(name,request,calls.get(name));await sleep(12);const b=fs.readFileSync(path.join(root,name));return{ok:true,arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};}finally{fetchActive--;}
  };
  const context=vm.createContext({window:{THREE,MamuliGLTFLoader:options.Loader||NativeLoader,MamuliSkeletonClone:global.MamuliSkeletonClone},document,fetch:fetcher,Image:global.Image,Blob,URL,TextDecoder,AbortController,atob,
    console:{warn:(...args)=>warnings.push(args)},setTimeout:(fn,ms)=>{if(options.manualDeadline&&ms===90000){const t={fn};deadlines.add(t);return t;}return setTimeout(fn,options.manualDeadline&&ms===250?0:ms);},clearTimeout:t=>{if(deadlines.has(t))deadlines.delete(t);else clearTimeout(t);}});
  vm.runInContext('const SITE=true;\n'+source+'\nglobalThis.__GLB=GLB;',context);
  return{glb:context.__GLB,draws,order,calls,warnings,deadlines,fetchPeak:()=>fetchPeak,fireDeadline(){assert.ok(deadlines.size);const t=deadlines.values().next().value;deadlines.delete(t);t.fn();}};
}
function maps(scene){const out=new Set();scene.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])for(const v of Object.values(m))if(v&&v.isTexture)out.add(v);});return[...out];}
const estimate=(w,h)=>Math.ceil(w*h*4*4/3);
async function actualAssets(){
  const h=harness();h.glb.configure({mobile:true});
  const urls=['art/m_oak_animated.glb','art/m_heligoland_animated.glb','art/m_volcano_animated.glb','art/m_gotland_animated.glb','art/m_cocos_animated.glb'];
  const tasks=urls.map(url=>h.glb.loadScene(url,url.includes('volcano')?10:0));
  const again=h.glb.loadScene(urls[2],10),assets=await Promise.all(tasks),clone=await again;
  assert.equal(h.order[0],urls[2],'central priority is serviced first');assert.ok(h.fetchPeak()<=2);assert.equal(h.glb.stats().maxActive,2);
  assert.equal(h.calls.get(urls[2]),1,'concurrent scene requests deduplicate');assert.notEqual(assets[2].scene,clone.scene);
  for(let i=0;i<assets.length;i++){
    const limit=i===2?1024:512,images=new Set();
    for(const texture of maps(assets[i].scene)){images.add(texture.image);assert.ok(texture.image.width<=limit&&texture.image.height<=limit);assert.equal(texture.flipY,false);assert.ok(texture.version>0);}
    assets[i].scene.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(assets[i].scene);assert.ok(Number.isFinite(box.max.y));
    assert.ok(images.size);
  }
  const centerMesh=[];assets[2].scene.traverse(o=>{if(o.isMesh&&o.material.map&&o.material.normalMap)centerMesh.push(o);});
  assert.ok(centerMesh.length);assert.equal(centerMesh[0].material.map.encoding,THREE.sRGBEncoding);assert.equal(centerMesh[0].material.normalMap.encoding,THREE.LinearEncoding);
  assert.equal(clone.scene.getObjectByName(centerMesh[0].name).material.map.image,centerMesh[0].material.map.image,'cached clones share resized images');
  const stats=h.glb.stats();assert.ok(stats.resizedImages>0);assert.ok(stats.imageBytes<=stats.originalImageBytes*.251,'mobile image budget saves at least75%');
  assert.ok(bitmaps.every(b=>b.closed===1),'each replaced real asset bitmap closes exactly once');
  await sleep(2);assert.equal(h.glb.stats().active,0);assert.equal(h.glb.stats().queued,0);assert.equal(h.glb.stats().completed,urls.length);
}
async function sharedImages(){
  const refs=[],bitmap={width:2048,height:1024,closed:0,close(){assert.ok(refs.every(t=>t.image!==this),'every material/parser ref changes before close');this.closed++;}};
  class Loader{parse(_data,_path,resolve){const a=new THREE.Texture(bitmap);a.flipY=false;a.encoding=THREE.sRGBEncoding;const b=a.clone(),c=a.clone();b.encoding=c.encoding=THREE.LinearEncoding;refs.push(a,b,c);const scene=new THREE.Group();scene.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({map:a,normalMap:b,roughnessMap:c})));resolve({scene,animations:[],parser:{getDependencies:async()=>refs}});}}
  const h=harness({Loader,fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)})});h.glb.configure({mobile:true,concurrency:1});
  const pack=await h.glb.loadScene('art/shared.glb');assert.equal(h.draws.length,1,'one canvas resample per shared source image');assert.equal(bitmap.closed,1);
  for(const t of maps(pack.scene)){assert.equal(t.image,refs[0].image);assert.equal(t.image.width,512);assert.equal(t.image.height,256);assert.equal(t.flipY,false);}
  assert.equal(h.glb.stats().images,1);assert.equal(h.glb.stats().textures,3);assert.equal(h.glb.stats().imageBytes,estimate(512,256));assert.equal(h.glb.stats().textureBytes,estimate(512,256)*3);
  const desktopImage={width:2048,height:1024,closed:0,close(){this.closed++;}};
  class DesktopLoader{parse(_d,_p,resolve){const scene=new THREE.Group();scene.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({map:new THREE.Texture(desktopImage)})));resolve({scene,animations:[]});}}
  const desktop=harness({Loader:DesktopLoader,fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)})});await desktop.glb.loadScene('art/full.glb');assert.equal(desktop.glb.stats().concurrency,4);assert.equal(desktop.draws.length,0);assert.equal(desktopImage.closed,0);assert.equal(desktop.glb.stats().imageBytes,estimate(2048,1024));
}
async function staticNativeSharing(){
  const h=harness();h.glb.configure({mobile:true});const url='art/m_heligoland.glb';
  const a=h.glb.load(url),b=h.glb.loadScene(url);assert.equal(h.glb.load(url),a);
  const [plain,native]=await Promise.all([a,b]);assert.ok(plain.geometry.attributes.position.count);assert.ok(native.scene.children.length);assert.equal(h.calls.get(url),1,'static/native readers share a pending file');
  // A different reader requested from a completed reader must get a fresh job,
  // rather than attaching to the closed job and remaining unresolved forever.
  const second='art/m_gotland.glb';await h.glb.load(second).then(()=>h.glb.loadScene(second));assert.equal(h.calls.get(second),2);
}
async function failures(){
  const url='art/m_gotland_animated.glb';let mode='stalled',aborts=0;
  const h=harness({manualDeadline:true,fetch:async(_url,options)=>{
    if(mode==='stalled')return new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>{aborts++;reject(new Error('aborted'));},{once:true}));
    const b=fs.readFileSync(path.join(root,url));return{ok:true,arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};
  }});h.glb.configure({mobile:true,concurrency:1});
  const failed=h.glb.loadScene(url),checked=assert.rejects(failed,/timed out/);await sleep(5);h.fireDeadline();await sleep(5);assert.equal(h.calls.get(url),2);h.fireDeadline();await checked;await sleep(2);
  assert.equal(aborts,2);assert.equal(h.glb.stats().active,0);assert.equal(h.glb.stats().failed,1);assert.equal(h.glb.stats().retries,1);
  mode='ready';const recovered=await h.glb.loadScene(url);assert.ok(recovered.scene.children.length);assert.equal(h.calls.get(url),3,'failure evicts cached rejected promise');
  let parses=0;
  class FlakyLoader{parse(_d,_p,resolve,reject){parses++;if(parses===1)return reject(new Error('bad GLB'));resolve({scene:new THREE.Group(),animations:[]});}}
  const parse=harness({Loader:FlakyLoader,fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)})});await assert.rejects(parse.glb.loadScene('art/fix.glb'),/bad GLB/);await parse.glb.loadScene('art/fix.glb');assert.equal(parses,2);assert.equal(parse.calls.get('art/fix.glb'),2);
}
(async()=>{await actualAssets();await sharedImages();await staticNativeSharing();await failures();console.log('GLB mobile: actual assets,2-slot priority queue, source-image dedup/budgets, bitmap lifetime, mixed readers, finite timeout/retry and cache recovery passed.');})().catch(error=>{console.error(error);process.exitCode=1;});
