#!/usr/bin/env node
// Rebuild mobile GLBs without touching desktop assets. No Blender flatten/join,
// texture recompression, new vertices, animation baking or runtime decimator.
// node tools/mobile-lod.mjs [m_volcano_animated.glb ...]
// meshoptimizer 1.1: https://github.com/zeux/meshoptimizer/blob/v1.1/js/README.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { MeshoptSimplifier as simplifier } from './mobile-vendor/meshopt_simplifier.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const types={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
const sizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
const clone=x=>JSON.parse(JSON.stringify(x));
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
export function readGLB(file){
 const bytes=fs.readFileSync(file);assert.equal(bytes.readUInt32LE(0),0x46546c67);
 assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.length,bytes.readUInt32LE(8));
 const n=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+n));
 const bin=bytes.subarray(28+n,28+n+bytes.readUInt32LE(20+n));
 assert.equal(json.buffers.length,1);return{json,bin,bytes};
}
export function accessor(doc,index,normalized=false){
 const a=doc.json.accessors[index],Type=types[a.componentType],size=sizes[a.type];
 assert.ok(Type&&size,`Unsupported accessor ${a.type}/${a.componentType}`);
 const values=new Type(a.count*size),bytes=Buffer.from(values.buffer),width=Type.BYTES_PER_ELEMENT*size;
 if(a.bufferView!==undefined){const view=doc.json.bufferViews[a.bufferView],stride=view.byteStride||width;
  for(let k=0;k<a.count;k++){const start=(view.byteOffset||0)+(a.byteOffset||0)+k*stride;doc.bin.copy(bytes,k*width,start,start+width);}
 }
 if(a.sparse){const s=a.sparse,iv=doc.json.bufferViews[s.indices.bufferView],vv=doc.json.bufferViews[s.values.bufferView],I=types[s.indices.componentType];
  const ixBytes=doc.bin.subarray((iv.byteOffset||0)+(s.indices.byteOffset||0),(iv.byteOffset||0)+(s.indices.byteOffset||0)+s.count*I.BYTES_PER_ELEMENT);
  const ix=new I(Uint8Array.from(ixBytes).buffer),start=(vv.byteOffset||0)+(s.values.byteOffset||0);
  for(let k=0;k<s.count;k++)doc.bin.copy(bytes,ix[k]*width,start+k*width,start+(k+1)*width);
 }
 if(!normalized)return values;
 const scale=a.normalized?({5120:127,5121:255,5122:32767,5123:65535,5125:4294967295}[a.componentType]||1):1;
 return Float32Array.from(values,v=>Math.max(a.normalized&&[5120,5122].includes(a.componentType)?-1:-Infinity,v/scale));
}
export function triangles(doc){return doc.json.meshes.reduce((sum,m)=>sum+m.primitives.reduce((n,p)=>n+doc.json.accessors[p.indices].count/3,0),0);}
function bounds(values,size=3){const min=Array(size).fill(Infinity),max=Array(size).fill(-Infinity);for(let k=0;k<values.length;k++) {const c=k%size;min[c]=Math.min(min[c],values[k]);max[c]=Math.max(max[c],values[k]);}return{min,max};}
function compact(doc){
 // Keep only live accessors. Repack accessors including sparse morph targets,
 // with 4-byte-aligned buffer views. Images remain bit-for-bit original.
 const j=doc.json,oldAccess=j.accessors,used=new Map(),arrays=[],targets=new Map(),morphs=new Set();
 const keep=i=>{if(!used.has(i)){used.set(i,used.size);arrays.push(accessor(doc,i));}return used.get(i);};
 for(const m of j.meshes)for(const p of m.primitives){targets.set(p.indices,34963);p.indices=keep(p.indices);for(const key in p.attributes){targets.set(p.attributes[key],34962);p.attributes[key]=keep(p.attributes[key]);}for(const t of p.targets||[])for(const key in t){targets.set(t[key],34962);morphs.add(t[key]);t[key]=keep(t[key]);}}
 for(const a of j.animations||[])for(const s of a.samplers){s.input=keep(s.input);s.output=keep(s.output);}
 for(const s of j.skins||[])if(s.inverseBindMatrices!==undefined)s.inverseBindMatrices=keep(s.inverseBindMatrices);
 const views=[],chunks=[];let offset=0;
 function add(bytes,target){const padding=(4-offset%4)%4;if(padding){chunks.push(Buffer.alloc(padding));offset+=padding;}const view={buffer:0,byteOffset:offset,byteLength:bytes.length};if(target)view.target=target;views.push(view);chunks.push(bytes);offset+=bytes.length;return views.length-1;}
 j.accessors=[...used.keys()].map((i,k)=>{
  const a=clone(oldAccess[i]);delete a.byteOffset;delete a.sparse;delete a.bufferView;
  const values=arrays[k],bytes=Buffer.from(values.buffer,values.byteOffset,values.byteLength),width=values.BYTES_PER_ELEMENT*sizes[a.type];
  const nonzero=[];if(morphs.has(i))for(let v=0;v<a.count;v++){let changed=false;for(let c=0;c<sizes[a.type];c++)changed ||= values[v*sizes[a.type]+c]!==0;if(changed)nonzero.push(v);}
  if(morphs.has(i)&&nonzero.length>0&&nonzero.length<a.count*.4){
   const I=a.count>65535?Uint32Array:Uint16Array,ix=I.from(nonzero),sparseBytes=Buffer.alloc(nonzero.length*width);
   for(let v=0;v<nonzero.length;v++)bytes.copy(sparseBytes,v*width,nonzero[v]*width,(nonzero[v]+1)*width);
   a.sparse={count:nonzero.length,indices:{bufferView:add(Buffer.from(ix.buffer)),componentType:a.count>65535?5125:5123},values:{bufferView:add(sparseBytes)}};
  }else{
   const stride=targets.get(i)===34962?Math.ceil(width/4)*4:width;
   if(stride!==width){const padded=Buffer.alloc(a.count*stride);for(let v=0;v<a.count;v++)bytes.copy(padded,v*stride,v*width,(v+1)*width);a.bufferView=add(padded,targets.get(i));views[a.bufferView].byteStride=stride;}
   else a.bufferView=add(bytes,targets.get(i));
  }
  return a;
 });
 for(const image of j.images||[])if(image.bufferView!==undefined){const v=j.bufferViews[image.bufferView];image.bufferView=add(doc.bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength));}
 j.bufferViews=views;j.buffers=[{byteLength:offset}];doc.bin=Buffer.concat(chunks);return doc;
}
function addAccessor(doc,original,values){
 const a=clone(original);a.count=values.length/sizes[a.type];delete a.sparse;delete a.byteOffset;
 const pad=(4-doc.bin.length%4)%4,bytes=Buffer.from(values.buffer,values.byteOffset,values.byteLength);
 a.bufferView=doc.json.bufferViews.length;doc.json.bufferViews.push({buffer:0,byteOffset:doc.bin.length+pad,byteLength:bytes.length});
 doc.bin=Buffer.concat([doc.bin,Buffer.alloc(pad),bytes]);
 if(original.min||original.max)Object.assign(a,bounds(values,sizes[a.type]));
 doc.json.accessors.push(a);return doc.json.accessors.length-1;
}
function saveGLB(doc,file){
 compact(doc);const js=Buffer.from(JSON.stringify(doc.json)),jp=(4-js.length%4)%4,bp=(4-doc.bin.length%4)%4;
 const out=Buffer.alloc(12+8+js.length+jp+8+doc.bin.length+bp);out.writeUInt32LE(0x46546c67);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);
 out.writeUInt32LE(js.length+jp,12);out.writeUInt32LE(0x4e4f534a,16);js.copy(out,20);out.fill(32,20+js.length,20+js.length+jp);
 const at=20+js.length+jp;out.writeUInt32LE(doc.bin.length+bp,at);out.writeUInt32LE(0x004e4942,at+4);doc.bin.copy(out,at+8);fs.writeFileSync(file,out);return out;
}
function simplifyPrimitive(doc,p,target){
 const original=doc.json.accessors[p.attributes.POSITION],count=original.count,positions=accessor(doc,p.attributes.POSITION,true),indices=Uint32Array.from(accessor(doc,p.indices));
 if(indices.length/3<=target)return{before:indices.length/3,after:indices.length/3,error:0,verticesBefore:count,verticesAfter:count};
 // Exact vertex welding includes every base/morph stream, so UV seams and
 // differently moving vertices stay distinct. Duplicate export vertices do
 // not falsely become separate topological borders for the simplifier.
 const originalStreams=[p.attributes,...p.targets||[]].flatMap(stream=>Object.values(stream).map(i=>({data:accessor(doc,i),size:sizes[doc.json.accessors[i].type]})));
 const unique=new Map(),weld=new Uint32Array(count);
 for(let k=0;k<count;k++){let key='';for(const {data,size} of originalStreams){for(let c=0;c<size;c++)key+=data[k*size+c]+',';key+=';';}const known=unique.get(key);if(known===undefined){unique.set(key,k);weld[k]=k;}else weld[k]=known;}
 for(let k=0;k<indices.length;k++)indices[k]=weld[indices[k]];
 const dims=bounds(positions),scale=Math.max(...dims.max.map((v,k)=>v-dims.min[k]));
 const attributes=[],weights=[];
 for(const key of ['NORMAL','TEXCOORD_0','COLOR_0'])if(p.attributes[key]!==undefined){const a=doc.json.accessors[p.attributes[key]],size=sizes[a.type];attributes.push({data:accessor(doc,p.attributes[key],true),size});weights.push(...Array(size).fill(key==='TEXCOORD_0'?0.5:key==='COLOR_0'?0.5:0.15));}
 for(const t of p.targets||[])if(t.POSITION!==undefined){attributes.push({data:Float32Array.from(accessor(doc,t.POSITION,true),v=>v/(scale||1)),size:3});weights.push(2,2,2);}
 assert.ok(weights.length<=32);const attrs=new Float32Array(count*weights.length);
 for(let k=0;k<count;k++){let off=k*weights.length;for(const {data,size} of attributes){for(let q=0;q<size;q++)attrs[off++]=data[k*size+q];}}
 // Lock all six extremal positions so width/height/placement cannot shrink.
 const locks=new Uint8Array(count);for(let k=0;k<count;k++)for(let c=0;c<3;c++)if(positions[k*3+c]===dims.min[c]||positions[k*3+c]===dims.max[c])locks[k]=1;
 const [reduced,error]=simplifier.simplifyWithAttributes(indices,positions,3,attrs,weights.length,weights,locks,target*3,0.025,['RegularizeLight']);
 const [remap,kept]=simplifier.compactMesh(reduced),inverse=new Uint32Array(kept);
 for(let k=0;k<remap.length;k++)if(remap[k]!==0xffffffff)inverse[remap[k]]=k;
 const streams=[p.attributes,...p.targets||[]];
 for(const stream of streams)for(const key in stream){const a=doc.json.accessors[stream[key]],size=sizes[a.type],values=accessor(doc,stream[key]),out=new values.constructor(kept*size);
  for(let k=0;k<kept;k++)for(let c=0;c<size;c++)out[k*size+c]=values[inverse[k]*size+c];
  stream[key]=addAccessor(doc,a,out);
 }
 p.indices=addAccessor(doc,{componentType:kept>65535?5125:5123,type:'SCALAR'},kept>65535?reduced:Uint16Array.from(reduced));
 return{before:indices.length/3,after:reduced.length/3,error,verticesBefore:count,verticesAfter:kept};
}
export async function generate(file){
 const name=path.basename(file),doc=readGLB(file),before=triangles(doc),budget=name.includes('volcano')?55000:name.includes('oak')?20000:6000;
 // Small separate meshes (birds, sails, particles) keep full geometry. They
 // are animated independently and are a tiny share of the vertex budget.
 const preserveBelow=name.includes('volcano')?12000:2000;
 const primitives=doc.json.meshes.flatMap(m=>m.primitives.map(p=>({m,p,tris:doc.json.accessors[p.indices].count/3}))),small=primitives.filter(x=>x.tris<preserveBelow).reduce((s,x)=>s+x.tris,0),large=before-small;
 const report=[];for(const {m,p,tris} of primitives){const target=tris<preserveBelow?tris:Math.max(100,Math.floor((budget-small)*tris/large));report.push({mesh:m.name||'',...simplifyPrimitive(doc,p,target)});}
 const out=path.join(root,'art/mobile',name);fs.mkdirSync(path.dirname(out),{recursive:true});const bytes=saveGLB(doc,out);
 const result={source:'art/'+name,mobile:'art/mobile/'+name,sourceSHA256:hash(doc.bytes),mobileSHA256:hash(bytes),bytesBefore:doc.bytes.length,bytesAfter:bytes.length,trianglesBefore:before,trianglesAfter:triangles(doc),verticesBefore:report.reduce((s,r)=>s+r.verticesBefore,0),verticesAfter:report.reduce((s,r)=>s+r.verticesAfter,0),clips:doc.json.animations?.length||0,primitives:report};
 console.log(`${name}: ${before} -> ${result.trianglesAfter} triangles; ${result.verticesBefore} -> ${result.verticesAfter} vertices`);return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 await simplifier.ready;const names=process.argv.slice(2);const files=names.length?names:fs.readdirSync(path.join(root,'art')).filter(n=>n.endsWith('_animated.glb')).sort();
 const report=[];for(const name of files)report.push(await generate(path.join(root,'art',name)));
 const manifest=path.join(root,'art/mobile/manifest.json');
 const previous=names.length&&fs.existsSync(manifest)?JSON.parse(fs.readFileSync(manifest)).assets:[];
 const merged=new Map(previous.map(a=>[a.source,a]));for(const a of report)merged.set(a.source,a);
 fs.writeFileSync(manifest,JSON.stringify({generator:'mobile-lod.mjs / meshoptimizer 1.1',assets:[...merged.values()].sort((a,b)=>a.source.localeCompare(b.source))},null,2)+'\n');
}
