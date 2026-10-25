#!/usr/bin/env node
// ტფილისი's whole city in one model (Meshy's "Miniature Wonder City", made from the board's concept picture): from
// Meshy's GLB to the board's two files, art/m_tb_city.glb (a computer, and ultra) and art/mobile/m_tb_city.glb (a
// phone), already in the board's own units and place, and its height map for city.js.
//   1. the model laid on the board: its plan scaled so its ring of districts lies inside the squares (each district's
//      tile behind its own square), its grass at the land's height, the thick block of soil under it and what lies
//      under the squares cut away; then the mends (--edits FILE: what Meshy got wrong, moved, turned or taken away)
//   2. its shape simplified, what can never be seen left out, and its picture baked again onto a fresh layout
//      (bake.mjs, boxmap.mjs): Meshy's picture spends almost half of its 8K on the soil; the new one only on what is
//      seen. Then the picture cleaned (paint_clean.py: the smudges flattened, the edges kept, a little crisper)
//   3. its triangles sorted by place: the middle first, then each district (by its tile: TILES below; a corner's tile
//      is shared by the two districts beside it, each taking the half nearer its own squares); the mesh's extras say
//      which run of triangles is whose ([name, first index, index count]), glb.js passes them on
//   4. the height of its top surface on a grid over the board (city.js: where things walk, sail and fly)
// node city_make.mjs IN.glb OUTDIR [--only desktop|mobile] [--k K] [--ground G] [--tris N --tex N --mtris N --mtex N
//   --htris N] [--layout box|xatlas] [--clean 0] [--edits mends.json] [--city ../src/city.js (its height map put in)]
// It needs, next to it: npm i @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions meshoptimizer
// sharp three@0.149 three-mesh-bvh@0.5 watlas; and python3 with opencv (paint_clean.py)
import { NodeIO, VertexLayout } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { clearNodeTransform, flatten, join, weld, simplify, prune, dedup, quantize, dequantize, textureCompress, transformMesh, compactPrimitive, cloneDocument } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { bake } from './bake.mjs';
import * as MENDS from './city_mends.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), F = {}, files = [];
for (let k = 0; k < argv.length; k++) if (argv[k].startsWith('--')) F[argv[k].slice(2)] = argv[++k]; else files.push(argv[k]);
const [IN, OUTDIR] = files;
if (!IN || !OUTDIR) { console.log('node city_make.mjs IN.glb OUTDIR [--only desktop|mobile] [--tris N --tex N --mtris N --mtex N] [--clean 0] [--edits mends.json] [--city city.js]'); process.exit(1); }
// the model's plan is about 1.9 wide: K times that, its outer edge just under the squares' inner edge (4.5); its grass
// (G, in its own units) at the land's height (0.03)
const K = +(F.k || 4.6 / 0.955), G = +(F.ground || -0.135), LAND = 0.03, CUT = +(F.cut || -0.19);
const TRIS = +(F.tris || 300000), TEX = +(F.tex || 4096), MTRIS = +(F.mtris || 110000), MTEX = +(F.mtex || 2048), HTRIS = +(F.htris || 1200000), ONLY = F.only || '';
const t0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);

// ===== the ring's tiles as the model has them (their rims, read off its top view; board units) =====
// each side's boundaries between its lots, from its first lot to its last: the front along x from the right (lots 1 to
// 9), the left along z from the front (11 to 19), the back along x from the left (21 to 29), the right along z from the
// back (31 to 39). A corner's tile lies beyond its two sides' last boundaries; its two lots halve it along the diagonal.
// (A few of Meshy's tiles are wider than a square, and two of them hold two districts each: the back's first two, and
// Vera and Vake; on the right, Rustaveli and the next)
const TILES = [
  [3.44, 2.49, 1.49, 0.52, -0.44, -1.47, -2.45, -3.44],
  [3.44, 2.55, 1.68, 0.66, -0.07, -1.42, -2.31, -3.32],
  [-3.45, -2.45, -1.44, -0.45, 0.48, 1.47, 2.40, 3.21],
  [-3.31, -2.25, -1.45, -0.22, 0.72, 1.77, 2.55, 3.45]
];
const RING = 3.25;                                  // (inside it the middle)

