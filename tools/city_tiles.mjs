#!/usr/bin/env node
// ტფილისი's city model: its districts' tiles put behind their own squares, on the model city_make.mjs made.
// Meshy built the city's ring of districts one tile off on the right side (Mtatsminda's slope): Rustaveli's columned
// building stood behind Kinto's question (33), the forest pond behind Rustaveli (32), the market stalls behind
// Mtatsminda (34), the Ferris wheel behind the funicular (35) and the carousel behind the story card (36). And on
// Sololaki (37) it put a grey Soviet block of flats. Here:
//   1. whole tiles move along the side, each with its ground, its gaps and its picture, in a new order with no gap
//      left: the columned building to Rustaveli, the pond to Kinto's question, the Ferris wheel to Mtatsminda, the
//      carousel and the little station to the funicular, the market stalls to the story card. A moved tile's points
//      are its own (where it touched its neighbours or the middle, those keep theirs); under the side's tiles a floor
//      of grass, so where a moved tile no longer meets its neighbour, grass shows, not the board beneath.
//   2. Sololaki: the block of flats and its paving taken away, the tile paved again whole; the Dry Bridge's cream
//      19th-century house (and the tree beside it) moves over to it, set down on Sololaki's paving; the Dry Bridge
//      keeps its arched house and the painters' stalls, the house's old plot paved again
//   3. the triangles in runs again, the middle's first, then each district's; the height map (for city.js) made again
// The picture is not touched: every triangle keeps its own picture coordinates; a new paving takes the colour most of
// the paving round it has, read off the picture.
// node city_tiles.mjs IN.glb OUT.glb [--city ../src/city.js (its height map written in)] [--verbose 1]
// Run it once on each of city_make.mjs's two files (art/m_tb_city.glb, art/mobile/m_tb_city.glb); a file it has
// already rearranged it leaves alone. It needs, next to it: npm i @gltf-transform/core @gltf-transform/functions
// @gltf-transform/extensions sharp
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, quantize, flatten, clearNodeTransform, prune } from '@gltf-transform/functions';
import sharp from 'sharp';
import fs from 'fs';

const argv = process.argv.slice(2), F = {}, files = [];
for (let k = 0; k < argv.length; k++) if (argv[k].startsWith('--')) F[argv[k].slice(2)] = argv[++k]; else files.push(argv[k]);
const [IN, OUT] = files;
if (!IN || !OUT) { console.log('node city_tiles.mjs IN.glb OUT.glb [--city ../src/city.js]'); process.exit(1); }

