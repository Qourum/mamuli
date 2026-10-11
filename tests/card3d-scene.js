// Real native geometry/timelines with only the WebGL boundary mocked. Browser QA
// verifies pixels; these checks protect extraction, hinge, framing and cleanup.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const THREE=require('../vendor/three.min.js'),frames=new Map(),renderers=[],events=new Map(),observers=[];
let now=0,nextFrame=0,reduce=false;
function element(){const handlers=new Map(),classes=new Set();return{
 clientWidth:340,clientHeight:210,children:[],classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)},
 appendChild(c){this.children.push(c);c.parent=this;},remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);},setAttribute(){},
 addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:name=>handlers.delete(name),handlers,
 getContext(){return{fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},ellipse(){},closePath(){},createLinearGradient(){return{addColorStop(){}};}};}
};}
class ResizeObserver{constructor(fn){this.fn=fn;observers.push(this);}observe(host){this.host=host;}disconnect(){this.disconnected=true;}}
class Renderer{
 constructor(){this.domElement=element();this.renderLists={dispose(){}};this.resources=new Set();this.shadowMap={};renderers.push(this);}
 setPixelRatio(v){this.dpr=v;}setClearColor(){}setSize(w,h){this.size=[w,h];}
 render(scene,camera){this.scene=scene;this.camera=camera;this.draws=(this.draws||0)+1;scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  const track=r=>{if(r&&!this.resources.has(r)){this.resources.add(r);r.addEventListener('dispose',()=>r.userData.released=true);}};track(scene.environment);
  scene.traverse(o=>{if(o.isInstancedMesh)track(o);track(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){track(m);for(const value of Object.values(m))if(value?.isTexture)track(value);}});
 }
 dispose(){this.disposed=true;}forceContextLoss(){this.lost=true;}
}
const document={visibilityState:'visible',createElement:element,addEventListener:(type,fn)=>events.set(fn,type),removeEventListener:(_type,fn)=>events.delete(fn)};
const context=vm.createContext({window:{THREE:{...THREE,WebGLRenderer:Renderer},devicePixelRatio:3,ResizeObserver},document,matchMedia:()=>({matches:reduce}),performance:{now:()=>now},requestAnimationFrame:fn=>{frames.set(++nextFrame,fn);return nextFrame;},cancelAnimationFrame:id=>frames.delete(id)});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/card3d.js'),'utf8')+'\nglobalThis.cards=Card3D;',context);const cards=context.cards;
function tick(ms){now+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(now));}
function released(renderer){assert.equal(renderer.disposed,true);assert.equal(renderer.lost,true);for(const r of renderer.resources)assert.equal(r.userData.released,true,'rendered geometry/material/texture/instance buffer released');}
function finite(scene){scene.traverse(o=>{assert(o.position.toArray().every(Number.isFinite));assert(o.quaternion.toArray().every(Number.isFinite));if(o.geometry)for(const name of ['position','normal'])if(o.geometry.attributes[name])assert(o.geometry.attributes[name].array.every(Number.isFinite),`${o.name} ${name} finite`);});}
function screenBounds(renderer,nodes){let max=0;const world=new THREE.Vector3(),instance=new THREE.Matrix4();for(const node of nodes){let visible=!!node;for(let ancestor=node;ancestor;ancestor=ancestor.parent)visible=visible&&ancestor.visible;if(!visible)continue;const a=node.geometry.attributes.position;for(let j=0;j<(node.isInstancedMesh?node.count:1);j++){if(node.isInstancedMesh)node.getMatrixAt(j,instance);for(let i=0;i<a.count;i+=Math.max(1,Math.floor(a.count/350))){world.fromBufferAttribute(a,i);if(node.isInstancedMesh)world.applyMatrix4(instance);world.applyMatrix4(node.matrixWorld).project(renderer.camera);assert(Number.isFinite(world.x+world.y+world.z));assert(world.z>-1&&world.z<1,'model remains inside camera depth range');max=Math.max(max,Math.abs(world.x),Math.abs(world.y));}}}return max;}
function revealNodes(renderer){const nodes=[];renderer.scene.traverse(o=>{if(o.geometry&&o.name!=='Studio contact shadow')nodes.push(o);});return nodes;}

