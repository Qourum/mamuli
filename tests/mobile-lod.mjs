// Geometry must get cheaper without losing animation, texture resolution, named
// scene parts, UV seams or per-vertex deformations. Uses shipped GLBs directly.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readGLB,accessor,triangles} from '../tools/mobile-lod.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'art/mobile/manifest.json')));
function image(doc,image){const v=doc.json.bufferViews[image.bufferView];return doc.bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);}
function streams(doc,p){return[p.attributes,...p.targets||[]].flatMap(stream=>Object.keys(stream).sort().map(key=>{const i=stream[key],a=doc.json.accessors[i];return{key,data:accessor(doc,i),size:({SCALAR:1,VEC2:2,VEC3:3,VEC4:4})[a.type],meta:[a.componentType,a.normalized||false,a.type]};}));}
function signature(streams,index){return streams.map(({data,size})=>{let key='';for(let i=0;i<size;i++)key+=data[index*size+i]+',';return key;}).join(';');}
let before=0,after=0,vertices=0;
for(const asset of manifest.assets){
 const original=readGLB(path.join(root,asset.source)),mobile=readGLB(path.join(root,asset.mobile)),a=original.json,b=mobile.json;
 before+=triangles(original);after+=triangles(mobile);
 for(const key of ['nodes','scenes','scene','materials','textures','samplers','extensionsUsed','extensionsRequired'])assert.deepEqual(b[key],a[key],`${asset.mobile}: ${key} retained`);
 assert.equal(b.meshes.length,a.meshes.length);assert.equal(b.images.length,a.images.length);
 a.images.forEach((i,n)=>assert.ok(image(original,i).equals(image(mobile,b.images[n])),`${asset.mobile}: original image bytes retained`));
 assert.equal(b.animations.length,a.animations.length);
 a.animations.forEach((clip,n)=>{const copy=b.animations[n];assert.equal(copy.name,clip.name);assert.deepEqual(copy.channels,clip.channels);assert.equal(copy.samplers.length,clip.samplers.length);clip.samplers.forEach((s,k)=>{assert.equal(copy.samplers[k].interpolation,s.interpolation);for(const key of ['input','output'])assert.deepEqual(accessor(mobile,copy.samplers[k][key]),accessor(original,s[key]),`${asset.mobile}: exact animation ${key}`);});});
 for(let mi=0;mi<a.meshes.length;mi++){
  const am=a.meshes[mi],bm=b.meshes[mi];for(const key of ['name','weights','extras'])assert.deepEqual(bm[key],am[key]);assert.equal(bm.primitives.length,am.primitives.length);
  for(let pi=0;pi<am.primitives.length;pi++){
   const p=am.primitives[pi],q=bm.primitives[pi],source=streams(original,p),dest=streams(mobile,q),count=b.accessors[q.attributes.POSITION].count;
   assert.deepEqual(dest.map(s=>[s.key,s.meta]),source.map(s=>[s.key,s.meta]));assert.equal(q.material,p.material);assert.equal(q.mode,p.mode);
   const signatures=new Set();for(let v=0;v<a.accessors[p.attributes.POSITION].count;v++)signatures.add(signature(source,v));
   for(let v=0;v<count;v++)assert.ok(signatures.has(signature(dest,v)),`${asset.mobile}: vertex${v} preserves original UV, normal, color and EVERY morph together`);
   const indices=accessor(mobile,q.indices);for(const i of indices)assert.ok(i<count);assert.equal(indices.length%3,0);assert.ok(indices.length>0);
   for(const s of dest)assert.equal(s.data.length/s.size,count);
   for(const stream of [q.attributes,...q.targets||[]])for(const i of Object.values(stream)){const ac=b.accessors[i];if(ac.bufferView!==undefined){const bv=b.bufferViews[ac.bufferView],width=accessor(mobile,i).BYTES_PER_ELEMENT*({SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[ac.type]);assert.equal((bv.byteOffset||0)%4,0);assert.equal((bv.byteStride||width)%4,0,'vertex elements aligned per glTF spec');}}
   assert.deepEqual(b.accessors[q.attributes.POSITION].min,a.accessors[p.attributes.POSITION].min,'minimum silhouette bounds held');assert.deepEqual(b.accessors[q.attributes.POSITION].max,a.accessors[p.attributes.POSITION].max,'maximum silhouette bounds held');
   vertices+=count;
  }
 }
 assert.equal(asset.trianglesAfter,triangles(mobile));
}
assert.equal(manifest.assets.length,19);assert.ok(after<before*.26);assert.ok(after<235000);
console.log(`Mobile LOD: ${before} -> ${after} triangles; ${vertices} vertices. 19 assets preserve scene nodes/materials, byte-exact images/animation, every UV/normal/color/morph, extents and valid indices/alignment.`);
