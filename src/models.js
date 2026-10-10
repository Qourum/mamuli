// ===== the 3D world on the board, made in code (nothing to download) =====
// The land itself is the relief (terrain.js): each place here first shapes its ground (its peaks, hills, rocks, river
// bed, the level spots for its buildings), then builds on it. Buildings, trees and rocks are made of simple solids:
// stone and roofs get a slight tint per face (like stones and tiles), leaves are round clusters shaded darker
// underneath, and every piece stands on the land where it is put.
// A place's frame: x runs along the board's side, +z towards its square (and the camera), y up from the land.

const Models = (() => {
  const T = window.THREE;
  if (!T) return null;
  T.ColorManagement.legacyMode = false;               // colours given in sRGB, as in the CSS

  const M4 = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler(), V = new T.Vector3(), SC = new T.Vector3(), C = new T.Color(), V2 = new T.Vector3(), V3 = new T.Vector3();

  // the same little random number for the same spot: vertices shared by two faces have to move together
  function hash3(x, y, z) { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
  function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function tone(hex, f) { C.set(hex); C.r = Math.min(1, C.r * f); C.g = Math.min(1, C.g * f); C.b = Math.min(1, C.b * f); return C.getHex(); }

  const PAL = {
    stone: 0xd6cbb6, stone2: 0xb9ad96, stone3: 0x958a78, slate: 0x75706a, slate2: 0x5b5751, svan: 0xddd2bd, svanRoof: 0x57524c,
    wood: 0x86593a, wood2: 0x5b3a24, terra: 0xb85c3c, terra2: 0x9c4a35, churchRoof: 0x667c6c, snow: 0xf3f6f9, rock: 0x8b857a,
    leaf: 0x4a8a3c, leaf2: 0x3b7136, pine: 0x2c5f38, pine2: 0x386f43, autumn: 0xc9802f, trunk: 0x5f4430, water: 0x3d82a3,
    gold: 0xe7b84a, red: 0xc0362c, white: 0xf0eadd, brick: 0xae5c3d, sand: 0xd5bd8c, cliff: 0xc4a274, vine: 0x5a9236,
    soil: 0x86694a, dark: 0x352820, glass: 0x2e3a44, silver: 0xc9ced6, cloth: 0xf4efe4
  };
  // each region's grass, and its snow line (in the board's units of height)
  const REGION = [[0x8e9a6f, 0.78], [0x7a9a4b, 0.74], [0x6a9a3f, 9], [0x84a047, 9], [0xa79f61, 9], [0x99a457, 9], [0x8ea149, 9], [0xa49a70, 9]];
  const PLAIN = 0x8ea455;

  // ----- shapes, standing on y = 0 -----
  const box = (w, h, d) => new T.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const cyl = (rt, rb, h, seg = 8) => new T.CylinderGeometry(rt, rb, h, seg).translate(0, h / 2, 0);
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
  // lumpy: every vertex pushed in or out a little (the same push for the same spot, so nothing tears)
  function jitter(g, amt, seed = 1) {
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      // positions rounded first: the same corner reached from two faces may differ in its last digits
      const X = p.getX(k), Y = p.getY(k), Z = p.getZ(k), f = 1 + (hash3(Math.round(X * 2000) * 0.0091 + seed, Math.round(Y * 2000) * 0.0097, Math.round(Z * 2000) * 0.0083 - seed) - 0.5) * 2 * amt;
      p.setXYZ(k, X * f, Y * (1 + (f - 1) * 0.6), Z * f);
    }
    return g;
  }
  function lump(r, seed, sy = 0.7) {
    const g = new T.DodecahedronGeometry(r, 0), p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const X = p.getX(k), Y = p.getY(k), Z = p.getZ(k), f = 0.8 + hash3(X * 5 + seed, Y * 5, Z * 5) * 0.4; p.setXYZ(k, X * f, Y * f * sy, Z * f); }
    return g.translate(0, r * sy * 0.55, 0);
  }

  // ----- a builder: collects pieces and merges them into one geometry with a colour per face -----
  // Options of a piece: o.round (leaves: its shading is soft, its normals point out from its middle), o.smooth (soft
  // shading from its own surface), o.vary (how much each face's colour differs, like stones; 0.05 when not given,
  // none for round pieces), o.sway and o.water (it moves in the board's shader: leaves and vines sway more the higher
  // they are, water lying still shimmers (1), falling water runs (2)), o.free (not set on the land).
  // When the builder has a ground(x, z), every piece and frame is raised onto the land at its spot.
  let partSeed = 0;
  function Builder() { this.parts = []; this.ground = null; }
  Builder.prototype.add = function (g, color, x = 0, y = 0, z = 0, o = {}, parent = null) {
    let gy = 0;
    if (!parent && this.ground && !o.free) { gy = this.ground(x, z); y += gy; }
    if (o.smooth && g.index) g.computeVertexNormals();
    if (g.index) g = g.toNonIndexed();
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (!o.smooth && g.attributes.normal) g.deleteAttribute('normal');
    const p = g.attributes.position, n = p.count, c = new Float32Array(n * 3);
    if (o.round) {
      g.computeBoundingBox(); const ctr = g.boundingBox.getCenter(V3), nr = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) { V.fromBufferAttribute(p, k).sub(ctr).normalize(); nr[k * 3] = V.x; nr[k * 3 + 1] = V.y; nr[k * 3 + 2] = V.z; }
      g.setAttribute('normal', new T.BufferAttribute(nr, 3));
    }
    const vary = o.vary != null ? o.vary : o.round ? 0 : 0.05, seed = ++partSeed;
    let y0 = Infinity, y1 = -Infinity;
    if (o.round) for (let k = 0; k < n; k++) { const yy = p.getY(k); if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
    for (let k = 0; k + 2 < n; k += 3) {
      const cy = (p.getY(k) + p.getY(k + 1) + p.getY(k + 2)) / 3;
      C.set(typeof color === 'function' ? color(cy, k / 3) : color);
      if (o.round) C.multiplyScalar(0.74 + 0.42 * (cy - y0) / Math.max(1e-6, y1 - y0));      // darker underneath
      if (vary) {
        V.fromBufferAttribute(p, k); V2.fromBufferAttribute(p, k + 1).sub(V); V3.fromBufferAttribute(p, k + 2).sub(V); V2.cross(V3).normalize();
        C.multiplyScalar(1 + (hash3(V2.x * 3.1 + seed, V2.y * 5.3, V2.z * 7.7) - 0.5) * 2 * vary);
      }
      for (let j = 0; j < 3; j++) { c[(k + j) * 3] = C.r; c[(k + j) * 3 + 1] = C.g; c[(k + j) * 3 + 2] = C.b; }
    }
    g.setAttribute('color', new T.BufferAttribute(c, 3));
    E.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ'); Q.setFromEuler(E);
    const s = o.s || 1;
    M4.compose(V.set(x, y, z), Q, SC.set(o.sx || s, o.sy || s, o.sz || s));
    if (parent) M4.premultiply(parent);
    g.applyMatrix4(M4);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (o.sway || o.water) {
      const a = new Float32Array(n * 2), sw = o.sway || 0;
      for (let k = 0; k < n; k++) { a[k * 2] = sw ? sw * Math.min(1, Math.max(0.25, (p.getY(k) - gy) / 0.3)) : 0; a[k * 2 + 1] = o.water || 0; }
      g.setAttribute('anim', new T.BufferAttribute(a, 2));
    }
    this.parts.push(g);
    return this;
  };
  // a frame inside the place: a model built around (0, 0) is placed, turned and scaled as a whole (on the land)
  Builder.prototype.at = function (x, z, ry = 0, s = 1, y = 0) {
    const gy = this.ground ? this.ground(x, z) : 0;
    const P = new T.Matrix4().compose(new T.Vector3(x, y + gy, z), new T.Quaternion().setFromEuler(new T.Euler(0, ry, 0)), new T.Vector3(s, s, s));
    return (g, color, lx = 0, ly = 0, lz = 0, o = {}) => this.add(g, color, lx, ly, lz, o, P);
  };
  // everything fn() adds is raised by dy more
  Builder.prototype.lift = function (dy, fn) { const n = this.parts.length; fn(); for (let k = n; k < this.parts.length; k++) this.parts[k].translate(0, dy, 0); return this; };
  Builder.prototype.build = function () {
    let n = 0;
    for (const g of this.parts) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), anim = new Float32Array(n * 2);
    let o = 0;
    for (const g of this.parts) {
      pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o); col.set(g.attributes.color.array, o);
      if (g.attributes.anim) anim.set(g.attributes.anim.array, o / 3 * 2);
      o += g.attributes.position.count * 3;
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.BufferAttribute(nor, 3));
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    g.setAttribute('anim', new T.BufferAttribute(anim, 2));          // always there: the board's shader reads it
    g.computeBoundingSphere();
    return g;
  };

  // ===== trees, bushes, rocks =====
  // a broadleaf tree: a crooked trunk and a crown of a few round clusters
  function tree(B, x, z, s = 1, leaf = PAL.leaf) {
    const r = rng(Math.round(x * 997 + z * 613) + 7);
    B.add(cyl(0.013 * s, 0.022 * s, 0.12 * s, 6), PAL.trunk, x, 0, z, { rz: (r() - 0.5) * 0.15 });
    B.add(jitter(ball(0.085 * s, 1), 0.16, r() * 9), tone(leaf, 0.95 + r() * 0.12), x, 0.17 * s, z, { sy: 0.95, round: true, sway: 1 });
    B.add(jitter(ball(0.058 * s, 0), 0.2, r() * 9), tone(leaf, 1.04), x + (r() - 0.5) * 0.09 * s, 0.13 * s, z + (r() - 0.5) * 0.08 * s, { round: true, sway: 0.9 });
    B.add(jitter(ball(0.05 * s, 0), 0.2, r() * 9), tone(leaf, 0.9), x + (r() - 0.5) * 0.08 * s, 0.22 * s, z + (r() - 0.5) * 0.06 * s, { round: true, sway: 1 });
  }
  function bigTree(B, x, z, s = 1, leaf = PAL.leaf2) {        // the old plane tree of Telavi
    B.add(cyl(0.026 * s, 0.05 * s, 0.17 * s, 7), PAL.trunk, x, 0, z);
    for (const [dx, dz, ry] of [[0.05, 0.02, 0.5], [-0.04, -0.02, -0.6]]) B.add(cyl(0.008 * s, 0.016 * s, 0.11 * s, 5), PAL.trunk, x + dx * s * 0.3, 0.14 * s, z + dz * s * 0.3, { rz: ry });
    B.add(jitter(ball(0.13 * s, 1), 0.14, 3), leaf, x, 0.27 * s, z, { sy: 0.8, round: true, sway: 0.7 });
    B.add(jitter(ball(0.09 * s, 1), 0.16, 5), tone(leaf, 1.12), x + 0.08 * s, 0.31 * s, z + 0.03 * s, { round: true, sway: 0.8 });
    B.add(jitter(ball(0.08 * s, 0), 0.18, 7), tone(leaf, 0.95), x - 0.08 * s, 0.24 * s, z - 0.02 * s, { round: true, sway: 0.7 });
  }
  // a fir: tiers of ragged cones, lighter at the tips
  function pine(B, x, z, s = 1, snowy = false) {
    const r = rng(Math.round(x * 911 + z * 577) + 3);
    B.add(cyl(0.014 * s, 0.02 * s, 0.07 * s, 5), PAL.trunk, x, 0, z);
    const tiers = [[0.1, 0.13, 0.045], [0.082, 0.12, 0.1], [0.062, 0.11, 0.155], [0.04, 0.1, 0.205]];
    tiers.forEach(([rr, hh, yy], k) => {
      const c = snowy && k >= 2 ? tone(0xe5ebef, 0.98 + k * 0.01) : tone(k % 2 ? PAL.pine2 : PAL.pine, 0.9 + k * 0.07);
      B.add(jitter(cone(rr * s, hh * s, 8), 0.12, r() * 9), c, x, yy * s, z, { smooth: true, vary: 0, sway: 0.8, ry: r() * 6 });
    });
  }
  function poplar(B, x, z, s = 1) {
    B.add(cyl(0.012 * s, 0.016 * s, 0.07 * s, 5), PAL.trunk, x, 0, z);
    B.add(jitter(ball(0.05 * s, 1), 0.14, x * 7), PAL.leaf, x, 0.2 * s, z, { sy: 3, round: true, sway: 1.2 });
  }
  function palm(B, x, z, s = 1) {
    B.add(cyl(0.011 * s, 0.017 * s, 0.14 * s, 6), 0x8a6b46, x, 0, z, { rz: 0.06 });
    B.add(cyl(0.009 * s, 0.012 * s, 0.13 * s, 6), 0x947450, x + 0.006 * s, 0.135 * s, z, { rz: 0.14 });
    for (let k = 0; k < 8; k++) B.add(cone(0.024 * s, 0.16 * s, 4), k % 2 ? 0x4c9a45 : 0x5aa84f, x - 0.02 * s, 0.25 * s, z, { ry: k * Math.PI / 4, rz: -(Math.PI / 2 + 0.55), sway: 1.4, vary: 0.08 });
  }
  function bush(B, x, z, s = 1, c = 0x467f3b) {
    B.add(jitter(ball(0.05 * s, 0), 0.2, x * 11), c, x, 0.03 * s, z, { sy: 0.75, round: true, sway: 0.5 });
    B.add(jitter(ball(0.036 * s, 0), 0.2, z * 13), tone(c, 1.1), x + 0.04 * s, 0.025 * s, z + 0.02 * s, { sy: 0.8, round: true, sway: 0.5 });
  }
  function rock(B, x, z, s = 0.07, c = PAL.stone3, seed = 1) { B.add(lump(s, seed), c, x, -s * 0.15, z, { ry: seed, vary: 0.1 }); }

  // ===== buildings =====
  function house(B, x, z, w, d, h, wall, roofC, ry = 0) {
    const put = B.at(x, z, ry);
    put(box(w, h, d), wall);
    put(roof(w * 1.1, h * 0.6, d * 1.14), roofC, 0, h, 0, { vary: 0.08 });
    put(box(w * 0.2, h * 0.5, 0.012), PAL.dark, 0, 0, d / 2);
    put(box(w * 0.16, h * 0.22, 0.008), PAL.glass, w * 0.3, h * 0.45, d / 2);
  }
  function svanTower(B, x, z, h = 0.52, s = 1) {
    const w = 0.12 * s;
    B.add(taper(w, w * 0.84, h * 0.84), PAL.svan, x, 0, z, { vary: 0.07 });
    B.add(box(w * 1.08, h * 0.1, w * 1.08), 0xd0c4ad, x, h * 0.82, z);
    B.add(pyr(w * 1.24, h * 0.17), PAL.svanRoof, x, h * 0.92, z, { vary: 0.08 });
    B.add(box(w * 0.22, w * 0.32, 0.012), PAL.dark, x, h * 0.6, z + w * 0.44);
    B.add(box(w * 0.2, w * 0.26, 0.012), PAL.dark, x, h * 0.85, z + w * 0.55);
  }
  function svanHouse(B, x, z, ry = 0) { house(B, x, z, 0.17, 0.13, 0.1, 0xcfc2aa, PAL.svanRoof, ry); }
  function khevsurTower(B, x, z, h = 0.42, s = 1) {
    const w = 0.12 * s;
    B.add(taper(w, w * 0.78, h * 0.78), PAL.slate, x, 0, z, { vary: 0.09 });
    for (let k = 0; k < 4; k++) B.add(box(w * (0.82 - k * 0.19), h * 0.055, w * (0.82 - k * 0.19)), k % 2 ? PAL.slate : PAL.slate2, x, h * (0.78 + k * 0.055), z);
    B.add(box(w * 0.2, w * 0.3, 0.012), PAL.dark, x, h * 0.55, z + w * 0.42);
  }
  function church(B, x, z, s = 1, wall = 0xd6c29b, roofC = PAL.churchRoof, ry = 0) {
    const put = B.at(x, z, ry, s);
    put(box(0.34, 0.13, 0.13), wall, 0, 0, 0, { vary: 0.06 });
    put(box(0.13, 0.13, 0.26), wall, 0, 0, 0, { vary: 0.06 });
    put(roof(0.36, 0.07, 0.15), roofC, 0, 0.13, 0, { vary: 0.07 });
    put(roof(0.28, 0.07, 0.15), roofC, 0, 0.13, 0, { ry: Math.PI / 2, vary: 0.07 });
    put(cyl(0.055, 0.055, 0.11, 10), wall, 0, 0.16, 0);
    for (let k = 0; k < 4; k++) put(box(0.012, 0.045, 0.006), PAL.dark, Math.cos(k * Math.PI / 2) * 0.056, 0.19, Math.sin(k * Math.PI / 2) * 0.056, { ry: -k * Math.PI / 2 + Math.PI / 2 });
    put(cone(0.067, 0.09, 10), roofC, 0, 0.27, 0);
    put(box(0.008, 0.045, 0.008), PAL.gold, 0, 0.36, 0);
    put(box(0.03, 0.008, 0.008), PAL.gold, 0, 0.385, 0);
    put(box(0.04, 0.06, 0.012), PAL.dark, 0, 0, 0.13);
    for (const k of [-0.1, 0.1]) put(box(0.016, 0.04, 0.006), PAL.dark, k, 0.05, 0.066);
  }
  function bellTower(B, x, z, s = 1, wall = PAL.stone, roofC = PAL.churchRoof) {
    const put = B.at(x, z, 0, s);
    put(box(0.1, 0.22, 0.1), wall);
    put(box(0.05, 0.06, 0.104), PAL.dark, 0, 0.13, 0);
    put(pyr(0.12, 0.08), roofC, 0, 0.22, 0);
  }
  function wall(B, x, z, len, h, ry = 0, c = PAL.stone2, thick = 0.035) {
    const put = B.at(x, z, ry);
    put(box(len, h, thick), c, 0, 0, 0, { vary: 0.08 });
    const n = Math.max(3, Math.round(len / 0.045) | 1);
    for (let k = 0; k < n; k += 2) put(box(len / n, 0.026, thick * 1.15), c, -len / 2 + (k + 0.5) * len / n, h, 0);
  }
  function roundTower(B, x, z, r, h, c = PAL.stone2, roofC = null) {
    B.add(cyl(r, r * 1.06, h, 10), c, x, 0, z, { vary: 0.08 });
    if (roofC) B.add(cone(r * 1.25, r * 2, 10), roofC, x, h, z);
    else for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; B.add(box(r * 0.45, r * 0.45, r * 0.45), c, x + Math.cos(a) * r * 0.8, h, z + Math.sin(a) * r * 0.8, { ry: -a }); }
  }
  function squareTower(B, x, z, w, h, c = PAL.stone2, roofC = null) {
    B.add(box(w, h, w), c, x, 0, z, { vary: 0.08 });
    if (roofC) B.add(pyr(w * 1.2, w * 0.9), roofC, x, h, z);
    else for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.add(box(w * 0.3, w * 0.3, w * 0.3), c, x + dx * w * 0.35, h, z + dz * w * 0.35);
    B.add(box(w * 0.24, w * 0.34, 0.01), PAL.dark, x, h * 0.62, z + w / 2);
  }
  // walls around a rectangle, towers on the corners
  function fortress(B, x, z, w, d, h, c = PAL.stone2, opt = {}) {
    const put = B.at(x, z, opt.ry || 0, 1, opt.y || 0), tr = opt.tr || 0.045;
    const W = (lx, lz, len, ry) => { const p2 = (g, col, a = 0, b = 0, cc = 0, o = {}) => { const cs = Math.cos(ry), sn = Math.sin(ry); put(g, col, lx + a * cs + cc * sn, b, lz - a * sn + cc * cs, Object.assign({}, o, { ry: (o.ry || 0) + ry })); };
      p2(box(len, h, 0.035), c, 0, 0, 0, { vary: 0.08 }); const n = Math.max(3, Math.round(len / 0.045) | 1); for (let k = 0; k < n; k += 2) p2(box(len / n, 0.026, 0.04), c, -len / 2 + (k + 0.5) * len / n, h, 0); };
    W(0, d / 2, w, 0); W(0, -d / 2, w, 0); W(-w / 2, 0, d, Math.PI / 2); W(w / 2, 0, d, Math.PI / 2);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      put(cyl(tr, tr * 1.06, h * 1.35, 10), c, dx * w / 2, 0, dz * d / 2, { vary: 0.08 });
      if (opt.roof) put(cone(tr * 1.3, tr * 2.1, 10), opt.roof, dx * w / 2, h * 1.35, dz * d / 2);
      else for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; put(box(tr * 0.42, tr * 0.42, tr * 0.42), c, dx * w / 2 + Math.cos(a) * tr * 0.8, h * 1.35, dz * d / 2 + Math.sin(a) * tr * 0.8, { ry: -a }); }
    }
    if (opt.gate !== false) put(box(0.05, h * 0.7, 0.012), PAL.dark, 0, 0, d / 2 + 0.02);
  }
  function caves(B, x, z, n, y0, spread, seed = 1) {
    const r = rng(seed);
    for (let k = 0; k < n; k++) B.add(box(0.035, 0.035, 0.03), PAL.dark, x + (r() - 0.5) * spread, y0 + r() * 0.05, z + r() * 0.03);
  }
  // rows of vines; on a slope each plant stands on its own ground, as on terraces
  function vineyard(B, x, z, w, d, ry = 0, rows = 4) {
    const cs = Math.cos(ry), sn = Math.sin(ry);
    const at = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
    for (let r = 0; r < rows; r++) {
      const rz = -d / 2 + (r + 0.5) * d / rows, n = Math.max(2, Math.round(w / 0.05));
      for (let k = 0; k < n; k++) {
        const [px, pz] = at(-w / 2 + (k + 0.5) * w / n, rz);
        B.add(box(0.04, 0.045, 0.03), k % 2 ? PAL.vine : tone(PAL.vine, 1.14), px, 0.004, pz, { ry, sway: 0.45, vary: 0.1 });
      }
      const [ax, az] = at(-w / 2, rz), [bx, bz] = at(w / 2, rz);
      for (const [px, pz] of [[ax, az], [bx, bz]]) B.add(box(0.008, 0.06, 0.008), PAL.wood2, px, 0, pz);
    }
  }
  function qvevri(B, x, z, s = 1, buried = 0.35) {
    B.add(lathe([[0, 0], [0.03, 0.012], [0.05, 0.05], [0.054, 0.09], [0.04, 0.13], [0.024, 0.15], [0.027, 0.162], [0.02, 0.162]], 12), 0xb0613a, x, -0.16 * buried * s, z, { s, smooth: true, vary: 0 });
  }
  function balconyHouse(B, x, z, w, h, wallC, ry = 0) {
    const put = B.at(x, z, ry), d = 0.13;
    put(box(w, h, d), wallC);
    put(roof(w * 1.08, 0.055, d * 1.16), 0x8a5a43, 0, h, 0, { vary: 0.08 });
    put(box(w * 0.92, 0.012, 0.045), PAL.wood, 0, h * 0.5, d / 2 + 0.022);
    put(box(w * 0.92, 0.035, 0.008), 0x6e4426, 0, h * 0.5 + 0.012, d / 2 + 0.042);
    for (const k of [-0.25, 0.25]) put(box(w * 0.16, h * 0.18, 0.01), PAL.glass, w * k, h * 0.7, d / 2 + 0.002);
    put(box(w * 0.14, h * 0.24, 0.01), PAL.dark, 0, 0, d / 2 + 0.002);
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
    B.add(ball(0.07 * s, 1), 0xb08a55, x, 0.065 * s, z, { sy: 0.95, smooth: false, vary: 0.04 });
    B.add(cone(0.03 * s, 0.05 * s, 6), 0xa07a45, x, 0.13 * s, z);
    B.add(cyl(0.025 * s, 0.025 * s, 0.012 * s, 6), PAL.gold, x, 0.13 * s, z);
  }
  function mill(B, x, z) {
    const put = B.at(x, z);
    put(box(0.26, 0.15, 0.2), PAL.stone);
    put(roof(0.3, 0.1, 0.24), PAL.wood, 0, 0.15, 0, { vary: 0.08 });
    put(box(0.06, 0.09, 0.012), PAL.dark, -0.05, 0, 0.1);
  }
  function guard(B, x, z, ry = 0, s = 1) {
    const put = B.at(x, z, ry, s);
    for (const k of [-0.022, 0.022]) put(box(0.026, 0.1, 0.03), 0x3e3a36, k, 0, 0);
    put(box(0.085, 0.11, 0.05), 0x9b2f26, 0, 0.1, 0);
    put(box(0.09, 0.02, 0.055), 0x5a3a1e, 0, 0.13, 0);
    put(ball(0.032, 1), 0xe8bf98, 0, 0.245, 0, { vary: 0 });
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
    // the mtsvadi grill beside it
    put(box(0.12, 0.05, 0.05), 0x3a3634, 0.32, 0, 0.12); put(box(0.13, 0.008, 0.055), 0xd0672a, 0.32, 0.05, 0.12);
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
  function caravanserai(B, x, z, s = 1) {
    const put = B.at(x, z, 0, s);
    for (const [lx, lz, l, ry] of [[0, -0.12, 0.34, 0], [0, 0.12, 0.34, 0], [-0.17, 0, 0.24, Math.PI / 2], [0.17, 0, 0.24, Math.PI / 2]]) put(box(l, 0.1, 0.04), 0xd3bd94, lx, 0, lz, { ry, vary: 0.07 });
    put(box(0.07, 0.075, 0.012), PAL.dark, 0, 0, 0.142);
    for (const k of [-0.1, 0.1]) { put(cyl(0.05, 0.05, 0.03, 10), 0xd3bd94, k, 0.1, -0.12); put(dome(0.05), 0xc4ab83, k, 0.13, -0.12, { smooth: true, vary: 0 }); }
  }

  // ===== the places: first their land (relief R, in the place's frame), then what stands on it (B) =====
  // R: peak(x, z, r, h, seed), hill(x, z, rx, rz, h, rot), mesa(x, z, rx, rz, h, edge, rot), ridge(x1, z1, x2, z2, w, h),
  //    dig(x1, z1, x2, z2, w, depth) a river, lake(x, z, rx, rz, depth, rot, sea), pad(x, z, r) level ground,
  //    path(x1, z1, x2, z2, w, colour), tint(colour, snowline).
  // The two lots on either side of a corner of the board share one square of land (the two rows of lots cross there):
  // each keeps to its own half of it, the triangle nearer its own square, split on the diagonal (z >= 0.15 + 1.05 x
  // for the first lot after a corner, z >= 0.15 - 1.05 x for the last one before it).
  const L = {};
  const CABLE = [[0.28, 0.3, -0.04], [0.0, 0.08, 0.42]];   // Narikala's cable car: the two masts (x, mast height, z)
  const reg = g => R => R.tint(REGION[g][0], REGION[g][1]);
  // Khevsureti
  L[1] = {   // Mutso: the stone towers on their crag
    r: R => { reg(0)(R); R.peak(-0.34, -0.18, 0.36, 0.78, 11); R.hill(-0.2, 0.1, 0.3, 0.22, 0.2, 0.5); for (const [x, z] of [[-0.36, 0.04], [-0.2, 0.16], [-0.06, 0.28]]) R.pad(x, z, 0.08); },
    b: B => {
      khevsurTower(B, -0.36, 0.04, 0.36, 0.95); khevsurTower(B, -0.2, 0.16, 0.44, 1); khevsurTower(B, -0.06, 0.28, 0.32, 0.9);
      rock(B, 0.08, 0.45, 0.06, PAL.slate, 4); rock(B, -0.44, 0.38, 0.05, PAL.stone3, 7); bush(B, -0.16, 0.44); pine(B, -0.44, -0.27, 0.9);
    }
  };
  L[3] = {   // Shatili: flat-roofed stone houses grown into each other
    r: R => { reg(0)(R); R.peak(-0.15, -0.44, 0.42, 0.78, 21); R.hill(0.02, -0.02, 0.44, 0.3, 0.1); R.pad(0.02, 0, 0.3); },
    b: B => {
      const r = rng(3);
      for (const [x, z, w, h] of [[-0.2, -0.05, 0.15, 0.28], [-0.05, -0.12, 0.14, 0.36], [0.1, -0.06, 0.15, 0.3], [0.24, 0.02, 0.12, 0.22], [-0.12, 0.1, 0.16, 0.16], [0.06, 0.12, 0.14, 0.18]]) {
        B.add(taper(w, w * 0.92, h), tone(PAL.slate, 0.92 + r() * 0.16), x, 0, z, { vary: 0.1 });
        B.add(box(w * 0.98, 0.02, w * 0.98), PAL.slate2, x, h, z);
        B.add(box(w * 0.5, 0.035, 0.03), PAL.wood, x, h * 0.62, z + w / 2 + 0.01);
      }
      pine(B, 0.36, -0.25, 0.9); pine(B, -0.38, 0.2, 0.8);
    }
  };
  // Svaneti
  L[6] = {   // Latali
    r: R => { reg(1)(R); R.peak(0.08, -0.42, 0.48, 0.95, 31); R.hill(-0.05, -0.1, 0.5, 0.3, 0.12); for (const [x, z, r] of [[-0.1, -0.06, 0.09], [0.14, 0.02, 0.09], [0.02, 0.18, 0.12], [-0.28, 0.16, 0.12]]) R.pad(x, z, r); },
    b: B => {
      pine(B, -0.36, -0.32, 1.1, true); pine(B, -0.26, -0.18, 0.9, true); pine(B, 0.36, -0.12, 1, true);
      svanTower(B, -0.1, -0.06, 0.5); svanTower(B, 0.14, 0.02, 0.44);
      svanHouse(B, 0.02, 0.18); svanHouse(B, -0.28, 0.16, 0.3);
      bush(B, 0.33, 0.28);
    }
  };
  L[8] = {   // Ushguli under Shkhara
    r: R => { reg(1)(R); R.peak(-0.05, -0.44, 0.55, 1.2, 41); R.peak(0.34, -0.36, 0.3, 0.62, 42); R.hill(0, 0.02, 0.5, 0.3, 0.08); for (const [x, z] of [[-0.24, -0.02], [-0.05, 0.06], [0.16, -0.04], [0.3, 0.12], [-0.2, 0.22], [0.08, 0.26]]) R.pad(x, z, 0.1); },
    b: B => {
      svanTower(B, -0.24, -0.02, 0.52); svanTower(B, -0.05, 0.06, 0.6); svanTower(B, 0.16, -0.04, 0.48); svanTower(B, 0.3, 0.12, 0.4, 0.9);
      svanHouse(B, -0.2, 0.22, -0.2); svanHouse(B, 0.08, 0.26);
      rock(B, -0.4, 0.3, 0.05, PAL.stone3, 3);
    }
  };
  L[9] = {   // Mestia
    r: R => { reg(1)(R); R.peak(0.32, -0.2, 0.4, 1.0, 51); for (const [x, z, r] of [[0.36, 0.06, 0.08], [0.2, 0.16, 0.08], [0.06, 0.32, 0.08], [0.36, 0.36, 0.1], [0.18, 0.46, 0.08], [-0.1, 0.48, 0.08]]) R.pad(x, z, r); },
    b: B => {
      svanTower(B, 0.36, 0.06, 0.54); svanTower(B, 0.2, 0.16, 0.6); svanTower(B, 0.06, 0.32, 0.5);
      church(B, 0.36, 0.36, 0.5, 0xd5c9b1, PAL.svanRoof);
      svanHouse(B, 0.18, 0.46, -0.2); svanHouse(B, -0.1, 0.48, 0.2);
      pine(B, 0.44, -0.3, 0.9, true);
    }
  };
  // Samegrelo
  L[11] = {  // Nokalakevi: the old walls of Archaeopolis on a green hill, the river below
    r: R => { reg(2)(R); R.hill(-0.28, -0.02, 0.32, 0.3, 0.3); R.dig(-0.55, 0.47, 0.3, 0.53, 0.09, 0.05); R.pad(-0.28, 0.02, 0.2); R.pad(-0.33, 0.26, 0.1); },
    b: B => {
      wall(B, -0.28, 0.02, 0.32, 0.11, 0.3, PAL.stone2); roundTower(B, -0.44, -0.07, 0.05, 0.2); roundTower(B, -0.13, 0.1, 0.05, 0.18);
      church(B, -0.33, 0.26, 0.45, 0xcabd9c, PAL.terra2);
      tree(B, -0.46, -0.26); bush(B, 0.06, 0.37); bush(B, -0.12, 0.36, 0.8);
    }
  };
  L[13] = {  // Rukhi fortress
    r: R => { reg(2)(R); R.hill(0, -0.16, 0.5, 0.42, 0.2); R.pad(0, -0.16, 0.3); },
    b: B => {
      fortress(B, 0, -0.16, 0.42, 0.3, 0.13, PAL.stone2, { tr: 0.05 });
      squareTower(B, 0.05, -0.2, 0.11, 0.26);
      palm(B, -0.34, 0.2); tree(B, 0.33, 0.2, 0.9); bush(B, 0.12, 0.3);
    }
  };
  L[14] = {  // Zugdidi: the Dadiani palace among palms
    r: R => { reg(2)(R); R.pad(0, -0.16, 0.34); R.path(0, -0.05, 0, 0.62, 0.07, 0xc2ad86); },
    b: B => {
      palace(B, 0, -0.18, 1.1);
      for (const [x, z] of [[-0.36, -0.3], [0.36, -0.28], [-0.33, 0.12], [0.34, 0.14]]) palm(B, x, z, 1.05);
      for (let k = 0; k < 3; k++) bush(B, -0.1 + k * 0.1, 0.16, 0.7, 0x3f8a3a);
    }
  };
  // Imereti
  L[16] = {  // Shorapani: a ruined fortress above the river
    r: R => { reg(3)(R); R.dig(-0.55, 0.3, 0.55, 0.32, 0.13, 0.06); R.hill(0, -0.2, 0.44, 0.38, 0.36); R.pad(-0.04, -0.22, 0.24); },
    b: B => {
      wall(B, -0.04, -0.22, 0.32, 0.09, 0.2, PAL.stone2, 0.03); roundTower(B, 0.12, -0.18, 0.05, 0.16); squareTower(B, -0.18, -0.26, 0.09, 0.2);
      tree(B, -0.36, 0.08, 1, PAL.autumn); tree(B, 0.35, 0.05, 0.9); bush(B, 0.2, 0.12);
    }
  };
  L[18] = {  // Geguti: the palace ruins
    r: R => { reg(3)(R); R.hill(0, -0.3, 0.44, 0.4, 0.12); R.pad(-0.02, -0.22, 0.3); },
    b: B => {
      for (const [x, z, w, h, ry] of [[-0.15, -0.2, 0.3, 0.18, 0], [0.1, -0.12, 0.22, 0.14, Math.PI / 2], [0.12, -0.32, 0.26, 0.2, 0]]) {
        B.add(box(w, h, 0.045), PAL.brick, x, 0, z, { ry, vary: 0.1 });
        B.add(box(0.06, h * 0.55, 0.05), PAL.dark, x, 0, z, { ry });
      }
      tree(B, -0.34, 0.12, 1.1, PAL.autumn); tree(B, 0.32, 0.16, 1, 0xd29a3a); tree(B, -0.05, 0.22, 0.8, PAL.autumn);
    }
  };
  L[19] = {  // Kutaisi: Bagrati on its hill, the Rioni below
    r: R => { reg(3)(R); R.hill(0.3, 0.02, 0.36, 0.3, 0.26); R.dig(-0.3, 0.52, 0.55, 0.47, 0.08, 0.05); R.pad(0.33, 0.1, 0.2); R.pad(0.1, 0.36, 0.08); R.pad(0.44, 0.38, 0.08); },
    b: B => {
      church(B, 0.33, 0.1, 0.85, 0xd6c497, 0x667c6c);
      house(B, 0.1, 0.36, 0.13, 0.11, 0.1, 0xe5d3b3, PAL.terra); house(B, 0.44, 0.38, 0.13, 0.11, 0.1, 0xdecaa8, PAL.terra);
      tree(B, -0.12, 0.42, 0.9, PAL.autumn); tree(B, 0.46, -0.28, 0.8);
    }
  };
  // Samtskhe
  L[21] = {  // Khertvisi: walls on a rock where two rivers meet
    r: R => { reg(4)(R); R.dig(-0.48, -0.56, -0.48, 0.62, 0.1, 0.07); R.dig(-0.55, 0.5, 0.25, 0.54, 0.08, 0.05); R.mesa(-0.26, 0.11, 0.24, 0.2, 0.36, 0.34); R.pad(-0.26, 0.11, 0.16); },
    b: B => {
      fortress(B, -0.27, 0.12, 0.28, 0.18, 0.12, 0xb5a283, { tr: 0.04, gate: false }); squareTower(B, -0.22, 0.1, 0.09, 0.2, 0xb5a283);
      bush(B, 0.04, 0.36, 0.9, 0x7d8f45); rock(B, -0.07, 0.44, 0.05, PAL.cliff, 3); rock(B, 0.14, 0.47, 0.04, PAL.cliff, 6);
    }
  };
  L[23] = {  // Atskuri
    r: R => { reg(4)(R); R.hill(0.05, -0.26, 0.5, 0.42, 0.32); R.pad(0.02, -0.3, 0.22); R.pad(-0.2, 0.02, 0.12); },
    b: B => {
      wall(B, 0.0, -0.28, 0.36, 0.1, -0.3, 0xb9a786); roundTower(B, 0.18, -0.36, 0.05, 0.2, 0xb9a786);
      church(B, -0.2, 0.02, 0.6, 0xcfba90, PAL.terra2);
      bush(B, 0.3, 0.2, 0.9, 0x7d8f45); rock(B, 0.14, 0.24, 0.06, PAL.cliff, 9);
    }
  };
  L[24] = {  // Akhaltsikhe: Rabati and its golden dome
    r: R => { reg(4)(R); R.hill(0, -0.2, 0.52, 0.4, 0.07); R.pad(0, -0.18, 0.36); },
    b: B => {
      fortress(B, 0, -0.18, 0.56, 0.38, 0.14, 0xcab38b, { tr: 0.05, roof: PAL.terra2 });
      B.add(cyl(0.07, 0.07, 0.12, 12), 0xe3d5b8, -0.05, 0, -0.2); B.add(dome(0.072, 12), PAL.gold, -0.05, 0.12, -0.2, { smooth: true, vary: 0 });
      B.add(cyl(0.02, 0.024, 0.32, 8), 0xe3d5b8, 0.16, 0, -0.26); B.add(cone(0.028, 0.06, 8), PAL.gold, 0.16, 0.32, -0.26);
      house(B, 0.14, -0.08, 0.12, 0.1, 0.09, 0xe6d8bc, PAL.terra);
      tree(B, -0.35, 0.22, 0.9); bush(B, 0.32, 0.26);
    }
  };
  // Kartli
  L[26] = {  // Surami: the fortress on its rock
    r: R => { reg(5)(R); R.mesa(0, -0.2, 0.27, 0.23, 0.26, 0.4); R.pad(0, -0.22, 0.17); },
    b: B => {
      for (const [x, z, l, ry] of [[0, -0.34, 0.36, 0], [-0.17, -0.2, 0.26, Math.PI / 2], [0.17, -0.2, 0.26, Math.PI / 2]]) wall(B, x, z, l, 0.12, ry, PAL.stone2);
      squareTower(B, 0, -0.24, 0.12, 0.3, PAL.stone2);
      tree(B, -0.34, 0.18, 1); poplar(B, 0.34, 0.12); poplar(B, 0.42, 0.22, 0.9); bush(B, 0.1, 0.28);
      // the bakery's clay oven: Surami's sweet bread
      B.add(dome(0.055, 10), 0xc59a6b, -0.12, 0, 0.26, { smooth: true, vary: 0 }); B.add(box(0.03, 0.025, 0.01), PAL.dark, -0.12, 0, 0.312);
    }
  };
  L[27] = {  // Uplistsikhe: the cave town in the rock above the Mtkvari
    r: R => { reg(5)(R); R.mesa(0, -0.24, 0.48, 0.28, 0.4, 0.5); R.dig(-0.55, 0.38, 0.55, 0.36, 0.12, 0.06); R.pad(0.16, -0.32, 0.12); },
    b: B => {
      caves(B, 0, 0.03, 10, 0.06, 0.6, 5);
      church(B, 0.16, -0.32, 0.5, 0xc6a06a, PAL.terra2);
      bush(B, -0.36, 0.2, 0.8, 0x7d8f45); bush(B, 0.38, 0.22, 0.7, 0x7d8f45);
    }
  };
  L[29] = {  // Mtskheta: Svetitskhoveli in its walls, Jvari on the hill above, where the two rivers meet
    r: R => { reg(5)(R); R.hill(0.4, -0.14, 0.24, 0.22, 0.42); R.pad(0.4, -0.12, 0.1); R.dig(-0.3, 0.56, 0.55, 0.5, 0.08, 0.06); R.dig(0.55, 0.0, 0.48, 0.5, 0.07, 0.05); R.pad(0.22, 0.22, 0.22); },
    b: B => {
      church(B, 0.4, -0.12, 0.45, 0xc6b18a, 0x75695a);
      church(B, 0.22, 0.22, 0.85, 0xdfcca0, 0x667c6c);
      wall(B, 0.22, 0.38, 0.42, 0.08, 0, 0xd1bf99); wall(B, 0.43, 0.22, 0.32, 0.08, Math.PI / 2, 0xd1bf99);
      poplar(B, -0.12, 0.47, 0.9); tree(B, 0.02, 0.44, 0.8);
    }
  };
  // Kakheti
  L[31] = {  // Sighnaghi: red roofs inside the town walls, the vineyards below
    r: R => { reg(6)(R); R.hill(-0.32, 0.08, 0.3, 0.26, 0.18); for (const [x, z] of [[-0.38, 0.0], [-0.22, 0.16], [-0.42, 0.22]]) R.pad(x, z, 0.08); R.pad(-0.24, 0.35, 0.1); },
    b: B => {
      for (const [x, z] of [[-0.38, 0.0], [-0.22, 0.16], [-0.42, 0.22]]) house(B, x, z, 0.14, 0.11, 0.12, 0xece0c2, PAL.terra);
      wall(B, -0.25, 0.35, 0.5, 0.09, -0.04, 0xd1bc95);
      for (const [x, z] of [[-0.48, 0.34], [-0.25, 0.35], [-0.02, 0.36]]) roundTower(B, x, z, 0.045, 0.17, 0xd1bc95, PAL.terra2);
      vineyard(B, -0.2, 0.48, 0.56, 0.1, 0, 2);
    }
  };
  L[32] = {  // Telavi: the king's palace and the great plane tree
    r: R => { reg(6)(R); R.hill(0.05, -0.26, 0.52, 0.36, 0.1); R.pad(0.08, -0.22, 0.34); R.pad(-0.3, 0.06, 0.12); },
    b: B => {
      fortress(B, 0.08, -0.22, 0.48, 0.32, 0.13, 0xcfb58c, { tr: 0.05 });
      house(B, 0.1, -0.24, 0.2, 0.14, 0.12, 0xe6d3af, PAL.terra);
      bigTree(B, -0.3, 0.06, 1.3);
      vineyard(B, 0.16, 0.24, 0.6, 0.18, 0, 2);
    }
  };
  L[34] = {  // Gremi: the brick citadel on its hill
    r: R => { reg(6)(R); R.hill(0, -0.24, 0.5, 0.42, 0.3); R.pad(-0.05, -0.24, 0.16); R.pad(0.22, -0.16, 0.08); },
    b: B => {
      church(B, -0.05, -0.24, 0.85, PAL.brick, 0x9c5a3c);
      squareTower(B, 0.22, -0.16, 0.11, 0.3, PAL.brick, 0x9c5a3c);
      vineyard(B, 0, 0.24, 0.9, 0.2, 0, 3);
    }
  };
  // Tbilisi
  L[37] = {  // Old Tbilisi: balconies, the sulphur baths, Metekhi on its cliff over the river
    r: R => { reg(7)(R); R.dig(-0.55, -0.1, 0.55, -0.06, 0.15, 0.07); R.mesa(0.24, -0.3, 0.21, 0.18, 0.2, 0.45); R.pad(0.24, -0.32, 0.12);
      for (const [x, z] of [[-0.3, -0.32], [-0.08, -0.36], [-0.28, 0.12], [-0.08, 0.16], [0.14, 0.14], [0.36, 0.18]]) R.pad(x, z, 0.11); },
    b: B => {
      church(B, 0.24, -0.32, 0.6, 0xd5c099, 0x857660);
      const cols = [0xe4cfa4, 0xc6dbdc, 0xe2b49d, 0xece2c4, 0xd2c1db];
      balconyHouse(B, -0.3, -0.32, 0.18, 0.22, cols[0]); balconyHouse(B, -0.08, -0.36, 0.16, 0.26, cols[1]);
      balconyHouse(B, -0.28, 0.12, 0.17, 0.2, cols[2]); balconyHouse(B, -0.08, 0.16, 0.16, 0.18, cols[3]); balconyHouse(B, 0.14, 0.14, 0.16, 0.22, cols[4]);
      for (const x of [0.32, 0.4]) B.add(dome(0.04, 10), PAL.brick, x, 0, 0.18, { smooth: true, vary: 0 });
    }
  };
  L[39] = {  // Narikala: the fortress on its ridge, Kartlis Deda beside it, the cable car going up from the old town
    r: R => { reg(7)(R); R.ridge(0.5, -0.32, 0.14, 0.1, 0.24, 0.36); R.pad(0.32, -0.1, 0.08); R.pad(0.46, 0.14, 0.07); R.pad(0.2, 0.38, 0.1); R.pad(-0.2, 0.48, 0.09); },
    b: B => {
      for (const [x, z] of [[0.42, -0.22], [0.22, 0.01]]) wall(B, x, z, 0.26, 0.1, 0.85, 0xb3a184);
      squareTower(B, 0.32, -0.1, 0.1, 0.18, 0xb3a184);
      statue(B, 0.46, 0.14, 1.3);
      church(B, 0.2, 0.38, 0.5, 0xd7c39e, 0x75695a);
      balconyHouse(B, -0.2, 0.48, 0.16, 0.18, 0xe5cba5);
      // the cable car's line up to the fortress, between two masts
      const top = CABLE.map(([x, h, z]) => [x, B.ground(x, z) + h, z]);
      for (const [x, h, z] of CABLE) { B.add(box(0.016, h, 0.016), 0x5b5f66, x, 0, z); B.add(box(0.05, 0.012, 0.02), 0x5b5f66, x, h, z); }
      const [a, b] = top, len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const up = Math.atan2(b[1] - a[1], Math.hypot(b[0] - a[0], b[2] - a[2])), ry = Math.atan2(-(b[2] - a[2]), b[0] - a[0]);
      B.add(box(len, 0.005, 0.005), 0x2b2d31, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, { ry, rz: up, free: true });
    }
  };
  // the four caravanserais
  L[5] = {   // Ananuri, by the lake
    r: R => { R.tint(0x88a050, 9); R.lake(0, -0.46, 0.6, 0.2, 0.08); R.pad(0.12, -0.12, 0.26); R.pad(-0.24, 0.16, 0.2); R.path(-0.55, 0.3, 0.55, 0.28, 0.06); },
    b: B => {
      fortress(B, 0.12, -0.12, 0.36, 0.26, 0.11, PAL.stone2, { tr: 0.045 });
      church(B, 0.12, -0.12, 0.55, 0xd3c19a, 0x75756a);
      caravanserai(B, -0.24, 0.16, 0.75);
      pine(B, -0.4, -0.18, 1.1); pine(B, 0.42, 0.12, 0.9);
    }
  };
  L[15] = {  // Gonio, by the sea
    r: R => { R.tint(0x7fa04a, 9); R.lake(0, -0.5, 0.64, 0.26, 0.09, 0, true); R.pad(0.05, -0.1, 0.32); R.path(-0.55, 0.28, 0.55, 0.26, 0.06, 0xb9a47e); },
    b: B => {
      fortress(B, 0.05, -0.1, 0.46, 0.3, 0.12, 0xc6b18c, { tr: 0.045 });
      palm(B, -0.38, 0.12); palm(B, 0.38, 0.06, 0.9); palm(B, -0.42, -0.2, 0.8);
    }
  };
  L[25] = {  // Rikoti: the mountain pass and its tunnel
    r: R => { R.tint(0x82a456, 0.72); R.peak(-0.26, -0.34, 0.4, 0.8, 151); R.peak(0.28, -0.32, 0.38, 0.72, 152); R.pad(0, -0.1, 0.14); R.path(0, -0.08, 0, 0.62, 0.11, 0xa99a7b); },
    b: B => {
      B.add(box(0.12, 0.09, 0.03), PAL.dark, 0.0, 0.0, -0.1);
      for (const x of [-0.075, 0.075]) B.add(box(0.03, 0.12, 0.05), PAL.stone2, x, 0, -0.1);
      B.add(box(0.18, 0.03, 0.05), PAL.stone2, 0, 0.11, -0.1);
      pine(B, -0.36, 0.2, 0.9); pine(B, 0.38, 0.22, 0.8);
    }
  };
  L[35] = {  // Tbilisi's caravanserai in the old city
    r: R => { R.tint(REGION[7][0], 9); R.pad(0, -0.18, 0.32); R.pad(-0.34, 0.08, 0.1); R.pad(0.34, 0.1, 0.1); R.path(-0.55, 0.3, 0.55, 0.3, 0.06, 0xb7a483); },
    b: B => {
      caravanserai(B, 0, -0.18, 1.2);
      balconyHouse(B, -0.34, 0.08, 0.15, 0.2, 0xe2b49d, 0.3); balconyHouse(B, 0.34, 0.1, 0.15, 0.18, 0xc6dbdc, -0.3);
    }
  };
  // the mill and the wine cellar
  L[12] = {
    r: R => { R.tint(PLAIN, 9); R.dig(0.3, -0.65, 0.3, 0.65, 0.15, 0.06); R.pad(0.02, -0.12, 0.2); R.pad(-0.1, 0.24, 0.1); },
    b: B => {
      mill(B, 0.02, -0.12);
      tree(B, -0.34, -0.32, 1.1); tree(B, -0.32, 0.18, 0.9, PAL.leaf2);
      B.add(box(0.12, 0.012, 0.12), 0xd4bb8b, -0.1, 0, 0.24); for (let k = 0; k < 3; k++) B.add(cyl(0.025, 0.03, 0.05, 8), 0xe5d9bd, -0.14 + k * 0.04, 0.012, 0.24);
    }
  };
  L[28] = {
    r: R => { R.tint(REGION[6][0], 9); R.hill(0, -0.46, 0.55, 0.22, 0.08); R.pad(-0.05, -0.2, 0.22); },
    b: B => {
      house(B, -0.05, -0.2, 0.3, 0.2, 0.13, PAL.stone, PAL.wood);
      for (const [x, z] of [[-0.18, 0.12], [-0.02, 0.16], [0.14, 0.1]]) qvevri(B, x, z, 1, 0.4);
      vineyard(B, 0.0, -0.46, 0.9, 0.14, 0, 2);
      B.add(cyl(0.04, 0.04, 0.09, 12), PAL.wood, 0.33, 0.04, 0.2, { rx: Math.PI / 2 });
    }
  };
  // the cards and the taxes
  const chestLot = { r: R => { R.tint(PLAIN, 9); R.hill(0, -0.12, 0.38, 0.3, 0.07); R.pad(0, -0.08, 0.22); }, b: B => { chestProp(B, 0, -0.08, 1.4); bush(B, -0.36, 0.2); bush(B, 0.36, 0.22); rock(B, 0.3, -0.35, 0.06, PAL.stone3, 2); tree(B, -0.38, -0.36, 0.9); } };
  const scrollLot = { r: R => { R.tint(PLAIN, 9); R.pad(0, -0.08, 0.2); }, b: B => { scrollProp(B, 0, -0.08, 1.5); tree(B, -0.34, -0.3, 0.9); bush(B, 0.34, 0.22); rock(B, 0.36, -0.3, 0.05, PAL.stone3, 5); } };
  L[2] = chestLot; L[17] = chestLot; L[33] = chestLot;
  L[7] = scrollLot; L[22] = scrollLot; L[36] = scrollLot;
  L[4] = { r: R => { R.tint(PLAIN, 9); R.pad(0, -0.1, 0.3); }, b: B => { moneyBag(B, -0.15, -0.12, 1.3); moneyBag(B, 0.1, -0.24, 1); coins(B, 0.12, 0.08, 6, 1.2); } };
  L[38] = {  // the customs gate
    r: R => { R.tint(PLAIN, 9); R.pad(0, -0.1, 0.42); R.path(-0.55, -0.05, 0.55, -0.05, 0.08, 0xa99a7b); },
    b: B => {
      B.add(box(0.06, 0.2, 0.06), PAL.wood2, -0.3, 0, -0.05);
      B.add(box(0.05, 0.12, 0.05), PAL.wood2, 0.34, 0, -0.05);          // the rest the barrier comes down on
      house(B, 0.2, -0.28, 0.2, 0.16, 0.13, 0xe5d9bd, PAL.terra);
      coins(B, -0.2, 0.2, 3, 1);
    }
  };

  // ===== the inside corners of the ring of squares =====
  const RING = [0x86a24e, 0x8e9a6f, 0x8ea149, 0x99a457].map((c, k) => ({
    r: R => R.tint(c, 9),
    b: B => { bush(B, 0.3, 0.29, 0.8); rock(B, 0.1, 0.12, 0.045, PAL.stone3, k + 3); bush(B, -0.14, -0.15, 0.9); tree(B, -0.4, -0.4, 1.1, k % 2 ? PAL.leaf2 : PAL.leaf); }
  }));

  // ===== the great mountain in the middle of the board (board coordinates, metres of the board) =====
  // A massif like Kazbegi's: the white summit and its shoulders, with on the side of each row of squares something of
  // its own: the church on its green hill (side 0), a Svan village (1), a waterfall from a cliff into a lake (2), a
  // forest climbing the slope (3).
  const CENTER = {
    peak: [0.12, -0.28], church: [0.22, 2.42], village: [-2.42, 0.3], fall: [0.15, -2.1], lake: [0.36, -2.74], forest: [2.4, 0.1]
  };
  function centerRelief(R) {
    R.tint(0, 0, 0x87a052, 1.75, 2.3);
    R.peak(CENTER.peak[0], CENTER.peak[1], 2.6, 3.8, 3.1);
    R.peak(-1.08, -0.98, 1.45, 1.7, 5.7); R.peak(1.18, -1.08, 1.3, 1.5, 8.2);
    R.peak(-0.92, 1.0, 1.1, 1.05, 2.4); R.peak(1.3, 0.8, 1.05, 0.95, 9.9);
    R.hill(CENTER.church[0], CENTER.church[1], 0.72, 0.52, 0.44); R.pad(CENTER.church[0], CENTER.church[1] - 0.02, 0.32);
    R.path(CENTER.church[0] + 0.5, 3.2, CENTER.church[0] + 0.1, CENTER.church[1] + 0.2, 0.06);
    R.hill(CENTER.village[0], CENTER.village[1], 0.58, 0.85, 0.26); R.pad(CENTER.village[0], CENTER.village[1], 0.5);
    R.mesa(CENTER.fall[0], CENTER.fall[1], 0.56, 0.42, 0.9, 0.45);
    { const [fx, fz] = CENTER.fall, [lx, lz] = CENTER.lake; R.dig(fx - 0.08, fz + 0.22, fx + (lx - fx) * 0.3, fz + (lz - fz) * 0.3, 0.08, 0.035); }
    R.lake(CENTER.lake[0], CENTER.lake[1], 0.56, 0.32, 0.09);
    R.dig(CENTER.lake[0] + 0.1, CENTER.lake[1] - 0.25, CENTER.lake[0] + 0.45, -3.45, 0.15, 0.05);
    R.hill(CENTER.forest[0], CENTER.forest[1], 0.72, 0.95, 0.34);
    R.tint(-2.4, 0.3, 0x7a9a4b, 1.6, 0.9); R.tint(2.4, 0.1, 0x6f9442, 1.7, 0.9);
  }
  // the waterfall: off the cliff's lip, down into the lake. Called once the land has its final shape (R: the terrain);
  // gives back where the water lands, for the spray
  function centerWater(R) {
    const [fx, fz] = CENTER.fall, [lx, lz] = CENTER.lake, wl = R.waterAt(lx, lz);
    if (wl == null) return null;
    const N = 120, step = Math.hypot(lx - fx, lz - fz) / N, pt = t => [fx + (lx - fx) * t, fz + (lz - fz) * t];
    let prev = R.height(fx, fz), lip = null, lipY = 0, foot = null;
    for (let k = 1; k <= N && !foot; k++) {
      const [x, z] = pt(k / N), y = R.height(x, z);
      if (!lip && (prev - y) / step > 2) { lip = pt((k - 1) / N); lipY = prev; }      // where the land drops away
      else if (lip && y <= wl + 0.004) foot = [x, z];                                  // where it meets the water
      prev = y;
    }
    if (!lip || !foot) return null;
    R.fall(lip[0], lipY + 0.012, lip[1], foot[0], wl + 0.003, foot[1], 0.13);
    return [foot[0], wl, foot[1]];
  }
  // made in a few steps (a pause between them when the board is made in the background): run them, then B.build()
  function center(ground) {
    const B = new Builder();
    B.ground = ground;
    const steps = [
      () => {
        const [cx, cz] = CENTER.church;
        church(B, cx, cz, 1.55, 0xcdbb97, 0x5f6f62); bellTower(B, cx + 0.42, cz + 0.08, 1.3, 0xc8b693, 0x5f6f62);
        for (const [dx, dz] of [[-0.5, 0.1], [0.62, -0.26], [-0.32, -0.34]]) tree(B, cx + dx, cz + dz, 1.4);
      },
      () => {
        const [vx, vz] = CENTER.village;
        for (const [dx, dz, h] of [[-0.1, -0.3, 0.75], [0.12, -0.05, 0.68], [-0.14, 0.24, 0.8], [0.1, 0.42, 0.62]]) svanTower(B, vx + dx, vz + dz, h, 1.35);
        for (const [dx, dz, ry] of [[0.24, -0.34, 0.4], [-0.3, 0.02, -0.3], [0.28, 0.24, 0.1], [-0.24, 0.5, 0.6]]) house(B, vx + dx, vz + dz, 0.22, 0.16, 0.13, 0xcfc2aa, PAL.svanRoof, ry + Math.PI / 2);
        for (const [dx, dz] of [[0.4, -0.6], [-0.42, -0.42], [0.42, 0.62]]) pine(B, vx + dx, vz + dz, 1.5);
      },
      () => {
        const r = rng(77), [fx, fz] = CENTER.forest;
        for (let k = 0; k < 22; k++) {
          const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.95, x = fx + Math.cos(a) * d * 0.7, z = fz + Math.sin(a) * d * 1.05;
          pine(B, x, z, 1.4 + r() * 0.8, ground(x, z) > 1.0);
        }
      },
      () => {
        const [lx, lz] = CENTER.lake;
        for (const [dx, dz] of [[-0.7, 0.05], [0.7, 0.1], [-0.55, -0.3], [0.62, -0.32]]) tree(B, lx + dx, lz + dz, 1.3, PAL.leaf2);
        for (const [x, z, s, sd] of [[-1.7, 1.9, 0.14, 3], [1.9, 1.7, 0.12, 5], [1.6, -2.2, 0.15, 7], [-1.9, -1.8, 0.13, 9], [0.9, 2.6, 0.08, 11], [-0.7, -2.6, 0.1, 13]]) rock(B, x, z, s, PAL.stone3, sd);
      }
    ];
    return { B, steps };
  }
  // the trees of the country around the board, one shape each for all of them
  function grove(pine_) {
    const B = new Builder();
    if (pine_) {
      B.add(cyl(0.03, 0.045, 0.16, 5), PAL.trunk, 0, 0, 0);
      [[0.21, 0.3, 0.1, PAL.pine], [0.155, 0.27, 0.26, PAL.pine2], [0.095, 0.23, 0.42, tone(PAL.pine, 1.12)]].forEach(([r, h, y, c], k) =>
        B.add(jitter(cone(r, h, 7), 0.1, k * 3 + 1), c, 0, y, 0, { smooth: true, vary: 0, sway: 0.5, ry: k }));
    } else {
      B.add(cyl(0.03, 0.05, 0.28, 5), PAL.trunk, 0, 0, 0);
      B.add(jitter(ball(0.2, 0), 0.18, 3), PAL.leaf, 0, 0.42, 0, { sy: 0.9, round: true, sway: 0.5 });
      B.add(jitter(ball(0.14, 0), 0.2, 5), tone(PAL.leaf, 1.12), 0.1, 0.33, 0.05, { round: true, sway: 0.5 });
      B.add(jitter(ball(0.12, 0), 0.2, 7), tone(PAL.leaf, 0.9), -0.09, 0.5, -0.04, { round: true, sway: 0.5 });
    }
    return B.build();
  }

  // ===== what moves, place by place (in the place's frame; heights above its land) =====
  // smoke: [x, z, height] chimneys and fires; sparkle: [x, z, height, kind] (1 gold, 2 white); actors: walking, sailing...
  const FX = {
    1: { actors: [{ k: 'sheep', at: [0.0, 0.42], r: 0.04 }, { k: 'sheep', at: [-0.3, 0.42], r: 0.04 }] },
    3: { smoke: [[-0.05, -0.12, 0.4], [0.1, -0.06, 0.34], [-0.12, 0.1, 0.2]] },
    6: { smoke: [[0.04, 0.18, 0.17], [-0.26, 0.16, 0.17]] },
    8: { smoke: [[-0.18, 0.22, 0.17], [0.1, 0.26, 0.17]] },
    9: { smoke: [[0.18, 0.46, 0.17], [-0.1, 0.48, 0.17]] },
    11: { actors: [{ k: 'sheep', at: [-0.04, 0.28], r: 0.04 }, { k: 'sheep', at: [0.12, 0.42], r: 0.03 }] },
    13: { actors: [{ k: 'guard', a: [-0.16, -0.01], b: [0.16, -0.01], h: 0.155, speed: 0.04, s: 0.55 }] },          // on the wall
    14: { sparkle: [[0, -0.18, 0.2, 2]] },
    16: { actors: [{ k: 'boat', a: [-0.42, 0.305], b: [0.42, 0.315], speed: 0.03 }] },                                // on the river
    18: { leaves: [[-0.34, 0.12, 0.27], [0.32, 0.16, 0.25], [-0.05, 0.22, 0.2]] },                                    // autumn
    21: { actors: [{ k: 'boat', a: [-0.48, -0.25], b: [-0.48, 0.36], speed: 0.03 }, { k: 'sheep', at: [0.0, 0.36], r: 0.035 }] },
    26: { smoke: [[-0.12, 0.26, 0.06]] },                                                                            // the bread oven
    27: { actors: [{ k: 'boat', a: [-0.42, 0.375], b: [0.42, 0.362], speed: 0.03 }], sparkle: [[-0.1, 0.03, 0.09, 1], [0.18, 0.04, 0.1, 1]] },   // torches in the caves
    29: { actors: [{ k: 'boat', a: [-0.2, 0.548], b: [0.35, 0.51], speed: 0.028 }, { k: 'sheep', at: [0.47, -0.28], r: 0.03 }] },
    34: { leaves: [[-0.2, 0.24, 0.1], [0.2, 0.24, 0.1]] },                                                          // the vintage
    19: { smoke: [[0.1, 0.36, 0.17], [0.44, 0.38, 0.17]] },
    23: { actors: [{ k: 'sheep', at: [0.24, 0.14], r: 0.06 }, { k: 'sheep', at: [0.34, 0.26], r: 0.04 }] },
    24: { smoke: [[0.14, -0.08, 0.15]], sparkle: [[-0.05, -0.2, 0.2, 1]] },
    31: { smoke: [[-0.38, 0.0, 0.2], [-0.22, 0.16, 0.2]] },
    32: { smoke: [[0.1, -0.24, 0.2]], leaves: [[-0.3, 0.06, 0.38]] },            // the great plane tree
    37: { smoke: [[0.32, 0.18, 0.04], [0.4, 0.18, 0.04], [-0.28, 0.12, 0.27]] },
    39: { actors: [{ k: 'gondola', cable: CABLE }] },
    5: { actors: [{ k: 'camel', a: [-0.05, 0.3], b: [0.42, 0.26], speed: 0.05 }, { k: 'boat', a: [-0.4, -0.47], b: [0.3, -0.45], speed: 0.04 }] },
    15: { actors: [{ k: 'camel', a: [-0.32, 0.26], b: [0.32, 0.24], speed: 0.05 }, { k: 'boat', sail: true, a: [-0.42, -0.52], b: [0.4, -0.48], speed: 0.035 }] },
    25: { actors: [{ k: 'camel', tunnel: true, a: [0.01, 0.6], b: [0, -0.34], speed: 0.06, phase: 0 }, { k: 'camel', tunnel: true, a: [0.01, 0.6], b: [0, -0.34], speed: 0.06, phase: 0.5 }] },
    35: { smoke: [[-0.34, 0.08, 0.26]], actors: [{ k: 'camel', a: [-0.22, 0.3], b: [0.22, 0.3], speed: 0.05 }] },
    12: { smoke: [[0.02, -0.12, 0.27]] },
    28: { smoke: [[-0.05, -0.2, 0.22]] },
    2: { sparkle: [[0, -0.08, 0.2, 1]] }, 17: { sparkle: [[0, -0.08, 0.2, 1]] }, 33: { sparkle: [[0, -0.08, 0.2, 1]] },
    7: { sparkle: [[0, -0.08, 0.25, 2]] }, 22: { sparkle: [[0, -0.08, 0.25, 2]] }, 36: { sparkle: [[0, -0.08, 0.25, 2]] },
    4: { sparkle: [[0, -0.1, 0.12, 1]] },
    38: { smoke: [[0.2, -0.28, 0.24]], sparkle: [[-0.2, 0.2, 0.08, 1]], actors: [{ k: 'bar', at: [-0.3, -0.05], h: 0.17, len: 0.64 }] },
    // the corner squares (on the square itself)
    0: { sparkle: [[-0.25, -0.32, 0.1, 1]] },
    10: { actors: [{ k: 'guard', a: [-0.36, -0.03], b: [0.2, -0.03], speed: 0.07, s: 1 }] },     // between the cage and the visitors
    20: { smoke: [[0.32, -0.18, 0.06]] },
    30: { actors: [{ k: 'guard', a: [-0.22, -0.3], b: [0.24, -0.3], speed: 0.05, s: 1.5 }] }
  };
  const CENTER_FX = {
    smoke: [[-2.18, 0.0, 0.22], [-2.72, 0.32, 0.22], [-2.14, 0.54, 0.22]],
    mist: [[0.24, -2.62, 0.05]],
    sheep: [[0.75, 2.75], [0.95, 2.6], [-0.4, 2.85], [-0.6, 2.6], [1.15, 2.85]]
  };

  // ----- the actors' own shapes (made around their own origin, facing +x) -----
  function actor(k) {
    const B = new Builder();
    if (k === 'camel') {
      const c = 0xc09157;
      B.add(box(0.1, 0.045, 0.042), c, 0, 0.07, 0); B.add(jitter(ball(0.026, 1), 0.1, 3), tone(c, 0.9), -0.005, 0.105, 0, { sx: 1.3, round: true });
      B.add(box(0.018, 0.06, 0.018), c, 0.058, 0.09, 0, { rz: -0.45 }); B.add(box(0.04, 0.02, 0.02), c, 0.08, 0.14, 0);
      for (const [lx, lz] of [[-0.035, -0.013], [-0.035, 0.013], [0.035, -0.013], [0.035, 0.013]]) B.add(box(0.012, 0.07, 0.012), tone(c, 0.85), lx, 0, lz);
      B.add(box(0.05, 0.03, 0.05), 0xa33a2e, -0.01, 0.115, 0);                          // its load
    } else if (k === 'sheep') {
      B.add(jitter(ball(0.032, 1), 0.18, 5), 0xf1ece0, 0, 0.042, 0, { sx: 1.35, sy: 0.85, round: true });
      B.add(ball(0.014, 0), 0x3a332d, 0.04, 0.05, 0, { sx: 1.3 });
      for (const [lx, lz] of [[-0.02, -0.012], [-0.02, 0.012], [0.02, -0.012], [0.02, 0.012]]) B.add(box(0.007, 0.03, 0.007), 0x3a332d, lx, 0, lz);
    } else if (k === 'guard') guard(B, 0, 0, Math.PI / 2, 1);
    else if (k === 'boat') {
      B.add(box(0.12, 0.022, 0.045), PAL.wood, 0, 0, 0); B.add(box(0.03, 0.026, 0.04), PAL.wood2, 0.065, 0.004, 0, { ry: Math.PI / 4, sy: 1 });
      B.add(box(0.11, 0.006, 0.04), tone(PAL.wood, 0.8), 0, 0.022, 0);
    } else if (k === 'sail') {
      B.add(box(0.12, 0.022, 0.045), 0xe9e2d2, 0, 0, 0); B.add(box(0.006, 0.12, 0.006), PAL.wood2, 0, 0.02, 0);
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([0.004, 0.035, 0, 0.004, 0.14, 0, 0.07, 0.04, 0, 0.004, 0.035, 0, 0.07, 0.04, 0, 0.004, 0.14, 0], 3));
      B.add(g, 0xf6f0e2, 0, 0, 0, { vary: 0 });
    } else if (k === 'gondola') {
      B.add(box(0.05, 0.035, 0.03), 0xc0362c, 0, -0.06, 0); B.add(box(0.052, 0.012, 0.032), 0xf0eadd, 0, -0.03, 0);
      B.add(box(0.004, 0.03, 0.004), 0x2b2d31, 0, -0.03, 0); B.add(box(0.03, 0.01, 0.025), PAL.glass, 0, -0.045, 0.002);
    } else if (k === 'bar') {
      for (let j = 0; j < 6; j++) B.add(box(0.1, 0.028, 0.028), j % 2 ? PAL.white : PAL.red, 0.05 + j * 0.1, -0.014, 0);
    } else if (k === 'cloud') {
      const r = rng(9);
      for (let j = 0; j < 6; j++) B.add(jitter(ball(0.22 + r() * 0.16, 1), 0.12, j), 0xffffff, (j - 2.5) * 0.2, r() * 0.08, (r() - 0.5) * 0.24, { sy: 0.62, round: true });
    } else if (k === 'eagle') {
      B.add(ball(0.035, 1), 0x4a3424, 0, 0, 0, { sx: 2.2, sy: 0.7, round: true }); B.add(ball(0.018, 0), 0xe9e2d2, 0.07, 0.008, 0);
      B.add(cone(0.01, 0.025, 4), 0xd9a33a, 0.09, 0.006, 0, { rz: -Math.PI / 2 });
    } else if (k === 'wing') {
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([0.03, 0, 0, -0.03, 0, 0, 0, 0, 0.16, -0.03, 0, 0, -0.05, 0, 0.12, 0, 0, 0.16], 3));
      B.add(g, 0x3e2b1e, 0, 0, 0, { vary: 0 });
    }
    return B.build();
  }

  // ===== what the players build, painted in their colour: a tower (1 to 4 on a square) or a fortress =====
  function towerParts() {
    const B = new Builder(), R = new Builder();
    B.add(taper(0.16, 0.135, 0.24), PAL.stone, 0, 0, 0);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.add(box(0.04, 0.04, 0.04), PAL.stone2, dx * 0.05, 0.24, dz * 0.05);
    B.add(box(0.045, 0.07, 0.01), PAL.dark, 0, 0, 0.078);
    B.add(box(0.03, 0.04, 0.01), PAL.dark, 0, 0.14, 0.072);
    R.add(cone(0.085, 0.13, 8), 0xffffff, 0, 0.24, 0, { vary: 0 });
    R.add(box(0.006, 0.06, 0.006), 0xffffff, 0, 0.37, 0, { vary: 0 });
    return { body: B.build(), roof: R.build() };
  }
  function castleParts() {
    const B = new Builder(), R = new Builder();
    fortress(B, 0, 0, 0.46, 0.22, 0.14, PAL.stone, { tr: 0.05 });
    B.add(box(0.15, 0.3, 0.13), PAL.stone, 0, 0, -0.02);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) R.add(cone(0.065, 0.11, 8), 0xffffff, dx * 0.23, 0.19, dz * 0.11, { vary: 0 });
    R.add(pyr(0.18, 0.13, 0.16), 0xffffff, 0, 0.3, -0.02, { vary: 0 });
    return { body: B.build(), roof: R.build() };
  }

  // ===== public =====
  function relief(i, R) { if (L[i] && L[i].r) L[i].r(R); else R.tint(PLAIN, 9); }
  function lot(i, ground) {
    const B = new Builder();
    B.ground = ground;
    if (L[i] && L[i].b) L[i].b(B);
    return B.parts.length ? B.build() : null;
  }
  function corner(i) {
    const B = new Builder();
    if (i === 0) { coins(B, -0.25, -0.32, 7, 1.3); moneyBag(B, 0.22, -0.4, 1.5); }
    if (i === 10) { cage(B, -0.08, -0.32); squareTower(B, 0.46, -0.52, 0.16, 0.42, PAL.stone3); for (let k = 0; k < 3; k++) B.add(cyl(0.006, 0.006, 0.07, 4), 0x2a2a2a, 0.45 + (k - 1) * 0.022, 0.26, -0.43); }
    if (i === 20) supra(B, 0, -0.3, 0);
    if (i === 30) { B.add(box(0.06, 0.34, 0.06), PAL.wood2, -0.42, 0, -0.5); B.add(box(0.2, 0.12, 0.012), PAL.red, -0.34, 0.24, -0.5); }
    return B.parts.length ? B.build() : null;
  }
  function ringRelief(k, R) { RING[k].r(R); }
  function inner(k, ground) { const B = new Builder(); B.ground = ground; RING[k].b(B); return B.build(); }
  let towerCache = null, castleCache = null;
  return {
    PAL, Builder, relief, lot, corner, ringRelief, inner, centerRelief, centerWater, center, grove, CENTER, CENTER_FX, actor, rng, tone,
    fx: i => FX[i] || null,
    tower: () => towerCache || (towerCache = towerParts()),
    castle: () => castleCache || (castleCache = castleParts()),
    shapes: { box, cyl, cone, pyr, ball, roof, dome, lathe, taper, jitter, lump },
    // the pieces the archipelago builds with too (sea.js)
    parts: { tree, bigTree, pine, palm, bush, rock, house, wall, roundTower, squareTower, fortress, church, coins, moneyBag, chestProp, scrollProp, guard, caves },
    LIFE: ['camel', 'sheep', 'guard', 'boat', 'sail', 'gondola', 'bar', 'cloud', 'eagle', 'wing'], world: 'land'
  };
})();