// ===== the right side's tiles, as city_make.mjs's TILES has them (along z from the back; board units) =====
// lot 32 [-3.31, -2.25] the pond, 33 [-2.25, -1.45] Rustaveli's building, 34 [-1.45, -0.22] the stalls,
// 35 [-0.22, 0.72] the Ferris wheel, 36 [0.72, 1.77] the carousel; laid again from -3.31 in the order of their new
// squares, each by how far its start moves
const MOVES = [
  { lot: 33, to: 32, dz: -3.31 - -2.25 },    // Rustaveli's columned building: [-3.31, -2.51]
  { lot: 32, to: 33, dz: -2.51 - -3.31 },    // the forest pond: [-2.51, -1.45]
  { lot: 35, to: 34, dz: -1.45 - -0.22 },    // the Ferris wheel: [-1.45, -0.51]
  { lot: 36, to: 35, dz: -0.51 - 0.72 },     // the carousel and the little station: [-0.51, 0.54]
  { lot: 34, to: 36, dz: 0.54 - -1.45 }      // the market stalls: [0.54, 1.77]
];
// under them (and the right side's other tiles), the floor of grass; its colour the middle's grass beside the tiles
const UNDER = { x: [3.18, 4.45], z: [-3.45, 3.5], y: -0.05, grass: { lot: 0, x: [3.0, 3.2], z: [-3, 3] } };
// ===== Sololaki (37, z [1.77, 2.55]) and the Dry Bridge (38, [2.55, 3.45]) =====
// a tile's paving: what faces up lowest on it (its commonest height); what stands on it: above that, not facing up
// close to it; a kerb's height over it
const LOW = 0.012, KERB = 0.02;
// the block of flats: all on Sololaki's tile inside its rim taken away, its paving too; the tile paved again whole
const SOLOLAKI = { lot: 37, x: [3.31, 4.41], z: [1.795, 2.53] };
// the Dry Bridge's tile inside its rim; on it, the cream house at the front (the pieces standing there whose middle
// is in the box), and how far it moves along z: onto the middle of Sololaki's tile, still facing its square (set down
// on Sololaki's paving); where it stood (its plot) paved again
const DRY = { lot: 38, x: [3.34, 4.4], z: [2.62, 3.4] };
const HOUSE = { lot: 38, x: [3.96, 4.33], z: [2.78, 3.33], to: 37, dz: -0.9 };
const PLOT = { lot: 38, x: [3.93, 4.37], z: [2.76, 3.36] };

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(IN), root = doc.getRoot();
const mesh = root.listMeshes()[0];
if (!mesh || !Array.isArray((mesh.getExtras() || {}).parts)) { console.log(`${IN}: no city model (no runs)`); process.exit(1); }
if ((mesh.getExtras() || {}).tiles) { console.log(`${IN}: its tiles are already where they belong`); process.exit(0); }
await doc.transform(dequantize(), flatten());
for (const n of root.listNodes()) if (n.getMesh()) clearNodeTransform(n);
const p = mesh.listPrimitives()[0], parts = mesh.getExtras().parts;
const sems = p.listSemantics().filter(s => ['POSITION', 'NORMAL', 'TEXCOORD_0'].includes(s));
for (const s of p.listSemantics()) if (!sems.includes(s)) p.setAttribute(s, null);
const A = Object.fromEntries(sems.map(s => [s, Array.from(p.getAttribute(s).getArray())]));
const W = { POSITION: 3, NORMAL: 3, TEXCOORD_0: 2 };
const P = A.POSITION;
let I = Array.from(p.getIndices().getArray());

