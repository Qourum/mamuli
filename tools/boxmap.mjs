// A picture layout for a model seen mostly from above, like ტფილისი's city (tools/city_make.mjs): instead of xatlas's
// thousands of small patches (a Meshy surface is bumpy, so its patches stay small and the picture goes half empty), each
// face is drawn from the side it faces most: the ground, roofs and water from above, walls from the front, the back, the
// left or the right. Faces drawn from the same side and joined by their edges make one patch (the whole ground is one);
// where a patch would fold over itself (a bridge's deck over the river) the faces that would overlap make a patch of
// their own. The patches' boxes are packed into the picture as tightly as they go.
// boxLayout(P, I, size): P the shape's positions (x, y, z per vertex, its vertices welded), I its triangles; returns the
// faces' new vertices (xref: which of P's each is), their uv (0..1), the triangles, and how full the picture is.

const AX = [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
// each side's two directions on the picture (u, v)
const UV = [[[1, 0, 0], [0, 0, 1]], [[1, 0, 0], [0, 0, -1]], [[0, 0, -1], [0, -1, 0]], [[0, 0, 1], [0, -1, 0]], [[1, 0, 0], [0, -1, 0]], [[-1, 0, 0], [0, -1, 0]]];

export function boxLayout(P, I, size, { pad = 4, upY = 0.7, under = 0.5, smooth = 4, fit = 0.35, debug = false, log = () => { } } = {}) {
  const nt = I.length / 3, nv = P.length / 3;
  // the faces' normals and areas
  const fn = new Float32Array(nt * 3), fa = new Float32Array(nt);
  for (let t = 0; t < nt; t++) {
    const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
    fa[t] = l / 2;
    if (l > 0) { fn[t * 3] = nx / l; fn[t * 3 + 1] = ny / l; fn[t * 3 + 2] = nz / l; } else fn[t * 3 + 1] = 1;
  }
  // which faces touch each vertex, and each face's neighbours across its edges
  const vc = new Uint32Array(nv + 1);
  for (let k = 0; k < I.length; k++) vc[I[k] + 1]++;
  for (let v = 0; v < nv; v++) vc[v + 1] += vc[v];
  const vf = new Uint32Array(I.length), fill = vc.slice(0, nv);
  for (let t = 0; t < nt; t++) for (let j = 0; j < 3; j++) vf[fill[I[t * 3 + j]]++] = t;
  const nb = new Int32Array(nt * 3).fill(-1);
  for (let t = 0; t < nt; t++) for (let j = 0; j < 3; j++) {
    if (nb[t * 3 + j] >= 0) continue;
    const a = I[t * 3 + j], b = I[t * 3 + (j + 1) % 3];
    for (let k = vc[a]; k < vc[a + 1]; k++) {
      const s = vf[k];
      if (s === t) continue;
      for (let i = 0; i < 3; i++) if (I[s * 3 + i] === b && I[s * 3 + (i + 1) % 3] === a) { nb[t * 3 + j] = s; nb[s * 3 + i] = t; }
    }
  }
  // the normals smoothed over the faces round each face (a bumpy wall still faces one way)
  let sn = fn;
  for (let it = 0; it < 2; it++) {
    const out = new Float32Array(nt * 3);
    for (let t = 0; t < nt; t++) {
      let x = 0, y = 0, z = 0;
      for (let j = 0; j < 3; j++) { const v = I[t * 3 + j]; for (let k = vc[v]; k < vc[v + 1]; k++) { const s = vf[k], w = fa[s]; x += sn[s * 3] * w; y += sn[s * 3 + 1] * w; z += sn[s * 3 + 2] * w; } }
      const l = Math.hypot(x, y, z) || 1;
      out[t * 3] = x / l; out[t * 3 + 1] = y / l; out[t * 3 + 2] = z / l;
    }
    sn = out;
  }
  // each face's side: from above where it faces up enough, from below where it faces down, else the wall it is nearest
  const side = new Uint8Array(nt), fits = (t, s, n, m) => n[t * 3] * AX[s][0] + n[t * 3 + 1] * AX[s][1] + n[t * 3 + 2] * AX[s][2] > m;
  for (let t = 0; t < nt; t++) {
    const x = sn[t * 3], y = sn[t * 3 + 1], z = sn[t * 3 + 2];
    side[t] = y >= upY ? 0 : y <= -0.7 ? 1 : Math.abs(x) >= Math.abs(z) ? (x > 0 ? 2 : 3) : (z > 0 ? 4 : 5);
  }
  // a face takes its neighbours' side when most of them (by area) have it and it faces that way well enough
  for (let it = 0; it < smooth; it++) {
    const next = side.slice();
    for (let t = 0; t < nt; t++) {
      const w = new Float32Array(6);
      w[side[t]] += fa[t] * 0.5;
      for (let j = 0; j < 3; j++) { const s = nb[t * 3 + j]; if (s >= 0) w[side[s]] += fa[s]; }
      let best = side[t];
      for (let s = 0; s < 6; s++) if (w[s] > w[best] && fits(t, s, fn, fit)) best = s;
      next[t] = best;
    }
    side.set(next);
  }

  // the patches: faces of one side joined by their edges; a face that would lie over another of its patch (seen from its
  // side) is left for a patch of its own
  const TPU0 = Math.sqrt(size * size * 0.8 / fa.reduce((a, b) => a + b, 0));   // (about the final scale)
  const charts = [], chartOf = new Int32Array(nt).fill(-1);
  const uvOf = (s, v) => [P[v * 3] * UV[s][0][0] + P[v * 3 + 1] * UV[s][0][1] + P[v * 3 + 2] * UV[s][0][2], P[v * 3] * UV[s][1][0] + P[v * 3 + 1] * UV[s][1][1] + P[v * 3 + 2] * UV[s][1][2]];
  // the texel centres inside a triangle (a grid of `tpu` per unit from u0, v0)
  function texels(a, b, c, u0, v0, tpu, W, cb) {
    const ax = (a[0] - u0) * tpu, ay = (a[1] - v0) * tpu, bx = (b[0] - u0) * tpu, by = (b[1] - v0) * tpu, cx = (c[0] - u0) * tpu, cy = (c[1] - v0) * tpu;
    const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(d) < 1e-12) return;
    for (let y = Math.max(0, Math.floor(Math.min(ay, by, cy))); y <= Math.ceil(Math.max(ay, by, cy)); y++)
      for (let x = Math.max(0, Math.floor(Math.min(ax, bx, cx))); x <= Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx))); x++) {
        const px = x + 0.5, py = y + 0.5, w0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / d, w1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / d;
        if (w0 > 1e-6 && w1 > 1e-6 && 1 - w0 - w1 > 1e-6) cb(y * W + x);
      }
  }
  function grow(list, s) {
    // (list: faces of one side, joined; the largest first)
    let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
    for (const t of list) for (let j = 0; j < 3; j++) { const [u, v] = uvOf(s, I[t * 3 + j]); u0 = Math.min(u0, u); v0 = Math.min(v0, v); u1 = Math.max(u1, u); v1 = Math.max(v1, v); }
    const tpu = Math.min(TPU0, 3000 / Math.max(u1 - u0, v1 - v0, 1e-6)), W = Math.ceil((u1 - u0) * tpu) + 2, H = Math.ceil((v1 - v0) * tpu) + 2;
    const cov = new Uint8Array(W * H), inList = new Set(list), seen = new Set(), keep = [], left = [];
    const order = [list.reduce((a, b) => fa[b] > fa[a] ? b : a, list[0])];
    seen.add(order[0]);
    for (let q = 0; q < order.length; q++) {
      const t = order[q], mine = [];
      const [a, b, c] = [0, 1, 2].map(j => uvOf(s, I[t * 3 + j]));
      texels(a, b, c, u0, v0, tpu, W, o => mine.push(o));
      let over = 0;
      for (const o of mine) if (cov[o]) over++;
      if (over > Math.max(2, mine.length * 0.1)) { left.push(t); continue; }
      for (const o of mine) cov[o] = 1;
      keep.push(t);
      for (let j = 0; j < 3; j++) { const n = nb[t * 3 + j]; if (n >= 0 && inList.has(n) && !seen.has(n)) { seen.add(n); order.push(n); } }
    }
    for (const t of list) if (!seen.has(t)) left.push(t);          // (cut off from the rest by the faces left out)
    return { keep, left };
  }
  function components(faces, s) {
    const inSet = new Set(faces), done = new Set(), out = [];
    for (const f of faces) {
      if (done.has(f)) continue;
      const list = [f]; done.add(f);
      for (let q = 0; q < list.length; q++) { const t = list[q]; for (let j = 0; j < 3; j++) { const n = nb[t * 3 + j]; if (n >= 0 && inSet.has(n) && !done.has(n) && side[n] === s) { done.add(n); list.push(n); } } }
      out.push(list);
    }
    return out;
  }
  for (let s = 0; s < 6; s++) {
    const all = [];
    for (let t = 0; t < nt; t++) if (side[t] === s) all.push(t);
    let todo = components(all, s);
    while (todo.length) {
      const next = [];
      for (const list of todo) {
        const { keep, left } = grow(list, s);
        if (keep.length) { const id = charts.length; charts.push({ s, faces: keep }); for (const t of keep) chartOf[t] = id; }
        if (left.length) next.push(...components(left, s));
      }
      todo = next;
    }
  }
  // each patch's box in its own units (the faces underneath, seen less, at half the scale)
  for (const ch of charts) {
    let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity, area = 0;
    for (const t of ch.faces) { area += fa[t]; for (let j = 0; j < 3; j++) { const [u, v] = uvOf(ch.s, I[t * 3 + j]); u0 = Math.min(u0, u); v0 = Math.min(v0, v); u1 = Math.max(u1, u); v1 = Math.max(v1, v); } }
    Object.assign(ch, { u0, v0, w: u1 - u0, h: v1 - v0, k: ch.s === 1 ? under : 1, area });
  }
  log(`box layout: ${charts.length} patches (${[0, 1, 2, 3, 4, 5].map(s => charts.filter(c => c.s === s).length).join('/')} up/down/x/-x/z/-z)`);

  // packing: the boxes, tallest first, each into the lowest place it fits along the picture's skyline (turned when it
  // fits better on its side); the scale as large as lets them all fit
  function pack(tpu, place = false) {
    const sky = [{ x: 0, y: 0, w: size }];
    const rects = charts.map((c, i) => ({ i, w: Math.ceil(c.w * tpu * c.k) + 2 * pad, h: Math.ceil(c.h * tpu * c.k) + 2 * pad }));
    rects.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h);
    let top = 0;
    for (const r of rects) {
      let best = null;
      for (const [w, h, rot] of [[r.w, r.h, false], [r.h, r.w, true]]) {
        if (w > size) continue;
        for (let k = 0; k < sky.length; k++) {
          if (sky[k].x + w > size) break;
          let y = 0, x = sky[k].x, rem = w;
          for (let j = k; j < sky.length && rem > 0; j++) { y = Math.max(y, sky[j].y); rem -= sky[j].w; }
          if (rem > 0) continue;
          if (!best || y + h < best.y + best.h || (y + h === best.y + best.h && x < best.x)) best = { k, x, y, w, h, rot };
        }
      }
      if (!best) return null;
      // the skyline: the new box's top over its width
      const nseg = { x: best.x, y: best.y + best.h, w: best.w }, ns = [];
      for (const sg of sky) {
        if (sg.x + sg.w <= nseg.x || sg.x >= nseg.x + nseg.w) { ns.push(sg); continue; }
        if (sg.x < nseg.x) ns.push({ x: sg.x, y: sg.y, w: nseg.x - sg.x });
        if (sg.x + sg.w > nseg.x + nseg.w) ns.push({ x: nseg.x + nseg.w, y: sg.y, w: sg.x + sg.w - nseg.x - nseg.w });
      }
      ns.push(nseg); ns.sort((a, b) => a.x - b.x);
      sky.length = 0;
      for (const sg of ns) { const l = sky[sky.length - 1]; if (l && l.y === sg.y && l.x + l.w === sg.x) l.w += sg.w; else sky.push(sg); }
      top = Math.max(top, best.y + best.h);
      if (top > size) return null;
      if (place) Object.assign(charts[r.i], { px: best.x + pad, py: best.y + pad, rot: best.rot });
    }
    return top;
  }
  let lo = 0, hi = TPU0 * 2;
  while (pack(hi)) hi *= 1.5;
  for (let it = 0; it < 22; it++) { const mid = (lo + hi) / 2; if (pack(mid)) lo = mid; else hi = mid; }
  const tpu = lo; pack(tpu, true);
  if (debug) {
    const rows = [[0, 64], [64, 256], [256, 1024], [1024, 4096], [4096, 16384], [16384, 1e12]].map(([a, b]) => {
      const cs = charts.filter(c => { const n = c.w * c.h * (tpu * c.k) ** 2; return n >= a && n < b; });
      const box = cs.reduce((x, c) => x + (Math.ceil(c.w * tpu * c.k) + 2 * pad) * (Math.ceil(c.h * tpu * c.k) + 2 * pad), 0), area = cs.reduce((x, c) => x + c.area * (tpu * c.k) ** 2, 0);
      return `${a}-${b}: ${cs.length} patches, boxes ${(box / size / size * 100).toFixed(1)}%, faces' area ${(area / size / size * 100).toFixed(1)}%`;
    });
    log('patch sizes (texels of their box):\n  ' + rows.join('\n  '));
    const big = charts.slice().sort((a, b) => b.area - a.area).slice(0, 5).map(c => `side ${c.s} ${c.faces.length} faces ${c.w.toFixed(2)}x${c.h.toFixed(2)} area ${c.area.toFixed(2)}`);
    log('largest: ' + big.join('; '));
  }

  // the new vertices: one for each vertex of each patch, with its place in the picture
  const map = new Map(), xref = [], uv = [], idx = new Uint32Array(nt * 3);
  let o = 0, used = 0;
  charts.forEach((ch, ci) => {
    const sc = tpu * ch.k;
    for (const t of ch.faces) {
      for (let j = 0; j < 3; j++) {
        const v = I[t * 3 + j], key = ci * nv + v;
        let k = map.get(key);
        if (k === undefined) {
          const [u, w] = uvOf(ch.s, v), du = (u - ch.u0) * sc, dv = (w - ch.v0) * sc;
          const x = ch.rot ? ch.px + dv : ch.px + du, y = ch.rot ? ch.py + du : ch.py + dv;
          k = xref.length; map.set(key, k); xref.push(v); uv.push(x / size, y / size);
        }
        idx[o++] = k;
      }
      used += fa[t] * sc * sc;
    }
  });
  log(`box layout: ${(tpu).toFixed(1)} texels a unit, ${(used / (size * size) * 100).toFixed(0)}% of the picture covered, ${xref.length} vertices`);
  return { xref: Uint32Array.from(xref), uv: Float32Array.from(uv), idx, tpu, charts: charts.length, chartList: debug ? charts : null };
}