const host=element(),bottle=cards.mount(host,'bottle'),first=renderers[0];assert(bottle);assert.equal(first.dpr,1.5);assert.equal(host.children.length,1);assert(first.shadowMap.enabled);assert(first.scene.environment.isCubeTexture);
const r=first.scene.userData.reveal;assert.equal(r.kind,'bottle');assert(r.bottle&&r.cork&&r.paper);
const glass=first.scene.getObjectByName('Thick-walled curved bottle with open neck');assert(glass.geometry.isLatheGeometry||glass.geometry.type==='LatheGeometry');assert(glass.material.isMeshPhysicalMaterial);assert(glass.material.transmission>.6);assert.equal(glass.material.opacity,1,'glass is visible through physical transmission, not a flat opacity fade');assert(glass.material.thickness>.08);
const initial=r.paper.geometry.attributes.position.array.slice();
r.paper.geometry.computeBoundingBox();let bounds=r.paper.geometry.boundingBox;
assert(bounds.max.x-bounds.min.x<.11,'the letter begins as a neck-sized vertical coil');assert(bounds.min.y+r.paperRig.position.y>.09,'rolled letter is above the inner bottle floor');assert(bounds.max.y+r.paperRig.position.y<r.mouthY,'rolled letter starts below the bottle mouth');
let maxCoil=0;for(let i=0;i<r.paper.geometry.attributes.position.count;i++){const a=r.paper.geometry.attributes.position;maxCoil=Math.max(maxCoil,Math.hypot(a.getX(i),a.getZ(i)));}assert(maxCoil<r.neckRadius-.01,'roll fits through the real neck with visible clearance');
const important=revealNodes(first);let worstFraming=screenBounds(first,important);
tick(800);assert(r.paperRig.position.y<.70,'cork release precedes letter extraction');const corkBefore=r.cork.position.y;
worstFraming=Math.max(worstFraming,screenBounds(first,important));tick(550);assert(r.paperRig.position.y>1.2,'letter rises through neck');assert(r.cork.position.y<corkBefore+.5,'cork follows a bounded flight');worstFraming=Math.max(worstFraming,screenBounds(first,important));
tick(470);r.paper.geometry.computeBoundingBox();bounds=r.paper.geometry.boundingBox;assert(r.paperRig.position.y+bounds.min.y>r.mouthY,'entire coil clears mouth before unfurling');assert(bounds.max.x-bounds.min.x<.11,'letter remains rolled during neck extraction');
worstFraming=Math.max(worstFraming,screenBounds(first,important));
tick(680);r.paper.geometry.computeBoundingBox();assert(r.paper.geometry.boundingBox.max.x-r.paper.geometry.boundingBox.min.x>.5,'sheet visibly unfurls');assert(frames.size>0,'subtle settling continues after the old 1.35-second cutoff');worstFraming=Math.max(worstFraming,screenBounds(first,important));
tick(700);r.paper.geometry.computeBoundingBox();assert(r.seal.visible);assert(r.paper.geometry.boundingBox.max.x-r.paper.geometry.boundingBox.min.x>1.18);finite(first.scene);worstFraming=Math.max(worstFraming,screenBounds(first,important));
tick(1600);assert.equal(frames.size,0,'reveal has a bounded 4.8-second lifetime');assert.equal(bottle.stats().elapsed,4800);assert.notDeepEqual(r.paper.geometry.attributes.position.array,initial);assert(Math.abs(r.cork.position.y+.64)<.002,'cork rests beside bottle');
worstFraming=Math.max(worstFraming,screenBounds(first,important));assert(worstFraming<.96,`bottle/letter remain in cinematic frame: ${worstFraming}`);
host.clientWidth=280;host.clientHeight=200;observers[0].fn();assert.equal(frames.size,0,'resizing finished scene does not restart animation');assert.deepEqual(first.size,[280,200]);
host.clientWidth=560;host.clientHeight=340;observers[0].fn();assert.deepEqual(first.size,[420,255],'one render scale preserves the host aspect');assert.equal(first.camera.aspect,560/340);assert.equal(frames.size,0);