// ===== the mends (city_mends.mjs; --mends 0 leaves them out, --edits FILE adds a JSON list of more) =====
// each edit: which triangles (their centres in a box: x, y, z ranges in board units, a missing one any; plane: { at, n,
// d, r } only those within d of that plane and r of `at`), and what is done: 'delete' them; 'move' them through `steps`
// (t: by [dx, dy, dz]; r: { axis 'x' | 'y' | 'z', deg, about [x, y, z] }; s: { k, about }), in that order; 'copy': the
// same, the originals kept. Or a shape added, coloured by MENDS.SWATCHES[color]: 'box' (at: the middle of its bottom,
// size, ry degrees, shift: moved in its own frame), 'cone' (at: its base's middle, r, h, n sides); 'fill': the holes in
// the box (x, z, y ranges) closed; 'flatten': the points in the box within its y range brought to the height `to`
const EDITS = [...(F.mends === '0' ? [] : MENDS.EDITS), ...JSON.parse(F.edits ? fs.readFileSync(F.edits, 'utf8') : '[]')];
const PAINT = F.mends === '0' ? null : MENDS.PAINT, SWATCHES = MENDS.SWATCHES;

await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }).setVertexLayout(VertexLayout.SEPARATE);
const doc = await io.read(IN), root = doc.getRoot();
const prims = () => root.listMeshes().flatMap(m => m.listPrimitives());
const tri = () => prims().reduce((a, p) => a + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0);
log(`${path.basename(IN)}: ${Math.round(tri())} triangles, pictures ${root.listTextures().map(t => (t.getSize() || ['?']).join('x')).join(', ')}`);
// only its colours (the board lights it itself)
for (const m of root.listMaterials()) {
  m.setNormalTexture(null).setOcclusionTexture(null).setEmissiveTexture(null).setMetallicRoughnessTexture(null);
  m.setMetallicFactor(0).setRoughnessFactor(1).setEmissiveFactor([0, 0, 0]);
}
await doc.transform(dequantize(), flatten());
for (const n of root.listNodes()) if (n.getMesh()) clearNodeTransform(n);
await doc.transform(join({ keepMeshes: false, keepNamed: false }), weld(), prune());