// whose each triangle is
let who = new Int16Array(I.length / 3);
for (const [name, s, c] of parts) { const id = name === 'middle' ? 0 : +name.slice(3); for (let t = s / 3; t < (s + c) / 3; t++) who[t] = id; }
const centre = t => [0, 1, 2].map(q => (P[I[t * 3] * 3 + q] + P[I[t * 3 + 1] * 3 + q] + P[I[t * 3 + 2] * 3 + q]) / 3);
function upness(t) {
  const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
  const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
  return { up: ny / (l || 1), area: l / 2 };
}
const facesUp = t => upness(t).up > 0.8;
const inBox = (b, x, z) => x >= b.x[0] && x <= b.x[1] && z >= b.z[0] && z <= b.z[1];
// the triangles of a box (whose, its middle in it), and a test on each (its middle, the triangle)
function within(box, test = () => true) {
  const out = [];
  for (let t = 0; t < I.length / 3; t++) {
    if (box.lot != null && who[t] !== box.lot) continue;
    const c = centre(t);
    if (inBox(box, c[0], c[2]) && test(c, t)) out.push(t);
  }
  return out;
}
// a vertex of its own for a moved triangle (one per point and move), its place moved by d
function mover() {
  const own = new Map();
  return (v, d, key) => {
    const k = v + ':' + key;
    if (!own.has(k)) {
      for (const s of sems) { const w = W[s]; for (let q = 0; q < w; q++) A[s].push(A[s][v * w + q]); }
      const n = A.POSITION.length / 3 - 1;
      A.POSITION[n * 3] += d[0]; A.POSITION[n * 3 + 1] += d[1]; A.POSITION[n * 3 + 2] += d[2];
      own.set(k, n);
    }
    return own.get(k);
  };
}
// the picture, to read its colours
const tex = root.listTextures()[0], img = await sharp(Buffer.from(tex.getImage())).raw().toBuffer({ resolveWithObject: true });
const texel = (u, v) => { const x = Math.min(img.info.width - 1, Math.max(0, Math.floor(u * img.info.width))), y = Math.min(img.info.height - 1, Math.max(0, Math.floor(v * img.info.height))), o = (y * img.info.width + x) * img.info.channels; return [img.data[o], img.data[o + 1], img.data[o + 2]]; };
const uvOf = t => [0, 1].map(k => (A.TEXCOORD_0[I[t * 3] * 2 + k] + A.TEXCOORD_0[I[t * 3 + 1] * 2 + k] + A.TEXCOORD_0[I[t * 3 + 2] * 2 + k]) / 3);
// the colour most of some triangles have: the picture coordinates of the one nearest the middle of their colours (a
// flat patch laid with them all is that colour)
function typical(list) {
  // (the colours in steps of 24, each step weighed by how much of the surface has it; of the biggest, the triangle
  // nearest its middle)
  const cs = list.map(t => texel(...uvOf(t))), bins = new Map();
  cs.forEach((v, k) => { const key = v.map(c => Math.floor(c / 24)).join(','), b = bins.get(key) || { area: 0, sum: [0, 0, 0], n: 0 }; const a = upness(list[k]).area; b.area += a; b.n++; for (let c = 0; c < 3; c++) b.sum[c] += v[c]; bins.set(key, b); });
  const top = [...bins.values()].sort((a, b) => b.area - a.area)[0], mid = top.sum.map(s => s / top.n);
  let best = 0, bd = Infinity;
  cs.forEach((v, k) => { const d = (v[0] - mid[0]) ** 2 + (v[1] - mid[1]) ** 2 + (v[2] - mid[2]) ** 2; if (d < bd) { bd = d; best = k; } });
  return { uv: uvOf(list[best]), rgb: cs[best] };
}
// a tile's paving (in a box, but not in `skip`): the height most of what faces up low on it has (by area, in steps of
// 5 mm), and that paving's colour
function paving(box, skip) {
  const up = within(box, (c, t) => c[1] > -0.06 && c[1] < 0.06 && !(skip && inBox(skip, c[0], c[2])) && facesUp(t)), bins = new Map();
  for (const t of up) { const k = Math.round(centre(t)[1] / 0.005); bins.set(k, (bins.get(k) || 0) + upness(t).area); }
  const k = [...bins].sort((a, b) => b[1] - a[1])[0][0], y = k * 0.005;
  return Object.assign({ y }, typical(up.filter(t => Math.abs(centre(t)[1] - y) < 0.004)));
}
// what stands on a tile in a box: above its paving, and not facing up close to it
const standing = (box, base) => within(box, (c, t) => c[1] > base.y + 0.004 && !(c[1] < base.y + LOW && facesUp(t)));
// a flat patch facing up (x, z ranges, at y), whose, in one colour; added at the end
const patches = [];
function patch(q, y, uv, lot) {
  const at = [];
  for (const [x, z] of [[q.x[0], q.z[0]], [q.x[1], q.z[0]], [q.x[1], q.z[1]], [q.x[0], q.z[1]]]) {
    A.POSITION.push(x, y, z); A.NORMAL.push(0, 1, 0); A.TEXCOORD_0.push(uv[0], uv[1]);
    at.push(A.POSITION.length / 3 - 1);
  }
  patches.push([[at[0], at[2], at[1]], lot], [[at[0], at[3], at[2]], lot]);
}
// pieces: the triangles in a list joined by their corners (a corner's place, so a seam in the picture does not part them)
function pieces(list) {
  const key = v => `${Math.round(P[v * 3] * 1e4)},${Math.round(P[v * 3 + 1] * 1e4)},${Math.round(P[v * 3 + 2] * 1e4)}`, up = new Map();
  const find = k => { while (up.get(k) !== k) { up.set(k, up.get(up.get(k))); k = up.get(k); } return k; };
  for (const t of list) { const ks = [0, 1, 2].map(j => key(I[t * 3 + j])); for (const k of ks) if (!up.has(k)) up.set(k, k); up.set(find(ks[1]), find(ks[0])); up.set(find(ks[2]), find(ks[0])); }
  const out = new Map();
  for (const t of list) { const r = find(key(I[t * 3])); if (!out.has(r)) out.set(r, []); out.get(r).push(t); }
  return [...out.values()];
}