cards.stop();
const chestHost=element(),chest=cards.mount(chestHost,'chest'),second=renderers[1];assert(chest);released(first);assert.equal(host.children.length,0);assert(observers[0].disconnected);
const c=second.scene.userData.reveal;assert.equal(c.pile.count,42);assert(c.hollow);const body=second.scene.getObjectByName('Separate weathered wall planks and floor');assert(body.material.map&&body.material.bumpMap,'wood has grain and shallow relief');
second.scene.updateMatrixWorld(true);const origin=c.chest.localToWorld(new THREE.Vector3(0,.43,0));
assert.equal(new THREE.Raycaster(origin,new THREE.Vector3(0,1,0)).intersectObject(body,false).length,0,'body has a genuinely open empty cavity');
const floorHit=new THREE.Raycaster(origin,new THREE.Vector3(0,-1,0)).intersectObject(body,false)[0];assert(floorHit&&floorHit.point.y<origin.y-.25,'inner floor is below the contents');
const chestNodes=revealNodes(second);let worstChestFraming=screenBounds(second,chestNodes);
const anchorBefore=c.lid.position.clone();tick(900);assert(c.lock.rotation.z<-.15);assert(c.lid.rotation.x<0&&c.lid.rotation.x>-.15);worstChestFraming=Math.max(worstChestFraming,screenBounds(second,chestNodes));tick(1400);assert(c.lid.rotation.x<-1.25,'arched lid opens around back hinge');worstChestFraming=Math.max(worstChestFraming,screenBounds(second,chestNodes));
second.scene.updateMatrixWorld(true);assert(c.lid.position.equals(anchorBefore));assert(c.lid.localToWorld(new THREE.Vector3()).distanceTo(c.chest.localToWorld(new THREE.Vector3(...c.hinge)))<1e-6,'true hinge anchor never drifts');
const front=c.lid.localToWorld(new THREE.Vector3(0,0,1.04)),back=c.lid.localToWorld(new THREE.Vector3());assert(front.y>back.y+.9,'front of lid lifts upward rather than through chest');
let octa=0,gemCount=0;second.scene.traverse(o=>{if(o.geometry?.type==='OctahedronGeometry')octa++;if(o.name==='Cut gemstones resting in the treasure')gemCount+=o.count;});assert.equal(octa,0,'no glowing triangle particles');assert.equal(gemCount,9);finite(second.scene);
tick(3000);assert.equal(frames.size,0);worstChestFraming=Math.max(worstChestFraming,screenBounds(second,chestNodes));assert(worstChestFraming<.96,`entire chest and raised lid stay framed: ${worstChestFraming}`);chestHost.clientHeight=200;observers[1].fn();assert(screenBounds(second,chestNodes)<.96,'200px in-game stage includes lid and chest floor');chest.dispose();chest.dispose();cards.stop();released(second);assert.equal(chestHost.children.length,0);assert.equal(events.size,0);

