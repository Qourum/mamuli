// ===== the land: one smooth relief under the whole board, and the country around it =====
// The ground inside the ring of squares is a single height field. Every region adds its own shapes to it (peaks with
// ridges, round hills, cliff-sided rocks, river beds, lakes, flat places for the buildings), in board coordinates;
// shapes have a reach, so neighbours blend into each other on their own. The middle of the board is the great mountain.
// Colours come from the land itself: grass in the region's own green where it is level, rock where it is steep, snow
// up high, dry patches and paths, and valleys a little darker. Water lies in the river beds and lakes as its own
// surface (it shimmers in the board's shader). Outside the board the country goes on: meadows, then hills, then
// mountains lost in the haze.
// The archipelago's world is the same relief under the sea (setWorld('sea')): the floor lies below the water, the places
// raise their islands out of it, sand runs along every shore, and the lagoon's water takes the colour of its depth, with
// foam where it meets the land. Around the board the open ocean goes on, with islands far off in the haze.

const Terrain = (() => {
  const T = window.THREE;
  if (!T) return null;
  T.ColorManagement.legacyMode = false;               // colours given in sRGB, as in the CSS (before the first colour is made)
  const C1 = new T.Color(), C2 = new T.Color(), C3 = new T.Color();

  // ----- noise -----
  function hash2(x, z) { const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return h - Math.floor(h); }
  function noise(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
  }
  function fbm(x, z, oct = 4) { let s = 0, a = 0.5, f = 1; for (let k = 0; k < oct; k++) { s += a * noise(x * f, z * f); f *= 2.03; a *= 0.5; } return s; }
  // sharp crests, as on real mountains
  function ridged(x, z, oct = 4) {
    let s = 0, a = 0.5, f = 1, w = 1;
    for (let k = 0; k < oct; k++) { let n = 1 - Math.abs(noise(x * f, z * f)); n *= n * w; w = Math.min(1, n * 2.2); s += n * a; f *= 2.1; a *= 0.5; }
    return s;
  }
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const bell = q => q >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * q);

  // ----- the shapes -----
  const feats = [], pads = [], waters = [], paths = [], tints = [];
  let bins = null, sea = false, city = false, seaField = null;
  const BIN = 1, B0 = -7, NB = 14;
  const SEA_Y = 0.02, BED = -0.16, RIM_SEA = -0.06, OCEAN_Y = -0.3;     // the water, the sea floor, along the squares, the ocean
  const VORTEX = { x: 3.45, z: 3.0, radius: 0.55, depth: 0.82 };
  function reset() { feats.length = pads.length = waters.length = paths.length = tints.length = 0; bins = null; seaField = null; }
  function setWorld(w) { sea = w === 'sea'; city = w === 'city'; reset(); }
  function put(f) { feats.push(f); bins = null; return f; }
  function rot(f, x, z) { const dx = x - f.x, dz = z - f.z, c = Math.cos(f.rot || 0), s = Math.sin(f.rot || 0); return [dx * c - dz * s, dx * s + dz * c]; }
  function segQ(f, x, z) {
    const ax = f.x2 - f.x1, az = f.z2 - f.z1, l2 = ax * ax + az * az || 1e-9;
    const t = Math.max(0, Math.min(1, ((x - f.x1) * ax + (z - f.z1) * az) / l2)), px = f.x1 + ax * t - x, pz = f.z1 + az * t - z;
    return [Math.sqrt(px * px + pz * pz) / f.w, t];
  }
  function value(f, x, z) {
    switch (f.t) {
      case 'peak': {
        const dx = x - f.x, dz = z - f.z, d = Math.sqrt(dx * dx + dz * dz) / f.reach;
        if (d >= 1) return 0;
        const k = 2.3 / f.reach, n = ridged(x * k + f.seed, z * k - f.seed * 0.7);
        return f.h * Math.pow(1 - d, 1.55) * (0.7 + 0.62 * n * (0.35 + 0.65 * (1 - d))) + f.h * 0.05 * fbm(x * 6 + f.seed, z * 6) * (1 - d);
      }
      case 'hill': {
        const [lx, lz] = rot(f, x, z), q = Math.sqrt((lx / f.rx) ** 2 + (lz / f.rz) ** 2);
        return q >= 1 ? 0 : f.h * bell(q) * (1 + 0.12 * fbm(x * 5 + f.x, z * 5));
      }
      case 'mesa': {
        const [lx, lz] = rot(f, x, z), q = Math.sqrt((lx / f.rx) ** 2 + (lz / f.rz) ** 2) * (1 + 0.1 * noise(x * 9, z * 9));
        return q >= 1.15 ? 0 : f.h * smooth(1, 1 - f.edge, q) * (1 + 0.06 * fbm(x * 7, z * 7));
      }
      case 'ridge': {
        const [q, t] = segQ(f, x, z);
        return q >= 1 ? 0 : f.h * bell(q) * (0.75 + 0.25 * Math.sin(t * Math.PI)) * (1 + 0.2 * fbm(x * 4, z * 4));
      }
      case 'dig': { const [q] = segQ(f, x, z); return q >= 1 ? 0 : -f.d * bell(q); }
      case 'lake': {
        const [lx, lz] = rot(f, x, z), q = Math.sqrt((lx / f.rx) ** 2 + (lz / f.rz) ** 2);
        return q >= 1 ? 0 : -f.d * smooth(1, 0.55, q);
      }
    }
    return 0;
  }
  function reachBox(f) {
    if (f.t === 'ridge' || f.t === 'dig') return [Math.min(f.x1, f.x2) - f.w, Math.min(f.z1, f.z2) - f.w, Math.max(f.x1, f.x2) + f.w, Math.max(f.z1, f.z2) + f.w];
    const r = f.t === 'peak' ? f.reach : Math.max(f.rx, f.rz) * 1.15;
    return [f.x - r, f.z - r, f.x + r, f.z + r];
  }
  function binIt() {
    bins = Array.from({ length: NB * NB }, () => []);
    for (const f of feats) {
      const [x0, z0, x1, z1] = reachBox(f);
      for (let i = Math.max(0, Math.floor((x0 - B0) / BIN)); i <= Math.min(NB - 1, Math.floor((x1 - B0) / BIN)); i++)
        for (let j = Math.max(0, Math.floor((z0 - B0) / BIN)); j <= Math.min(NB - 1, Math.floor((z1 - B0) / BIN)); j++) bins[j * NB + i].push(f);
    }
  }
  const RIM = 4.5, RIM_Y = 0.025, EDGE = RIM + 0.1;      // the land meets the squares at RIM, and goes on a little under them
  // the height of the land inside the board, before the flat places
  function raw(x, z) {
    if (!bins) binIt();
    let h = sea ? BED + 0.035 * fbm(x * 0.9 + 3, z * 0.9 - 2) : 0.03 + 0.028 * fbm(x * 1.15 + 3, z * 1.15 - 2), late = 0;
    const i = Math.floor((x - B0) / BIN), j = Math.floor((z - B0) / BIN);
    if (i >= 0 && j >= 0 && i < NB && j < NB) for (const f of bins[j * NB + i]) { const v = value(f, x, z); if (f.late) late = Math.min(late, v); else h += v; }
    // along the ring of squares the land comes down to meet them (the sea's floor comes up to a shallow lagoon there);
    // a river's bed (late) goes on under them
    const m = Math.max(Math.abs(x), Math.abs(z)), rim = sea ? RIM_SEA : RIM_Y;
    return rim + (h - rim) * smooth(RIM, RIM - 0.34, m) + late;
  }
  function height(x, z) {
    let h = raw(x, z);
    for (const p of pads) {
      if (Math.abs(x - p.x) > p.r || Math.abs(z - p.z) > p.r) continue;
      const dx = x - p.x, dz = z - p.z, q = Math.sqrt(dx * dx + dz * dz) / p.r;
      if (q >= 1) continue;
      if (p.y == null) p.y = raw(p.x, p.z);          // taken once every shape is in place
      h += (p.y - h) * smooth(1, 0.5, q);
    }
    if (sea) {
      // The round whirlpool depresses the seabed beneath its funnel, so the floor cannot cap the water opening.
      const q = Math.hypot(x - VORTEX.x, z - VORTEX.z) / (VORTEX.radius + 0.14);
      if (q < 1) h = Math.min(h, SEA_Y - VORTEX.depth * (1 - smooth(0.72, 1, q)));
    }
    return h;
  }

  function curve(ctrl, n) {
    const out = [], P = k => ctrl[Math.max(0, Math.min(ctrl.length - 1, k))];
    for (let k = 0; k < ctrl.length - 1; k++) for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t, a = P(k - 1), b = P(k), c = P(k + 1), e = P(k + 2);
      out.push([0, 1].map(q => 0.5 * (2 * b[q] + (c[q] - a[q]) * t + (2 * a[q] - 5 * b[q] + 4 * c[q] - e[q]) * t2 + (3 * b[q] - a[q] - 3 * c[q] + e[q]) * t3)));
    }
    out.push(ctrl[ctrl.length - 1].slice());
    return out;
  }
  // ----- what the regions call (board coordinates) -----
  const api = {
    peak: (x, z, reach, h, seed = 1) => put({ t: 'peak', x, z, reach, h, seed }),
    hill: (x, z, rx, rz, h, rotation = 0) => put({ t: 'hill', x, z, rx, rz, h, rot: rotation }),
    mesa: (x, z, rx, rz, h, edge = 0.3, rotation = 0) => put({ t: 'mesa', x, z, rx, rz, h, edge, rot: rotation }),
    ridge: (x1, z1, x2, z2, w, h) => put({ t: 'ridge', x1, z1, x2, z2, w, h }),
    // a river bed, with its water
    dig: (x1, z1, x2, z2, w, d, water = true) => { const f = put({ t: 'dig', x1, z1, x2, z2, w, d }); if (water) waters.push({ k: 'river', f }); return f; },
    // a lake (its water: true for the sea's colour, 'lava' for a volcano's crater)
    lake: (x, z, rx, rz, d, rotation = 0, kind = false) => { const f = put({ t: 'lake', x, z, rx, rz, d, rot: rotation }); waters.push({ k: 'lake', f, sea: kind === true || kind === 'sea', lava: kind === 'lava' }); return f; },
    fall: (x1, y1, z1, x2, y2, z2, w) => waters.push({ k: 'fall', a: [x1, y1, z1], b: [x2, y2, z2], w }),
    // a river at one level (a city's): a smooth line through the points, its bed dug w either side of it and d deep
    // (under the squares too), its water at height y, ww wide; colour its own
    // (color: its middle's; bank: its banks', with foam along them, when given)
    flow: (ctrl, w, d, y, ww, color = 0x4f8a8c, bank = null) => {
      const pts = curve(ctrl, 8);
      for (let k = 1; k < pts.length; k++) put({ t: 'dig', x1: pts[k - 1][0], z1: pts[k - 1][1], x2: pts[k][0], z2: pts[k][1], w, d, late: true });
      waters.push({ k: 'flow', pts, y, hw: ww / 2, c: new T.Color(color), cb: bank == null ? null : new T.Color(bank) });
      return pts;
    },
    // level ground for a building: the land around it is brought to the height at its middle
    pad: (x, z, r) => { pads.push({ x, z, r, y: null }); },
    path: (x1, z1, x2, z2, w, color = 0xa48c64) => paths.push({ x1, z1, x2, z2, w, c: new T.Color(color) }),
    // the region's grass colour and snow line around a point (and the colour of its rock, when it has its own)
    tint: (x, z, color, snow = 9, spread = 0.62, rock = null) => tints.push({ x, z, c: new T.Color(color), snow, s2: spread * spread, r: rock == null ? null : new T.Color(rock) }),
    height, raw
  };

  // ----- the colours of the land -----
  const ROCK = new T.Color(0x857b6e), ROCK2 = new T.Color(0x57524b), ROCK3 = new T.Color(0xa59a8a), SNOW = new T.Color(0xf3f6f9), DRY = new T.Color(0xb7a467), SOIL = new T.Color(0x8d7650);
  const SAND = new T.Color(0xeedcab), WET = new T.Color(0xc9b483), ROCKC = new T.Color();
  // the grass colour around a point (into out), its rock's colour (into ROCKC) and its snow line
  function regionAt(x, z, out) {
    let w = 0, snow = 0, rw = 0;
    out.setRGB(0, 0, 0); ROCKC.setRGB(0, 0, 0);
    for (const t of tints) {
      const dx = x - t.x, dz = z - t.z, d2 = dx * dx + dz * dz;
      if (d2 > t.s2 * 9) continue;
      const k = Math.exp(-d2 / t.s2), rc = t.r || ROCK;
      out.r += t.c.r * k; out.g += t.c.g * k; out.b += t.c.b * k; snow += t.snow * k; w += k;
      ROCKC.r += rc.r * k; ROCKC.g += rc.g * k; ROCKC.b += rc.b * k; rw += k;
    }
    if (rw > 1e-6) { ROCKC.r /= rw; ROCKC.g /= rw; ROCKC.b /= rw; } else ROCKC.copy(ROCK);
    if (w < 1e-6) { out.set(sea ? 0x5a9e46 : city ? 0x8cb64e : 0x8ea455); return 9; }
    out.r /= w; out.g /= w; out.b /= w;
    return snow / w;
  }
  // ao: how far the spot lies below the land around it (clefts, valleys), edge: how far above it (ridges, crests)
  function ground(x, z, y, ny, ao, edge, out) {
    const snowLine = regionAt(x, z, out), slope = 1 - ny, n1 = fbm(x * 2.4, z * 2.4), n2 = noise(x * 6.5 + 7, z * 6.5);
    out.multiplyScalar(0.84 + 0.28 * (n1 * 0.5 + 0.5));                                   // the green varies
    out.lerp(DRY, smooth(0.25, 0.7, n2 * 0.5 + 0.5) * (city ? 0.12 : 0.32));               // dry patches (the city's lawns are watered)
    for (const p of paths) {                                                              // tracks and roads
      const [q] = segQ({ x1: p.x1, z1: p.z1, x2: p.x2, z2: p.z2, w: p.w }, x, z);
      if (q < 1) out.lerp(p.c, smooth(1, 0.55, q) * 0.85);
    }
    // rock where it is steep: in layers, darker in its clefts, paler on its edges
    const band = Math.sin(y * 23 + n1 * 3.2);
    C3.copy(ROCKC).lerp(ROCK2, Math.max(0, Math.min(1, 0.22 + 0.4 * (n2 * 0.5 + 0.5) + 0.2 * band + ao * 2.5)) * (sea || city ? 0.5 : 1)).lerp(ROCK3, Math.min(0.65, edge * 3.5) * (sea || city ? 0.4 : 1));
    out.lerp(C3, smooth(0.13, 0.33, slope));
    const snow = smooth(snowLine - 0.1, snowLine + 0.06, y + 0.2 * n1 + 0.08 * n2) * (1 - smooth(0.5, 0.74, slope));
    out.lerp(SNOW, snow);
    if (sea) {                                                                             // a beach along every shore, wet below the water
      const beach = (1 - smooth(SEA_Y + 0.022, SEA_Y + 0.07, y + 0.012 * n1)) * (1 - smooth(0.3, 0.6, slope));
      out.lerp(SAND, beach);
      out.lerp(WET, smooth(SEA_Y + 0.004, SEA_Y - 0.03, y));
    }
    out.multiplyScalar(1 - ao);                                                            // valleys a little darker
    return out;
  }

  // ----- the ground inside the board: a grid, made a few rows at a time (each yield is a pause) -----
  function* board(N = 132) {
    const n = N + 1, pos = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3), hs = new Float32Array(n * n);
    const step = (EDGE * 2) / N;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = -EDGE + i * step, z = -EDGE + j * step, y = height(x, z), k = j * n + i;
        pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; hs[k] = y;
      }
      if (j % 4 === 3) yield;
    }
    const idx = new (n * n > 65535 ? Uint32Array : Uint16Array)(N * N * 6);
    let o = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      // the diagonal that follows the land: fewer folds
      if (Math.abs(hs[a] - hs[d]) < Math.abs(hs[b] - hs[c])) { idx[o++] = a; idx[o++] = c; idx[o++] = d; idx[o++] = a; idx[o++] = d; idx[o++] = b; }
      else { idx[o++] = a; idx[o++] = c; idx[o++] = b; idx[o++] = b; idx[o++] = c; idx[o++] = d; }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setIndex(new T.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    yield;
    const nor = g.attributes.normal.array;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        // how far below (or above) the land around it this spot lies: near by and a little further off
        let s1 = 0, c1 = 0, s3 = 0, c3 = 0;
        for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
          if ((di === 0 && dj === 0) || (Math.abs(di) !== 3 && Math.abs(dj) !== 3 && (Math.abs(di) > 1 || Math.abs(dj) > 1))) continue;
          const ii = i + di, jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
          if (Math.abs(di) <= 1 && Math.abs(dj) <= 1) { s1 += hs[jj * n + ii]; c1++; } else { s3 += hs[jj * n + ii]; c3++; }
        }
        const d1 = c1 ? s1 / c1 - hs[k] : 0, d3 = c3 ? s3 / c3 - hs[k] : 0;
        const ao = Math.max(0, Math.min(0.3, d3 * 2.2 + d1 * 5)), edge = Math.max(0, -d3 * 2.2 - d1 * 5);
        ground(pos[k * 3], pos[k * 3 + 2], hs[k], nor[k * 3 + 1], ao, edge, C1);
        col[k * 3] = C1.r; col[k * 3 + 1] = C1.g; col[k * 3 + 2] = C1.b;
      }
      if (j % 4 === 3) yield;
    }
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    g.setAttribute('anim', landAnim(n * n));
    g.computeBoundingSphere();
    return g;
  }
  // the land says so to the board's shader (anim.y = 3): it gets the grain of soil, grass and rock
  function landAnim(n) { const a = new Float32Array(n * 2); for (let k = 1; k < a.length; k += 2) a[k] = 3; return new T.BufferAttribute(a, 2); }

  // ----- water: rivers along their beds, lakes, a waterfall -----
  const WATER = 0x3d82a3, SEA = 0x2f7fb3, LAVA = 0xff7a22;
  // the city's water: turquoise, deeper in the middle, lighter at the shore where the foam is (anim.y BANK there)
  const CITY_DEEP = new T.Color(0x2a8a98), CITY_SHORE = new T.Color(0x6fc6c4), BANK = 1.4;
  function waterGeo() {
    const P = [], Cc = [], A = [];
    const tri = (a, b, c, color, kind) => { for (const v of [a, b, c]) { P.push(v[0], v[1], v[2]); Cc.push(color.r, color.g, color.b); A.push(0, kind); } };
    const vert = (v, color, kind) => { P.push(v[0], v[1], v[2]); Cc.push(color.r, color.g, color.b); A.push(0, kind); };
    for (const w of waters) {
      if (w.k === 'river') {
        const f = w.f, len = Math.hypot(f.x2 - f.x1, f.z2 - f.z1), n = Math.max(2, Math.ceil(len / 0.07));
        const nx = -(f.z2 - f.z1) / len, nz = (f.x2 - f.x1) / len, hw = f.w * 0.42;
        C1.set(WATER);
        let prev = null;
        for (let k = 0; k <= n; k++) {
          const t = k / n, x = f.x1 + (f.x2 - f.x1) * t, z = f.z1 + (f.z2 - f.z1) * t, y = height(x, z) + 0.012;
          const L = [x + nx * hw, y, z + nz * hw], R = [x - nx * hw, y, z - nz * hw];
          if (prev) { tri(prev[0], L, prev[1], C1, 1); tri(prev[1], L, R, C1, 1); }          // facing up
          prev = [L, R];
        }
      } else if (w.k === 'lake') {
        const f = w.f, y = height(f.x, f.z) + f.d * 0.55, c = Math.cos(f.rot || 0), s = Math.sin(f.rot || 0), n = 28;
        if (sea && !w.lava && y < SEA_Y + 0.01) continue;                       // under the sea: the sea's own water is there
        C1.set(w.lava ? LAVA : w.sea ? SEA : WATER);
        const at = k => { const a = k / n * Math.PI * 2, lx = Math.cos(a) * f.rx * 0.97, lz = Math.sin(a) * f.rz * 0.97; return [f.x + lx * c + lz * s, y, f.z - lx * s + lz * c]; };
        if (city && !w.lava) { for (let k = 0; k < n; k++) { vert([f.x, y, f.z], CITY_DEEP, 1); vert(at(k + 1), CITY_SHORE, BANK); vert(at(k), CITY_SHORE, BANK); } continue; }
        for (let k = 0; k < n; k++) tri([f.x, y, f.z], at(k + 1), at(k), C1, w.lava ? 5 : 1);
      } else if (w.k === 'flow') {
        // a ribbon along the line at the river's level, its sides turned halfway between one piece and the next
        const p = w.pts, n = p.length, side = [];
        for (let k = 0; k < n; k++) {
          const a = p[Math.max(0, k - 1)], b = p[Math.min(n - 1, k + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
          side.push([-dz / l * w.hw, dx / l * w.hw]);
        }
        // (in three strips across: its middle deeper, its banks lighter, the shader's foam along them: anim.y 1.4 at the
        // banks, 1 in the middle)
        const mid = w.c, bank = w.cb || w.c, B = w.cb ? BANK : 1;
        for (let k = 1; k < n; k++) {
          const L0 = [p[k - 1][0] + side[k - 1][0], w.y, p[k - 1][1] + side[k - 1][1]], R0 = [p[k - 1][0] - side[k - 1][0], w.y, p[k - 1][1] - side[k - 1][1]];
          const L1 = [p[k][0] + side[k][0], w.y, p[k][1] + side[k][1]], R1 = [p[k][0] - side[k][0], w.y, p[k][1] - side[k][1]];
          const M0 = [p[k - 1][0], w.y, p[k - 1][1]], M1 = [p[k][0], w.y, p[k][1]];
          vert(L0, bank, B); vert(L1, bank, B); vert(M0, mid, 1);  vert(M0, mid, 1); vert(L1, bank, B); vert(M1, mid, 1);
          vert(M0, mid, 1); vert(M1, mid, 1); vert(R0, bank, B);   vert(R0, bank, B); vert(M1, mid, 1); vert(R1, bank, B);
        }
      } else if (w.k === 'fall') {
        // off the lip it arcs out, clear of the rock, and spreads as it falls
        const [a, b] = [w.a, w.b], dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l, px = -uz * w.w / 2, pz = ux * w.w / 2;
        C1.set(0xb4dbea);
        const n = 14;
        let prev = null;
        for (let k = 0; k <= n; k++) {
          const t = k / n, e = t * t, out = 0.07 * Math.sin(Math.PI * Math.min(1, t * 1.3)), sp = 1 + 0.6 * t;
          const x = a[0] + dx * t + ux * out, z = a[2] + dz * t + uz * out, y = a[1] + (b[1] - a[1]) * e;
          const L = [x + px * sp, y, z + pz * sp], R = [x - px * sp, y, z - pz * sp];
          if (prev) { tri(prev[0], L, prev[1], C1, 2); tri(prev[1], L, R, C1, 2); }          // facing away from the rock
          prev = [L, R];
        }
      }
    }
    if (!P.length) return null;
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(P, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(Cc, 3));
    g.setAttribute('anim', new T.Float32BufferAttribute(A, 2));
    g.computeVertexNormals();
    return g;
  }

  // ----- the archipelago's lagoon: the water inside the ring of squares, coloured by how deep it is (pale turquoise
  // over sand, blue where it is deep), with the foam lapping each shore (the board's shader moves it: anim.y = 4 and how
  // deep it is, anim.x how near the shore). Where land stands well above it, there is none. -----
  const DEEP = [[0, 0xc8eee6], [0.03, 0x9ddbd4], [0.09, 0x7dc9c9], [0.17, 0x56b6c2], [0.3, 0x429faf]].map(([d, c]) => [d, new T.Color(c)]);
  function depthColor(d, out) {
    if (d <= DEEP[0][0]) return out.copy(DEEP[0][1]);
    for (let k = 1; k < DEEP.length; k++) if (d < DEEP[k][0]) return out.copy(DEEP[k - 1][1]).lerp(DEEP[k][1], (d - DEEP[k - 1][0]) / (DEEP[k][0] - DEEP[k - 1][0]));
    return out.copy(DEEP[DEEP.length - 1][1]);
  }
  function* seaGeo(N = 84) {
    const n = N + 1, step = (EDGE * 2) / N, dep = new Float32Array(n * n);
    for (let j = 0; j < n; j++) { for (let i = 0; i < n; i++) dep[j * n + i] = SEA_Y - height(-EDGE + i * step, -EDGE + j * step); if (j % 6 === 5) yield; }
    seaField = { N, n, step, shore: Float32Array.from(dep, d => 1 - smooth(0, .07, d)) };
    const P = [], Cc = [], A = [], idx = [], map = new Int32Array(n * n).fill(-1);
    const vert = k => {
      if (map[k] >= 0) return map[k];
      const i = k % n, j = (k - i) / n, d = dep[k];
      P.push(-EDGE + i * step, SEA_Y, -EDGE + j * step);
      depthColor(d, C1); Cc.push(C1.r, C1.g, C1.b);
      A.push(1 - smooth(0, 0.07, d), 4 + Math.max(0, Math.min(0.45, d)));                  // (and how deep: the shallows shine)
      return (map[k] = P.length / 3 - 1);
    };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      if (Math.max(dep[a], dep[b], dep[c], dep[d]) < -0.02) continue;                // dry land all round
      idx.push(vert(a), vert(c), vert(b), vert(b), vert(c), vert(d));
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(new Float32Array(P.length).map((v, k) => k % 3 === 1 ? 1 : 0), 3));
    g.setAttribute('color', new T.Float32BufferAttribute(Cc, 3));
    g.setAttribute('anim', new T.Float32BufferAttribute(A, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  }
  // Reuse the rendered shore field for floating boats and rain. Sampling this
  // grid is constant-time; it does not reevaluate terrain noise per rain drop.
  function seaShore(x,z) {
    if (!seaField) return 0;
    const {N,n,step,shore}=seaField, u=Math.max(0,Math.min(N,(x+EDGE)/step)), v=Math.max(0,Math.min(N,(z+EDGE)/step));
    const i=Math.min(N-1,Math.floor(u)),j=Math.min(N-1,Math.floor(v)),a=u-i,b=v-j,k=j*n+i;
    // Match the two rendered triangles (a+c+b, b+c+d) exactly.
    return a+b<=1 ? shore[k]+a*(shore[k+1]-shore[k])+b*(shore[k+n]-shore[k])
      : shore[k+n+1]+(1-b)*(shore[k+1]-shore[k+n+1])+(1-a)*(shore[k+n]-shore[k+n+1]);
  }

  // ----- the country around the board: rings outward from under its plinth; meadows and fields, then wooded hills,
  // then the mountains far off. In the archipelago, the open ocean, waves breaking along the board's sides -----
  const outY = (x, z) => {
    const r = Math.sqrt(x * x + z * z), far = smooth(18, 46, r);
    return -0.47 + 0.3 * smooth(6.8, 9, r) * (0.5 + 0.5 * fbm(x * 0.32, z * 0.32))
      + 1.7 * smooth(8.3, 13, r) * Math.pow(0.5 + 0.5 * fbm(x * 0.17 + 5, z * 0.17), 1.4)
      + 2.2 * smooth(13, 24, r) * (0.5 + 0.5 * fbm(x * 0.09 - 3, z * 0.09)) + far * 12 * ridged(x * 0.04, z * 0.04);
  };
  // where the woods are (the trees grow there, and the ground under them is darker)
  const woods = (x, z) => smooth(-0.12, 0.22, fbm(x * 0.24 + 2, z * 0.24 - 1));
  function ocean(rings, seg) {
    const r0 = 6.25, r1 = 70, pos = [], col = [], anim = [], idx = [], NEAR = new T.Color(0x64bdc8), MID = new T.Color(0x50adbd), FAR = new T.Color(0x388ea8);
    for (let k = 0; k <= rings; k++) {
      const r = r0 * Math.pow(r1 / r0, k / rings);
      for (let s = 0; s < seg; s++) {
        const a = s / seg * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r, side = Math.max(Math.abs(x), Math.abs(z)) - 6.45;
        pos.push(x, OCEAN_Y, z);
        C1.copy(NEAR).lerp(MID, smooth(0.5, 6, side)).lerp(FAR, smooth(10, 40, r)).multiplyScalar(0.94 + 0.12 * (fbm(x * 0.15, z * 0.15) * 0.5 + 0.5));
        col.push(C1.r, C1.g, C1.b);
        anim.push(1 - smooth(0.0, 0.45, side), 4.45);                                          // the surf along the board; deep
      }
    }
    for (let k = 0; k < rings; k++) for (let s = 0; s < seg; s++) {
      const a = k * seg + s, b = k * seg + (s + 1) % seg, c = a + seg, d = b + seg;
      idx.push(a, b, c, b, d, c);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(new Float32Array(pos.length).map((v, k) => k % 3 === 1 ? 1 : 0), 3));
    g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    g.setAttribute('anim', new T.Float32BufferAttribute(anim, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  }
  function outer(rings = 40, seg = 96) {
    if (sea) return ocean(rings, seg);
    const r0 = 6.25, r1 = 70, pos = [], col = [], idx = [];
    for (let k = 0; k <= rings; k++) {
      const r = r0 * Math.pow(r1 / r0, k / rings);
      for (let s = 0; s < seg; s++) {
        const a = s / seg * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
        pos.push(x, outY(x, z), z);
      }
    }
    for (let k = 0; k < rings; k++) for (let s = 0; s < seg; s++) {
      const a = k * seg + s, b = k * seg + (s + 1) % seg, c = a + seg, d = b + seg;
      idx.push(a, b, c, b, d, c);                    // counter-clockwise seen from above: the land faces up
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const nor = g.attributes.normal.array, MEADOW = new T.Color(city ? 0x86aa4a : 0x86a34c), FOREST = new T.Color(city ? 0x4f7d34 : 0x4a6e36);
    const FIELDS = [0xcdb862, 0x9aab48, 0xa5865a, 0xbfb46c, 0x7f9c45].map(c => new T.Color(c));
    for (let k = 0; k < pos.length / 3; k++) {
      const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2], r = Math.sqrt(x * x + z * z), slope = 1 - nor[k * 3 + 1];
      const n1 = fbm(x * 0.5, z * 0.5), n2 = noise(x * 1.7, z * 1.7);
      C1.copy(MEADOW).multiplyScalar(0.86 + 0.24 * (n2 * 0.5 + 0.5));
      C1.lerp(DRY, smooth(0.3, 0.8, n1 * 0.5 + 0.5) * 0.3);
      // fields near the board, in patches of their own crop
      const field = smooth(0.0, 0.25, fbm(x * 0.24 + 11, z * 0.24 - 4)) * smooth(6.7, 7.6, r) * (1 - smooth(12, 16, r)) * (1 - smooth(0.1, 0.25, slope));
      if (field > 0) C1.lerp(FIELDS[Math.floor((noise(x * 0.6 + 3, z * 0.6 - 7) * 0.5 + 0.5) * 4.99)], field * 0.85);
      C1.lerp(FOREST, woods(x, z) * 0.8 * smooth(7.2, 8.2, r));
      C1.lerp(ROCK, smooth(0.2, 0.45, slope));
      C1.lerp(SNOW, smooth(6.5, 8, y + 1.5 * n1) * (1 - smooth(0.5, 0.7, slope)));
      col.push(C1.r, C1.g, C1.b);
    }
    g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    g.setAttribute('anim', landAnim(pos.length / 3));
    g.computeBoundingSphere();
    return g;
  }
  // spots for trees around the board: mostly in the woods, a few out in the meadows; firs higher up, none on the peaks
  function groves(n, seed = 7) {
    const out = [];
    if (sea) return out;                                                                    // the ocean has its own islands (sea.js)
    let s = seed;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let tries = 0; out.length < n && tries < n * 14; tries++) {
      const a = rnd() * Math.PI * 2, r = 7.3 + Math.pow(rnd(), 2) * 14, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.max(Math.abs(x), Math.abs(z)) < 7.1) continue;
      if (rnd() > 0.07 + 0.93 * woods(x, z)) continue;
      const y = outY(x, z);
      if (y > 3.2) continue;
      out.push({ x, y, z, s: 0.7 + rnd() * 0.65, ry: rnd() * 6.28, pine: rnd() < 0.28 + 0.55 * smooth(0.2, 2.4, y) });
    }
    return out;
  }

  // the water's surface where (x, z) lies in a lake (or the sea), or null
  function waterAt(x, z) {
    for (const w of waters) {
      if (w.k === 'flow') {
        const p = w.pts;
        for (let k = 1; k < p.length; k++) if (segQ({ x1: p[k - 1][0], z1: p[k - 1][1], x2: p[k][0], z2: p[k][1], w: w.hw }, x, z)[0] < 1) return w.y;
        continue;
      }
      if (w.k !== 'lake' || w.lava) continue;
      const f = w.f, [lx, lz] = rot(f, x, z);
      if ((lx / f.rx) ** 2 + (lz / f.rz) ** 2 < 1) { const y = height(f.x, f.z) + f.d * 0.55; if (!sea || y > SEA_Y + 0.01) return y; }
    }
    if (sea) { const r = Math.max(Math.abs(x), Math.abs(z)); return r > 6.2 ? OCEAN_Y : height(x, z) < SEA_Y ? SEA_Y : null; }
    return null;
  }
  return Object.assign(api, { reset, setWorld, board, waterGeo, seaGeo, seaShore, waterAt, outer, outY, groves, noise, fbm, RIM, SEA_Y, BED, OCEAN_Y, VORTEX, get sea() { return sea; } });
})();
