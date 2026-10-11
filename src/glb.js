// ===== the archipelago's 3D models, made from its Higgsfield pictures (art/m_*.glb, written by tools/glb_prep.mjs) =====
// A small reader for exactly what that tool writes: a GLB of one mesh with one texture (webp), its numbers maybe stored
// as small integers. It gives the mesh's shape (in the model's own units, every node's place applied) and its material,
// lit like the rest of the board. Animated assets use the matching official glTF reader instead: their node hierarchy,
// PBR materials and native clips stay intact. Each file is read once; a board made again gets its own scene instance.

const GLB = (() => {
  const T = window.THREE;
  if (!T) return null;
  const KIND = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const TOP = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };
  const cache = new Map();
  const scenes = new Map();
  const jobs = new Map(), queue = [], measuredTextures = new WeakSet(), measuredImages = new WeakMap();
  const policy = { mobile: false, concurrency: 4 };
  const counts = { completed: 0, failed: 0, fetches: 0, retries: 0, timeouts: 0, maxActive: 0, textures: 0, images: 0, resizedImages: 0, resizeFailures: 0, originalImageBytes: 0, imageBytes: 0, originalTextureBytes: 0, textureBytes: 0 };
  const DEADLINE = 90000;
  let active = 0, scheduled = false, serial = 0;
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const imageBytes = (w, h) => Math.ceil(w * h * 4 * 4 / 3); // RGBA plus a full mip chain; an estimate, not driver telemetry.
  function stats() { return { ...counts, mobile: policy.mobile, concurrency: policy.concurrency, active, queued: queue.length }; }
  function configure(options = {}) {
    if (options.mobile != null) policy.mobile = !!options.mobile;
    policy.concurrency = Number.isFinite(options.concurrency) ? Math.max(1, Math.min(8, Math.floor(options.concurrency))) : policy.mobile ? 2 : 4;
    schedule(); return stats();
  }
  function deadline(promise, label, abort) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        counts.timeouts++; if (abort) abort();
        reject(new Error(`${label}: timed out after 90 seconds`));
      }, DEADLINE);
      Promise.resolve(promise).then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
    });
  }
  function schedule() {
    if (scheduled || !queue.length) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false; queue.sort((a,b) => b.priority-a.priority || a.order-b.order);
      while (active < policy.concurrency && queue.length) {
        const job = queue.shift(); job.running = true; active++; counts.maxActive = Math.max(counts.maxActive, active);
        run(job).finally(() => { active--; if(jobs.get(job.url)===job)jobs.delete(job.url); schedule(); });
      }
    }, 0);
  }
  function request(mode, url, priority, memo) {
    const rank = Number.isFinite(priority) ? priority : 0;
    if (memo.has(url)) { const queued = jobs.get(url); if (queued) queued.priority = Math.max(queued.priority, rank); return memo.get(url); }
    let resolve, reject;
    const promise = new Promise((a,b) => { resolve=a; reject=b; });
    memo.set(url,promise);
    let job = jobs.get(url);
    if(job&&(job.closed||job.requests.some(r=>r.mode===mode&&r.done)))job=null;
    if (!job) { job={url,priority:rank,order:serial++,running:false,requests:[]};jobs.set(url,job);queue.push(job); }
    job.priority=Math.max(job.priority,rank);
    job.requests.push({mode,memo,promise,resolve,reject,done:false}); schedule();
    return promise;
  }
  function rejectRequest(job, item, error) {
    item.done=true;if(item.memo.get(job.url)===item.promise)item.memo.delete(job.url);
    if(job.requests.every(r=>r.done)){job.closed=true;if(jobs.get(job.url)===job)jobs.delete(job.url);}
    console.warn(item.mode==='scene'?'animated model':'model',job.url,error);item.reject(error);
  }
  async function run(job) {
    let failed=false;
    try {
      const buffer=await fetchBytes(job.url);
      // Concurrent static/native callers share the file and the same queue slot.
      // The raw file is released after parsing rather than kept as another cache.
      for (;;) {
        const item=job.requests.find(r=>!r.done);if(!item)break;
        await pause(0);
        try {
          let asset;
          if(item.mode==='scene') {
            asset=await deadline(parseScene(buffer,job.url.slice(0,job.url.lastIndexOf('/')+1)),job.url+' parse');
            await deadline(prepareTextures(asset,job.url),job.url+' textures');retainScene(asset.scene);
          } else asset=await deadline(make(buffer),job.url+' parse');
          item.done=true;if(job.requests.every(r=>r.done)){job.closed=true;if(jobs.get(job.url)===job)jobs.delete(job.url);}item.resolve(asset);
        } catch(error){failed=true;rejectRequest(job,item,error);}
      }
    } catch(error) {failed=true;for(const item of job.requests)if(!item.done)rejectRequest(job,item,error);}
    if(failed)counts.failed++;else counts.completed++;
  }

  async function prepareTextures(gltf, url) {
    const textures=new Set();
    for(const scene of new Set([gltf.scene,...(gltf.scenes||[])]))if(scene)scene.traverse(o=>{
      for(const material of Array.isArray(o.material)?o.material:o.material?[o.material]:[])
        for(const value of Object.values(material))if(value&&value.isTexture)textures.add(value);
    });
    const residentTextures=new Set(textures);
    // Include parser-cached texture clones before releasing an ImageBitmap. They
    // share Texture.Source objects with material maps and may be reused later.
    if(policy.mobile&&gltf.parser&&typeof gltf.parser.getDependencies==='function')
      for(const texture of await gltf.parser.getDependencies('texture'))if(texture&&texture.isTexture)textures.add(texture);
    const grouped=new Map();
    for(const texture of textures){const image=texture.image;if(!image)continue;if(!grouped.has(image))grouped.set(image,[]);grouped.get(image).push(texture);}
    const cap=/volcano/i.test(url)?1024:512;
    for(const [image, refs]of grouped){
      let info=measuredImages.get(image);
      if(!info){
        const w=image.naturalWidth||image.width||0,h=image.naturalHeight||image.height||0;
        if(!w||!h)continue;
        const original=imageBytes(w,h);info={image,width:w,height:h,original,bytes:original};
        if(policy.mobile&&Math.max(w,h)>cap){
          try{
            const canvas=document.createElement('canvas'),factor=cap/Math.max(w,h);
            canvas.width=Math.max(1,Math.round(w*factor));canvas.height=Math.max(1,Math.round(h*factor));
            const context=canvas.getContext('2d',{alpha:true});if(!context)throw new Error('2D canvas unavailable');
            context.drawImage(image,0,0,canvas.width,canvas.height);
            info={image:canvas,width:canvas.width,height:canvas.height,original,bytes:imageBytes(canvas.width,canvas.height)};counts.resizedImages++;
          }catch(error){counts.resizeFailures++;}
        }
        measuredImages.set(image,info);measuredImages.set(info.image,info);
        counts.images++;counts.originalImageBytes+=original;counts.imageBytes+=info.bytes;
      }
      if(info.image!==image){for(const texture of refs){texture.image=info.image;texture.needsUpdate=true;}}
      for(const texture of refs)if(residentTextures.has(texture)&&!measuredTextures.has(texture)){
        measuredTextures.add(texture);counts.textures++;counts.originalTextureBytes+=info.original;counts.textureBytes+=info.bytes;
      }
      // Never close a bitmap still referenced by a texture. Canvas sources stay
      // available for later WebGL uploads/context recovery; UV flip and colour
      // encoding remain properties of the original texture objects.
      if(info.image!==image&&typeof image.close==='function'&&[...textures].every(texture=>texture.image!==image))image.close();
    }
  }

  function chunks(buf) {
    const dv = new DataView(buf);
    if (buf.byteLength < 20 || dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB');
    let json = null, bin = null;
    for (let at = 12; at + 8 <= buf.byteLength;) {
      const len = dv.getUint32(at, true), type = dv.getUint32(at + 4, true);
      if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, at + 8, len)));
      else if (type === 0x004e4942) bin = buf.slice(at + 8, at + 8 + len);
      at += 8 + len;
    }
    if (!json || !bin) throw new Error('a GLB without its parts');
    return { json, bin };
  }
  // an accessor's numbers: integers stored for floats (normalized) come back as floats, indices as they are
  function read(g, k, asFloat) {
    const a = g.json.accessors[k], v = g.json.bufferViews[a.bufferView], A = KIND[a.componentType], n = SIZE[a.type];
    if (!A || !n) throw new Error('an accessor of an unknown kind');
    const off = (v.byteOffset || 0) + (a.byteOffset || 0), size = A.BYTES_PER_ELEMENT * n, stride = v.byteStride || size;
    let raw;
    if (stride === size) raw = new A(g.bin, off, a.count * n);
    else {                                  // each element padded (small integers are) or among others: one by one
      const step = stride / A.BYTES_PER_ELEMENT, all = new A(g.bin, off, ((a.count - 1) * stride + size) / A.BYTES_PER_ELEMENT);
      raw = new A(a.count * n);
      for (let j = 0; j < a.count; j++) for (let c = 0; c < n; c++) raw[j * n + c] = all[j * step + c];
    }
    if (!asFloat || A === Float32Array) return { a: raw, n };
    const out = new Float32Array(raw.length), top = a.normalized ? TOP[a.componentType] : 1;
    for (let j = 0; j < raw.length; j++) out[j] = a.normalized ? Math.max(raw[j] / top, -1) : raw[j];
    return { a: out, n };
  }
  // where each mesh stands: the nodes' places multiplied down the tree
  function placed(json) {
    const out = [], M = n => {
      const m = new T.Matrix4();
      if (n.matrix) m.fromArray(n.matrix);
      else m.compose(new T.Vector3().fromArray(n.translation || [0, 0, 0]), new T.Quaternion().fromArray(n.rotation || [0, 0, 0, 1]), new T.Vector3().fromArray(n.scale || [1, 1, 1]));
      return m;
    };
    const walk = (k, up) => {
      const n = json.nodes[k], m = up.clone().multiply(M(n));
      if (n.mesh != null) out.push({ mesh: n.mesh, m });
      for (const c of n.children || []) walk(c, m);
    };
    const sc = json.scenes ? json.scenes[json.scene || 0] : { nodes: json.nodes.map((n, k) => k) };
    for (const k of sc.nodes || []) walk(k, new T.Matrix4());
    return out;
  }
  async function picture(g, tex) {
    const t = g.json.textures[tex.index], src = t.extensions && t.extensions.EXT_texture_webp ? t.extensions.EXT_texture_webp.source : t.source;
    const im = g.json.images[src], v = g.json.bufferViews[im.bufferView];
    const blob = new Blob([new Uint8Array(g.bin, v.byteOffset || 0, v.byteLength)], { type: im.mimeType || 'image/webp' });
    const url = URL.createObjectURL(blob), img = new Image();
    img.src = url;
    try { await img.decode(); } finally { URL.revokeObjectURL(url); }
    const tx = new T.Texture(img);
    tx.flipY = false;                       // (a glTF picture's first row is the top of its UVs)
    tx.encoding = T.sRGBEncoding;
    tx.anisotropy = 4;
    tx.needsUpdate = true;
    return tx;
  }
  async function make(buf) {
    const g = chunks(buf), parts = [];
    let mat = null;
    for (const { mesh, m } of placed(g.json)) {
      for (const p of g.json.meshes[mesh].primitives) {
        if (p.mode != null && p.mode !== 4) continue;            // triangles only
        const geo = new T.BufferGeometry(), at = p.attributes;
        const pos = read(g, at.POSITION, true);
        geo.setAttribute('position', new T.BufferAttribute(pos.a, 3));
        if (at.NORMAL != null) geo.setAttribute('normal', new T.BufferAttribute(read(g, at.NORMAL, true).a, 3));
        if (at.TEXCOORD_0 != null) geo.setAttribute('uv', new T.BufferAttribute(read(g, at.TEXCOORD_0, true).a, 2));
        if (p.indices != null) geo.setIndex(new T.BufferAttribute(read(g, p.indices, false).a, 1));
        geo.applyMatrix4(m);
        if (at.NORMAL == null) geo.computeVertexNormals();
        parts.push(geo);
        if (!mat && p.material != null) mat = g.json.materials[p.material];
      }
    }
    if (!parts.length) throw new Error('a GLB without a mesh');
    const geometry = parts.length === 1 ? parts[0] : merge(parts);
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const pbr = (mat && mat.pbrMetallicRoughness) || {}, f = pbr.baseColorFactor || [1, 1, 1, 1];
    const map = pbr.baseColorTexture ? await picture(g, pbr.baseColorTexture) : null;
    geometry.setAttribute('aLeaf', new T.BufferAttribute(leaves(geometry, map && map.image), 1));
    const material = new T.MeshLambertMaterial({ map, color: new T.Color(f[0], f[1], f[2]) });
    return { geometry, material };
  }
  // where the model has leaves, and how much they sway in the wind (the board's shader moves them): green in its
  // picture, and standing above the ground round it (the treetops, the palms' fronds; not the grass, not the trunks)
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function leaves(geo, img) {
    const pos = geo.attributes.position, uv = geo.attributes.uv, n = pos.count, out = new Float32Array(n);
    if (!uv || !img) return out;
    let px;
    const S = 256;
    try {
      const cv = document.createElement('canvas'); cv.width = cv.height = S;
      const x = cv.getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0, S, S);
      px = x.getImageData(0, 0, S, S).data;
    } catch (e) { return out; }
    // the ground: the lowest point in each little square of the model's plan
    const bb = geo.boundingBox, size = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) || 1, cell = size / 48, low = new Map();
    const key = (cx, cz) => cx * 4096 + cz, at = i => [Math.floor((pos.getX(i) - bb.min.x) / cell), Math.floor((pos.getZ(i) - bb.min.z) / cell)];
    for (let i = 0; i < n; i++) { const [cx, cz] = at(i), k = key(cx, cz), y = pos.getY(i); if (!(low.get(k) <= y)) low.set(k, y); }
    for (let i = 0; i < n; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      const ix = Math.min(S - 1, Math.floor((u - Math.floor(u)) * S)), iy = Math.min(S - 1, Math.floor((v - Math.floor(v)) * S));   // (a glTF picture's first row is the top)
      const o = (iy * S + ix) * 4, r = px[o], gr = px[o + 1], b = px[o + 2];
      const green = smooth(6, 30, gr - Math.max(r, b) * 0.95);
      if (!green) continue;
      const [cx, cz] = at(i);
      let ground = Infinity;
      for (let a = -2; a <= 2; a++) for (let c = -2; c <= 2; c++) { const y = low.get(key(cx + a, cz + c)); if (y !== undefined && y < ground) ground = y; }
      out[i] = green * smooth(size * 0.012, size * 0.07, pos.getY(i) - ground);
    }
    return out;
  }
  // several pieces into one (they have the same numbers: the tool writes them so)
  function merge(list) {
    const names = Object.keys(list[0].attributes), out = new T.BufferGeometry();
    let nv = 0, ni = 0;
    for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    for (const nm of names) {
      const n = list[0].attributes[nm].itemSize, a = new Float32Array(nv * n);
      let at = 0;
      for (const g of list) { a.set(g.attributes[nm].array, at); at += g.attributes[nm].array.length; }
      out.setAttribute(nm, new T.BufferAttribute(a, n));
    }
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let at = 0, base = 0;
    for (const g of list) {
      const c = g.attributes.position.count;
      if (g.index) for (let j = 0; j < g.index.count; j++) idx[at++] = g.index.array[j] + base;
      else for (let j = 0; j < c; j++) idx[at++] = j + base;
      base += c;
    }
    out.setIndex(new T.BufferAttribute(idx, 1));
    return out;
  }
  // a model, read once: a promise of { geometry, material }. (Claude's viewer, where the preview lives, serves no .glb
  // files: the preview has each written out as text, base64, next to where it would be.)
  const asText = typeof SITE !== 'undefined' && !SITE;
  const bytes = s => { const b = atob(s.trim()), a = new Uint8Array(b.length); for (let k = 0; k < b.length; k++) a[k] = b.charCodeAt(k); return a.buffer; };
  function fetchBytes(url) {
    const attempt = () => {
      const controller=typeof AbortController!=='undefined'?new AbortController():null;counts.fetches++;
      return deadline((async()=>{
        const r=await fetch(asText?url+'.txt':url,controller?{signal:controller.signal}:undefined);
        if(!r.ok){const error=new Error(`${url}: ${r.status}`);error.retryable=r.status>=500||r.status===408||r.status===429;throw error;}
        return asText?bytes(await r.text()):await r.arrayBuffer();
      })(),url+' download',controller?()=>controller.abort():null);
    };
    return attempt().catch(async error=>{if(error.retryable===false)throw error;counts.retries++;await pause(250);return attempt();});
  }
  function load(url, priority=0) {return request('static',url,priority,cache);}
  function parseScene(buf, path = '') {
    if (!window.MamuliGLTFLoader) return Promise.reject(new Error('the animated GLB reader is unavailable'));
    return new Promise((resolve, reject) => new window.MamuliGLTFLoader().parse(buf, path, resolve, reject));
  }
  function retainScene(scene) {
    scene.traverse(o => {
      if (o.geometry) o.geometry.userData.keep = true;
      for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
        m.userData.keep = true;
        for (const value of Object.values(m)) if (value && value.isTexture) value.userData.keep = true;
      }
    });
  }
  function sceneInstance(gltf) {
    // SkeletonUtils also clones bones. Mesh.clone gives every instance its own morph weights; geometry, textures,
    // materials and immutable clips are shared. One island's mixer can never change another island's pose.
    let skinned = false;
    gltf.scene.traverse(o => { if (o.isSkinnedMesh) skinned = true; });
    if (skinned && !window.MamuliSkeletonClone) throw new Error('the animated skeleton reader is unavailable');
    const scene = window.MamuliSkeletonClone ? window.MamuliSkeletonClone(gltf.scene) : gltf.scene.clone(true);
    return { scene, animations: gltf.animations || [] };
  }
  function loadScene(url,priority=0) {return request('scene',url,priority,scenes).then(sceneInstance);}
  return {load,loadScene,configure,stats,_parse:make,_parseScene:parseScene};
})();