// 1. on the board: x, z times K; y from its grass (G) up, times K, at the land's height
for (const m of root.listMeshes()) transformMesh(m, [K, 0, 0, 0, 0, K, 0, 0, 0, 0, K, 0, 0, (-G) * K + LAND, 0, 1]);
const cutY = (CUT - G) * K + LAND, EDGE = +(F.edge || 4.55);          // (beyond 4.5 the squares cover it)
{
  let gone = 0;
  for (const p of prims()) {
    const a = p.getAttribute('POSITION').getArray(), ix = p.getIndices(), I = ix.getArray(), keep = [];
    for (let t = 0; t < I.length; t += 3) {
      const i0 = I[t] * 3, i1 = I[t + 1] * 3, i2 = I[t + 2] * 3;
      const low = a[i0 + 1] < cutY && a[i1 + 1] < cutY && a[i2 + 1] < cutY;
      const cx = (a[i0] + a[i1] + a[i2]) / 3, cz = (a[i0 + 2] + a[i1 + 2] + a[i2 + 2]) / 3;
      if (low || Math.abs(cx) > EDGE || Math.abs(cz) > EDGE) { gone++; continue; }
      keep.push(I[t], I[t + 1], I[t + 2]);
    }
    ix.setArray(new Uint32Array(keep));
    compactPrimitive(p);
  }
  log(`on the board (x${K.toFixed(3)}): the soil under it and what lies under the squares cut away, ${gone} triangles; ${Math.round(tri())} left`);
}
// the mends
if (EDITS.length) {
  const p = prims()[0], P = Array.from(p.getAttribute('POSITION').getArray()), UVa = Array.from(p.getAttribute('TEXCOORD_0').getArray());
  let I = Array.from(p.getIndices().getArray());
  const inside = (e, t) => {
    const c = [0, 1, 2].map(q => (P[I[t * 3] * 3 + q] + P[I[t * 3 + 1] * 3 + q] + P[I[t * 3 + 2] * 3 + q]) / 3);
    if (!['x', 'y', 'z'].every((ax, q) => !e[ax] || (c[q] >= e[ax][0] && c[q] <= e[ax][1]))) return false;
    if (!e.plane) return true;
    const { at, n, d, r } = e.plane, v = [c[0] - at[0], c[1] - at[1], c[2] - at[2]], h = v[0] * n[0] + v[1] * n[1] + v[2] * n[2];
    return Math.abs(h) <= d && Math.hypot(v[0] - h * n[0], v[1] - h * n[1], v[2] - h * n[2]) <= r;
  };
  // the added shapes: their own vertices, their colour's picture coordinates (bake.mjs)
  const vert = (x, y, z, color) => { P.push(x, y, z); UVa.push((color + 0.5) / 1024, 2.5); return P.length / 3 - 1; };
  function box(e) {
    const a = (e.ry || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), [sx, sy, sz] = e.size, sh = e.shift || [0, 0, 0];
    const rot = (lx, lz) => [lx * c + lz * s, -lx * s + lz * c], [ox, oz] = rot(sh[0], sh[2]), [x0, y0, z0] = [e.at[0] + ox, e.at[1] + sh[1], e.at[2] + oz];
    const v = [[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], [-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]].map(([dx, dy, dz]) => { const [rx, rz] = rot(dx * sx / 2, dz * sz / 2); return vert(x0 + rx, y0 + dy * sy, z0 + rz, e.color); });
    for (const f of [[0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6], [0, 5, 1], [0, 4, 5], [1, 6, 2], [1, 5, 6], [2, 7, 3], [2, 6, 7], [3, 4, 0], [3, 7, 4]]) I.push(v[f[0]], v[f[1]], v[f[2]]);
  }
  // the holes left where something was taken away (a loop of open edges inside the box, its points within its y range):
  // closed with a flat patch, ear by ear (seen from above); the patch takes a picture coordinate of its edge (it is
  // painted again anyway, or of the colour round it)
  function fill(e) {
    const key = v => `${Math.round(P[v * 3] * 1e4)},${Math.round(P[v * 3 + 1] * 1e4)},${Math.round(P[v * 3 + 2] * 1e4)}`;
    const canon = new Map(), cid = v => { const k = key(v); let c = canon.get(k); if (c === undefined) { c = v; canon.set(k, c); } return c; };
    const nt = I.length / 3, near = { x: [e.x[0] - 0.05, e.x[1] + 0.05], z: [e.z[0] - 0.05, e.z[1] + 0.05] }, dir = new Set();
    for (let t = 0; t < nt; t++) {
      if (!inside(near, t)) continue;
      const a = cid(I[t * 3]), b = cid(I[t * 3 + 1]), c = cid(I[t * 3 + 2]);
      for (const [u, v] of [[a, b], [b, c], [c, a]]) dir.add(u + ',' + v);
    }
    // the open edges, turned round (the hole's own way); a point where two holes touch has two ways out
    const out = new Map();
    for (const k of dir) { const [u, v] = k.split(',').map(Number); if (!dir.has(v + ',' + u)) { if (!out.has(v)) out.set(v, []); out.get(v).push(u); } }
    const inBox = v => P[v * 3] >= e.x[0] && P[v * 3] <= e.x[1] && P[v * 3 + 2] >= e.z[0] && P[v * 3 + 2] <= e.z[1] && P[v * 3 + 1] >= e.y[0] && P[v * 3 + 1] <= e.y[1];
    const xz = v => [P[v * 3], P[v * 3 + 2]], turnUp = (a, b, c) => { const [ax, az] = xz(a), [bx, bz] = xz(b), [cx, cz] = xz(c); return (bz - az) * (cx - ax) - (bx - ax) * (cz - az); };
    const inTri = (p, a, b, c) => turnUp(a, b, p) >= 0 && turnUp(b, c, p) >= 0 && turnUp(c, a, p) >= 0;
    let holes = 0, tris = 0, open = 0;
    for (const [s0, list] of out) while (list.length) {
      const loop = [s0];
      let v = list.pop();
      while (v !== s0 && loop.length < 20000) { loop.push(v); const l = out.get(v); if (!l || !l.length) { v = undefined; break; } v = l.pop(); }
      if (v !== s0) { open++; continue; }
      if (loop.length < 3 || !loop.every(inBox)) continue;
      let area = 0; for (let k = 1; k + 1 < loop.length; k++) area += turnUp(loop[0], loop[k], loop[k + 1]);
      if (area <= 0) continue;                               // (not a hole in a surface facing up)
      // ears: a corner turning the surface's way (up) with no other point of the loop inside it; what is left when no
      // ear is found, a fan round its middle
      const poly = loop.slice();
      while (poly.length > 3) {
        let cut = false;
        for (let k = 0; k < poly.length; k++) {
          const a = poly[(k + poly.length - 1) % poly.length], b = poly[k], c = poly[(k + 1) % poly.length];
          if (turnUp(a, b, c) <= 1e-12) continue;
          if (poly.some(p => p !== a && p !== b && p !== c && inTri(p, a, b, c))) continue;
          I.push(a, b, c); tris++; poly.splice(k, 1); cut = true; break;
        }
        if (!cut) break;
      }
      if (poly.length === 3) { I.push(poly[0], poly[1], poly[2]); tris++; }
      else if (poly.length > 3) {
        const m = [0, 1, 2].map(q => poly.reduce((a, v) => a + P[v * 3 + q], 0) / poly.length);
        P.push(...m); UVa.push(UVa[poly[0] * 2], UVa[poly[0] * 2 + 1]);
        const c = P.length / 3 - 1;
        for (let k = 0; k < poly.length; k++) { I.push(c, poly[k], poly[(k + 1) % poly.length]); tris++; }
      }
      holes++;
    }
    log(`mend: ${e.name || ''}: ${holes} holes closed, ${tris} triangles${open ? `, ${open} open edges left` : ''}`);
  }
  // the bumps of what was taken away pressed flat: the points in the box (x, z) within the y range set to `to`
  function flatten(e) {
    const seen = new Set();
    for (let k = 0; k < I.length; k++) {
      const v = I[k];
      if (seen.has(v)) continue;
      seen.add(v);
      const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
      if (x >= e.x[0] && x <= e.x[1] && z >= e.z[0] && z <= e.z[1] && y >= e.y[0] && y <= e.y[1]) P[v * 3 + 1] = e.to;
    }
    log(`mend: ${e.name || ''}: pressed flat`);
  }
  function cone(e) {
    const [x, y, z] = e.at, n = e.n || 10, base = vert(x, y, z, e.color), top = vert(x, y + e.h, z, e.color), ring = [];
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; ring.push(vert(x + e.r * Math.cos(a), y, z + e.r * Math.sin(a), e.color)); }
    for (let k = 0; k < n; k++) { const r0 = ring[k], r1 = ring[(k + 1) % n]; I.push(r0, top, r1, base, r0, r1); }
  }
  const turn = (v, r) => {
    const a = r.deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), o = r.about || [0, 0, 0], d = [v[0] - o[0], v[1] - o[1], v[2] - o[2]];
    const w = r.axis === 'x' ? [d[0], d[1] * c - d[2] * s, d[1] * s + d[2] * c] : r.axis === 'y' ? [d[0] * c + d[2] * s, d[1], -d[0] * s + d[2] * c] : [d[0] * c - d[1] * s, d[0] * s + d[1] * c, d[2]];
    return [w[0] + o[0], w[1] + o[1], w[2] + o[2]];
  };
  for (const e of EDITS) {
    if (e.op === 'box' || e.op === 'cone') { (e.op === 'box' ? box : cone)(e); continue; }
    if (e.op === 'fill') { fill(e); continue; }
    if (e.op === 'flatten') { flatten(e); continue; }
    const nt = I.length / 3, sel = [];
    for (let t = 0; t < nt; t++) if (inside(e, t)) sel.push(t);
    if (e.op === 'delete') { const gone = new Set(sel); I = I.filter((_, k) => !gone.has(Math.floor(k / 3))); log(`mend: ${e.name || ''}: ${sel.length} triangles taken away`); continue; }
    // (the chosen triangles get vertices of their own, so the rest is not dragged with them)
    const own = new Map(), add = [];
    for (const t of sel) for (let j = 0; j < 3; j++) {
      const v = I[t * 3 + j];
      if (!own.has(v)) {
        own.set(v, P.length / 3);
        let q = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
        for (const step of e.steps || []) {
          if (step.t) q = [q[0] + step.t[0], q[1] + step.t[1], q[2] + step.t[2]];
          if (step.r) q = turn(q, step.r);
          if (step.s) { const o = step.s.about || [0, 0, 0]; q = q.map((x, i) => o[i] + (x - o[i]) * step.s.k); }
        }
        P.push(...q); UVa.push(UVa[v * 2], UVa[v * 2 + 1]);
      }
      add.push(own.get(v));
    }
    if (e.op === 'move') { const gone = new Set(sel); I = I.filter((_, k) => !gone.has(Math.floor(k / 3))); }
    I.push(...add);
    log(`mend: ${e.name || ''}: ${sel.length} triangles ${e.op === 'move' ? 'moved' : 'copied'}`);
  }
  log(`mends: ${EDITS.filter(e => e.op === 'box' || e.op === 'cone').length} shapes added`);
  for (const sem of p.listSemantics()) if (!['POSITION', 'TEXCOORD_0'].includes(sem)) p.setAttribute(sem, null);
  p.getAttribute('POSITION').setArray(Float32Array.from(P));
  p.getAttribute('TEXCOORD_0').setArray(Float32Array.from(UVa));
  p.getIndices().setArray(Uint32Array.from(I));
  compactPrimitive(p);
}

