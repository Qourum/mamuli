const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),THREE=require(path.join(root,'vendor/three.min.js'));
const ctx=vm.createContext({window:{THREE}});vm.runInContext(fs.readFileSync(path.join(root,'src/place-fx.js'),'utf8')+'\nglobalThis.fx=PlaceFX3D;',ctx);
const parent=new THREE.Group(),places=Array.from({length:40},(_,i)=>({i,at:new THREE.Vector3(i%10*.8,.04,Math.floor(i/10)*2),corner:i%10===0}));
const live=ctx.fx.create({parent,places});assert.equal(live.stats().places,40);
let matrices=0;
for(let i=0;i<40;i++){
 live.update(i*4);assert(live.trigger(i,i%3?'arrival':'purchase','#38a2f0'));
 for(let t=0;t<3.5;t+=.08){live.update(i*4+t);parent.traverse(o=>{if(o.isInstancedMesh){assert([...o.instanceMatrix.array].every(Number.isFinite));assert([...o.instanceColor?.array||[]].every(Number.isFinite));matrices++;}});}
 assert.equal(live.stats().active,0);
}
for(let i=0;i<40;i++)live.trigger(i,'build');assert.equal(live.stats().active,8,'burst count bounded');assert(!live.trigger(40));assert(!live.trigger(-1));
live.reset();assert.equal(live.stats().active,0);assert.equal(parent.children[0].children.length,3,'only three shared draw meshes');
let disposed=0;parent.traverse(o=>{if(o.isInstancedMesh){o.addEventListener('dispose',()=>disposed++);o.geometry.addEventListener('dispose',()=>disposed++);o.material.addEventListener('dispose',()=>disposed++);}});
live.dispose();live.dispose();assert.equal(disposed,9);assert.equal(parent.children.length,0);
const reduced=ctx.fx.create({parent,places,reducedMotion:true});assert(!reduced.trigger(0));reduced.update(12);assert.equal(reduced.stats().active,0);reduced.dispose();
console.log(JSON.stringify({passed:true,all40Places:true,matrixFrames:matrices,boundedEvents:8,drawMeshes:3,reducedMotion:true,disposedExactlyOnce:true}));