const scroll=cards.mount(element(),'scroll'),third=renderers[2];tick(100);document.visibilityState='hidden';for(const [fn,type]of events)if(type==='visibilitychange')fn();assert.equal(frames.size,0);const hiddenDraws=third.draws;tick(500);assert.equal(third.draws,hiddenDraws);
document.visibilityState='visible';for(const [fn,type]of events)if(type==='visibilitychange')fn();assert.equal(frames.size,1,'visibility resume keeps one loop');scroll.dispose();cards.stop();released(third);assert.equal(frames.size,0);
reduce=true;const still=cards.mount(element(),'bottle'),fourth=renderers[3];assert(still);assert.equal(frames.size,0);assert.equal(still.stats().elapsed,4800);assert(fourth.scene.userData.reveal.seal.visible);still.dispose();cards.stop();released(fourth);
const stillChest=cards.mount(element(),'chest'),fifth=renderers[4];assert(fifth.scene.userData.reveal.lid.rotation.x<-1.25);assert.equal(frames.size,0);stillChest.dispose();cards.stop();released(fifth);assert.equal(events.size,0);
// Sample the full trajectories in the narrower phone stage, not just endpoints.
reduce=false;let denseWorst=0,neckSamples=0;
for(const kind of ['bottle','chest']){
 const phone=element();phone.clientWidth=310;phone.clientHeight=230;const sceneController=cards.mount(phone,kind),renderer=renderers.at(-1),parts=revealNodes(renderer),state=renderer.scene.userData.reveal;
 for(let step=0;step<60;step++){
  tick(80);denseWorst=Math.max(denseWorst,screenBounds(renderer,parts));finite(renderer.scene);
  if(kind==='bottle'&&sceneController.stats().elapsed<=1820){
   // Use the actual lathed inner wall around the narrow neck: coil radius stays
   // smaller than its minimum opening while any part passes through it.
   const attr=state.paper.geometry.attributes.position,point=new THREE.Vector3();
   for(let i=0;i<attr.count;i+=19){point.fromBufferAttribute(attr,i).applyMatrix4(state.paper.matrixWorld);state.bottle.worldToLocal(point);if(point.y>1.085&&point.y<1.324){assert(Math.hypot(point.x,point.z)<.063,'physical roll clears the neck wall while passing through');neckSamples++;}}
  }
 }
 assert.equal(frames.size,0);sceneController.dispose();cards.stop();released(renderer);
}
assert(neckSamples>100,'neck clearance checks sample the moving letter');assert(denseWorst<.96,`both complete reveals fit a narrow phone stage: ${denseWorst}`);
// A preview with the legacy Three default and a game with explicit sRGB setup
// must use the same physical swatches without mutating shared color settings.
const previousLegacy=THREE.ColorManagement.legacyMode;THREE.ColorManagement.legacyMode=false;reduce=true;
const colorScene=cards.mount(element(),'bottle'),colorRenderer=renderers.at(-1);assert.equal(THREE.ColorManagement.legacyMode,false);
const secondGlass=colorRenderer.scene.getObjectByName('Thick-walled curved bottle with open neck').material;
assert(secondGlass.color.distanceTo?secondGlass.color.distanceTo(glass.material.color)<1e-9:Math.abs(secondGlass.color.r-glass.material.color.r)<1e-9,'sRGB material swatches agree in standalone and game');colorScene.dispose();cards.stop();released(colorRenderer);THREE.ColorManagement.legacyMode=previousLegacy;
// A bounded cache keeps uploaded resources and the WebGL context alive between
// cards. Repeated sessions replay the same native timeline; stale handles cannot
// dispose a later mount. stop/context loss explicitly releases every resource.
reduce=false;
const beforePool=renderers.length;
assert(cards.prepare('bottle'));
const pooled=renderers.at(-1),cachedBottle=pooled.scene,bottleResources=new Set(pooled.resources),warmDraws=pooled.draws;
assert.equal(warmDraws,2,'opening and final visibility variants are warmed');
assert.equal(frames.size,0,'prewarming never starts animation');
assert(cards.prepare('bottle'));assert.equal(pooled.draws,warmDraws,'prewarming a ready scene is a no-op');
const poolHost=element(),one=cards.mount(poolHost,'bottle');
assert.equal(renderers.length,beforePool+1,'mount reuses prepared renderer');
assert.equal(pooled.scene,cachedBottle,'mount reuses prepared scene/geometry/materials');
assert.equal(one.stats().elapsed,0,'prewarming does not consume the reveal timeline');
assert.equal(pooled.draws,warmDraws+1,'mount draws the first frame once');
observers.at(-1).fn();assert.equal(pooled.draws,warmDraws+1,'initial ResizeObserver report does not redraw same size');
assert.equal(cards.prepare('chest'),false,'prewarming cannot interrupt an active reveal');
tick(1300);one.dispose();assert.equal(frames.size,0);assert.equal(poolHost.children.length,0);assert.equal(events.size,0);
assert(!pooled.disposed&&!pooled.lost,'closing a card keeps one context ready');
for(const resource of bottleResources)assert(!resource.userData.released,'card resources survive normal close');
const two=cards.mount(poolHost,'bottle');assert.equal(pooled.scene,cachedBottle);assert.equal(two.stats().elapsed,0);assert.equal(pooled.scene.userData.reveal.seal.visible,false,'replayed reveal resets final-pose visibility');
one.dispose();assert.equal(frames.size,1,'old session cannot stop new reveal');assert.equal(poolHost.children.length,1);
two.dispose();assert(cards.prepare('chest'));const cachedChest=pooled.scene;assert.notEqual(cachedChest,cachedBottle);
assert(cards.prepare('scroll'));const cachedScroll=pooled.scene;
assert.equal(renderers.length,beforePool+1,'all three scene kinds share exactly one renderer');
for(const [kind,scene] of [['bottle',cachedBottle],['chest',cachedChest],['scroll',cachedScroll],['chest',cachedChest]]){
 const session=cards.mount(element(),kind);assert.equal(pooled.scene,scene);assert.equal(renderers.length,beforePool+1);session.dispose();
}
cards.stop();released(pooled);assert.equal(frames.size,0);assert.equal(events.size,0);
// Phone reveals update/draw at 30 Hz on a 120 Hz display, preserving 4.8 seconds.
context.screen={width:412,height:912};
const paced=cards.mount(element(),'bottle'),pacedRenderer=renderers.at(-1),startDraws=pacedRenderer.draws;
for(let i=0;i<120;i++)tick(1000/120);
assert(pacedRenderer.draws-startDraws>=29&&pacedRenderer.draws-startDraws<=30,'phone caps native reveal work at 30 updates per second');
assert(Math.abs(paced.stats().elapsed-1000)<34,'elapsed time follows real time rather than rendered frame count');
tick(3801);assert.equal(paced.stats().elapsed,4800);assert.equal(frames.size,0);
let prevented=false;pacedRenderer.domElement.handlers.get('webglcontextlost')({preventDefault(){prevented=true;}});
assert(prevented);released(pacedRenderer);assert.equal(paced.stats().disposed,true);assert.equal(events.size,0);delete context.screen;
context.window.THREE=null;assert.equal(cards.mount(element(),'bottle'),null,'existing artwork remains fallback without Three');
context.window.THREE={...THREE,WebGLRenderer:class{constructor(){throw Error('WebGL unavailable');}}};const fallback=element();assert.equal(cards.mount(fallback,'chest'),null);assert.equal(fallback.children.length,0);assert(!fallback.classList.contains('has-3d'));
console.log(JSON.stringify({passed:true,letterStartsInside:true,neckClearBeforeUnfurl:true,neckSamples,hollowChest:true,backHinge:true,coins:42,gems:9,boundedMs:4800,worstBottleFraming:worstFraming,worstChestFraming,denseWorst,reducedMotion:true,contextAndResourcesReleased:true,oneCachedContext:true,threeCachedScenes:true,phoneReveal30Hz:true,instanceBuffersReleased:true,aspectPreserved:true,sRGBConsistent:true},null,2));