// (--dump FILE: the model as it now is, positions, picture coordinates and triangles, for looking into)
if (F.dump) {
  const p = prims()[0], P = p.getAttribute('POSITION').getArray(), U = p.getAttribute('TEXCOORD_0').getArray(), I = p.getIndices().getArray();
  fs.writeFileSync(F.dump, Buffer.concat([Buffer.from(new Uint32Array([P.length, U.length, I.length]).buffer), Buffer.from(Float32Array.from(P).buffer), Buffer.from(Float32Array.from(U).buffer), Buffer.from(Uint32Array.from(I).buffer)]));
  log(`dumped to ${F.dump}`);
  if (F.dumpOnly) process.exit(0);
}
// 2. the detailed model for baking, then each file's simpler shape with its own picture
const prim = d => d.getRoot().listMeshes()[0].listPrimitives()[0];
const count = d => prim(d).getIndices().getCount() / 3;
if (count(doc) > HTRIS) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: HTRIS / count(doc), error: 0.0005, lockBorder: false }));
const p0 = prim(doc), HD = { pos: Float32Array.from(p0.getAttribute('POSITION').getArray()), uv: Float32Array.from(p0.getAttribute('TEXCOORD_0').getArray()), idx: Uint32Array.from(p0.getIndices().getArray()) };
const tex0 = root.listTextures()[0], img0 = await sharp(Buffer.from(tex0.getImage()), { limitInputPixels: false }).raw().toBuffer({ resolveWithObject: true });
const TX = { data: img0.data, width: img0.info.width, height: img0.info.height, channels: img0.info.channels };
log(`bake source: ${HD.idx.length / 3} triangles, picture ${TX.width}x${TX.height}`);

