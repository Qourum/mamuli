// Actual corner GLBs and extracted production presentation functions. Canvas records text only; no WebGL renderer.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(base,'src/board3d.js'),'utf8');
global.window=global;global.THREE=require(path.join(base,'vendor/three.min.js'));global.self=global;
global.createImageBitmap=async()=>({width:1024,height:1024,close(){}});
global.Image=class{constructor(){this.width=this.height=1;}set src(v){queueMicrotask(()=>this.onload&&this.onload());}};
const originalFetch=global.fetch;
global.fetch=async url=>{if(String(url).startsWith('blob:'))return originalFetch(url);const bytes=fs.readFileSync(path.join(base,url));return{ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};};
vm.runInThisContext(fs.readFileSync(path.join(base,'vendor/GLTFLoader.min.js'),'utf8'));
vm.runInThisContext('const SITE=true;\n'+fs.readFileSync(path.join(base,'src/glb.js'),'utf8')+'\nglobal.__PresentationGLB=GLB;');
function production(name){const start=source.indexOf('  function '+name+'(');assert(start>=0,name+' exists');let h=source.indexOf('(',start),parens=0;for(;h<source.length;h++){if(source[h]==='(')parens++;if(source[h]===')'&&!--parens)break;}let k=source.indexOf('{',h),depth=0,quote=null;const end0=k;for(;k<source.length;k++){const c=source[k];if(quote){if(c==='\\')k++;else if(c===quote)quote=null;continue;}if(c==='\''||c==='"'||c==='`'){quote=c;continue;}if(c==='/'&&source[k+1]==='/'){k=source.indexOf('\n',k);continue;}if(c==='/'&&source[k+1]==='*'){k=source.indexOf('*/',k)+1;continue;}if(c==='{')depth++;if(c==='}'&&!--depth)return source.slice(start,k+1);}throw Error('unclosed '+name+' at '+end0);}
function canvas(){const calls=[];const x=new Proxy({font:'20px sans-serif',calls,measureText(t){return{width:String(t).length*(+(this.font.match(/([\d.]+)px/)||[,20])[1])*.52};},createLinearGradient(){return{addColorStop(){}};},createRadialGradient(){return{addColorStop(){}};},fillText(t){calls.push(String(t));},clearRect(){calls.length=0;}},{get(t,k){return k in t?t[k]:(...args)=>{};}});return{width:256,height:384,getContext:()=>x,calls};}
const doc={createElement:()=>canvas()};const context=vm.createContext({window:{THREE},T:THREE,document:doc,GLB:global.__PresentationGLB,Terrain:{SEA_Y:.02,OCEAN_Y:-.3},console,performance,Float32Array,setTimeout,clearTimeout,Diag:{note(){}}});
for(const file of ['data.js','themes.js','models.js','sea.js'])vm.runInContext(fs.readFileSync(path.join(base,'src',file),'utf8'),context);
vm.runInContext(`useTheme('archipelago');
const C=1.5,D=1.5,S=12,TW=1,TH=.2,TAU=Math.PI*2,maxAniso=4;
const OUT=[[0,1],[-1,0],[0,-1],[1,0]],ALONG=[[-1,0],[0,-1],[1,0],[0,1]];
const sideOf=i=>Math.floor(i/10)%4,yawOf=s=>-s*Math.PI/2,wantWorld=()=>THEME.world;
const FONT={sans:'sans-serif',serif:'serif',num:'sans-serif'};
const fontPx=x=>+(/(\\d+(?:\\.\\d+)?)px/.exec(x.font)||[0,30])[1];
const pic=()=>null,seaScene=()=>null,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let weatherLife=null,built=true;let ok=true,shadowDirty=false,landG=new T.Group(),root=new T.Group(),REDUCED=false;
const lotMesh=[],mark=[],flags=[],labelTex=[],labelCv=[],labelMat=[],sideMat=[],cornerTitles=[],animatedModels=[];
let modelDelta=0,placeModelsLife=null,mapPropsLife=null,placeEffects=null,st={players:[{name:'ანა',out:false,jail:false},{name:'ნიკა',out:false,jail:false}]},pos=[0,0];
const CREAM=new T.Color(0xe9d6a8),mats={scenery:new T.MeshLambertMaterial(),stone:new T.MeshLambertMaterial()},ownerMats=[];
let dustGeo=null,confGeo=null,coinGeo=null,goldRim=null,coinMat=null;
const layoutBuildings=()=>{},placeBuildings=()=>{},pop=()=>{},modelWater=m=>m,living=m=>m;
const topOf=k=>wantWorld()==='sea'?(k.m?.4:.78):(k.m?.3:.52);
const tween=(d,f)=>{f(1);return Promise.resolve();},ease={out:x=>x,lin:x=>x};
`,context);
for(const name of ['rr','fit','lines','coinIcon','priceLine','iconAt','drawLabel','drawSeaLabel','updateTileLabel','cornerTitle','prepareMaterials','nativeModel','clearAnimatedModels','placeCorner','centerOf','toWorld','flagFor','colorFlag','setOwner','setLevel','setMort','jailedNow','spot','disposeAll']){
  if(name==='jailedNow'){vm.runInContext("const jailedNow=s=>!!(st.players[s]&&st.players[s].jail&&pos[s]===JAIL);",context);continue;}
  vm.runInContext(production(name),context);
}
const waveStart=source.indexOf('    // flags wave, the wheel turns'),waveEnd=source.indexOf('    if (wheel)',waveStart);assert(waveStart>=0&&waveEnd>waveStart);
vm.runInContext('function wave(t){'+source.slice(waveStart,waveEnd)+'}\nglobalThis.api={placeCorner,flagFor,colorFlag,setOwner,setLevel,setMort,drawLabel,spot,wave,disposeAll,clearAnimatedModels,mark,flags,labelCv,labelTex,labelMat,sideMat,cornerTitles,animatedModels,get land(){return landG;},get root(){return root;},set state(s){st=s;},set positions(p){pos=p;},set reduced(r){REDUCED=r;},set world(w){useTheme(w);},SeaModels};',context);
const api=context.api;
(async()=>{
 const corners=[];
 for(const [raw,d] of Object.entries(api.SeaModels.cornerModels)){
  const i=+raw,tile=new THREE.Group();api.root.add(tile);const before=api.animatedModels.length;api.placeCorner(i,tile,d);
  for(let n=0;n<100&&api.animatedModels.length===before;n++)await new Promise(r=>setTimeout(r,10));
  assert.equal(api.animatedModels.length,before+1,'actual model loaded');const rec=api.animatedModels.at(-1),g=tile.getObjectByName('Corner_Diorama_'+i);assert(g);
  const duration=Math.max(...rec.mixer._actions.map(a=>a._clip.duration));let maxExtent=0,maxTop=0;
  for(let tick=0;tick<=24;tick++){rec.mixer.setTime(duration*tick/24);tile.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(g,true);assert(b.min.x>=-.67-1e-5&&b.max.x<=.67+1e-5,'corner X stays in square through loop');assert(b.min.z>=-.67-1e-5&&b.max.z<=.67+1e-5,'corner Z stays in square through loop');assert(b.min.y>=.212-1e-5,'model rests on square, not below it');maxExtent=Math.max(maxExtent,b.max.x-b.min.x,b.max.z-b.min.z);maxTop=Math.max(maxTop,b.max.y);}
  const sprite=tile.getObjectByName('Corner_Hologram_'+i);assert(sprite&&sprite.position.y>maxTop+.10,'title clears animated model');assert.equal(sprite.renderOrder,4,'title draws after the transparent sea');const titleCount=api.cornerTitles.length,oldMap=sprite.material.map,oldVersion=oldMap.version;vm.runInContext('cornerTitle('+i+',globalThis.currentTile,1)',Object.assign(context,{currentTile:tile}));assert.equal(api.cornerTitles.length,titleCount,'font/image refresh reuses the title');assert.equal(sprite.material.map,oldMap);assert(oldMap.version>oldVersion,'title texture refreshes in place');
  const six=Array.from({length:6},(_,s)=>({name:'P'+s,out:false,jail:i===10&&s%2===0}));api.state={players:six};api.positions=six.map(()=>i);const seats=six.map((_,s)=>api.spot(s,i));assert.equal(new Set(seats.map(p=>p.toArray().join(','))).size,6,'caught and visiting pirates have distinct berths');
  const c=vm.runInContext('centerOf('+i+')',context),r=-Math.floor(i/10)*Math.PI/2;const local=seats.map(p=>{const dx=p.x-c.x,dz=p.z-c.z;return new THREE.Vector3(dx*Math.cos(r)-dz*Math.sin(r),p.y,dx*Math.sin(r)+dz*Math.cos(r));});
  const ship=new THREE.Mesh(api.SeaModels.tokenShip('#f2c443'),new THREE.MeshBasicMaterial());ship.scale.setScalar(1.15);ship.rotation.y=Math.PI+.45;ship.position.y=.05;ship.updateMatrixWorld(true);const hb=new THREE.Box3().setFromObject(ship,true);
  const berthGap=local.map(p=>{const b=hb.clone().translate(p);return Math.max(b.min.x-.67,-.67-b.max.x,b.min.z-.67,-.67-b.max.z);});assert(Math.min(...berthGap)>0,'all six actual ships clear the full corner footprint');for(let t=0;t<20;t+=.25){ship.rotation.set(.06*Math.sin(t*1.6+i*1.7),Math.PI+.45,.03*Math.sin(t*1.1+i),'YXZ');ship.updateMatrixWorld(true);const animatedHull=new THREE.Box3().setFromObject(ship,true);for(const p of local){const b=animatedHull.clone().translate(p);assert(Math.max(b.min.x-.67,-.67-b.max.x,b.min.z-.67,-.67-b.max.z)>0,'ships remain clear during their natural roll/pitch');}}corners.push({i,berthMinGap:+Math.min(...berthGap).toFixed(3),hullBounds:{min:hb.min.toArray(),max:hb.max.toArray()}});
  rec.mixer.setTime(0);tile.updateMatrixWorld(true);const ray=new THREE.Raycaster(new THREE.Vector3(0,10,.3),new THREE.Vector3(0,-1,0));const hits=ray.intersectObject(g,true);const surface=hits.length?hits[0].point.y:null;
  corners.push({i,width:+maxExtent.toFixed(3),modelTop:+maxTop.toFixed(3),titleY:+sprite.position.y.toFixed(3),tokenSurfaceY:surface==null?null:+surface.toFixed(3)});
 }
 api.world='mamuli';api.state={players:[{name:'L',out:false,jail:true},{name:'V',out:false,jail:false}]};api.positions=[10,10];const landJail=api.spot(0,10),landVisitor=api.spot(1,10),origin=vm.runInContext('centerOf(10)',context);assert(Math.abs(landJail.y-.23)<1e-8);assert(Math.abs(landVisitor.y-.2)<1e-8);assert(Math.abs(landJail.x-(origin.x+.3))<1e-8);assert(Math.abs(landJail.z-(origin.z-.08))<1e-8);api.world='archipelago';
 const i=1;api.labelTex[i]=new THREE.CanvasTexture(canvas());api.sideMat[i]=new THREE.MeshLambertMaterial();api.labelMat[i]=new THREE.MeshLambertMaterial();
 api.state={players:[{name:'ანა',out:false,jail:false},{name:'ნიკა',out:false,jail:false}]};api.setOwner(i,0,false);assert(api.labelCv[i].calls.includes('ანა'));assert(api.labelCv[i].calls.includes('თავისუფალი მიწა'));
 const version=api.labelTex[i].version;api.setLevel(i,4,false);assert(api.labelCv[i].calls.includes('ქოხი · 4'));assert(api.labelTex[i].version>version);api.setLevel(i,5,false);assert(api.labelCv[i].calls.includes('სასტუმრო · 1'));api.setMort(i,true,false);assert(api.labelCv[i].calls.includes('დაგირავებულია'));api.setOwner(i,1,false);assert(api.labelCv[i].calls.includes('ნიკა'));api.setMort(i,false,false);api.setOwner(i,-1,false);assert(api.labelCv[i].calls.includes('შეძენა შესაძლებელია'));
 api.setOwner(i,0,false);const f=api.flags[i];assert.equal(f.width,.43);assert(f.canvas.calls.includes('01'));for(let t=0;t<20;t+=.25){api.wave(t);assert(Array.from(f.cloth.geometry.attributes.position.array).every(Number.isFinite));}
 api.reduced=true;api.wave(2);const snap=f.cloth.geometry.attributes.position.array.slice();api.wave(99);assert.deepEqual(f.cloth.geometry.attributes.position.array,snap,'reduced motion freezes the flag');assert(f.glow.material.opacity===.35);
 vm.runInContext(fs.readFileSync(path.join(base,'src/weather.js'),'utf8'),context);const weather=vm.runInContext('Weather3D.create({parent:root,waterY:.02,seed:1729})',context);const flagShader={uniforms:{},vertexShader:THREE.ShaderLib.lambert.vertexShader,fragmentShader:THREE.ShaderLib.lambert.fragmentShader};f.cloth.material.onBeforeCompile(flagShader);assert(flagShader.uniforms.uWeatherZone);assert(flagShader.vertexShader.includes('vWeatherWorld'));const titleMaterial=api.cornerTitles[0].sprite.material,titleShader={uniforms:{},vertexShader:THREE.ShaderLib.sprite.vertexShader,fragmentShader:THREE.ShaderLib.sprite.fragmentShader};titleMaterial.onBeforeCompile(titleShader);assert(titleShader.uniforms.uWeatherZone);assert(titleShader.fragmentShader.includes('localWeatherShade()'));weather.dispose();assert.equal(flagShader.uniforms.uWeatherZone.value.w,0);
 let disposedTitles=0;for(const c of api.cornerTitles)c.sprite.material.map.addEventListener('dispose',()=>disposedTitles++);
 const ownedMap=f.cloth.material.map;let disposedMap=0,disposedMat=0;ownedMap.addEventListener('dispose',()=>disposedMap++);f.cloth.material.addEventListener('dispose',()=>disposedMat++);api.disposeAll(api.root);assert.equal(disposedMap,1,'flag map is disposed once');assert.equal(disposedMat,1,'flag material is disposed once');assert.equal(disposedTitles,4,'all four reused title textures dispose once');api.clearAnimatedModels();assert.equal(api.animatedModels.length,0);
 console.log(JSON.stringify({passed:true,corners,labelStateRefresh:true,flagsFiniteAndReducedMotion:true,flagAndTitleResourcesDisposed:true,weatherMaterialHooksPreserved:true,distinctSixCornerBerths:true,landTokenPositionsPreserved:true}));
})().catch(e=>{console.error(e);process.exitCode=1;});