// 1. the tiles moved. What stands across a tile's edge (a tree half on its neighbour or on the middle, a building)
// goes whole with the one most of it is on
{
  const cand = within({ x: [3.0, 4.6], z: [-3.9, 2.0] }, c => c[1] > 0.06);
  let whole = 0;
  for (const list of pieces(cand)) {
    const n = {};
    for (const t of list) n[who[t]] = (n[who[t]] || 0) + 1;
    const ks = Object.keys(n);
    if (ks.length < 2 || !ks.some(k => MOVES.some(m => m.lot === +k))) continue;
    const most = +ks.sort((a, b) => n[b] - n[a])[0];
    for (const t of list) who[t] = most;
    whole++;
  }
  console.log(`across the tiles' edges: ${whole} things kept whole`);
}
{
  const own = mover(), to = new Int16Array(who), n = I.length / 3, count = {};
  for (let t = 0; t < n; t++) {
    const m = MOVES.find(m => m.lot === who[t]);
    if (!m) continue;
    for (let j = 0; j < 3; j++) I[t * 3 + j] = own(I[t * 3 + j], [0, 0, m.dz], m.lot);
    to[t] = m.to; count[m.lot] = (count[m.lot] || 0) + 1;
  }
  who = to;
  for (const m of MOVES) console.log(`tile of lot ${m.lot} -> behind ${m.to} (z ${m.dz >= 0 ? '+' : ''}${m.dz.toFixed(2)}): ${count[m.lot] || 0} triangles`);
}
// 2. Sololaki: the block of flats away, the cream house over from the Dry Bridge, paving where they stood
{
  const n = I.length / 3;
  // the pavings and the grass, first
  const sol = paving(SOLOLAKI), dry = paving(DRY, PLOT), grass = typical(within(UNDER.grass, (c, t) => c[1] > 0 && c[1] < 0.08 && facesUp(t)));
  console.log(`paving: Sololaki's at ${sol.y.toFixed(3)} (${sol.rgb}), the Dry Bridge's at ${dry.y.toFixed(3)} (${dry.rgb}); the grass ${grass.rgb}`);
  // all on Sololaki's tile inside its rim, its paving too
  const gone = new Set(within(SOLOLAKI, c => c[1] > sol.y - 0.01));
  // the house: of what stands near it above its kerbs, the pieces whose middle is in its box (not its neighbour);
  // then its foot below them, all that stands under the pieces' outline
  const near = { lot: HOUSE.lot, x: [HOUSE.x[0] - 0.08, HOUSE.x[1] + 0.08], z: [HOUSE.z[0] - 0.08, HOUSE.z[1] + 0.08] };
  const cand = standing(near, dry).filter(t => centre(t)[1] > dry.y + KERB);
  const chosen = pieces(cand).filter(list => {
    const c = list.reduce((s, t) => { const q = centre(t); return [s[0] + q[0], s[1] + q[2]]; }, [0, 0]).map(v => v / list.length);
    if (F.verbose && list.length > 5) console.log(`  piece: ${list.length} triangles, middle ${c.map(v => v.toFixed(2)).join(', ')}`);
    return inBox(HOUSE, c[0], c[1]);
  }).flat();
  let bx0 = 9, bx1 = -9, bz0 = 9, bz1 = -9;
  for (const t of chosen) { const [x, , z] = centre(t); bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); bz0 = Math.min(bz0, z); bz1 = Math.max(bz1, z); }
  const house = new Set(chosen);
  for (const t of standing({ lot: HOUSE.lot, x: [bx0, bx1], z: [bz0, bz1] }, dry)) if (centre(t)[1] <= dry.y + KERB) house.add(t);
  const own = mover(), d = [0, sol.y - dry.y, HOUSE.dz];
  for (const t of house) { for (let j = 0; j < 3; j++) I[t * 3 + j] = own(I[t * 3 + j], d, 'house'); who[t] = HOUSE.to; }
  // what is left on its plot (kerbs, steps, the paving round its foot)
  const left = within(PLOT, c => c[1] > dry.y - 0.01).filter(t => !house.has(t));
  for (const t of left) gone.add(t);
  const keep = [], keepWho = [];
  for (let t = 0; t < n; t++) if (!gone.has(t)) { keep.push(I[t * 3], I[t * 3 + 1], I[t * 3 + 2]); keepWho.push(who[t]); }
  I = keep; who = Int16Array.from(keepWho);
  console.log(`Sololaki: its block of flats and paving taken away, ${gone.size - left.length} triangles; the cream house moved over (by ${d.map(v => v.toFixed(3)).join(', ')}), ${house.size}; its plot cleared, ${left.length}`);
  patch(SOLOLAKI, sol.y - 0.001, sol.uv, SOLOLAKI.lot);
  patch(PLOT, dry.y - 0.001, dry.uv, PLOT.lot);
  patch(UNDER, UNDER.y, grass.uv, 0);
  for (const [tri, lot] of patches) { I.push(...tri); keepWho.push(lot); }
  who = Int16Array.from(keepWho);
}
// 3. the runs again: the middle first, then each district
const nt = I.length / 3, order = [...Array(nt).keys()].sort((a, b) => who[a] - who[b] || a - b), idx = new Uint32Array(I.length), runs = [];
order.forEach((t, k) => { idx[k * 3] = I[t * 3]; idx[k * 3 + 1] = I[t * 3 + 1]; idx[k * 3 + 2] = I[t * 3 + 2]; });
for (let k = 0; k < nt;) { const w = who[order[k]]; let e = k; while (e < nt && who[order[e]] === w) e++; runs.push([w ? 'lot' + w : 'middle', k * 3, (e - k) * 3]); k = e; }
for (const s of sems) p.getAttribute(s).setArray(Float32Array.from(A[s]));
p.getIndices().setArray(idx);
mesh.setExtras(Object.assign({}, mesh.getExtras(), { parts: runs, tiles: 1 }));
await doc.transform(prune(), quantize({ quantizePosition: 16, quantizeNormal: 10, quantizeTexcoord: 14 }));
await io.write(OUT, doc);
console.log(`${OUT}: ${nt} triangles, ${A.POSITION.length / 3} points, ${runs.length} runs, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);

// the top surface's height on a grid (as city_make.mjs makes it): 128 x 128 over the inside, 0..255 between LO and HI
if (F.city) {
  const N = 128, half = 4.6, LO = -0.3, HI = 2.6, LAND = 0.03, hm = new Float32Array(N * N).fill(-9), s = N / (2 * half), Q = A.POSITION;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, c = idx[t + 1] * 3, e = idx[t + 2] * 3;
    const ax = (Q[a] + half) * s, az = (Q[a + 2] + half) * s, bx = (Q[c] + half) * s, bz = (Q[c + 2] + half) * s, cx = (Q[e] + half) * s, cz = (Q[e + 2] + half) * s;
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(d) < 1e-12) continue;
    for (let j = Math.max(0, Math.floor(Math.min(az, bz, cz))); j <= Math.min(N - 1, Math.ceil(Math.max(az, bz, cz))); j++)
      for (let i = Math.max(0, Math.floor(Math.min(ax, bx, cx))); i <= Math.min(N - 1, Math.ceil(Math.max(ax, bx, cx))); i++) {
        const px = i + 0.5, pz = j + 0.5, w1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / d, w2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / d, w3 = 1 - w1 - w2;
        if (w1 < -1e-4 || w2 < -1e-4 || w3 < -1e-4) continue;
        const y = w1 * Q[a + 1] + w2 * Q[c + 1] + w3 * Q[e + 1], o = j * N + i;
        if (y > hm[o]) hm[o] = y;
      }
  }
  const q = new Uint8Array(N * N);
  let top = [-9, 0, 0];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const y = hm[j * N + i], v = y < -8 ? LAND : y;
    q[j * N + i] = Math.max(0, Math.min(255, Math.round((v - LO) / (HI - LO) * 255)));
    if (y > top[0]) top = [y, -half + (i + 0.5) * 2 * half / N, -half + (j + 0.5) * 2 * half / N];
  }
  const HM = { N, half, lo: LO, hi: HI, top: top.map(v => +v.toFixed(3)), data: Buffer.from(q).toString('base64') };
  const src = fs.readFileSync(F.city, 'utf8'), re = /\/\*HEIGHTS\*\/[\s\S]*?\/\*HEIGHTS\*\//;
  if (!re.test(src)) { console.log(`${F.city}: no /*HEIGHTS*/ place in it`); process.exit(1); }
  fs.writeFileSync(F.city, src.replace(re, () => '/*HEIGHTS*/' + JSON.stringify(HM) + '/*HEIGHTS*/'));
  console.log(`${F.city}: height map written in; the highest point ${top.map(v => v.toFixed(2)).join(', ')}`);
}