// 3. whose each triangle is: the middle, or a district (by its tile)
function owner(x, z) {
  const deep = [z - RING, -x - RING, -z - RING, x - RING];        // how far into each side's ring
  let s = 0;
  for (let k = 1; k < 4; k++) if (deep[k] > deep[s]) s = k;
  if (deep[s] < 0) return 0;
  const a = s === 0 || s === 2 ? x : z, b = TILES[s], down = s < 2;     // (the front's and the left's run down)
  let k = 0;
  while (k < 8 && (down ? a <= b[k] : a >= b[k])) k++;
  return s * 10 + 1 + k;
}
function sorted(b) {
  const nt = b.idx.length / 3, who = new Uint8Array(nt);
  for (let t = 0; t < nt; t++) {
    let x = 0, z = 0;
    for (let j = 0; j < 3; j++) { const v = b.idx[t * 3 + j]; x += b.pos[v * 3]; z += b.pos[v * 3 + 2]; }
    who[t] = owner(x / 3, z / 3);
  }
  const order = [...Array(nt).keys()].sort((p, q) => who[p] - who[q] || p - q), idx = new Uint32Array(b.idx.length), parts = [];
  order.forEach((t, k) => { idx.set(b.idx.subarray(t * 3, t * 3 + 3), k * 3); });
  for (let k = 0; k < nt;) { const w = who[order[k]]; let e = k; while (e < nt && who[order[e]] === w) e++; parts.push([w ? 'lot' + w : 'middle', k * 3, (e - k) * 3]); k = e; }
  return { idx, parts };
}
// the top surface's height on a grid (N x N over the board's inside, the highest point in each cell)
function heights(b, N = 128, half = 4.6) {
  const hm = new Float32Array(N * N).fill(-9), s = N / (2 * half), P = b.pos, I = b.idx;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, c = I[t + 1] * 3, e = I[t + 2] * 3;
    const ax = (P[a] + half) * s, az = (P[a + 2] + half) * s, bx = (P[c] + half) * s, bz = (P[c + 2] + half) * s, cx = (P[e] + half) * s, cz = (P[e + 2] + half) * s;
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(d) < 1e-12) continue;
    for (let j = Math.max(0, Math.floor(Math.min(az, bz, cz))); j <= Math.min(N - 1, Math.ceil(Math.max(az, bz, cz))); j++)
      for (let i = Math.max(0, Math.floor(Math.min(ax, bx, cx))); i <= Math.min(N - 1, Math.ceil(Math.max(ax, bx, cx))); i++) {
        const px = i + 0.5, pz = j + 0.5, w1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / d, w2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / d, w3 = 1 - w1 - w2;
        if (w1 < -1e-4 || w2 < -1e-4 || w3 < -1e-4) continue;
        const y = w1 * P[a + 1] + w2 * P[c + 1] + w3 * P[e + 1], o = j * N + i;
        if (y > hm[o]) hm[o] = y;
      }
  }
  return { N, half, hm };
}

