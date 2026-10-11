// Native event reveals share one WebGL context and three bounded scene kinds.
// Closing a card detaches its session; the next reveal reuses uploaded geometry,
// textures and shader programs. stop() releases the entire cache. The 4.8-second
// sequence ends in a composed still; reduced motion shows that still immediately.
const Card3D = (() => {
  let active = null, sharedRenderer = null;
  const scenes = new Map();
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const smooth = n => { const p = clamp(n, 0, 1); return p * p * (3 - 2 * p); };
  const stage = (t, a, b) => smooth((t - a) / (b - a));
  const mix = (a, b, t) => a * (1 - t) + b * t;
  const DURATION = 4800;

  const canonicalKind = kind => kind === 'chest' || kind === 'scroll' ? kind : 'bottle';
  const phone = () => {
    try { return Math.min(screen.width, screen.height) < 700 || navigator.maxTouchPoints > 1 && /Android|iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent); }
    catch (_) { return false; }
  };
  function renderer() {
    if (sharedRenderer) return sharedRenderer;
    const T = window.THREE, r = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    sharedRenderer = r;
    r.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1)); r.outputEncoding = T.sRGBEncoding;
    r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = .86; r.setClearColor(0x000000, 0);
    if (r.shadowMap) { r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap; }
    r.domElement.setAttribute('aria-hidden', 'true');
    r.domElement.addEventListener('webglcontextlost', contextLost);
    return r;
  }
  function contextLost(event) { event.preventDefault(); stop(); }
  function stop() {
    if (active) active.dispose();
    for (const scene of scenes.values()) scene.destroy();
    scenes.clear();
    const r = sharedRenderer; sharedRenderer = null;
    if (r) {
      r.domElement.removeEventListener('webglcontextlost', contextLost);
      r.renderLists.dispose(); r.dispose(); r.forceContextLoss(); r.domElement.remove();
    }
  }
  function getScene(kind) {
    if (!scenes.has(kind)) scenes.set(kind, build(kind));
    return scenes.get(kind);
  }
  function mount(host, kind = 'bottle') {
    if (active) active.dispose();
    if (!host || !window.THREE) return null;
    try { return getScene(canonicalKind(kind)).attach(host); }
    catch (_) { stop(); return null; }
  }
  // Called one kind at a time from the idle menu preparation queue. Render both
  // endpoints so initially hidden seal/treasure shaders are uploaded as well.
  function prepare(kind = 'bottle') {
    if (active || !window.THREE || document.visibilityState === 'hidden') return false;
    try { getScene(canonicalKind(kind)).prepare(); return true; }
    catch (_) { stop(); return false; }
  }
  function build(kind) {
    const T = window.THREE;
    let scene, camera, frame = 0, destroyed = false, resize = null, host = null, controller = null;
    let elapsed = 0, started = 0, nextDraw = null, previousSize = '', prepared = false, draw = null;
    const mobile = phone(), objects = new Set(), materials = new Set(), textures = new Set();
    let r;
    function visibility() {
      if (!controller) return;
      cancelAnimationFrame(frame);
      if (document.visibilityState !== 'hidden') { nextDraw = null; if (draw) draw(performance.now()); }
    }
    function detach() {
      cancelAnimationFrame(frame); frame = 0;
      if (resize) resize.disconnect(); resize = null;
      document.removeEventListener('visibilitychange', visibility);
      if (host) { host.classList.remove('has-3d'); r.domElement.remove(); }
      host = null;
      if (active === controller) active = null;
      controller = null;
    }
    function destroy() {
      if (destroyed) return;
      destroyed = true; detach();
      if (scene) scene.traverse(o => {
        if (o.shadow && o.shadow.dispose) o.shadow.dispose();
        if (o.isInstancedMesh && o.dispose) o.dispose();
      });
      objects.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    }
    try {
      r = renderer(); scene = new T.Scene();
      const studio = Array.from({ length: 6 }, (_, side) => {
        const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
        const gradient = x.createLinearGradient(0, 0, 0, 128); gradient.addColorStop(0, '#3f6570'); gradient.addColorStop(.5, '#7b9186'); gradient.addColorStop(1, '#392b22'); x.fillStyle = gradient; x.fillRect(0, 0, 128, 128);
        if (side === 0 || side === 4) { const panel = x.createLinearGradient(18, 0, 63, 0); panel.addColorStop(0, '#72909d'); panel.addColorStop(.24, '#fffcec'); panel.addColorStop(.65, '#fff1c9'); panel.addColorStop(1, '#88a0a2'); x.fillStyle = panel; x.fillRect(18, 8, 45, 110); }
        if (side === 2) { x.fillStyle = '#fff5d8'; x.fillRect(12, 12, 104, 104); } return c;
      });
      const environment = new T.CubeTexture(studio); environment.encoding = T.sRGBEncoding; environment.needsUpdate = true; textures.add(environment); scene.environment = environment;
      camera = new T.PerspectiveCamera(32, 1, .08, 20);
      scene.add(new T.HemisphereLight(0xe7f3f6, 0x463824, .48));
      const key = new T.DirectionalLight(0xffedce, 1.48); key.position.set(-3, 5, 4); key.castShadow = true; key.shadow.mapSize.set(512, 512); key.shadow.camera.left = key.shadow.camera.bottom = -3; key.shadow.camera.right = key.shadow.camera.top = 3; key.shadow.camera.near = .1; key.shadow.camera.far = 12; key.shadow.bias = -.0003; scene.add(key);
      const rim = new T.DirectionalLight(0x9adee8, .52); rim.position.set(3, 2, -3); scene.add(rim);
      function mat(color, opt = {}, physical = false) {
        const m = new (physical ? T.MeshPhysicalMaterial : T.MeshStandardMaterial)({ color, roughness: .55, ...opt });
        // The standalone card preview also runs without terrain's colour setup.
        // Normalize just this scene's swatches, never the shared Three setting.
        if (!T.ColorManagement || T.ColorManagement.legacyMode !== false) {
          m.color.convertSRGBToLinear(); if (opt.attenuationColor && m.attenuationColor) m.attenuationColor.convertSRGBToLinear();
        }
        materials.add(m); return m;
      }
      function mesh(g, m, parent = scene, name) { objects.add(g); const o = new T.Mesh(g, m); if (name) o.name = name; o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; }
      function texture(canvas, color = true) { const t = new T.CanvasTexture(canvas); if (color) t.encoding = T.sRGBEncoding; t.anisotropy = 4; textures.add(t); return t; }
      const gold = mat(0xd3a12b, { metalness: .84, roughness: .32, envMapIntensity: .68 });
      const brass = mat(0xa78032, { metalness: .76, roughness: .42, envMapIntensity: .65 });
      const darkMetal = mat(0x3f4240, { metalness: .72, roughness: .56 });
      const shadowMat = new T.ShadowMaterial({ color: 0x071520, opacity: .25 }); materials.add(shadowMat);
      const floor = mesh(new T.PlaneGeometry(7, 7), shadowMat, scene, 'Studio contact shadow'); floor.rotation.x = -Math.PI / 2; floor.position.y = -.75; floor.castShadow = false;
      function bevel(w, h, d, r = .012) {
        const s = new T.Shape(), x = w / 2 - r, y = h / 2 - r;
        s.moveTo(-x, -y); s.lineTo(x, -y); s.lineTo(x, y); s.lineTo(-x, y); s.closePath();
        const g = new T.ExtrudeGeometry(s, { depth: Math.max(.002, d - 2 * r), steps: 1, curveSegments: 2, bevelEnabled: true, bevelSegments: 2, bevelSize: r, bevelThickness: r }); g.translate(0, 0, -d / 2 + r); return g;
      }
      function merged(parts) {
        const p = [], n = [], uv = [], M = new T.Matrix4(), o = new T.Object3D();
        for (const part of parts) {
          let g = part.g; if (g.index) { const raw = g.toNonIndexed(); g.dispose(); g = raw; }
          o.position.fromArray(part.p || [0, 0, 0]); o.rotation.fromArray([...(part.r || [0, 0, 0]), 'XYZ']); o.scale.fromArray(part.s || [1, 1, 1]); o.updateMatrix(); M.copy(o.matrix); g.applyMatrix4(M);
          if (!g.attributes.normal) g.computeVertexNormals();
          const a = g.attributes.position, normals = g.attributes.normal, coords = g.attributes.uv;
          for (let i = 0; i < a.count; i++) { p.push(a.getX(i), a.getY(i), a.getZ(i)); n.push(normals.getX(i), normals.getY(i), normals.getZ(i)); uv.push(coords ? coords.getX(i) : 0, coords ? coords.getY(i) : 0); } g.dispose();
        }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(n, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.computeBoundingBox(); g.computeBoundingSphere(); return g;
      }
      const piece = (g, x = 0, y = 0, z = 0, r, s) => ({ g, p: [x, y, z], r, s });
      function woodTextures() {
        const c = document.createElement('canvas'), bump = document.createElement('canvas'); c.width = bump.width = 512; c.height = bump.height = 256;
        const x = c.getContext('2d'), b = bump.getContext('2d'); x.fillStyle = '#9d7650'; x.fillRect(0, 0, 512, 256); b.fillStyle = '#888888'; b.fillRect(0, 0, 512, 256);
        for (let i = 0; i < 110; i++) {
          const y = i * 2.37, width = .35 + i % 4 * .2; x.strokeStyle = i % 3 ? 'rgba(67,36,15,.26)' : 'rgba(230,184,115,.28)'; b.strokeStyle = i % 3 ? '#666666' : '#aaaaaa'; x.lineWidth = b.lineWidth = width;
          for (const paint of [x, b]) { paint.beginPath(); paint.moveTo(0, y); for (let k = 1; k <= 12; k++) paint.lineTo(k * 44, y + Math.sin(k * .71 + i * 2.3) * (2 + i % 6)); paint.stroke(); }
        }
        for (const [kx, ky] of [[92, 87], [349, 181]]) for (let i = 0; i < 6; i++) { x.strokeStyle = 'rgba(57,30,14,.25)'; x.lineWidth = .8; x.beginPath(); x.ellipse(kx, ky, 10 + i * 4, 2 + i * 1.2, .04, 0, Math.PI * 2); x.stroke(); }
        return { map: texture(c), bump: texture(bump, false) };
      }
      function parchment() {
        const c = document.createElement('canvas'); c.width = 512; c.height = 576; const x = c.getContext('2d');
        x.fillStyle = '#eadbb7'; x.fillRect(0, 0, 512, 576);
        for (let i = 0; i < 1700; i++) { x.fillStyle = i % 3 ? 'rgba(87,59,25,.05)' : 'rgba(255,250,220,.17)'; x.fillRect((i * 137) % 512, (i * 193) % 576, 1 + i % 3, 1); }
        const wash = x.createLinearGradient(0, 0, 512, 576); wash.addColorStop(0, 'rgba(120,69,18,.21)'); wash.addColorStop(.2, 'rgba(186,135,58,0)'); wash.addColorStop(.8, 'rgba(186,135,58,0)'); wash.addColorStop(1, 'rgba(113,64,20,.24)'); x.fillStyle = wash; x.fillRect(0, 0, 512, 576);
        x.strokeStyle = '#9b7747'; x.lineWidth = 2; x.strokeRect(27, 27, 458, 522); x.strokeRect(34, 34, 444, 508);
        x.strokeStyle = '#655038'; x.lineWidth = 3; x.beginPath(); x.arc(258, 160, 63, 0, Math.PI * 2); x.stroke();
        x.beginPath(); x.moveTo(258, 82); x.lineTo(275, 160); x.lineTo(258, 239); x.lineTo(241, 160); x.closePath(); x.stroke();
        x.beginPath(); x.moveTo(179, 160); x.lineTo(258, 144); x.lineTo(337, 160); x.lineTo(258, 177); x.closePath(); x.stroke();
        x.lineWidth = 2; for (let i = 0; i < 7; i++) { x.beginPath(); x.moveTo(65, 292 + i * 26); x.lineTo(434 - (i % 3) * 34, 292 + i * 26); x.stroke(); }
        return texture(c);
      }
      function lidSegment(L, D, H, from, to, thickness = .025) {
        const p = [], uv = [], ix = [], steps = Math.max(2, Math.ceil((to - from) * 18));
        for (let i = 0; i <= steps; i++) {
          const a = mix(from, to, i / steps), ny = D / 2 * Math.sin(a), nz = -H * Math.cos(a), norm = Math.hypot(ny, nz), y = H * Math.sin(a), z = D / 2 * (1 - Math.cos(a));
          for (const inner of [false, true]) for (const x of [-L / 2, L / 2]) { p.push(x, y - (inner ? thickness * ny / norm : 0), z - (inner ? thickness * nz / norm : 0)); uv.push(x / L + .5, a / Math.PI); }
          if (i < steps) { const q = i * 4; ix.push(q, q + 4, q + 5, q, q + 5, q + 1, q + 2, q + 3, q + 7, q + 2, q + 7, q + 6, q, q + 2, q + 6, q, q + 6, q + 4, q + 1, q + 5, q + 7, q + 1, q + 7, q + 3); }
        }
        ix.push(0, 1, 3, 0, 3, 2); const e = steps * 4; ix.push(e, e + 2, e + 3, e, e + 3, e + 1);
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(ix); g.computeVertexNormals(); return g;
      }
      function coinGeo() {
        const base = new T.CylinderGeometry(.083, .083, .023, 24), rim = new T.TorusGeometry(.071, .0037, 5, 24), ring = new T.TorusGeometry(.015, .0028, 4, 14);
        return merged([piece(base), piece(rim, 0, .012, 0, [Math.PI / 2, 0, 0]), piece(ring, 0, .015, -.017, [Math.PI / 2, 0, 0]), piece(new T.BoxGeometry(.006, .005, .043), 0, .015, .009), piece(new T.TorusGeometry(.022, .0028, 4, 14, Math.PI), 0, .015, .010, [Math.PI / 2, 0, 0])]);
      }
      function gemGeo() {
        const profile = [[.0, -.07], [.10, -.02], [.105, .01], [.062, .065]], p = [], ix = [], N = 8;
        for (const [r, y] of profile) for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; p.push(Math.cos(a) * r, y, Math.sin(a) * r); }
        for (let j = 0; j < profile.length - 1; j++) for (let i = 0; i < N; i++) { const a = j * N + i, b = j * N + (i + 1) % N; ix.push(a, a + N, b, b, a + N, b + N); }
        for (let i = 1; i < N - 1; i++) ix.push(3 * N, 3 * N + i + 1, 3 * N + i);
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setIndex(ix); const flat = g.toNonIndexed(); g.dispose(); flat.computeVertexNormals(); return flat;
      }
      let animate;
      if (kind === 'chest') {
        const chest = new T.Group(); chest.name = 'Weathered hollow treasure chest'; chest.position.y = -.66; scene.add(chest);
        const grain = woodTextures(), wood = mat(0x81512d, { map: grain.map, bumpMap: grain.bump, bumpScale: .016, roughness: .69, envMapIntensity: .35 });
        const innerWood = mat(0x5c412c, { map: grain.map, roughness: .89 });
        const L = 1.76, D = 1.04, H = .64, timber = [], metal = [], dark = [];
        for (let i = 0; i < 4; i++) { const y = .10 + i * .147; for (const s of [-1, 1]) timber.push(piece(bevel(L, .142, .065), 0, y, s * D / 2)); for (const s of [-1, 1]) timber.push(piece(bevel(.065, .142, D - .10), s * (L / 2 - .032), y, 0)); }
        timber.push(piece(bevel(L - .12, .085, D - .08), 0, .030));
        for (const s of [-1, 1]) { timber.push(piece(bevel(L + .035, .045, .082, .008), 0, H, s * D / 2)); timber.push(piece(bevel(.084, .045, D), s * L / 2, H)); }
        mesh(merged(timber), wood, chest, 'Separate weathered wall planks and floor');
        const lining = mesh(bevel(L - .15, .028, D - .14, .008), innerWood, chest, 'Dark empty interior floor'); lining.position.y = .083;
        for (const x of [-.59, .59]) {
          for (const s of [-1, 1]) {
            metal.push(piece(bevel(.09, H + .065, .027, .009), x, H / 2, s * (D / 2 + .038)));
            for (const y of [.08, .27, .48, .61]) metal.push(piece(new T.SphereGeometry(.016, 8, 5), x, y, s * (D / 2 + .057), null, [1, 1, .5]));
          }
          metal.push(piece(bevel(.09, .035, D + .08, .008), x, .008));
          dark.push(piece(new T.CylinderGeometry(.031, .031, .155, 12), x, H + .012, -D / 2 - .015, [0, 0, Math.PI / 2]));
        }
        mesh(merged(metal), brass, chest, 'Aged brass straps and rivets'); mesh(merged(dark), darkMetal, chest, 'Two hinge barrels');
        const lock = new T.Group(); lock.name = 'Released brass lock'; lock.position.set(0, .42, D / 2 + .065); chest.add(lock);
        mesh(bevel(.18, .19, .055, .020), brass, lock); const keyhole = mesh(new T.CircleGeometry(.019, 16), darkMetal, lock); keyhole.position.set(0, .025, .029);
        const keyslot = mesh(new T.BoxGeometry(.015, .036, .004), darkMetal, lock); keyslot.position.set(0, .004, .031);
        const shackle = mesh(new T.TorusGeometry(.060, .009, 6, 20, Math.PI), brass, lock); shackle.position.y = .083;
        const lid = new T.Group(); lid.name = 'Arched lid with back hinge'; lid.position.set(0, H + .018, -D / 2); chest.add(lid);
        const staves = [], straps = [];
        for (let i = 0; i < 12; i++) staves.push(piece(lidSegment(L + .028, D, .34, i * Math.PI / 12 + .0035, (i + 1) * Math.PI / 12 - .0035)));
        const end = new T.Shape(); end.moveTo(-D / 2, 0); for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI; end.lineTo(-D / 2 + D / 2 * (1 - Math.cos(a)), .34 * Math.sin(a)); } end.closePath();
        for (const s of [-1, 1]) { const g = new T.ExtrudeGeometry(end, { depth: .031, bevelEnabled: false }); g.rotateY(Math.PI / 2); staves.push(piece(g, s * L / 2 - .015, 0, D / 2)); }
        mesh(merged(staves), wood, lid, 'Curved wooden lid staves and endcaps');
        for (const x of [-.59, .59]) { straps.push(piece(lidSegment(.096, D + .013, .348, 0, Math.PI, .016), x)); for (const a of [.20, .70, 1.25, 1.88, 2.42, 2.94]) straps.push(piece(new T.SphereGeometry(.014, 8, 5), x, .354 * Math.sin(a), D / 2 * (1 - Math.cos(a)), null, [1, .7, .7])); }
        straps.push(piece(bevel(.12, .22, .031, .009), 0, -.052, D + .013)); mesh(merged(straps), brass, lid, 'Curved lid straps and latch');
        const coin = coinGeo(); objects.add(coin); const pile = new T.InstancedMesh(coin, gold, 42); pile.name = 'Forty-two embossed gold coins'; pile.castShadow = true; pile.receiveShadow = true; chest.add(pile);
        const o = new T.Object3D();
        for (let i = 0; i < pile.count; i++) { const a = i * 2.39996, r = .20 + .30 * Math.sqrt(i / pile.count); o.position.set(Math.cos(a) * r * 1.38, .38 + i % 4 * .046, Math.sin(a) * r * .65); o.rotation.set(Math.sin(i * 1.7) * .22, a, Math.cos(i * 2.1) * .15); o.scale.setScalar(.88 + (i % 5) * .065); o.updateMatrix(); pile.setMatrixAt(i, o.matrix); }
        const heroes = []; for (let i = 0; i < 3; i++) { const c = mesh(coin, gold, chest, 'Settling gold coin'); c.position.set(-.28 + i * .26, .58, .03 + i * .05); c.rotation.z = .22 + i * .09; heroes.push(c); }
        const gem = gemGeo(); objects.add(gem);
        for (const [i, color] of [0x790e22, 0x075f37, 0x123f8b].entries()) { const jewels = new T.InstancedMesh(gem, mat(color, { roughness: .20, metalness: .06, clearcoat: .72, clearcoatRoughness: .13, envMapIntensity: .38 }, true), 3); jewels.name = 'Cut gemstones resting in the treasure'; jewels.castShadow = true; chest.add(jewels); for (let j = 0; j < 3; j++) { o.position.set(-.52 + j * .45 + i * .05, .54 + (j % 2) * .045, -.25 + i * .20); o.rotation.set(.10 * i, i + j, .18 * Math.sin(i + j)); o.scale.setScalar(.75 + .12 * j); o.updateMatrix(); jewels.setMatrixAt(j, o.matrix); } }
        const warm = new T.PointLight(0xffd899, 0, 2.2, 2); warm.position.set(0, .72, .10); chest.add(warm);
        scene.userData.reveal = { kind, chest, lid, lock, pile, heroes, hollow: true, hinge: [0, H + .018, -D / 2] };
        animate = t => {
          const unlock = stage(t, .40, .88), opening = stage(t, .76, 2.30), idle = 1 - stage(t, 3.85, 4.8);
          lock.rotation.z = -.21 * unlock; lock.position.y = .42 - .045 * unlock;
          lid.rotation.x = -1.27 * opening + Math.sin(Math.max(0, t - 2.3) * 5) * .015 * opening * Math.exp(-Math.max(0, t - 2.3) * 3);
          chest.rotation.y = -.14 + .055 * stage(t, 1.2, 2.8) + Math.sin(t * .75) * .012 * idle;
          for (let i = 0; i < heroes.length; i++) { const u = stage(t, 1.9 + i * .1, 3.0 + i * .1); heroes[i].position.y = .58 + Math.sin(Math.PI * u) * .035; heroes[i].rotation.z = .22 + i * .09 + Math.sin(Math.PI * u) * .10; }
          warm.intensity = .18 * opening;
          const targetY = .025, visibleHeight = Math.max(2.44, 2.55 / camera.aspect), distance = visibleHeight / (2 * Math.tan(16 * Math.PI / 180)); camera.position.set(distance * .37, targetY + distance * .43, distance * .83); camera.lookAt(0, targetY, 0);
        };
      } else {
        const bottleMode = kind === 'bottle';
        const paperRig = new T.Group(); paperRig.name = 'Letter reveal rig';
        let bottle = null, cork = null, corkLaunch = null, twine = null;
        if (bottleMode) {
          bottle = new T.Group(); bottle.name = 'Curved hollow glass bottle'; bottle.position.set(-.65, -.70, -.02); bottle.rotation.z = -.12; scene.add(bottle); bottle.add(paperRig);
          const profile = [[0, .025], [.16, .025], [.245, .055], [.283, .14], [.300, .30], [.298, .73], [.26, .85], [.17, .95], [.105, 1.055], [.095, 1.24], [.13, 1.255], [.14, 1.285], [.14, 1.314], [.092, 1.324], [.078, 1.30], [.073, 1.245], [.073, 1.085], [.14, .969], [.232, .845], [.263, .725], [.263, .19], [.225, .12], [.16, .09], [0, .09]];
          const curve = new T.CatmullRomCurve3(profile.map(([r, y]) => new T.Vector3(r, y, 0)), false, 'centripetal');
          const points = curve.getPoints(160).map(p => new T.Vector2(Math.max(0, p.x), p.y));
          const glass = mat(0xa6cdb5, { roughness: .065, metalness: 0, transmission: .70, thickness: .085, attenuationColor: 0x4b9568, attenuationDistance: 1.2, ior: 1.50, clearcoat: .80, clearcoatRoughness: .055, envMapIntensity: .80, transparent: true, opacity: 1, side: T.DoubleSide, depthWrite: false }, true);
          const body = mesh(new T.LatheGeometry(points, 64), glass, bottle, 'Thick-walled curved bottle with open neck'); body.castShadow = false;
          const lip = mesh(new T.TorusGeometry(.114, .018, 10, 48), glass, bottle, 'Rolled glass mouth'); lip.rotation.x = Math.PI / 2; lip.position.y = 1.311; lip.castShadow = false;
          const heel = mesh(new T.TorusGeometry(.263, .013, 8, 48), glass, bottle, 'Thick glass heel'); heel.rotation.x = Math.PI / 2; heel.position.y = .10; heel.castShadow = false;
          const corkCanvas = document.createElement('canvas'); corkCanvas.width = corkCanvas.height = 128; const cx = corkCanvas.getContext('2d'); cx.fillStyle = '#aa8856'; cx.fillRect(0, 0, 128, 128); for (let i = 0; i < 550; i++) { cx.fillStyle = i % 4 ? '#80613e' : '#d2b785'; cx.fillRect(i * 31 % 128, i * 79 % 128, 1 + i % 3, 1); }
          cork = mesh(new T.CylinderGeometry(.084, .081, .18, 32), mat(0xd2b183, { map: texture(corkCanvas), roughness: .87 }), scene, 'Released cork resting beside bottle');
          bottle.updateMatrixWorld(true); corkLaunch = bottle.localToWorld(new T.Vector3(0, 1.72, .02));
          const cord = mat(0xbda67e, { roughness: .95 }), ropes = [];
          for (let i = 0; i < 3; i++) ropes.push(piece(new T.TorusGeometry(.055, .0028, 5, 36), 0, -.08 + i * .016, 0, [Math.PI / 2, 0, 0]));
          twine = mesh(merged(ropes), cord, paperRig, 'Twine around the rolled letter');
        } else scene.add(paperRig);
        const W = 1.22, H = 1.08, R = .049;
        const paper = mesh(new T.PlaneGeometry(W, H, 80, 34), mat(0xffffff, { map: parchment(), side: T.DoubleSide, roughness: .89 }), paperRig, 'Letter unrolling from an actual narrow coil');
        const a = paper.geometry.attributes.position, rest = a.array.slice();
        const seal = new T.Group(); seal.name = 'Embossed wax seal on letter'; paperRig.add(seal);
        const wax = mat(0x8f3528, { roughness: .46, clearcoat: .35 }, true);
        const waxDisc = mesh(new T.CylinderGeometry(.080, .077, .023, 32), wax, seal); waxDisc.rotation.x = Math.PI / 2;
        mesh(new T.TorusGeometry(.055, .004, 6, 28), brass, seal).position.z = .014;
        const stamp = mesh(new T.SphereGeometry(.016, 12, 8), wax, seal); stamp.position.set(0, .010, .016); stamp.scale.z = .25;
        const ribbon = mesh(bevel(.047, .13, .006, .003), wax, seal); ribbon.position.set(.01, -.108, -.006); ribbon.rotation.z = -.18;
        scene.userData.reveal = { kind, bottle, paperRig, paper, cork, seal, letterSize: [W, H], coilRadius: R, neckRadius: .073, mouthY: 1.324 };
        animate = t => {
          const extraction = bottleMode ? stage(t, .82, 1.82) : 1, unfurl = stage(t, bottleMode ? 1.98 : .30, bottleMode ? 3.14 : 1.8), travel = bottleMode ? stage(t, 1.84, 2.90) : 1, idle = 1 - stage(t, 3.90, 4.8);
          if (bottleMode) {
            bottle.rotation.z = -.12 - .035 * travel + Math.sin(t * .9) * .009 * idle;
            paperRig.position.set(1.17 * travel, mix(mix(.67, 1.97, extraction), 1.065, travel), .035 * travel);
            paperRig.rotation.set(0, .14 * travel, -bottle.rotation.z * travel);
            if (t <= 1.0) { bottle.updateMatrixWorld(true); cork.position.copy(bottle.localToWorld(new T.Vector3(0, 1.375 + .345 * stage(t, .34, .91), .02))); cork.rotation.set(0, .12, bottle.rotation.z - .20 * stage(t, .34, .91)); }
            else {
              const u = clamp((t - 1) / 1.15, 0, 1), tau = u * 1.15, targetY = -.64, initialVelocity = (targetY - corkLaunch.y + .5 * 3.8 * 1.15 * 1.15) / 1.15;
              cork.position.set(mix(corkLaunch.x, -1.17, u), corkLaunch.y + initialVelocity * tau - 1.9 * tau * tau, mix(corkLaunch.z, .22, u));
              const settle = Math.max(0, t - 2.15); if (u === 1) cork.position.y = targetY + .033 * Math.abs(Math.sin(settle * 10)) * Math.exp(-settle * 6);
              cork.rotation.set(.14 * u, .22 + u * .18, mix(-.30, Math.PI / 2 + .12, smooth(u)));
            }
          } else { paperRig.position.set(0, .16, .08); paperRig.rotation.set(0, .06, .025 * Math.sin(t) * idle); }
          if (twine) { twine.visible = unfurl < .08; twine.scale.setScalar(1 + .3 * unfurl); }
          const released = W * unfurl;
          for (let i = 0; i < a.count; i++) {
            const s = rest[i * 3] + W / 2, y = rest[i * 3 + 1], radius = R + .003 * (1 - s / W), edge = Math.pow(Math.abs(y) / (H / 2), 8);
            let x, z;
            if (s <= released) { x = -released / 2 + s; z = -R * (1 - unfurl) + .008 * Math.sin(x * 4.5) * unfurl; }
            else { const angle = (s - released) / radius; x = released / 2 + Math.sin(angle) * radius; z = R * unfurl - Math.cos(angle) * radius; }
            a.setXYZ(i, x, y + .005 * Math.sin(s * 31) * edge, z + .003 * Math.sin(y * 7 + t * 1.7) * unfurl * idle);
          }
          a.needsUpdate = true; paper.geometry.computeVertexNormals(); paper.geometry.computeBoundingSphere();
          seal.visible = unfurl > .76; seal.position.set(.34, -.355, .026); seal.scale.setScalar(stage(unfurl, .76, .96));
          const pulse = bottleMode ? stage(t, .55, 1.55) * (1 - stage(t, 1.95, 3.0)) : 0;
          const targetY = .14 + .43 * pulse, visibleHeight = Math.max(mix(1.91, 2.88, pulse), 2.98 / camera.aspect), distance = visibleHeight / (2 * Math.tan(16 * Math.PI / 180));
          camera.position.set(distance * .19, targetY + distance * .17, distance * .97); camera.lookAt(.04, targetY, 0);
        };
      }
      function size(draw = true) {
        if (destroyed || !host) return;
        const hostWidth = host.clientWidth || 340, hostHeight = host.clientHeight || 210;
        const key = hostWidth + ':' + hostHeight;
        if (key === previousSize) return;
        previousSize = key;
        const renderScale = Math.min(1, 420 / hostWidth, 280 / hostHeight);
        const w = Math.max(1, Math.round(hostWidth * renderScale)), h = Math.max(1, Math.round(hostHeight * renderScale));
        r.setSize(w, h, false); camera.aspect = hostWidth / hostHeight;
        if (draw) { animate(reduced() ? DURATION / 1000 : elapsed / 1000); camera.updateProjectionMatrix(); r.render(scene, camera); }
      }
      function render(now) {
        if (destroyed || !controller || document.visibilityState === 'hidden') return;
        // The phone reveal targets 60 Hz on 60/90/120 Hz displays. Advance a
        // stable deadline instead of resetting it to each late RAF; skip missed
        // slots rather than replaying them in a catch-up burst. The timeline
        // always uses real elapsed time, independently of the drawing cadence.
        const interval = 1000 / 60, tolerance = .4;
        if (!mobile || nextDraw === null || now + tolerance >= nextDraw || now - started >= DURATION) {
          elapsed = reduced() ? DURATION : clamp(now - started, 0, DURATION);
          if (mobile) nextDraw = nextDraw === null ? now + interval : nextDraw + Math.max(1, Math.floor((now + tolerance - nextDraw) / interval) + 1) * interval;
          animate(elapsed / 1000); camera.updateProjectionMatrix(); r.render(scene, camera);
        }
        if (elapsed < DURATION) frame = requestAnimationFrame(render);
      }
      draw = render;
      function attach(nextHost) {
        if (destroyed) return null;
        host = nextHost; elapsed = 0; started = performance.now(); nextDraw = null; previousSize = '';
        let disposed = false, finalElapsed = 0;
        const session = {
          dispose() { if (disposed) return; disposed = true; finalElapsed = elapsed; if (controller === session) detach(); },
          stats: () => ({ kind, elapsed: disposed ? finalElapsed : elapsed, duration: DURATION, disposed })
        };
        controller = active = session;
        host.appendChild(r.domElement); host.classList.add('has-3d'); size(false);
        if (window.ResizeObserver) { resize = new window.ResizeObserver(() => size()); resize.observe(host); }
        document.addEventListener('visibilitychange', visibility); render(started); return session;
      }
      return {
        attach, destroy,
        prepare() {
          if (prepared || destroyed) return;
          r.setSize(340, 210, false); camera.aspect = 340 / 210;
          for (const t of [0, DURATION / 1000]) { animate(t); camera.updateProjectionMatrix(); r.render(scene, camera); }
          prepared = true;
        }
      };
    } catch (error) { destroy(); throw error; }
  }
  return { mount, prepare, stop };
})();
