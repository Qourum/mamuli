// ===== the little 3D world on the board, made of boxes, cones and cylinders (nothing to download) =====
// Every model is built in a "lot" frame: x runs along the board's side, +z towards the square in front of the lot (and the
// camera), y up from the ground. Pieces are coloured per face and merged into one mesh per lot.

const Models = (() => {
  const T = window.THREE;
  if (!T) return null;
  T.ColorManagement.legacyMode = false;               // colours given in sRGB, as in the CSS

  const M4 = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler(), V = new T.Vector3(), SC = new T.Vector3(), C = new T.Color();

  // the same little random number for the same spot: vertices shared by two faces have to move together
  function hash3(x, y, z) { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
  function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function tone(hex, f) { C.set(hex); C.r = Math.min(1, C.r * f); C.g = Math.min(1, C.g * f); C.b = Math.min(1, C.b * f); return C.getHex(); }

  const PAL = {
    stone: 0xd9cfbc, stone2: 0xbdb19b, stone3: 0x9a8f7d, slate: 0x77726a, slate2: 0x5d5952, svan: 0xe6dcc8, svanRoof: 0x58534e,
    wood: 0x8a5a34, wood2: 0x5e3b22, terra: 0xc4643f, terra2: 0xa64e37, churchRoof: 0x6f8574, snow: 0xf5f8fb, rock: 0x8e99a4,
    leaf: 0x4f9645, leaf2: 0x3c7c3a, pine: 0x2f6a3c, pine2: 0x3b7d48, autumn: 0xd9862f, trunk: 0x6b4a2c, water: 0x4ba6cc,
    gold: 0xe7b84a, red: 0xc8372d, white: 0xf2ece0, brick: 0xb8613f, sand: 0xdcc391, cliff: 0xcfab7a, vine: 0x5e9c3a,
    soil: 0x8c6b43, dark: 0x3b2c22, glass: 0x2e3a44, silver: 0xc9ced6, cloth: 0xf4efe4
  };
  // the ground of each region's lots
  const GROUND = [0xa3ad86, 0x8fc062, 0x7fb455, 0xa4c062, 0xc9b874, 0xaebf68, 0x98b558, 0xd6c6a3];

  // ----- shapes, standing on y = 0 -----
  const box = (w, h, d) => new T.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const cyl = (rt, rb, h, seg = 8) => new T.CylinderGeometry(rt, rb, h, seg).translate(0, h / 2, 0);
  const halfCyl = (r, h, seg = 6) => new T.CylinderGeometry(r, r, h, seg, 1, false, 0, Math.PI).translate(0, h / 2, 0);
  const cone = (r, h, seg = 8) => new T.ConeGeometry(r, h, seg).translate(0, h / 2, 0);
  const pyr = (w, h, d = w) => new T.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).scale(w, h, d).translate(0, h / 2, 0);
  const taper = (wb, wt, h) => new T.CylinderGeometry(wt * Math.SQRT1_2, wb * Math.SQRT1_2, h, 4).rotateY(Math.PI / 4).translate(0, h / 2, 0);
  const ball = (r, det = 0) => new T.IcosahedronGeometry(r, det);
  const dome = (r, seg = 10) => new T.SphereGeometry(r, seg, Math.max(3, seg >> 1), 0, Math.PI * 2, 0, Math.PI / 2);
  const lathe = (pts, seg = 10) => new T.LatheGeometry(pts.map(([x, y]) => new T.Vector2(x, y)), seg);
  // a gable roof, ridge along x
  function roof(w, h, d) {
    const a = w / 2, b = d / 2, v = [-a, 0, b, a, 0, b, a, h, 0, -a, 0, b, a, h, 0, -a, h, 0, a, 0, -b, -a, 0, -b, -a, h, 0, a, 0, -b, -a, h, 0, a, h, 0,
      a, 0, b, a, 0, -b, a, h, 0, -a, 0, -b, -a, 0, b, -a, h, 0];
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(v, 3));
    return g;
  }
  // a craggy cone: mountains, hills, rocks
  function crag(r, h, seg, rings, rough, seed) {
    const g = new T.ConeGeometry(r, h, seg, rings), p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const X = p.getX(k), Y = p.getY(k), Z = p.getZ(k);
      if (Y <= -h / 2 + 1e-6) { const f = 0.9 + hash3(X + seed, 0, Z) * 0.2; p.setXYZ(k, X * f, Y, Z * f); continue; }
      const j = hash3(X * 3.1 + seed, Y * 2.3, Z * 3.7 + seed), f = 1 - rough / 2 + j * rough;
      p.setXYZ(k, X * f, Y + (Y < h / 2 - 1e-6 ? (j - 0.5) * 0.14 * h : 0), Z * f);
    }
    return g.translate(0, h / 2, 0);
  }
  function mesa(rt, rb, h, seg, rough, seed) {
    const g = new T.CylinderGeometry(rt, rb, h, seg, 2), p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const X = p.getX(k), Y = p.getY(k), Z = p.getZ(k), j = hash3(X * 3.3 + seed, Y * 1.7, Z * 2.9 + seed), f = 1 - rough / 2 + j * rough;
      const mid = Y > -h / 2 + 1e-6 && Y < h / 2 - 1e-6;
      p.setXYZ(k, X * f, Y + (mid ? (j - 0.5) * 0.16 * h : 0), Z * f);
    }
    return g.translate(0, h / 2, 0);
  }
  function lump(r, seed, sy = 0.7) {
    const g = new T.DodecahedronGeometry(r, 0), p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const X = p.getX(k), Y = p.getY(k), Z = p.getZ(k), f = 0.8 + hash3(X * 5 + seed, Y * 5, Z * 5) * 0.4; p.setXYZ(k, X * f, Y * f * sy, Z * f); }
    return g.translate(0, r * sy * 0.55, 0);
  }

  // ----- a builder: collects pieces and merges them into one geometry with a colour per face -----
  function Builder() { this.parts = []; }
  Builder.prototype.add = function (g, color, x = 0, y = 0, z = 0, o = {}, parent = null) {
    if (g.index) g = g.toNonIndexed();
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (g.attributes.normal) g.deleteAttribute('normal');
    const p = g.attributes.position, n = p.count, c = new Float32Array(n * 3);
    for (let k = 0; k + 2 < n; k += 3) {
      if (typeof color === 'function') C.set(color((p.getY(k) + p.getY(k + 1) + p.getY(k + 2)) / 3, k / 3));
      else C.set(color);
      for (let j = 0; j < 3; j++) { c[(k + j) * 3] = C.r; c[(k + j) * 3 + 1] = C.g; c[(k + j) * 3 + 2] = C.b; }
    }
    g.setAttribute('color', new T.BufferAttribute(c, 3));
    E.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ'); Q.setFromEuler(E);
    const s = o.s || 1;
    M4.compose(V.set(x, y, z), Q, SC.set(o.sx || s, o.sy || s, o.sz || s));
    if (parent) M4.premultiply(parent);
    g.applyMatrix4(M4);
    this.parts.push(g);
    return this;
  };
  // a frame inside the lot: a model built around (0, 0) is placed, turned and scaled as a whole
  Builder.prototype.at = function (x, z, ry = 0, s = 1, y = 0) {
    const P = new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(0, ry, 0)), new T.Vector3(s, s, s));
    return (g, color, lx = 0, ly = 0, lz = 0, o = {}) => this.add(g, color, lx, ly, lz, o, P);
  };
  // everything fn() adds is raised by dy (onto a hill, a rock)
  Builder.prototype.lift = function (dy, fn) { const n = this.parts.length; fn(); for (let k = n; k < this.parts.length; k++) this.parts[k].translate(0, dy, 0); return this; };
  Builder.prototype.build = function () {
    let n = 0;
    for (const g of this.parts) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    let o = 0;
    for (const g of this.parts) { pos.set(g.attributes.position.array, o); col.set(g.attributes.color.array, o); o += g.attributes.position.count * 3; }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  };

  // ===== pieces =====
  function pine(B, x, z, s = 1, snowy = false) {
    B.add(cyl(0.016 * s, 0.022 * s, 0.07 * s, 5), PAL.trunk, x, 0, z);
    B.add(cone(0.095 * s, 0.18 * s, 7), PAL.pine, x, 0.05 * s, z);
    B.add(cone(0.07 * s, 0.15 * s, 7), snowy ? 0xe8eef3 : PAL.pine2, x, 0.14 * s, z);
  }
  function tree(B, x, z, s = 1, leaf = PAL.leaf) {
    B.add(cyl(0.015 * s, 0.022 * s, 0.1 * s, 5), PAL.trunk, x, 0, z);
    B.add(ball(0.085 * s), leaf, x, 0.15 * s, z, { sy: 1.1 });
  }
  function bigTree(B, x, z, s = 1, leaf = PAL.leaf2) {        // the old plane tree of Telavi
    B.add(cyl(0.03 * s, 0.05 * s, 0.16 * s, 6), PAL.trunk, x, 0, z);
    B.add(ball(0.13 * s, 1), leaf, x, 0.24 * s, z, { sy: 0.85 });
    B.add(ball(0.09 * s), tone(leaf, 1.12), x + 0.07 * s, 0.3 * s, z + 0.03 * s);
  }
  function poplar(B, x, z, s = 1) {
    B.add(cyl(0.012 * s, 0.016 * s, 0.06 * s, 5), PAL.trunk, x, 0, z);
    B.add(ball(0.05 * s), PAL.leaf, x, 0.2 * s, z, { sy: 3 });
  }
  function palm(B, x, z, s = 1) {
    B.add(cyl(0.011 * s, 0.018 * s, 0.26 * s, 5), 0x8f6d45, x, 0, z, { rz: 0.1 });
    for (let k = 0; k < 6; k++) B.add(cone(0.026 * s, 0.15 * s, 4), k % 2 ? 0x4c9a45 : 0x5aa84f, x - 0.026 * s, 0.25 * s, z, { ry: k * Math.PI / 3, rz: -(Math.PI / 2 + 0.45) });
  }
  function bush(B, x, z, s = 1, c = 0x467f3b) { B.add(ball(0.05 * s), c, x, 0.03 * s, z, { sy: 0.75 }); }
  function rock(B, x, z, s = 0.07, c = PAL.stone3, seed = 1) { B.add(lump(s, seed), c, x, 0, z, { ry: seed }); }
  function mountain(B, x, z, r, h, opt = {}) {
    const snow = opt.snow == null ? 0.62 : opt.snow, rk = opt.rock || PAL.rock, seed = opt.seed || 1;
    B.add(crag(r, h, opt.seg || 7, 3, opt.rough || 0.34, seed), cy => cy > h * snow ? PAL.snow : cy > h * (snow - 0.13) ? tone(rk, 1.1) : cy < h * 0.18 && opt.green ? opt.green : rk, x, opt.y || 0, z, { ry: seed });
  }
  function hill(B, x, z, r, h, c, seed = 1) { B.add(crag(r, h, 9, 2, 0.18, seed), c, x, 0, z, { ry: seed }); }
  function house(B, x, z, w, d, h, wall, roofC, ry = 0) {
    const put = B.at(x, z, ry);
    put(box(w, h, d), wall);
    put(roof(w * 1.1, h * 0.6, d * 1.14), roofC, 0, h, 0);
    put(box(w * 0.2, h * 0.5, 0.012), PAL.dark, 0, 0, d / 2);
  }
  function svanTower(B, x, z, h = 0.52, s = 1) {
    const w = 0.12 * s;
    B.add(taper(w, w * 0.84, h * 0.84), PAL.svan, x, 0, z);
    B.add(box(w * 1.08, h * 0.1, w * 1.08), 0xd5cab4, x, h * 0.82, z);
    B.add(pyr(w * 1.24, h * 0.17), PAL.svanRoof, x, h * 0.92, z);
    B.add(box(w * 0.22, w * 0.32, 0.012), PAL.dark, x, h * 0.6, z + w * 0.44);
    B.add(box(w * 0.2, w * 0.26, 0.012), PAL.dark, x, h * 0.85, z + w * 0.55);
  }
  function svanHouse(B, x, z, ry = 0) { house(B, x, z, 0.17, 0.13, 0.1, 0xd3c7b0, PAL.svanRoof, ry); }
  function khevsurTower(B, x, z, h = 0.42, s = 1) {
    const w = 0.12 * s;
    B.add(taper(w, w * 0.78, h * 0.78), PAL.slate, x, 0, z);
    for (let k = 0; k < 4; k++) B.add(box(w * (0.82 - k * 0.19), h * 0.055, w * (0.82 - k * 0.19)), k % 2 ? PAL.slate : PAL.slate2, x, h * (0.78 + k * 0.055), z);
    B.add(box(w * 0.2, w * 0.3, 0.012), PAL.dark, x, h * 0.55, z + w * 0.42);
  }
  function church(B, x, z, s = 1, wall = 0xdcc8a0, roofC = PAL.churchRoof, ry = 0) {
    const put = B.at(x, z, ry, s);
    put(box(0.34, 0.13, 0.13), wall);
    put(box(0.13, 0.13, 0.26), wall);
    put(roof(0.36, 0.07, 0.15), roofC, 0, 0.13, 0);
    put(roof(0.28, 0.07, 0.15), roofC, 0, 0.13, 0, { ry: Math.PI / 2 });
    put(cyl(0.055, 0.055, 0.11, 8), wall, 0, 0.16, 0);
    put(cone(0.067, 0.09, 8), roofC, 0, 0.27, 0);
    put(box(0.008, 0.045, 0.008), PAL.gold, 0, 0.36, 0);
    put(box(0.03, 0.008, 0.008), PAL.gold, 0, 0.385, 0);
    put(box(0.04, 0.06, 0.012), PAL.dark, 0, 0, 0.13);
  }
  function bellTower(B, x, z, s = 1, wall = PAL.stone, roofC = PAL.churchRoof) {
    const put = B.at(x, z, 0, s);
    put(box(0.1, 0.22, 0.1), wall);
    put(box(0.05, 0.06, 0.104), PAL.dark, 0, 0.13, 0);
    put(pyr(0.12, 0.08), roofC, 0, 0.22, 0);
  }
  function wall(B, x, z, len, h, ry = 0, c = PAL.stone2, thick = 0.035) {
    const put = B.at(x, z, ry);
    put(box(len, h, thick), c);
    const n = Math.max(3, Math.round(len / 0.045) | 1);
    for (let k = 0; k < n; k += 2) put(box(len / n, 0.026, thick * 1.15), c, -len / 2 + (k + 0.5) * len / n, h, 0);
  }
  function roundTower(B, x, z, r, h, c = PAL.stone2, roofC = null) {
    B.add(cyl(r, r * 1.06, h, 10), c, x, 0, z);
    if (roofC) B.add(cone(r * 1.25, r * 2, 10), roofC, x, h, z);
    else for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; B.add(box(r * 0.45, r * 0.45, r * 0.45), c, x + Math.cos(a) * r * 0.8, h, z + Math.sin(a) * r * 0.8, { ry: -a }); }
  }
  function squareTower(B, x, z, w, h, c = PAL.stone2, roofC = null) {
    B.add(box(w, h, w), c, x, 0, z);
    if (roofC) B.add(pyr(w * 1.2, w * 0.9), roofC, x, h, z);
    else for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.add(box(w * 0.3, w * 0.3, w * 0.3), c, x + dx * w * 0.35, h, z + dz * w * 0.35);
    B.add(box(w * 0.24, w * 0.34, 0.01), PAL.dark, x, h * 0.62, z + w / 2);
  }
  // walls around a rectangle, towers on the corners
  function fortress(B, x, z, w, d, h, c = PAL.stone2, opt = {}) {
    const put = B.at(x, z, opt.ry || 0, 1, opt.y || 0), tr = opt.tr || 0.045;
    const W = (lx, lz, len, ry) => { const p2 = (g, col, a = 0, b = 0, cc = 0, o = {}) => { const cs = Math.cos(ry), sn = Math.sin(ry); put(g, col, lx + a * cs + cc * sn, b, lz - a * sn + cc * cs, Object.assign({}, o, { ry: (o.ry || 0) + ry })); };
      p2(box(len, h, 0.035), c); const n = Math.max(3, Math.round(len / 0.045) | 1); for (let k = 0; k < n; k += 2) p2(box(len / n, 0.026, 0.04), c, -len / 2 + (k + 0.5) * len / n, h, 0); };
    W(0, d / 2, w, 0); W(0, -d / 2, w, 0); W(-w / 2, 0, d, Math.PI / 2); W(w / 2, 0, d, Math.PI / 2);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      put(cyl(tr, tr * 1.06, h * 1.35, 10), c, dx * w / 2, 0, dz * d / 2);
      if (opt.roof) put(cone(tr * 1.3, tr * 2.1, 10), opt.roof, dx * w / 2, h * 1.35, dz * d / 2);
      else for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; put(box(tr * 0.42, tr * 0.42, tr * 0.42), c, dx * w / 2 + Math.cos(a) * tr * 0.8, h * 1.35, dz * d / 2 + Math.sin(a) * tr * 0.8, { ry: -a }); }
    }
    if (opt.gate !== false) put(box(0.05, h * 0.7, 0.012), PAL.dark, 0, 0, d / 2 + 0.02);
  }
  function cliff(B, x, z, w, h, d, c = PAL.cliff, seed = 3) {
    B.add(mesa(0.72, 1, 1, 9, 0.26, seed), cy => cy > 0.97 ? tone(c, 1.1) : cy < 0.25 ? tone(c, 0.9) : c, x, 0, z, { sx: w / 2, sy: h, sz: d / 2, ry: seed });
  }
  function caves(B, x, z, n, y0, spread, seed = 1) {
    const r = rng(seed);
    for (let k = 0; k < n; k++) B.add(box(0.035, 0.035, 0.012), PAL.dark, x + (r() - 0.5) * spread, y0 + r() * 0.12, z);
  }
  function vineyard(B, x, z, w, d, ry = 0, rows = 4) {
    const put = B.at(x, z, ry);
    put(box(w, 0.012, d), PAL.soil);
    for (let r = 0; r < rows; r++) {
      const rz = -d / 2 + (r + 0.5) * d / rows, n = Math.max(2, Math.round(w / 0.055));
      for (let k = 0; k < n; k++) put(box(0.042, 0.05, 0.034), k % 2 ? PAL.vine : tone(PAL.vine, 1.12), -w / 2 + (k + 0.5) * w / n, 0.012, rz);
    }
  }
  function qvevri(B, x, z, s = 1, buried = 0.35) {
    B.add(lathe([[0, 0], [0.03, 0.012], [0.05, 0.05], [0.054, 0.09], [0.04, 0.13], [0.024, 0.15], [0.027, 0.162], [0.02, 0.162]], 10), 0xb8663b, x, -0.16 * buried * s, z, { s });
  }
  function balconyHouse(B, x, z, w, h, wallC, ry = 0) {
    const put = B.at(x, z, ry), d = 0.13;
    put(box(w, h, d), wallC);
    put(roof(w * 1.08, 0.055, d * 1.16), 0x8d5b43, 0, h, 0);
    put(box(w * 0.92, 0.012, 0.045), PAL.wood, 0, h * 0.5, d / 2 + 0.022);
    put(box(w * 0.92, 0.035, 0.008), 0x6e4426, 0, h * 0.5 + 0.012, d / 2 + 0.042);
    for (const k of [-0.25, 0.25]) put(box(w * 0.16, h * 0.18, 0.01), PAL.glass, w * k, h * 0.7, d / 2 + 0.002);
  }
  function camel(B, x, z, ry = 0, s = 1) {
    const put = B.at(x, z, ry, s), c = 0xc4955a;
    put(box(0.1, 0.045, 0.042), c, 0, 0.07, 0);
    put(ball(0.026), tone(c, 0.9), -0.005, 0.105, 0, { sx: 1.3 });
    put(box(0.018, 0.06, 0.018), c, 0.058, 0.09, 0, { rz: -0.45 });
    put(box(0.04, 0.02, 0.02), c, 0.08, 0.14, 0);
    for (const [lx, lz] of [[-0.035, -0.013], [-0.035, 0.013], [0.035, -0.013], [0.035, 0.013]]) put(box(0.012, 0.07, 0.012), tone(c, 0.85), lx, 0, lz);
  }
  function statue(B, x, z, s = 1) {          // Kartlis Deda, silver, over the city
    const put = B.at(x, z, 0, s);
    put(box(0.07, 0.04, 0.07), PAL.stone3);
    put(cyl(0.016, 0.03, 0.2, 7), PAL.silver, 0, 0.04, 0);
    put(ball(0.018), PAL.silver, 0, 0.255, 0);
    put(box(0.15, 0.012, 0.012), PAL.silver, 0, 0.2, 0);
    put(box(0.008, 0.06, 0.008), PAL.silver, 0.075, 0.16, 0);
  }
  function palace(B, x, z, s = 1) {          // the Dadiani palace in Zugdidi
    const put = B.at(x, z, 0, s);
    put(box(0.42, 0.15, 0.14), PAL.white);
    put(box(0.44, 0.02, 0.16), 0x9a9188, 0, 0.15, 0);
    put(roof(0.16, 0.05, 0.05), PAL.white, 0, 0.17, 0.08, { ry: 0 });
    for (const k of [-0.06, -0.02, 0.02, 0.06]) put(cyl(0.008, 0.008, 0.15, 6), 0xffffff, k, 0, 0.085);
    for (const k of [-0.16, -0.11, 0.11, 0.16]) put(box(0.022, 0.05, 0.01), PAL.glass, k, 0.06, 0.071);
  }
  function chestProp(B, x, z, s = 1) {
    const put = B.at(x, z, 0, s);
    put(box(0.24, 0.12, 0.15), PAL.wood);
    for (const k of [-0.08, 0.08]) put(box(0.022, 0.125, 0.155), PAL.gold, k, 0, 0);
    put(box(0.24, 0.11, 0.025), 0x7b4f2d, 0, 0.12, -0.085, { rx: -0.45 });
    put(box(0.2, 0.03, 0.12), PAL.gold, 0, 0.115, 0);
    for (let k = 0; k < 5; k++) put(cyl(0.022, 0.022, 0.008, 10), PAL.gold, -0.08 + k * 0.045, 0.14 + (k % 2) * 0.01, 0.01 * (k % 3), { rx: 0.3, rz: k * 0.4 });
    for (let k = 0; k < 4; k++) put(cyl(0.022, 0.022, 0.008, 10), PAL.gold, -0.2 + k * 0.13, 0, 0.13 + (k % 2) * 0.03);
  }
  function scrollProp(B, x, z, s = 1) {
    const put = B.at(x, z, 0, s);
    put(box(0.05, 0.12, 0.05), PAL.wood2);
    put(box(0.2, 0.012, 0.14), PAL.wood2, 0, 0.12, 0, { rx: 0.35 });
    put(box(0.17, 0.006, 0.17), 0xf3e2b6, 0, 0.14, 0.01, { rx: 0.35 });
    for (const k of [-1, 1]) put(cyl(0.018, 0.018, 0.2, 8), 0xe9d39b, 0, 0.145 + k * -0.025, k * 0.085, { rz: Math.PI / 2 });
    put(cyl(0.022, 0.022, 0.008, 10), PAL.red, 0.04, 0.155, 0.03, { rx: 0.35 });
  }
  function coins(B, x, z, n = 6, s = 1) {
    const r = rng(n * 7 + 3);
    for (let k = 0; k < n; k++) { const sx = x + (r() - 0.5) * 0.3 * s, sz = z + (r() - 0.5) * 0.2 * s, hh = 2 + Math.floor(r() * 5); for (let j = 0; j < hh; j++) B.add(cyl(0.028 * s, 0.028 * s, 0.012 * s, 10), j % 2 ? PAL.gold : tone(PAL.gold, 0.88), sx, j * 0.012 * s, sz); }
  }
  function moneyBag(B, x, z, s = 1) {
    B.add(ball(0.07 * s, 1), 0xb08a55, x, 0.065 * s, z, { sy: 0.95 });
    B.add(cone(0.03 * s, 0.05 * s, 6), 0xa07a45, x, 0.13 * s, z);
    B.add(cyl(0.025 * s, 0.025 * s, 0.012 * s, 6), PAL.gold, x, 0.13 * s, z);
  }
  function mill(B, x, z) {
    const put = B.at(x, z);
    put(box(0.26, 0.15, 0.2), PAL.stone);
    put(roof(0.3, 0.1, 0.24), PAL.wood, 0, 0.15, 0);
    put(box(0.06, 0.09, 0.012), PAL.dark, -0.05, 0, 0.1);
  }
  function guard(B, x, z, ry = 0, s = 1) {
    const put = B.at(x, z, ry, s);
    for (const k of [-0.022, 0.022]) put(box(0.026, 0.1, 0.03), 0x3e3a36, k, 0, 0);
    put(box(0.085, 0.11, 0.05), 0x9b2f26, 0, 0.1, 0);
    put(box(0.09, 0.02, 0.055), 0x5a3a1e, 0, 0.13, 0);
    put(ball(0.032), 0xe8bf98, 0, 0.245, 0);
    put(cone(0.04, 0.06, 8), PAL.silver, 0, 0.255, 0);
    put(cyl(0.006, 0.006, 0.42, 5), PAL.wood2, 0.065, 0, 0.02);
    put(cone(0.016, 0.05, 5), PAL.silver, 0.065, 0.42, 0.02);
    put(cyl(0.06, 0.06, 0.012, 12), PAL.red, -0.06, 0.12, 0.03, { rz: Math.PI / 2, ry: 0.3 });
    put(cyl(0.02, 0.02, 0.014, 8), PAL.gold, -0.067, 0.12, 0.035, { rz: Math.PI / 2, ry: 0.3 });
  }
  // the supra: a long table with bread, wine and horns
  function supra(B, x, z, ry = 0) {
    const put = B.at(x, z, ry);
    put(box(0.5, 0.012, 0.2), PAL.wood, 0, 0.07, 0);
    put(box(0.52, 0.006, 0.22), PAL.cloth, 0, 0.082, 0);
    for (const [lx, lz] of [[-0.22, -0.08], [0.22, -0.08], [-0.22, 0.08], [0.22, 0.08]]) put(box(0.02, 0.07, 0.02), PAL.wood2, lx, 0, lz);
    for (const lz of [-0.15, 0.15]) put(box(0.46, 0.04, 0.06), PAL.wood2, 0, 0, lz);
    for (let k = 0; k < 4; k++) put(ball(0.03), 0xd9a650, -0.18 + k * 0.12, 0.1, -0.04 + (k % 2) * 0.07, { sy: 0.55, sx: 1.4 });
    for (const k of [-0.06, 0.12]) put(lathe([[0, 0], [0.025, 0.004], [0.03, 0.03], [0.012, 0.06], [0.014, 0.075], [0, 0.075]], 8), 0xa4552f, k, 0.085, 0.03);
    for (let k = 0; k < 6; k++) put(ball(0.012), 0x6b2c6e, 0.03 + (k % 3) * 0.018, 0.1 + Math.floor(k / 3) * 0.014, -0.05);
    put(cone(0.018, 0.12, 6), 0xe9dcc0, -0.2, 0.1, 0.05, { rz: 1.2, ry: 0.4 });
  }
  function arrow(B, x, z, ry, len = 0.9) {     // the start's big arrow, lying on the square
    const sh = new T.Shape();
    const w = 0.14, hw = 0.3, hl = 0.32;
    sh.moveTo(-len / 2, -w / 2); sh.lineTo(len / 2 - hl, -w / 2); sh.lineTo(len / 2 - hl, -hw / 2); sh.lineTo(len / 2, 0); sh.lineTo(len / 2 - hl, hw / 2); sh.lineTo(len / 2 - hl, w / 2); sh.lineTo(-len / 2, w / 2); sh.closePath();
    const g = new T.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1 });
    g.rotateX(-Math.PI / 2);
    B.add(g, cy => cy > 0.04 ? PAL.red : tone(PAL.red, 0.75), x, 0.012, z, { ry });
  }
  function cage(B, x, z, w = 0.62, d = 0.48, h = 0.42) {
    const put = B.at(x, z);
    put(box(w + 0.04, 0.03, d + 0.04), PAL.stone3);
    const n = 9;
    for (let k = 0; k <= n; k++) {
      const t = -w / 2 + k * w / n;
      put(cyl(0.008, 0.008, h, 5), 0x3a3a3a, t, 0.03, d / 2);
      put(cyl(0.008, 0.008, h, 5), 0x3a3a3a, t, 0.03, -d / 2);
    }
    for (let k = 1; k < 7; k++) { const t = -d / 2 + k * d / 7; put(cyl(0.008, 0.008, h, 5), 0x3a3a3a, -w / 2, 0.03, t); put(cyl(0.008, 0.008, h, 5), 0x3a3a3a, w / 2, 0.03, t); }
    put(box(w + 0.03, 0.02, d + 0.03), 0x4a4038, 0, h + 0.03, 0);
  }

  // ===== the lots: what stands behind each square =====
  const L = {};
  // Khevsureti
  L[1] = B => {    // Mutso: towers climbing a rocky ridge
    mountain(B, 0.05, -0.38, 0.42, 0.78, { snow: 0.72, seed: 11, green: 0x8d9a74 });
    hill(B, -0.12, -0.02, 0.32, 0.2, 0x8c917a, 3);
    B.lift(0.12, () => khevsurTower(B, -0.18, -0.08, 0.36, 0.95));
    B.lift(0.06, () => khevsurTower(B, -0.02, -0.16, 0.44, 1)); khevsurTower(B, 0.16, -0.02, 0.32, 0.9);
    rock(B, 0.3, 0.2, 0.07, PAL.slate, 4); rock(B, -0.33, 0.22, 0.06, PAL.stone3, 7); bush(B, 0.05, 0.3);
  };
  L[3] = B => {    // Shatili: flat-roofed stone houses grown into each other
    mountain(B, -0.15, -0.42, 0.38, 0.72, { snow: 0.75, seed: 21, green: 0x8d9a74 });
    const r = rng(3);
    for (const [x, z, w, h] of [[-0.2, -0.05, 0.15, 0.28], [-0.05, -0.12, 0.14, 0.36], [0.1, -0.06, 0.15, 0.3], [0.24, 0.02, 0.12, 0.22], [-0.12, 0.1, 0.16, 0.16], [0.06, 0.12, 0.14, 0.18]]) {
      B.add(taper(w, w * 0.92, h), tone(PAL.slate, 0.92 + r() * 0.16), x, 0, z);
      B.add(box(w * 0.98, 0.02, w * 0.98), PAL.slate2, x, h, z);
      B.add(box(w * 0.5, 0.035, 0.03), PAL.wood, x, h * 0.62, z + w / 2 + 0.01);
    }
    pine(B, 0.36, -0.25, 0.9);
  };
  // Svaneti
  L[6] = B => {    // Latali
    mountain(B, 0.08, -0.4, 0.44, 0.9, { seed: 31, green: 0x7aa457 });
    pine(B, -0.36, -0.32, 1.1, true); pine(B, -0.26, -0.18, 0.9, true);
    svanTower(B, -0.1, -0.06, 0.5); svanTower(B, 0.14, 0.02, 0.44);
    svanHouse(B, 0.02, 0.18); svanHouse(B, -0.28, 0.16, 0.3);
    bush(B, 0.33, 0.28);
  };
  L[8] = B => {    // Ushguli under Shkhara
    mountain(B, -0.05, -0.42, 0.5, 1.12, { snow: 0.48, seed: 41, green: 0x7aa457 });
    mountain(B, 0.34, -0.34, 0.26, 0.6, { snow: 0.55, seed: 42 });
    svanTower(B, -0.24, -0.02, 0.52); svanTower(B, -0.05, 0.06, 0.6); svanTower(B, 0.16, -0.04, 0.48); svanTower(B, 0.3, 0.12, 0.4, 0.9);
    svanHouse(B, -0.2, 0.22, -0.2); svanHouse(B, 0.08, 0.26);
  };
  L[9] = B => {    // Mestia
    mountain(B, 0.2, -0.42, 0.42, 0.95, { seed: 51, green: 0x7aa457 });
    mountain(B, -0.25, -0.38, 0.3, 0.62, { seed: 52 });
    svanTower(B, -0.28, -0.02, 0.54); svanTower(B, -0.1, -0.12, 0.6); svanTower(B, 0.3, 0.06, 0.5);
    church(B, 0.08, 0.06, 0.62, 0xd8cdb6, PAL.svanRoof);
    svanHouse(B, -0.2, 0.24, 0.2); svanHouse(B, 0.22, 0.27, -0.2);
  };
  // Samegrelo
  L[11] = B => {   // Nokalakevi: the old walls of Archaeopolis on a green hill
    hill(B, 0, -0.25, 0.48, 0.28, 0x6fa34b, 61);
    wall(B, -0.1, -0.18, 0.5, 0.11, 0.25, PAL.stone2); roundTower(B, -0.34, -0.25, 0.05, 0.2); roundTower(B, 0.14, -0.1, 0.05, 0.18);
    church(B, 0.18, -0.32, 0.55, 0xcdbf9e, PAL.terra2);
    tree(B, -0.3, 0.15); tree(B, 0.32, 0.18, 1.1, PAL.leaf2); bush(B, 0.05, 0.25); bush(B, -0.08, 0.3, 0.8);
  };
  L[13] = B => {   // Rukhi fortress
    hill(B, 0, -0.18, 0.46, 0.18, 0x77ab50, 71);
    fortress(B, 0, -0.16, 0.42, 0.3, 0.13, PAL.stone2, { tr: 0.05 });
    squareTower(B, 0.05, -0.2, 0.11, 0.26);
    palm(B, -0.34, 0.2); tree(B, 0.33, 0.2, 0.9); bush(B, 0.12, 0.3);
  };
  L[14] = B => {   // Zugdidi: the Dadiani palace among palms
    palace(B, 0, -0.18, 1.1);
    for (const [x, z] of [[-0.36, -0.3], [0.36, -0.28], [-0.33, 0.12], [0.34, 0.14]]) palm(B, x, z, 1.05);
    B.add(box(0.3, 0.01, 0.24), 0x6aa04a, 0, 0, 0.14);
    for (let k = 0; k < 3; k++) bush(B, -0.1 + k * 0.1, 0.16, 0.7, 0x3f8a3a);
  };
  // Imereti
  L[16] = B => {   // Shorapani: a ruined fortress above the river
    B.add(box(1, 0.012, 0.12), PAL.water, 0, 0, 0.3);
    hill(B, 0, -0.18, 0.42, 0.34, 0x8fb257, 81);
    wall(B, -0.04, -0.22, 0.32, 0.09, 0.2, PAL.stone2, 0.03); roundTower(B, 0.12, -0.18, 0.05, 0.16); squareTower(B, -0.18, -0.26, 0.09, 0.2);
    tree(B, -0.36, 0.08, 1, PAL.autumn); tree(B, 0.35, 0.05, 0.9);
  };
  L[18] = B => {   // Geguti: the palace ruins
    hill(B, 0, -0.3, 0.4, 0.12, 0x99b75c, 91);
    for (const [x, z, w, h, ry] of [[-0.15, -0.2, 0.3, 0.18, 0], [0.1, -0.12, 0.22, 0.14, Math.PI / 2], [0.12, -0.32, 0.26, 0.2, 0]]) {
      B.add(box(w, h, 0.045), PAL.brick, x, 0, z, { ry });
      B.add(box(0.06, h * 0.55, 0.05), PAL.dark, x, 0, z, { ry });
    }
    tree(B, -0.34, 0.12, 1.1, PAL.autumn); tree(B, 0.32, 0.16, 1, 0xe0a33e); tree(B, -0.05, 0.22, 0.8, PAL.autumn);
  };
  L[19] = B => {   // Kutaisi: Bagrati on its hill
    hill(B, 0, -0.22, 0.48, 0.24, 0x92b558, 101);
    church(B, 0, -0.2, 1.15, 0xd9c79a, 0x6f8574);
    house(B, -0.32, 0.16, 0.14, 0.12, 0.1, 0xead8b8, PAL.terra); house(B, 0.3, 0.2, 0.15, 0.12, 0.1, 0xe2cfae, PAL.terra);
    tree(B, -0.08, 0.26, 0.9, PAL.autumn);
  };
  // Samtskhe
  L[21] = B => {   // Khertvisi: walls on a rock between two rivers
    B.add(box(0.12, 0.012, 1.1), PAL.water, -0.42, 0, 0);
    cliff(B, 0.02, -0.15, 0.62, 0.32, 0.5, PAL.cliff, 5);
    B.lift(0.3, () => { fortress(B, 0.02, -0.15, 0.34, 0.22, 0.12, 0xb9a585, { tr: 0.045, gate: false }); squareTower(B, 0.08, -0.18, 0.1, 0.22, 0xb9a585); });
    bush(B, 0.3, 0.25, 0.9, 0x7d8f45); rock(B, -0.2, 0.25, 0.06, PAL.cliff, 3);
  };
  L[23] = B => {   // Atskuri
    hill(B, 0.05, -0.25, 0.46, 0.32, 0xb4a768, 111);
    wall(B, 0.0, -0.28, 0.36, 0.1, -0.3, 0xbcaa88); roundTower(B, 0.18, -0.36, 0.05, 0.2, 0xbcaa88);
    church(B, -0.2, 0.02, 0.6, 0xd2bd93, PAL.terra2);
    bush(B, 0.3, 0.2, 0.9, 0x7d8f45); rock(B, 0.14, 0.24, 0.06, PAL.cliff, 9);
  };
  L[24] = B => {   // Akhaltsikhe: Rabati and its golden dome
    fortress(B, 0, -0.18, 0.56, 0.38, 0.14, 0xcdb68e, { tr: 0.05, roof: PAL.terra2 });
    B.add(cyl(0.07, 0.07, 0.12, 10), 0xe6d8bb, -0.05, 0, -0.2); B.add(dome(0.072), PAL.gold, -0.05, 0.12, -0.2);
    B.add(cyl(0.02, 0.024, 0.32, 8), 0xe6d8bb, 0.16, 0, -0.26); B.add(cone(0.028, 0.06, 8), PAL.gold, 0.16, 0.32, -0.26);
    house(B, 0.14, -0.08, 0.12, 0.1, 0.09, 0xe9dbbf, PAL.terra);
    tree(B, -0.35, 0.22, 0.9); bush(B, 0.32, 0.26);
  };
  // Kartli
  L[26] = B => {   // Surami: the fortress on its rock
    cliff(B, 0, -0.2, 0.5, 0.22, 0.42, 0xb8a27c, 7);
    B.lift(0.22, () => {
      for (const [x, z, l, ry] of [[0, -0.34, 0.36, 0], [-0.17, -0.2, 0.26, Math.PI / 2], [0.17, -0.2, 0.26, Math.PI / 2]]) wall(B, x, z, l, 0.12, ry, PAL.stone2);
      squareTower(B, 0, -0.24, 0.12, 0.3, PAL.stone2);
    });
    tree(B, -0.34, 0.18, 1); poplar(B, 0.34, 0.12); bush(B, 0.1, 0.28);
  };
  L[27] = B => {   // Uplistsikhe: the cave town in the rock
    cliff(B, 0, -0.22, 0.9, 0.36, 0.52, 0xd7b583, 13);
    caves(B, 0, 0.0, 9, 0.05, 0.6, 5);
    B.lift(0.36, () => church(B, 0.16, -0.3, 0.5, 0xc9a26c, PAL.terra2));
    B.add(box(1, 0.012, 0.12), PAL.water, 0, 0, 0.36);
    bush(B, -0.36, 0.2, 0.8, 0x7d8f45);
  };
  L[29] = B => {   // Mtskheta: Svetitskhoveli in its walls, Jvari on the hill behind
    hill(B, 0.18, -0.42, 0.34, 0.42, 0x9db45f, 121);
    B.lift(0.38, () => church(B, 0.18, -0.42, 0.5, 0xc9b48c, 0x7b6f5c));
    church(B, -0.06, -0.08, 1.2, 0xe2cfa3, 0x6f8574);
    wall(B, -0.06, 0.16, 0.58, 0.08, 0, 0xd4c29c); wall(B, -0.35, -0.06, 0.44, 0.08, Math.PI / 2, 0xd4c29c);
    tree(B, 0.36, 0.18, 0.9);
  };
  // Kakheti
  L[31] = B => {   // Sighnaghi: the town walls and red roofs above the valley
    vineyard(B, 0, 0.22, 0.9, 0.22, 0, 3);
    wall(B, 0, -0.12, 0.9, 0.11, 0, 0xd4bf98);
    for (const x of [-0.4, -0.13, 0.14, 0.4]) roundTower(B, x, -0.12, 0.05, 0.2, 0xd4bf98, PAL.terra2);
    for (const [x, z] of [[-0.25, -0.34], [0, -0.38], [0.24, -0.33]]) house(B, x, z, 0.15, 0.12, 0.12, 0xf0e2c4, PAL.terra);
  };
  L[32] = B => {   // Telavi: the king's palace and the great plane tree
    fortress(B, 0.08, -0.22, 0.48, 0.32, 0.13, 0xd2b88f, { tr: 0.05 });
    house(B, 0.1, -0.24, 0.2, 0.14, 0.12, 0xe9d6b2, PAL.terra);
    bigTree(B, -0.3, 0.06, 1.3);
    vineyard(B, 0.16, 0.24, 0.6, 0.18, 0, 2);
  };
  L[34] = B => {   // Gremi: the brick citadel on its hill
    hill(B, 0, -0.24, 0.48, 0.26, 0x8fae52, 131);
    B.lift(0.22, () => church(B, -0.05, -0.24, 0.85, PAL.brick, 0xa5603f));
    B.lift(0.13, () => squareTower(B, 0.22, -0.16, 0.11, 0.3, PAL.brick, 0xa5603f));
    vineyard(B, 0, 0.24, 0.9, 0.2, 0, 3);
  };
  // Tbilisi
  L[37] = B => {   // Old Tbilisi: balconies, the sulphur baths, Metekhi on its cliff over the river
    B.add(box(1, 0.012, 0.14), PAL.water, 0, 0, -0.08);
    cliff(B, 0.24, -0.3, 0.4, 0.2, 0.34, 0xc9a77c, 17);
    B.lift(0.2, () => church(B, 0.24, -0.32, 0.6, 0xd8c39b, 0x8a7a62));
    const cols = [0xe8d3a8, 0xc9dfe0, 0xe6b8a0, 0xf0e6c8, 0xd6c4e0];
    balconyHouse(B, -0.3, -0.32, 0.18, 0.22, cols[0]); balconyHouse(B, -0.08, -0.36, 0.16, 0.26, cols[1]);
    balconyHouse(B, -0.28, 0.12, 0.17, 0.2, cols[2]); balconyHouse(B, -0.08, 0.16, 0.16, 0.18, cols[3]); balconyHouse(B, 0.14, 0.14, 0.16, 0.22, cols[4]);
    for (const x of [0.32, 0.4]) B.add(dome(0.04), PAL.brick, x, 0, 0.18);
  };
  L[39] = B => {   // Narikala: the fortress on the ridge, Kartlis Deda beside it
    hill(B, 0, -0.26, 0.5, 0.34, 0x9faa72, 141);
    B.lift(0.2, () => { for (const [x, z, l, ry] of [[-0.2, -0.22, 0.3, 0.35], [0.16, -0.28, 0.3, -0.25]]) wall(B, x, z, l, 0.1, ry, 0xb6a487); });
    B.lift(0.3, () => squareTower(B, -0.02, -0.3, 0.1, 0.18, 0xb6a487));
    statue(B, 0.32, -0.12, 1.3);
    church(B, -0.24, 0.12, 0.55, 0xdac6a0, 0x7b6f5c);
    balconyHouse(B, 0.12, 0.18, 0.16, 0.18, 0xe9cfa8);
  };
  // the four caravanserais
  function caravanserai(B, x, z, s = 1) {
    const put = B.at(x, z, 0, s);
    for (const [lx, lz, l, ry] of [[0, -0.12, 0.34, 0], [0, 0.12, 0.34, 0], [-0.17, 0, 0.24, Math.PI / 2], [0.17, 0, 0.24, Math.PI / 2]]) put(box(l, 0.1, 0.04), 0xd8c39a, lx, 0, lz, { ry });
    put(box(0.07, 0.075, 0.012), PAL.dark, 0, 0, 0.142);
    for (const k of [-0.1, 0.1]) { put(cyl(0.05, 0.05, 0.03, 10), 0xd8c39a, k, 0.1, -0.12); put(dome(0.05), 0xc9b088, k, 0.13, -0.12); }
  }
  L[5] = B => {    // Ananuri, by the lake
    B.add(box(1, 0.012, 0.3), PAL.water, 0, 0, -0.42);
    fortress(B, 0.12, -0.12, 0.36, 0.26, 0.11, PAL.stone2, { tr: 0.045 });
    church(B, 0.12, -0.12, 0.55, 0xd6c49c, 0x7a7a6a);
    caravanserai(B, -0.24, 0.16, 0.75); camel(B, 0.25, 0.25, -0.4);
    pine(B, -0.4, -0.18, 1.1);
  };
  L[15] = B => {   // Gonio, by the sea
    B.add(box(1, 0.014, 0.42), 0x3f97c4, 0, 0, -0.42);
    fortress(B, 0.05, -0.12, 0.46, 0.32, 0.12, 0xc9b48e, { tr: 0.045 });
    palm(B, -0.38, 0.12); palm(B, 0.38, 0.06, 0.9);
    camel(B, 0.0, 0.24, 0.3);
  };
  L[25] = B => {   // Rikoti: the mountain pass and its tunnel
    mountain(B, -0.22, -0.32, 0.36, 0.74, { seed: 151, snow: 0.7, green: 0x82a456 });
    mountain(B, 0.25, -0.3, 0.34, 0.66, { seed: 152, snow: 0.72, green: 0x82a456 });
    B.add(box(0.14, 0.012, 0.9), 0xb3a283, 0.0, 0, 0.1);
    B.add(box(0.12, 0.09, 0.03), PAL.dark, 0.0, 0.0, -0.1);
    for (const [x, h] of [[-0.075, 0.12], [0.075, 0.12]]) B.add(box(0.03, h, 0.05), PAL.stone2, x, 0, -0.1);
    B.add(box(0.18, 0.03, 0.05), PAL.stone2, 0, 0.11, -0.1);
    camel(B, -0.02, 0.22, 1.5); camel(B, 0.02, 0.38, 1.5, 0.9);
  };
  L[35] = B => {   // Tbilisi's caravanserai in the old city
    caravanserai(B, 0, -0.18, 1.2);
    balconyHouse(B, -0.34, 0.08, 0.15, 0.2, 0xe6b8a0, 0.3); balconyHouse(B, 0.34, 0.1, 0.15, 0.18, 0xc9dfe0, -0.3);
    camel(B, 0, 0.24, 0.2);
  };
  // the mill and the wine cellar
  L[12] = B => {
    B.add(box(0.14, 0.014, 1.1), PAL.water, 0.3, 0, 0);
    mill(B, 0.02, -0.12);
    tree(B, -0.34, -0.32, 1.1); tree(B, -0.32, 0.18, 0.9, PAL.leaf2);
    B.add(box(0.12, 0.012, 0.12), 0xd9c08f, -0.1, 0, 0.24); for (let k = 0; k < 3; k++) B.add(cyl(0.025, 0.03, 0.05, 8), 0xe8dcc0, -0.14 + k * 0.04, 0.012, 0.24);
  };
  L[28] = B => {
    house(B, -0.05, -0.2, 0.3, 0.2, 0.13, PAL.stone, PAL.wood);
    for (const [x, z] of [[-0.18, 0.12], [-0.02, 0.16], [0.14, 0.1]]) qvevri(B, x, z, 1, 0.4);
    vineyard(B, 0.0, -0.46, 0.9, 0.14, 0, 2);
    B.add(cyl(0.04, 0.04, 0.09, 10), PAL.wood, 0.33, 0, 0.2, { rx: Math.PI / 2 });
  };
  // the cards and the taxes
  const chestLot = B => { chestProp(B, 0, -0.08, 1.4); bush(B, -0.36, 0.2); bush(B, 0.36, 0.22); rock(B, 0.3, -0.35, 0.06, PAL.stone3, 2); };
  const scrollLot = B => { scrollProp(B, 0, -0.08, 1.5); tree(B, -0.34, -0.3, 0.9); bush(B, 0.34, 0.22); };
  L[2] = chestLot; L[17] = chestLot; L[33] = chestLot;
  L[7] = scrollLot; L[22] = scrollLot; L[36] = scrollLot;
  L[4] = B => { moneyBag(B, -0.15, -0.12, 1.3); moneyBag(B, 0.1, -0.24, 1); coins(B, 0.12, 0.08, 6, 1.2); };
  L[38] = B => {   // the customs gate
    B.add(box(0.06, 0.2, 0.06), PAL.wood2, -0.3, 0, -0.05);
    for (let k = 0; k < 6; k++) B.add(box(0.1, 0.03, 0.03), k % 2 ? PAL.white : PAL.red, -0.22 + k * 0.1, 0.16, -0.05);
    house(B, 0.2, -0.28, 0.2, 0.16, 0.13, 0xe8dcc0, PAL.terra);
    coins(B, -0.2, 0.2, 3, 1);
  };

  // what stands where on the inside corners of the ring of squares
  function ringCorner(B, k) {
    if (k === 0) { tree(B, -0.3, -0.25, 1.2); tree(B, 0.1, -0.35, 1); pine(B, 0.32, 0.1, 1.2); tree(B, -0.05, 0.25, 1.1, PAL.leaf2); B.add(box(0.36, 0.01, 0.24), PAL.water, 0.0, 0, 0); bush(B, 0.3, 0.32); }
    if (k === 1) { mountain(B, -0.1, -0.1, 0.42, 0.6, { snow: 0.8, seed: 171, rock: 0x9a958a, green: 0x8d9a74 }); rock(B, 0.3, 0.25, 0.08, PAL.stone3, 5); pine(B, 0.3, -0.3); }
    if (k === 2) { vineyard(B, 0, 0, 0.9, 0.8, 0.4, 7); qvevri(B, 0.3, 0.32, 1.2, 0.3); }
    if (k === 3) { mountain(B, 0, -0.05, 0.55, 1.0, { snow: 0.5, seed: 181 }); mountain(B, 0.32, 0.25, 0.25, 0.42, { snow: 0.6, seed: 182 }); }
  }

  // ===== what the players build, painted in their colour: a tower (1 to 4 on a square) or a fortress =====
  function towerParts() {
    const B = new Builder(), R = new Builder();
    B.add(taper(0.16, 0.135, 0.24), PAL.stone, 0, 0, 0);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.add(box(0.04, 0.04, 0.04), PAL.stone2, dx * 0.05, 0.24, dz * 0.05);
    B.add(box(0.045, 0.07, 0.01), PAL.dark, 0, 0, 0.078);
    B.add(box(0.03, 0.04, 0.01), PAL.dark, 0, 0.14, 0.072);
    R.add(cone(0.085, 0.13, 8), 0xffffff, 0, 0.24, 0);
    R.add(box(0.006, 0.06, 0.006), 0xffffff, 0, 0.37, 0);
    return { body: B.build(), roof: R.build() };
  }
  function castleParts() {
    const B = new Builder(), R = new Builder();
    fortress(B, 0, 0, 0.46, 0.22, 0.14, PAL.stone, { tr: 0.05 });
    B.add(box(0.15, 0.3, 0.13), PAL.stone, 0, 0, -0.02);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) R.add(cone(0.065, 0.11, 8), 0xffffff, dx * 0.23, 0.19, dz * 0.11);
    R.add(pyr(0.18, 0.13, 0.16), 0xffffff, 0, 0.3, -0.02);
    return { body: B.build(), roof: R.build() };
  }

  // ===== public =====
  function lot(i) {
    const B = new Builder();
    const f = L[i];
    if (f) f(B);
    return B.parts.length ? B.build() : null;
  }
  function corner(i) {
    const B = new Builder();
    if (i === 0) { coins(B, -0.25, -0.32, 7, 1.3); moneyBag(B, 0.22, -0.4, 1.5); }
    if (i === 10) { cage(B, -0.08, -0.32); squareTower(B, 0.46, -0.52, 0.16, 0.42, PAL.stone3); for (let k = 0; k < 3; k++) B.add(cyl(0.006, 0.006, 0.07, 4), 0x2a2a2a, 0.45 + (k - 1) * 0.022, 0.26, -0.43); }
    if (i === 20) supra(B, 0, -0.3, 0);
    if (i === 30) { guard(B, 0, -0.3, 0, 1.5); B.add(box(0.06, 0.34, 0.06), PAL.wood2, -0.42, 0, -0.5); B.add(box(0.2, 0.12, 0.012), PAL.red, -0.34, 0.24, -0.5); }
    return B.parts.length ? B.build() : null;
  }
  function inner(k) { const B = new Builder(); ringCorner(B, k); return B.build(); }
  let towerCache = null, castleCache = null;
  return {
    PAL, GROUND, Builder, lot, corner, inner, rng, tone,
    tower: () => towerCache || (towerCache = towerParts()),
    castle: () => castleCache || (castleCache = castleParts()),
    shapes: { box, cyl, cone, pyr, ball, roof, dome, lathe, taper }
  };
})();