async function make(which, target, size, file) {
  const b = await bake(HD, TX, { tris: target, size, err: 0.002, maxCost: +(F.charts || 10), pad: F.pad ? +F.pad : 2, layout: F.layout || 'box', cull: { edge: 4.5, wall: 0.2, over: 1.28 }, swatches: SWATCHES, paint: PAINT, log });
  const { idx, parts } = sorted(b);
  const d = cloneDocument(doc), p = prim(d);
  for (const sem of p.listSemantics()) if (!['POSITION', 'NORMAL', 'TEXCOORD_0'].includes(sem)) p.setAttribute(sem, null);
  p.getAttribute('POSITION').setArray(b.pos);
  if (p.getAttribute('NORMAL')) p.getAttribute('NORMAL').setArray(b.normal);
  else p.setAttribute('NORMAL', d.createAccessor().setType('VEC3').setArray(b.normal).setBuffer(d.getRoot().listBuffers()[0]));
  p.getAttribute('TEXCOORD_0').setArray(b.uv);
  p.getIndices().setArray(idx);
  d.getRoot().listMeshes()[0].setName('city').setExtras({ parts });
  // the picture: as baked (_raw), then cleaned (the one in the file, next to it to look at and mend)
  const raw = file.replace(/\.glb$/, '_raw.png'), mask = file.replace(/\.glb$/, '_mask.png'), clean = file.replace(/\.glb$/, '.png');
  await sharp(b.image, { raw: { width: b.size, height: b.size, channels: 4 } }).removeAlpha().png().toFile(raw);
  if (F.clean !== '0') {
    await sharp(Buffer.from(b.done.map(v => v ? 255 : 0)), { raw: { width: b.size, height: b.size, channels: 1 } }).png().toFile(mask);
    const sp = Math.max(1.5, size / 1365), r = Math.max(0.7, size / 4096);
    log(execFileSync('python3', ['-I', path.join(HERE, 'paint_clean.py'), raw, mask, clean, '--sp', sp.toFixed(2), '--radius', r.toFixed(2)], { encoding: 'utf8' }).trim());
  } else fs.copyFileSync(raw, clean);
  d.getRoot().listTextures()[0].setImage(new Uint8Array(fs.readFileSync(clean))).setMimeType('image/png');
  await d.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size], quality: 86 }),
    quantize({ quantizePosition: 16, quantizeNormal: 10, quantizeTexcoord: 14 }), prune(), dedup());
  await io.write(file, d);
  log(`${which}: ${file}: ${idx.length / 3} triangles, picture ${size}, ${(fs.statSync(file).size / 1024).toFixed(0)} KB; ${parts.length} parts`);
  return b;
}
fs.mkdirSync(path.join(OUTDIR, 'mobile'), { recursive: true });
let desk = null;
if (ONLY !== 'mobile') desk = await make('desktop', TRIS, TEX, path.join(OUTDIR, 'm_tb_city.glb'));
if (ONLY !== 'desktop') { const m = await make('mobile', MTRIS, MTEX, path.join(OUTDIR, 'mobile', 'm_tb_city.glb')); if (!desk) desk = m; }
// the height map city.js keeps: 128 x 128 over the inside (4.6 either way), heights as 0..255 between LO and HI
const { N, half, hm } = heights(desk), LO = -0.3, HI = 2.6, q = new Uint8Array(N * N);
let top = [-9, 0, 0];
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const y = hm[j * N + i], v = y < -8 ? LAND : y;
  q[j * N + i] = Math.max(0, Math.min(255, Math.round((v - LO) / (HI - LO) * 255)));
  if (y > top[0]) top = [y, -half + (i + 0.5) * 2 * half / N, -half + (j + 0.5) * 2 * half / N];
}
const HM = { N, half, lo: LO, hi: HI, top: top.map(v => +v.toFixed(3)), data: Buffer.from(q).toString('base64') };
fs.writeFileSync(path.join(OUTDIR, 'city_heights.json'), JSON.stringify(HM));
if (F.city) {
  const src = fs.readFileSync(F.city, 'utf8'), out = src.replace(/\/\*HEIGHTS\*\/[\s\S]*?\/\*HEIGHTS\*\//, () => '/*HEIGHTS*/' + JSON.stringify(HM) + '/*HEIGHTS*/');
  if (out === src) log(`${F.city}: no /*HEIGHTS*/ place in it`); else { fs.writeFileSync(F.city, out); log(`${F.city}: its height map written in`); }
}
log(`height map ${N}x${N}; the highest point ${top.map(v => v.toFixed(2)).join(', ')}`);
log('done');
