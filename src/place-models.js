// Distinct maritime landmarks for the sixteen places without a supplied GLB.
// Terrain stays fixed. Crowns, cloth, machinery, boats and lights are separate
// real 3D parts, driven by the board clock and bounded shared instance pools.
const PlaceModels3D = (() => {
  const T = window.THREE;
  if (!T) return null;
  const indices = [6, 8, 11, 13, 14, 16, 18, 19, 21, 23, 24, 26, 27, 29, 32, 34];
  const LS = [1.18, 1.25, 1.12], TAU = Math.PI * 2;
  const C = { wood: 0x906645, darkWood: 0x553c2c, plank: 0xc29a67, rope: 0xd3bc85, stone: 0xb8ac97, darkStone: 0x72736b,
    cream: 0xeee4ca, roof: 0xa46141, slate: 0x505b60, dark: 0x273339, iron: 0x46525a, gold: 0xf0c15b, leaf: 0x65a34b, leafDark: 0x3c7850,
    sand: 0xe3ca98, red: 0xa94e43, pink: 0xdbb2a5, blue: 0x83b8c4, yellow: 0xe2cb87 };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const matrix = (x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(sx, sy, sz));
  const box = (w, h, d) => new T.BoxGeometry(w, h, d);
  const cylinder = (r, h, top = r, seg = 10) => new T.CylinderGeometry(top, r, h, seg);
  const sphere = (r = 1, detail = 1) => new T.IcosahedronGeometry(r, detail);
  function mergeBuilder() {
    const p = [], n = [], c = [], col = new T.Color();
    return { add(g, hex, m, variation = .035) {
      if (m) g.applyMatrix4(m);
      const flat = g.index ? g.toNonIndexed() : g;
      if (!flat.attributes.normal) flat.computeVertexNormals();
      const pos = flat.attributes.position.array, nor = flat.attributes.normal.array;
      col.setHex(hex);
      for (let k = 0; k < pos.length; k++) { p.push(pos[k]); n.push(nor[k]); }
      for (let k = 0; k < pos.length / 3; k++) {
        const face = Math.floor(k / 3), shade = 1 + Math.sin(face * 2.471 + p.length * .013) * variation;
        c.push(col.r * shade, col.g * shade, col.b * shade);
      }
      if (flat !== g) flat.dispose(); g.dispose();
    }, finish() {
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(n, 3)); g.setAttribute('color', new T.Float32BufferAttribute(c, 3));
      g.computeBoundingBox(); g.computeBoundingSphere(); return g;
    }, get count() { return p.length / 3; } };
  }
  function roof(w, d, h) {
    const s = new T.Shape(); s.moveTo(-w / 2, 0); s.lineTo(0, h); s.lineTo(w / 2, 0); s.closePath();
    return new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, -d / 2);
  }
  function arch(w, h, d) {
    const s = new T.Shape(), a = w / 2, inner = a * .61;
    s.moveTo(-a, 0); s.lineTo(-a, h * .5); s.quadraticCurveTo(-a, h, 0, h); s.quadraticCurveTo(a, h, a, h * .5); s.lineTo(a, 0);
    s.lineTo(inner, 0); s.lineTo(inner, h * .5); s.quadraticCurveTo(inner, h * .77, 0, h * .77); s.quadraticCurveTo(-inner, h * .77, -inner, h * .5); s.lineTo(-inner, 0); s.closePath();
    return new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSegments: 1, bevelSize: .002, bevelThickness: .002, curveSegments: 5 }).translate(0, 0, -d / 2);
  }
  function rod(a, b, radius = .0025) {
    const A = new T.Vector3(...a), B = new T.Vector3(...b), v = B.clone().sub(A), mid = A.clone().add(B).multiplyScalar(.5);
    const g = cylinder(radius, v.length(), radius, 6); g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize())); return g.translate(mid.x, mid.y, mid.z);
  }
  function palmCrown() {
    const b = mergeBuilder();
    for (let k = 0; k < 9; k++) {
      const a = k / 9 * TAU, p = [], ix = [], len = .105 + (k % 3) * .014;
      for (let j = 0; j <= 7; j++) {
        const t = j / 7, width = Math.max(.0008, .018 * Math.sin(Math.PI * t) * (1 - .25 * t)), x = len * t, y = .022 * Math.sin(Math.PI * t) - .047 * t * t;
        for (const side of [-1, 1]) p.push(x, y, width * side);
      }
      for (let j = 0; j < 7; j++) { const i = j * 2; ix.push(i, i + 2, i + 1, i + 1, i + 2, i + 3); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setIndex(ix); g.computeVertexNormals();
      b.add(g, k % 3 ? C.leaf : C.leafDark, matrix(0, 0, 0, 1, 1, 1, 0, a, 0));
      b.add(rod([0, 0, 0], [len * .7, .008, 0], .0017), 0x85ad58, matrix(0, 0, 0, 1, 1, 1, 0, a, 0));
    }
    for (let k = 0; k < 3; k++) b.add(sphere(.008), 0x8b713f, matrix(Math.cos(k * 2) * .008, -.007, Math.sin(k * 2) * .008));
    return b.finish();
  }
  function oakCrown() {
    const b = mergeBuilder();
    for (let k = 0; k < 7; k++) b.add(sphere(1, 1), k % 2 ? C.leaf : C.leafDark, matrix(Math.cos(k * 2.4) * .056, .035 + (k % 3) * .020, Math.sin(k * 2.4) * .053, .067, .066, .061));
    return b.finish();
  }
  function pineCrown() {
    const b = mergeBuilder();
    for (let k = 0; k < 4; k++) b.add(new T.ConeGeometry(.068 - k * .013, .115, 9), k % 2 ? 0x52845e : 0x326b53, matrix(0, .025 + k * .054, 0));
    return b.finish();
  }
  function cloth(width, height, tent = false) {
    const g = new T.PlaneGeometry(width, height, 7, 4), p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k) / width + .5, y = p.getY(k) / height + .5;
      if (tent) p.setXYZ(k, p.getX(k), .09 * (1 - Math.abs(x * 2 - 1)), (y - .5) * .13);
      else p.setXYZ(k, x * width, p.getY(k), .006 * Math.sin(x * Math.PI) * Math.sin(y * Math.PI));
    }
    g.computeVertexNormals(); g.userData.cloth = Float32Array.from(p.array); g.userData.width = width; g.userData.tent = tent; return g;
  }
  function flagGlyph() {
    const b = mergeBuilder(); b.add(sphere(1, 1), C.cream, matrix(.026, .006, .004, .007, .006, .0015));
    b.add(box(.009, .003, .002), C.cream, matrix(.026, .001, .004));
    for (const r of [-.6, .6]) b.add(box(.019, .0018, .001), C.cream, matrix(.026, -.006, .004, 1, 1, 1, 0, 0, r));
    const g = b.finish(); g.userData.cloth = Float32Array.from(g.attributes.position.array); g.userData.width = .065; return g;
  }
  function rotor() {
    const b = mergeBuilder(); b.add(cylinder(.012, .018, .012, 12), C.iron, matrix(0, 0, 0, 1, 1, 1, Math.PI / 2));
    for (let k = 0; k < 4; k++) {
      const m = matrix(0, 0, 0, 1, 1, 1, 0, 0, k * Math.PI / 2);
      b.add(box(.008, .15, .007), C.darkWood, m.clone().multiply(matrix(0, .079, 0)));
      b.add(box(.043, .086, .003), C.cream, m.clone().multiply(matrix(.010, .101, .002)));
      for (let j = 0; j < 5; j++) b.add(box(.048, .003, .007), C.wood, m.clone().multiply(matrix(.009, .065 + j * .017, .004)));
    }
    return b.finish();
  }
  function shipGeometry(wreck = false, galley = false) {
    const b = mergeBuilder(), shape = new T.Shape(); shape.moveTo(-.15, -.045); shape.lineTo(.045, -.047); shape.quadraticCurveTo(.15, -.04, .18, 0); shape.quadraticCurveTo(.15, .04, .045, .047); shape.lineTo(-.15, .04); shape.closePath();
    const hull = new T.ExtrudeGeometry(shape, { depth: .057, bevelEnabled: true, bevelSegments: 1, bevelSize: .004, bevelThickness: .004, curveSegments: 5 }).rotateX(-Math.PI / 2).translate(0, -.038, 0);
    b.add(hull, wreck ? 0x796044 : C.darkWood);
    for (let k = 0; k < 9; k++) b.add(box(.029, .006, .075), C.plank, matrix(-.132 + k * .032, .023, 0));
    for (const z of [-.044, .044]) {
      b.add(box(.28, .009, .005), C.wood, matrix(-.004, .039, z));
      for (let k = 0; k < 6; k++) b.add(box(.004, .035, .004), C.plank, matrix(-.13 + k * .048, .027, z));
    }
    if (wreck) {
      for (let k = 0; k < 6; k++) b.add(arch(.08, .055, .006), 0xbca57a, matrix(-.11 + k * .047, -.007, 0, 1, 1, 1, 0, Math.PI / 2));
      b.add(rod([-.02, .03, 0], [.12, .16, .035], .004), C.darkWood);
    } else {
      b.add(rod([.02, .027, 0], [.02, .285, 0], .0038), C.darkWood);
      b.add(rod([-.09, .028, -.04], [.02, .264, 0], .0012), C.rope);
      b.add(rod([-.09, .028, .04], [.02, .264, 0], .0012), C.rope);
      b.add(rod([.15, .035, 0], [.02, .245, 0], .0012), C.rope);
      b.add(box(.13, .005, .005), C.wood, matrix(.02, .219, 0, 1, 1, 1, 0, Math.PI / 2));
      if (galley) for (let k = 0; k < 5; k++) for (const side of [-1, 1]) b.add(rod([-.11 + k * .04, .026, side * .042], [-.135 + k * .04, -.007, side * .081], .0018), C.plank);
      b.add(box(.063, .034, .069), C.wood, matrix(-.113, .039, 0));
      b.add(box(.006, .009, .006), C.gold, matrix(-.143, .063, .03));
    }
    return b.finish();
  }

  function create(opts) {
    if (!opts || !opts.parent) return null;
    const parent = opts.parent, root = new T.Group(); root.name = 'Animated maritime place landmarks'; parent.add(root);
    const own = new Set(), records = new Map(), pools = new Map(), dimMaterials = new Map(), clothMaterials = new Map();
    const clothTime = { value: 0 };
    let dead = false, current = 0, last = null, triggers = 0;
    const matte = new T.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: .015, side: T.DoubleSide });
    const metal = new T.MeshStandardMaterial({ vertexColors: true, roughness: .36, metalness: .66 });
    const fabric = new T.MeshStandardMaterial({ color: 0xffffff, roughness: .90, metalness: 0, side: T.DoubleSide });
    const green = new T.MeshStandardMaterial({ vertexColors: true, roughness: .76, metalness: 0, side: T.DoubleSide });
    const warm = new T.MeshStandardMaterial({ color: 0xffcd6c, emissive: 0xffaa35, emissiveIntensity: .55, roughness: .26 });
    const smokeMat = new T.MeshStandardMaterial({ color: 0xb3bdba, roughness: 1, transparent: true, opacity: .19, depthWrite: false });
    const gold = new T.MeshStandardMaterial({ color: C.gold, metalness: .72, roughness: .25, emissive: 0x50300d, emissiveIntensity: .18 });
    const waterMat = new T.MeshStandardMaterial({ color: 0x99e0dc, roughness: .18, metalness: .04, transparent: true, opacity: .72, depthWrite: false });
    const reactionMat = new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0x8b7043, emissiveIntensity: .20, transparent: true, opacity: .72, depthWrite: false, roughness: .36 });
    [matte, metal, fabric, green, warm, smokeMat, gold, waterMat, reactionMat].forEach(m => own.add(m));
    function clothMaterial(base) {
      if (clothMaterials.has(base)) return clothMaterials.get(base);
      const material = base.clone(); own.add(material); clothMaterials.set(base, material);
      // The same pinned-edge wave now runs on the GPU. Its exact derivatives
      // transform the rest normal, so cloth lighting follows the moving surface
      // without rebuilding normal and position buffers on every phone frame.
      material.onBeforeCompile = shader => {
        shader.uniforms.uPlaceClothTime = clothTime;
        shader.vertexShader = `uniform float uPlaceClothTime;
          attribute vec2 aPlaceCloth;
          vec3 placeClothWave(vec3 p) {
            float phase = uPlaceClothTime * 2.1 + p.x * 49.0 + p.y * 18.0;
            float wave = .0045 * sin(phase), slope = .0045 * cos(phase);
            return vec3(aPlaceCloth.x * wave,
              aPlaceCloth.y * wave + aPlaceCloth.x * 49.0 * slope,
              aPlaceCloth.x * 18.0 * slope);
          }\n` + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
          vec3 clothWave = placeClothWave(position);
          objectNormal.xy -= clothWave.yz * objectNormal.z;`);
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.z += clothWave.x;');
      };
      material.customProgramCacheKey = () => 'place-cloth-wave-v1';
      return material;
    }
    const pool = (key, factory, material) => {
      if (!pools.has(key)) {
        const geometry = factory(); own.add(geometry);
        if (geometry.userData.cloth) {
          const pos = geometry.attributes.position, width = geometry.userData.width, tent = geometry.userData.tent, coefficients = [];
          for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            coefficients.push(tent ? Math.abs(x / width) : clamp(x / width, 0, 1), tent ? Math.sign(x) / width : x >= 0 && x <= width ? 1 / width : 0);
          }
          geometry.setAttribute('aPlaceCloth', new T.Float32BufferAttribute(coefficients, 2));
          material = clothMaterial(material);
        }
        pools.set(key, { key, geometry, material, entries: [], mesh: null, reaction: key === 'arrival-rings' || key === 'reward-coins' });
      }
      return pools.get(key);
    };
    const dynamic = (rec, key, factory, material, base, local = new T.Matrix4(), motion = 'wind', color = 0xffffff, phase = 0, amount = 1) => {
      const p = pool(key, factory, material), entry = { rec, base: base.clone(), local: local.clone(), anchored: base.clone().multiply(local), motion, phase: phase + rec.i * .47, amount, color: new T.Color(color), index: p.entries.length, drawIndex: -1 };
      p.entries.push(entry); rec.parts.push({ pool: p, entry }); return entry;
    };
    function anchor(rec, x, z, height = 0, ry = 0, s = 1, afloat = false) {
      const p = rec.frame.at(x, z, height); if (afloat) p.y = typeof Terrain !== 'undefined' ? Terrain.SEA_Y : .02;
      return new T.Matrix4().compose(p, new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), (rec.frame.yaw || 0) + ry), new T.Vector3(LS[0] * s, LS[1] * s, LS[2] * s));
    }
    function kit(rec, x, z, ry = 0, s = 1, afloat = false) {
      const base = anchor(rec, x, z, 0, ry, s, afloat);
      return { base, add(g, color, px = 0, py = 0, pz = 0, rx = 0, rz = 0, metallic = false) {
        (metallic ? rec.metals : rec.static).add(g, color, base.clone().multiply(matrix(px, py, pz, 1, 1, 1, rx, 0, rz)));
      } };
    }
    function house(rec, x, z, w = .12, h = .11, d = .10, wall = C.cream, top = C.roof, porch = false) {
      const k = kit(rec, x, z); k.add(box(w + .01, .016, d + .01), C.stone, 0, .008);
      k.add(box(w, h, d), wall, 0, h / 2 + .012); k.add(roof(w + .027, d + .024, h * .48), top, 0, h + .012);
      k.add(box(.027, h * .6, .006), C.darkWood, 0, h * .32 + .012, d / 2 + .004);
      for (const side of [-1, 1]) { k.add(box(.028, .033, .006), C.darkWood, side * w * .30, h * .64, d / 2 + .005); k.add(box(.020, .025, .007), 0xe1c583, side * w * .30, h * .64, d / 2 + .006); }
      for (let j = 0; j < 6; j++) {
        const px = -w / 2 + (j + .5) * w / 6, y = h + .014 + h * .48 * (1 - Math.abs(px / (w * .56)));
        k.add(box(.005, .004, d + .025), j % 2 ? top : 0xc19b75, px, y);
      }
      if (porch) {
        k.add(box(w + .04, .012, .058), C.plank, 0, .014, d / 2 + .033);
        for (const side of [-1, 1]) k.add(cylinder(.0036, h * .77, .0036, 8), C.cream, side * (w / 2 + .008), h * .4, d / 2 + .05);
        k.add(box(w + .041, .010, .065), top, 0, h * .8, d / 2 + .03, -.12);
      }
      return k;
    }
    function flag(rec, base, x, y, z, color = C.red, boat = false) {
      rec.static.add(cylinder(.0024, .11, .0024, 7), C.darkWood, base.clone().multiply(matrix(x, y + .055, z)));
      const local = matrix(x + .003, y + .086, z);
      dynamic(rec, 'flags', () => cloth(.065, .041), fabric, base, local, boat ? 'boat' : 'pennant', color);
      dynamic(rec, 'flag-glyph', flagGlyph, matte, base, local, boat ? 'boat' : 'pennant');
    }
    function palm(rec, x, z, scale = 1) {
      const k = kit(rec, x, z, x * 1.5, scale), h = .26, lean = .024;
      for (let j = 0; j < 7; j++) {
        const t0 = j / 7, t1 = (j + 1) / 7;
        k.add(rod([lean * t0 * t0, h * t0, 0], [lean * t1 * t1, h * t1, 0], .008 - j * .0005), j % 2 ? C.wood : C.plank);
      }
      dynamic(rec, 'palms', palmCrown, green, k.base, matrix(lean, h, 0), 'crown', 0xffffff, x + z, scale);
    }
    function tree(rec, x, z, scale = 1, pine = false) {
      const k = kit(rec, x, z, x * 2, scale); k.add(cylinder(.010, .16, .006, 8), C.darkWood, 0, .08);
      for (const side of [-1, 1]) k.add(rod([0, .10, 0], [side * .045, .185, .006], .004), C.wood);
      dynamic(rec, pine ? 'pines' : 'oaks', pine ? pineCrown : oakCrown, green, k.base, matrix(0, pine ? .09 : .16, 0), 'crown', 0xffffff, x * 7, pine ? .6 : .35);
    }
    function fort(rec, x, z, w = .24, d = .19, h = .13, color = C.stone) {
      const k = kit(rec, x, z), wall = .024;
      k.add(box(w + .019, .018, d + .019), C.darkStone, 0, .009);
      k.add(box(w, h, wall), color, 0, h / 2, -d / 2);
      for (const side of [-1, 1]) { k.add(box(wall, h, d), color, side * w / 2, h / 2); k.add(box(w * .33, h, wall), color, side * w * .335, h / 2, d / 2); }
      k.add(arch(w * .31, h * .89, wall), color, 0, .004, d / 2);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        k.add(cylinder(.026, h + .062, .024, 10), color, sx * w / 2, (h + .062) / 2, sz * d / 2);
        for (let q = 0; q < 5; q++) k.add(box(.012, .017, .012), color, sx * w / 2 + Math.cos(q / 5 * TAU) * .020, h + .064, sz * d / 2 + Math.sin(q / 5 * TAU) * .020);
      }
      for (let j = 0; j < 7; j++) { const px = -w / 2 + j * w / 6; k.add(box(.013, .021, wall), color, px, h + .006, -d / 2); }
      for (let j = 0; j < 3; j++) k.add(box(w * .83, .0023, .0017), 0x8c897b, 0, .028 + j * .027, d / 2 + .012);
      flag(rec, k.base, -w * .31, h + .057, -d * .27);
      return k;
    }
    function tower(rec, x, z, height = .31, color = C.stone, spire = false) {
      const k = kit(rec, x, z); k.add(box(.125, .018, .115), C.darkStone, 0, .009); k.add(box(.10, height, .088), color, 0, height / 2);
      for (let j = 0; j < 3; j++) for (const side of [-1, 1]) k.add(box(.013, .031, .004), C.dark, side * .027, .069 + j * .080, .046);
      k.add(arch(.038, .062, .007), C.darkStone, 0, 0, .047); k.add(box(.020, .046, .003), C.darkWood, 0, .023, .049);
      if (spire) k.add(roof(.13, .12, .058), C.slate, 0, height); else for (const side of [-1, 1]) for (let j = 0; j < 3; j++) k.add(box(.018, .025, .018), color, side * .041, height + .009, -.039 + j * .039);
      for (let j = 0; j < 5; j++) k.add(box(.103, .002, .002), 0x939186, 0, .042 + j * .052, .045);
      flag(rec, k.base, .03, height + (spire ? .06 : .02), -.025, 0x6596a6); return k;
    }
    function cargo(rec, x, z) {
      const k = kit(rec, x, z); k.add(cylinder(.023, .059, .021, 10), C.wood, -.027, .030);
      for (const y of [.012, .045]) k.add(cylinder(.024, .005, .024, 10), C.iron, -.027, y, 0, 0, 0, true);
      k.add(box(.05, .048, .047), C.plank, .029, .024, -.004);
      for (const r of [-.68, .68]) k.add(box(.065, .005, .003), C.darkWood, .029, .024, .022, 0, r);
    }
    function pier(rec, x, z, len = .17) {
      const k = kit(rec, x, z, 0, 1, true); k.add(box(.085, .012, len), C.darkWood, 0, .023, len / 2);
      for (let j = 0; j < 10; j++) k.add(box(.088, .007, len / 10 - .002), j % 2 ? C.plank : C.wood, 0, .031, (j + .5) * len / 10);
      for (const side of [-1, 1]) for (let j = 0; j < 3; j++) k.add(cylinder(.0044, .09, .0044, 7), C.darkWood, side * .043, .009, j * len / 2);
      lamp(rec, k.base, .047, .064, len * .9); return k;
    }
    function lamp(rec, base, x, y, z) {
      rec.static.add(box(.013, .005, .015), C.iron, base.clone().multiply(matrix(x, y + .014, z)));
      dynamic(rec, 'lanterns', () => new T.SphereGeometry(.008, 10, 7), warm, base, matrix(x, y, z), 'lamp');
    }
    function cannon(rec, x, z, ry = 0) {
      const k = kit(rec, x, z, ry); k.add(box(.060, .019, .035), C.darkWood, 0, .010);
      for (const side of [-1, 1]) for (const xx of [-.018, .018]) k.add(cylinder(.010, .008, .010, 9), C.wood, xx, .011, side * .021, Math.PI / 2);
      k.add(cylinder(.008, .075, .007, 12), C.iron, .004, .030, 0, 0, -Math.PI / 2 + .13, true);
      k.add(cylinder(.006, .001, .006, 12), C.dark, .041, .034, 0, 0, Math.PI / 2, true);
    }
    function fire(rec, x, z, height = 0, smoky = true) {
      const k = kit(rec, x, z);
      for (const r of [-.7, .7]) k.add(box(.057, .008, .013), C.darkWood, 0, .004 + height, 0, 0, r);
      for (let j = 0; j < 3; j++) dynamic(rec, 'flames', () => new T.ConeGeometry(.010, .035, 7), warm, k.base, matrix((j - 1) * .009, .020 + height, 0), 'flame', j % 2 ? 0xffe095 : 0xff943d, j);
      if (smoky) for (let j = 0; j < 4; j++) dynamic(rec, 'smoke', () => sphere(.014, 1), smokeMat, k.base, matrix(0, .058 + height, 0), 'smoke', 0xffffff, j / 4 * TAU, .12);
    }
    function rock(rec, x, z, rx = .070, hy = .11, rz = .065, color = C.stone) {
      rec.static.add(sphere(1, 2), color, anchor(rec, x, z).multiply(matrix(0, hy * .75, 0, rx, hy, rz, .08, x * 5, -.08)));
    }
    function retainingFoundation(rec, x, z) {
      // Tortuga's original mesa is much narrower than its new fort. The upper
      // stepped footing spreads every wall onto stone; its lower skirt meets
      // the actual hillside at every edge, rather than hovering above the bay.
      const base = anchor(rec, x, z), originY = rec.frame.at(x, z, 0).y;
      const points = [], faces = [], widths = [[.236,.20,.008],[.252,.22,-.073],[.28,.25,-.153]];
      const outline = (w,d) => [[-w/2+.018,-d/2],[w/2-.018,-d/2],[w/2,-d/2+.018],[w/2,d/2-.018],[w/2-.018,d/2],[-w/2+.018,d/2],[-w/2,d/2-.018],[-w/2,-d/2+.018]];
      for(const [w,d,y] of widths)for(const [px,pz]of outline(w,d))points.push(px,y,pz);
      for(const [px,pz]of outline(.28,.25)) {
        const floor=(rec.frame.at(x+px,z+pz,0).y-originY)/LS[1];
        points.push(px,Math.min(-.163,floor-.008),pz);
      }
      for(let ring=0;ring<3;ring++)for(let k=0;k<8;k++) {
        const a=ring*8+k,b=ring*8+(k+1)%8,c=a+8,d=b+8;
        faces.push(a,b,c,b,d,c);
      }
      for(let k=1;k<7;k++)faces.push(0,k+1,k);
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.setIndex(faces);g.computeVertexNormals();
      rec.static.add(g,0x9e9988,base,.045);
      const k=kit(rec,x,z);
      for(const [w,d,y]of [[.243,.208,-.030],[.263,.23,-.097]]) {
        k.add(box(w,.005,.003),0x797e71,0,y,-d/2);
        for(const side of[-1,1])k.add(box(.003,.005,d),0x797e71,side*w/2,y,0);
      }
    }
    function chest(rec, x, z, scale = 1) {
      const k = kit(rec, x, z, .17, scale); k.add(box(.068, .037, .046), C.darkWood, 0, .021);
      for (const side of [-1, 1]) k.add(box(.006, .041, .049), C.gold, side * .024, .022, 0, 0, 0, true);
      k.add(box(.009, .014, .004), C.gold, 0, .029, .025, 0, 0, true);
      const lid = () => { const b = mergeBuilder(); b.add(box(.072, .016, .047), C.wood, matrix(0, .008, .022)); for (const side of [-1, 1]) b.add(box(.006, .019, .049), C.gold, matrix(side * .024, .008, .022)); return b.finish(); };
      dynamic(rec, 'chest-lids', lid, matte, k.base, matrix(0, .039, -.023), 'lid');
      for (let j = 0; j < 5; j++) k.add(cylinder(.008, .004, .008, 10), C.gold, -.02 + (j % 3) * .02, .039 + (j % 2) * .003, -.008 + Math.floor(j / 3) * .016, .12, 0, true);
    }
    function boat(rec, x, z, galley = false) {
      const base = anchor(rec, x, z, 0, galley ? -.35 : .08, galley ? .85 : .70, true);
      dynamic(rec, galley ? 'galley-hulls' : 'sloop-hulls', () => shipGeometry(false, galley), matte, base, new T.Matrix4(), 'boat');
      dynamic(rec, 'ship-sails', () => cloth(.10, .125), fabric, base, matrix(.025, .186, 0, 1, 1, 1, 0, Math.PI / 2), 'boat', C.cream);
    }
    function tent(rec, x, z, color) {
      const k = kit(rec, x, z); for (const side of [-1, 1]) k.add(rod([side * .069, 0, -.066], [0, .095, -.066], .0025), C.darkWood);
      dynamic(rec, 'camp-canvas', () => cloth(.145, .09, true), fabric, k.base, matrix(0, 0, 0), 'tent', color);
      k.add(box(.048, .044, .002), C.dark, 0, .022, -.065);
      k.add(rod([0, .095, .06], [.09, 0, .06], .0011), C.rope);
    }
    function windmill(rec, x, z) {
      const k = kit(rec, x, z); k.add(cylinder(.050, .25, .035, 12), C.cream, 0, .125); k.add(new T.ConeGeometry(.061, .074, 10), C.darkWood, 0, .285);
      k.add(box(.028, .055, .004), C.darkWood, 0, .028, .049); k.add(box(.019, .026, .005), C.dark, 0, .171, .043);
      dynamic(rec, 'windmill-rotor', rotor, matte, k.base, matrix(0, .211, .058), 'rotor');
    }
    function cave(rec, x, z, scale = 1) {
      const k = kit(rec, x, z, 0, scale); k.add(box(.111, .087, .009), 0x152b32, 0, .046, -.012);
      k.add(arch(.15, .136, .045), C.darkStone, 0, -.006, .012);
      for (let j = 0; j < 5; j++) k.add(sphere(.026, 1), 0xa6a489, Math.cos(j * .67) * .068, .039 + Math.sin(j * .67) * .072, .018);
      const vine = () => { const b = mergeBuilder(); for (let j = 0; j < 4; j++) b.add(rod([.004 * Math.sin(j), -j * .017, 0], [.004 * Math.sin(j + 1), -(j + 1) * .017, .003], .0023), C.leafDark); return b.finish(); };
      dynamic(rec, 'cave-vines', vine, green, k.base, matrix(-.029, .119, .038), 'vine');
      for (let j = 0; j < 3; j++) dynamic(rec, 'cave-drops', () => sphere(.0026, 1), waterMat, k.base, matrix(.032, .090, .035), 'drip', 0xffffff, j, .074);
    }
    function winch(rec, x, z) {
      const k = kit(rec, x, z);
      for (const side of [-1, 1]) { k.add(rod([side * .050, 0, 0], [side * .018, .17, 0], .0045), C.wood); k.add(rod([side * .04, 0, -.036], [side * .016, .17, 0], .004), C.wood); }
      k.add(box(.067, .008, .012), C.darkWood, 0, .166); k.add(rod([0, .159, 0], [0, .025, 0], .0014), C.rope);
      dynamic(rec, 'lift-buckets', () => cylinder(.020, .036, .026, 10), matte, k.base, matrix(0, .079, .012), 'lift', C.wood);
      dynamic(rec, 'pulley-wheels', () => new T.TorusGeometry(.019, .003, 5, 14), metal, k.base, matrix(0, .148, .009), 'rotor');
    }
    function grave(rec, x, z, skull = false) {
      const k = kit(rec, x, z, x * .6); k.add(box(.048, .011, .070), C.darkStone, 0, .005);
      const s = new T.Shape(); s.moveTo(-.021, 0); s.lineTo(-.021, .056); s.quadraticCurveTo(0, .082, .021, .056); s.lineTo(.021, 0); s.closePath();
      k.add(new T.ExtrudeGeometry(s, { depth: .012, bevelEnabled: true, bevelSize: .002, bevelThickness: .002, bevelSegments: 1, curveSegments: 5 }).translate(0, .010, -.006), skull ? 0x9aafa9 : C.stone);
      if (skull) {
        // A small raised carved skull, not an oversized sphere covering the grave.
        rec.static.add(sphere(1, 1), C.cream, k.base.clone().multiply(matrix(0, .056, .010, .009, .008, .002)));
        for (const side of [-1, 1]) k.add(box(.004, .003, .003), C.dark, side * .0035, .057, .013);
        for (const r of [-.6, .6]) k.add(box(.028, .003, .003), C.cream, 0, .037, .010, 0, r);
      } else { k.add(box(.003, .021, .003), C.darkStone, 0, .053, .008); k.add(box(.016, .003, .003), C.darkStone, 0, .057, .008); }
    }
    function cactus(rec, x, z, s = 1) {
      const k = kit(rec, x, z, x, s); k.add(cylinder(.015, .18, .011, 10), 0x6c9a62, 0, .09);
      for (const side of [-1, 1]) { k.add(rod([0, .083, 0], [side * .041, .087, 0], .009), 0x598955); k.add(cylinder(.009, .073, .006, 9), 0x6c9a62, side * .042, .118); }
      for (let j = 0; j < 6; j++) for (const side of [-1, 1]) k.add(new T.ConeGeometry(.0012, .011, 3), C.cream, side * .015, .025 + j * .025, .008, 0, side * Math.PI / 2);
    }
    function tortoise(rec, x, z, s = 1) {
      const k = kit(rec, x, z, -.15, s);
      rec.static.add(sphere(1, 2), 0x827457, k.base.clone().multiply(matrix(0, .031, 0, .055, .034, .041)));
      for (let j = 0; j < 7; j++) {
        const a = j / 6 * TAU, r = j === 6 ? 0 : .025;
        k.add(cylinder(.014, .005, .012, 6), j % 2 ? 0xa39368 : 0x6f6b50, Math.cos(a) * r, .050 + (j === 6 ? .012 : 0), Math.sin(a) * r * .76);
      }
      const head = () => { const b = mergeBuilder(); b.add(sphere(1, 1), 0x839063, matrix(.01, 0, 0, .024, .014, .013)); for (const side of [-1, 1]) b.add(sphere(.0025), C.dark, matrix(.024, .005, side * .010)); return b.finish(); };
      dynamic(rec, 'tortoise-heads', head, matte, k.base, matrix(.051, .021, 0), 'graze');
      for (const side of [-1, 1]) for (const xx of [-.036, .032]) k.add(cylinder(.007, .016, .009, 6), 0x74825c, xx, .009, side * .031);
    }

    for (const place of opts.places || []) {
      if (!indices.includes(place.i) || !place.frame || typeof place.frame.at !== 'function') continue;
      const rec = { i: place.i, name: place.name || String(place.i), frame: place.frame, static: mergeBuilder(), metals: mergeBuilder(), parts: [], event: null, mort: false, group: new T.Group() };
      rec.group.name = 'Animated place ' + rec.i + ': ' + rec.name; rec.group.userData.i = rec.i; rec.group.userData.nativeProcedural = true; root.add(rec.group); records.set(rec.i, rec);
      switch (rec.i) {
        case 6:
          tent(rec, -.15, -.14, C.cream); tent(rec, .020, -.21, C.red); cargo(rec, -.22, -.015); fire(rec, -.045, -.042); boat(rec, .15, .116, true);
          for (let j = 0; j < 4; j++) rec.static.add(new T.LatheGeometry([new T.Vector2(.010, 0), new T.Vector2(.017, .029), new T.Vector2(.008, .049), new T.Vector2(.009, .059)], 10), 0xb9744a, anchor(rec, -.25 + j * .023, -.045).multiply(matrix(0, 0, 0)));
          break;
        case 8:
          fort(rec, .13, -.18, .16, .14, .11, C.sand); house(rec, -.09, -.095, .15, .11, .12, C.cream, C.cream);
          for (const x of [-.14, -.045]) rec.static.add(new T.SphereGeometry(.042, 16, 8, 0, TAU, 0, Math.PI / 2), C.cream, anchor(rec, x, -.09, .112));
          { const k = kit(rec, -.23, -.22); k.add(cylinder(.022, .25, .017, 12), C.cream, 0, .125); k.add(new T.ConeGeometry(.028, .055, 12), C.blue, 0, .278); flag(rec, k.base, 0, .31, 0, C.blue); }
          palm(rec, .26, .015, .85); palm(rec, -.27, .02, .80); palm(rec, .05, -.30, .78); break;
        case 11:
          tower(rec, .10, -.01, .35, 0xa5a296, true); house(rec, -.12, -.18, .11, .085, .09, C.stone, C.slate);
          { const k = kit(rec, -.10, .048); k.add(box(.26, .035, .018), C.darkStone, 0, .018); for (let j = 0; j < 8; j++) k.add(box(.025, .008, .024), C.stone, -.11 + j * .031, .038); }
          tree(rec, -.26, -.24, .78); lamp(rec, anchor(rec, .10, -.01), .060, .064, .049); break;
        case 13:
          { const k = kit(rec, .13, -.11); k.add(cylinder(.044, .37, .030, 18), C.cream, 0, .185); k.add(cylinder(.051, .010, .051, 18), C.iron, 0, .378, 0, 0, 0, true); k.add(cylinder(.026, .052, .026, 12), C.dark, 0, .408); k.add(new T.ConeGeometry(.040, .035, 14), C.slate, 0, .454); for (let j = 0; j < 8; j++) k.add(cylinder(.0018, .054, .0018, 5), C.cream, Math.cos(j / 8 * TAU) * .026, .408, Math.sin(j / 8 * TAU) * .026); dynamic(rec, 'beacon-reflectors', () => new T.CylinderGeometry(.021, .021, .011, 12, 1, false, 0, Math.PI * .65), warm, k.base, matrix(0, .410, 0), 'beacon'); }
          house(rec, -.06, -.145, .14, .09, .10, C.cream, C.slate, true); pier(rec, -.16, .034, .13); tree(rec, -.27, -.19, .56); break;
        case 14:
          windmill(rec, -.15, -.13); house(rec, .10, -.19, .17, .14, .12, C.cream, C.slate, true); chest(rec, .12, .045, .80);
          tree(rec, -.26, -.27, .71); tree(rec, .25, -.08, .78); tree(rec, -.015, -.29, .76); cargo(rec, .25, .065); break;
        case 16:
          palm(rec, -.23, -.07, .95); palm(rec, -.09, -.25, .91); palm(rec, .07, -.09, 1.04); house(rec, -.02, -.13, .09, .075, .07, C.plank, C.sand);
          rec.static.add(shipGeometry(true), C.wood, anchor(rec, .19, .13, 0, -.26, .70, true)); fire(rec, .20, .11, .018); cargo(rec, -.20, .036); break;
        case 18:
          retainingFoundation(rec,-.15,-.15); fort(rec, -.15, -.15, .18, .14, .18, 0xc2b391); house(rec, .10, -.01, .11, .09, .09, C.plank, C.sand); house(rec, .14, -.17, .09, .078, .074, C.plank, C.sand);
          palm(rec, -.27, .015, .80); palm(rec, .26, -.075, .76); fire(rec, -.035, .045);
          { const k = kit(rec, -.025, .04); k.add(box(.082, .005, .045), C.wood, 0, .073); for (const side of [-1, 1]) k.add(box(.004, .075, .004), C.darkWood, side * .035, .036); for (let j = 0; j < 3; j++) k.add(sphere(.008), 0x915744, -.02 + j * .02, .081); } cargo(rec, .26, .10); break;
        case 19:
          fort(rec, -.22, -.11, .15, .14, .12, 0xb48164); cannon(rec, -.245, -.005); cannon(rec, -.175, -.005);
          house(rec, -.05, -.16, .087, .14, .09, 0xbf8769, C.slate, true); house(rec, .075, -.10, .09, .12, .09, 0xc99a79, C.slate); house(rec, .19, -.18, .09, .14, .09, 0xac775e, C.slate);
          { const k = kit(rec, .26, .12, .24, .75, true); k.add(box(.095, .065, .076), C.roof, 0, -.015, 0, 0, .20); k.add(roof(.11, .092, .042), C.slate, -.011, .024, 0, 0, .20); } pier(rec, .08, .025, .14); break;
        case 21:
          fort(rec, -.21, -.23, .13, .11, .09, C.cream);
          house(rec, -.08, -.105, .080, .13, .085, C.pink, C.cream, true); house(rec, .04, -.18, .083, .12, .082, C.yellow, C.cream); house(rec, .17, -.105, .085, .15, .085, C.blue, C.cream, true);
          palm(rec, -.27, -.005, .77); palm(rec, .27, -.25, .73); pier(rec, .15, .018, .15); boat(rec, -.075, .157); cargo(rec, .245, .032); break;
        case 23:
          cave(rec, -.11, -.018, 1.05); cave(rec, .10, -.005, .84); chest(rec, -.10, .040, .68);
          palm(rec, -.27, -.13, .91); palm(rec, .27, -.10, .89); palm(rec, .02, -.29, .74); rock(rec, .10, -.16, .11, .09, .10); lamp(rec, anchor(rec, .11, -.005), .035, .036, .044); break;
        case 24:
          for (const [x,z,s] of [[-.22,-.19,1.03],[-.11,-.28,.95],[0,-.19,1.08],[-.26,-.025,.87],[.11,-.29,.88]]) tree(rec,x,z,s,true);
          house(rec, .14, -.055, .12, .11, .10, C.plank, C.sand, true); palm(rec, .26, .055, .72); cargo(rec, .21, .045); flag(rec, anchor(rec, .14, -.055), -.073, .060, .046, C.blue); break;
        case 26:
          for (let j = 0; j < 7; j++) grave(rec, -.17 + (j % 4) * .077, -.20 + Math.floor(j / 4) * .09, j === 2);
          palm(rec, .26, -.18, .90); palm(rec, -.27, -.005, .79); palm(rec, .15, .025, .76); pier(rec, -.12, .027, .135);
          rec.static.add(arch(.071,.12,.017),C.stone,anchor(rec,-.20,-.30)); lamp(rec, anchor(rec, .10, -.20), .024, .056, .02); break;
        case 27:
          house(rec, .18, -.012, .12, .095, .10, C.cream, C.red, true); tree(rec, -.22, -.005, .76); tree(rec, .07, .056, .72); tree(rec, .22, -.22, .81);
          { const base = anchor(rec, -.02, -.18, .020); rec.metals.add(new T.TorusGeometry(.047, .008, 6, 18).rotateX(Math.PI / 2), 0x96704b, base); dynamic(rec, 'crater-glows', () => cylinder(.038, .006, .038, 18), warm, base, new T.Matrix4(), 'lamp', 0xff9151); for (let j = 0; j < 5; j++) dynamic(rec, 'smoke', () => sphere(.014,1), smokeMat, base, matrix(0,.020,0), 'smoke',0xffffff,j / 5 * TAU,.18); }
          cargo(rec, .27, .06); break;
        case 29:
          rock(rec,-.23,-.035,.070,.17,.065,0xb7b2a3); rock(rec,-.12,.033,.065,.10,.063,0xc5baa7); rock(rec,.24,-.08,.068,.22,.055,0xc5baa7);
          palm(rec,-.065,-.20,.96); palm(rec,.09,-.29,.88); palm(rec,-.27,-.25,.69); winch(rec,.075,.013); chest(rec,.105,.090,.62);
          rec.static.add(rod([0,0,0],[.006,.072,0],.002),C.darkWood,anchor(rec,.15,.045)); break;
        case 32:
          cactus(rec,.05,-.13,1.28); cactus(rec,.17,-.23,1.03); cactus(rec,-.07,-.02,1.01); cactus(rec,.24,-.045,.86);
          rock(rec,-.24,-.23,.075,.11,.065,0x575d55); rock(rec,.25,.080,.044,.05,.041,0x5b6257); tortoise(rec,-.16,.075,1.32); tortoise(rec,.10,.066,.91); break;
        case 34:
          house(rec,.065,-.003,.13,.12,.11,C.plank,C.sand,true); tree(rec,-.25,-.045,.79); tree(rec,-.04,-.12,.75); tree(rec,.25,-.050,.70);
          { const k = kit(rec,.16,-.19); for(const side of[-1,1])k.add(cylinder(.0035,.19,.0035,7),C.darkWood,side*.041,.095); k.add(box(.114,.012,.094),C.plank,0,.191); for(const side of[-1,1]) k.add(box(.11,.004,.004),C.rope,0,.239,side*.041); k.add(roof(.127,.11,.049),C.sand,0,.279); for(const side of[-1,1]) k.add(cylinder(.0028,.10,.0028,6),C.wood,side*.043,.234); flag(rec,k.base,.052,.26,0,C.cream); lamp(rec,k.base,-.025,.22,.026); }
          fire(rec,-.08,.055,0,false); cargo(rec,.19,.057); break;
      }
      for (const [builder, material, label] of [[rec.static, matte, 'architecture'], [rec.metals, metal, 'metalwork']]) {
        if (!builder.count) continue;
        const geometry = builder.finish(), mesh = new T.Mesh(geometry, material); mesh.name = rec.name + ' ' + label; mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.i = rec.i; rec.group.add(mesh); own.add(geometry);
      }
      rec.static = rec.metals = null;
      const reactionBase = anchor(rec, 0, -.10, .035);
      dynamic(rec, 'arrival-rings', () => new T.TorusGeometry(1, .017, 5, 32).rotateX(Math.PI / 2), reactionMat, reactionBase, new T.Matrix4(), 'reaction-ring');
      for (let j = 0; j < 6; j++) dynamic(rec, 'reward-coins', () => cylinder(.011, .004, .011, 10), gold, anchor(rec, 0, -.10, .17), new T.Matrix4(), 'reaction-coin', 0xffffff, j / 6 * TAU);
    }
    for (const p of pools.values()) {
      p.mesh = new T.InstancedMesh(p.geometry, p.material, p.entries.length); p.mesh.name = 'Place animation: ' + p.key; p.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); p.mesh.frustumCulled = false; p.mesh.receiveShadow = !['smoke','arrival-rings','reward-coins'].includes(p.key); p.mesh.castShadow = false; root.add(p.mesh);
      if (p.key === 'smoke' || p.key === 'arrival-rings') p.mesh.renderOrder = 2;
      for (const e of p.entries) p.mesh.setColorAt(e.index, e.color);
    }
    const animated = new T.Matrix4(), out = new T.Matrix4(), q = new T.Quaternion(), v = new T.Vector3(), s = new T.Vector3(), euler = new T.Euler(), reactionColor = new T.Color();
    function update(t, dt) {
      if (dead) return;
      const time = opts.reducedMotion ? 0 : Number.isFinite(t) ? t : current;
      current = time; if (last === time) return; last = time; clothTime.value = time;
      let reactionsActive = false;
      if (!opts.reducedMotion) for (const rec of records.values()) {
        if (rec.event && time >= rec.event.started && time < rec.event.started + rec.event.duration) { reactionsActive = true; break; }
      }
      for (const p of pools.values()) {
        // A zero-scaled instance still submits geometry. Idle reaction pools
        // need neither GPU draws nor rewritten matrix/color buffers.
        if (p.reaction && !reactionsActive) {
          if (p.mesh.count) for (const entry of p.entries) entry.drawIndex = -1;
          p.mesh.count = 0; p.mesh.visible = false; continue;
        }
        let visible = 0;
        for (const entry of p.entries) {
          const { rec, motion, phase, amount } = entry, event = rec.event, life = event ? (time-event.started)/event.duration : 2, boost = life >= 0 && life < 1 ? Math.sin(Math.PI*life) : 0;
          if (p.reaction) { entry.drawIndex = -1; if (life < 0 || life >= 1) continue; }
          v.set(0,0,0); euler.set(0,0,0); s.set(1,1,1);
          switch(motion) {
            case 'crown': euler.x=.019*amount*Math.sin(time*1.1+phase);euler.z=.027*amount*Math.sin(time*1.5+phase);break;
            case 'pennant': euler.y=.036*Math.sin(time*.8+phase);break;
            case 'tent': euler.z=.007*Math.sin(time*1.4+phase);break;
            case 'rotor': euler.z=time*.63+phase;break;
            case 'beacon': euler.y=time*.66+phase;break;
            case 'boat': v.y=.0045*Math.sin(time*1.3+phase);euler.x=.018*Math.sin(time*1.3+phase);euler.z=.012*Math.sin(time*.95+phase);break;
            case 'lamp': s.setScalar(.96+.075*Math.sin(time*2.4+phase)+boost*.20);break;
            case 'flame': s.set(.9+.1*Math.sin(time*5+phase),.75+.30*Math.sin(time*6+phase),.85+.12*Math.cos(time*5+phase));euler.z=.10*Math.sin(time*3+phase);break;
            case 'smoke': { const cycle=(time*.18+phase/TAU)%1;v.set(.026*Math.sin(phase+cycle*2),cycle*amount,.017*Math.cos(phase+cycle));s.setScalar(.45+cycle*1.5);break; }
            case 'vine': euler.z=.08*Math.sin(time*1.2+phase);euler.x=.04*Math.sin(time*.9+phase);break;
            case 'drip': v.y=-((time*.65+phase*.31)%1)*amount;s.set(1,1.5,1);break;
            case 'lift': v.y=.018*Math.sin(time*.9+phase);break;
            case 'lid': euler.x=-.045-boost*.90;break;
            case 'graze': euler.z=.10*Math.sin(time*.50+phase);euler.y=.09*Math.sin(time*.31+phase);break;
            case 'reaction-ring': s.setScalar(.08+life*.20);v.y=.008+life*.018;break;
            case 'reaction-coin': v.set(Math.cos(phase)*life*.16,Math.sin(Math.PI*life)*.23,Math.sin(phase)*life*.12);euler.set(time*6+phase,phase,time*4);s.setScalar(1-life*.55);break;
          }
          q.setFromEuler(euler);animated.compose(v,q,s);
          // Fixed attachments are combined once at construction. Boat parts
          // retain carrier motion before their local mast/sail offsets.
          if(motion==='boat')out.copy(entry.base).multiply(animated).multiply(entry.local);else out.multiplyMatrices(entry.anchored,animated);
          const index = p.reaction ? visible++ : entry.index;
          p.mesh.setMatrixAt(index,out);
          if (p.reaction) {
            entry.drawIndex = index; reactionColor.copy(entry.color); if (rec.mort) reactionColor.multiplyScalar(.43);
            p.mesh.setColorAt(index, reactionColor);
          }
        }
        if (p.reaction) { p.mesh.count = visible; p.mesh.visible = visible > 0; p.mesh.instanceColor.needsUpdate = true; }
        p.mesh.instanceMatrix.needsUpdate=true;
      }
    }
    function colorEntry(part) {
      const index = part.pool.reaction ? part.entry.drawIndex : part.entry.index;
      if (index < 0) return;
      const color=part.entry.color.clone();if(part.entry.rec.mort)color.multiplyScalar(.43);part.pool.mesh.setColorAt(index,color);part.pool.mesh.instanceColor.needsUpdate=true;
    }
    function trigger(i,kind,seatColor) {
      const rec=records.get(i);if(dead||!rec)return false;
      triggers++;rec.event={kind:kind||'arrival',started:current,duration:kind==='build'?2.5:2.0};
      if(seatColor){const color=new T.Color(seatColor);for(const part of rec.parts)if(part.pool.key==='arrival-rings'){part.entry.color.copy(color);colorEntry(part);}if(['buy','purchase','won','owner'].includes(kind))for(const part of rec.parts)if(part.pool.key==='flags'){part.entry.color.copy(color);colorEntry(part);}}
      last=null;update(current,0);return true;
    }
    function setMort(i,value) {
      const rec=records.get(i);if(dead||!rec)return false;rec.mort=!!value;
      for(const mesh of rec.group.children){const base=mesh.userData.baseMaterial||(mesh.userData.baseMaterial=mesh.material);if(rec.mort){if(!dimMaterials.has(base)){const dim=base.clone();dim.color.multiplyScalar(.43);dim.emissive.multiplyScalar(.43);dimMaterials.set(base,dim);own.add(dim);}mesh.material=dimMaterials.get(base);}else mesh.material=base;}
      for(const part of rec.parts)colorEntry(part);return true;
    }
    function dispose(){if(dead)return;dead=true;parent.remove(root);for(const p of pools.values())p.mesh.dispose();for(const resource of own)resource.dispose();own.clear();pools.clear();dimMaterials.clear();clothMaterials.clear();records.clear();root.clear();}
    function stats(){let triangles=0,staticDraws=0,instances=0;for(const rec of records.values())for(const mesh of rec.group.children){staticDraws++;triangles+=mesh.geometry.attributes.position.count/3;}for(const p of pools.values()){instances+=p.entries.length;triangles+=(p.geometry.index?p.geometry.index.count:p.geometry.attributes.position.count)/3*p.entries.length;}return {places:records.size,indices:[...records.keys()],pools:pools.size,instances,drawCalls:staticDraws+pools.size,triangles,triggers,disposed:dead};}
    update(0,0);
    return {update,trigger,setMort,dispose,stats,getObject:i=>records.get(i)?.group||null};
  }
  return {indices,create};
})();
