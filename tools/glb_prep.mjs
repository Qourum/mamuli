#!/usr/bin/env node
// The archipelago's 3D models: from the GLB files Meshy (or Higgsfield) makes to the board's (art/m_*.glb).
//   node glb_prep.mjs IN.glb OUT.glb [--tris 7000] [--tex 512] [--cut auto|none|H] [--turn DEG] [--err 0.02] [--drop X,Z,R,Y]
// It needs, next to it: npm i @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions meshoptimizer sharp
// What comes out is one mesh with one picture (webp), as src/glb.js reads it:
// - the model is turned about its up axis (--turn, in degrees), stood in the middle, its widest side 1 long;
// - a diorama's block of water and its base are cut away under its water line, which becomes y = 0: the line is found by
//   itself (the widest flat level facing up, low in the model) or given (--cut, as a height from 0 to 1 of the model;
//   none keeps everything);
// - fewer triangles (--tris; --err is how far, as a part of the model's size, the surface may move for it), a smaller
//   picture (--tex), the numbers stored as small integers;
// - the colour picture only: the board lights its models itself.
import { NodeIO, VertexLayout } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { clearNodeTransform, flatten, join, weld, simplify, prune, dedup, quantize, textureCompress, transformMesh, compactPrimitive } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';

const argv = process.argv.slice(2), flags = {}, files = [];
for (let k = 0; k < argv.length; k++) if (argv[k].startsWith('--')) flags[argv[k].slice(2)] = argv[++k]; else files.push(argv[k]);
const [IN, OUT] = files;
if (!IN || !OUT) { console.log('node glb_prep.mjs IN.glb OUT.glb [--tris 7000] [--tex 512] [--cut auto|none|H] [--turn DEG]'); process.exit(1); }
const TRIS = +(flags.tris || 7000), TEX = +(flags.tex || 512), CUT = flags.cut || 'auto', TURN = +(flags.turn || 0) * Math.PI / 180, ERR = +(flags.err || 0.02);

await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }).setVertexLayout(VertexLayout.SEPARATE);
const doc = await io.read(IN), root = doc.getRoot();
const tri = () => root.listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((a, p) => a + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0), 0);
console.log(`${IN}: ${root.listMeshes().length} meshes, ${Math.round(tri())} triangles, ${root.listTextures().length} pictures (${root.listTextures().map(t => t.getSize() ? t.getSize().join('x') : '?').join(', ')})`);

// the colour picture only
for (const m of root.listMaterials()) {
  m.setNormalTexture(null).setOcclusionTexture(null).setEmissiveTexture(null).setMetallicRoughnessTexture(null);
  m.setMetallicFactor(0).setRoughnessFactor(1).setEmissiveFactor([0, 0, 0]);
}
// every node's place into its mesh, and all of it into one mesh
await doc.transform(flatten());
for (const n of root.listNodes()) if (n.getMesh()) clearNodeTransform(n);
await doc.transform(join({ keepMeshes: false, keepNamed: false }), weld(), prune());
const meshes = root.listMeshes(), prims = meshes.flatMap(m => m.listPrimitives());
if (prims.length !== 1) console.log(`(${prims.length} pieces: each with its own material; the board reads them as one)`);

// turned, in the middle, standing on y = 0, its widest side 1 long
const bounds = () => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], v = [0, 0, 0];
  for (const p of prims) { const a = p.getAttribute('POSITION'); for (let k = 0; k < a.getCount(); k++) { a.getElement(k, v); for (let j = 0; j < 3; j++) { lo[j] = Math.min(lo[j], v[j]); hi[j] = Math.max(hi[j], v[j]); } } }
  return { lo, hi };
};
// (matrices column by column, as glTF has them)
const turn = Math.abs(TURN) > 1e-6 ? ([Math.cos(TURN), 0, -Math.sin(TURN), 0, 0, 1, 0, 0, Math.sin(TURN), 0, Math.cos(TURN), 0, 0, 0, 0, 1]) : null;
if (turn) for (const m of meshes) transformMesh(m, turn);
let { lo, hi } = bounds();
const k = 1 / Math.max(hi[0] - lo[0], hi[2] - lo[2]);
for (const m of meshes) transformMesh(m, [k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0, -k * (lo[0] + hi[0]) / 2, -k * lo[1], -k * (lo[2] + hi[2]) / 2, 1]);
({ lo, hi } = bounds());
const H = hi[1];
console.log(`size 1 x ${H.toFixed(3)} x ${(hi[2] - lo[2]).toFixed(3)} (width x height x depth)`);

// what is not wanted (--drop x,z,r,y: what lies in that circle, above that height, all of it: a cloud of smoke the board
// makes itself, say)
if (flags.drop) {
  const [dx, dz, dr, dy] = flags.drop.split(',').map(Number), e = [0, 0, 0];
  let gone = 0;
  for (const p of prims) {
    const a = p.getAttribute('POSITION'), ix = p.getIndices(), keep = [];
    const out = j => { a.getElement(j, e); return e[1] > dy && Math.hypot(e[0] - dx, e[2] - dz) < dr; };
    for (let t = 0; t < ix.getCount(); t += 3) {
      const v = [ix.getScalar(t), ix.getScalar(t + 1), ix.getScalar(t + 2)];
      if (v.every(out)) { gone++; continue; }
      keep.push(...v);
    }
    ix.setArray(a.getCount() > 65535 ? new Uint32Array(keep) : new Uint16Array(keep));
    compactPrimitive(p);
  }
  console.log(`dropped ${gone} triangles above ${dy} within ${dr} of ${dx}, ${dz}`);
}

// the water line: a wide flat level facing up, low in the model
const bins = new Map(), STEP = 0.004;
for (const p of prims) {
  const a = p.getAttribute('POSITION'), ix = p.getIndices(), n = ix ? ix.getCount() : a.getCount();
  const A = [0, 0, 0], B = [0, 0, 0], C = [0, 0, 0];
  for (let t = 0; t < n; t += 3) {
    a.getElement(ix ? ix.getScalar(t) : t, A); a.getElement(ix ? ix.getScalar(t + 1) : t + 1, B); a.getElement(ix ? ix.getScalar(t + 2) : t + 2, C);
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const nx = u[1] * w[2] - u[2] * w[1], ny = u[2] * w[0] - u[0] * w[2], nz = u[0] * w[1] - u[1] * w[0], len = Math.hypot(nx, ny, nz);
    if (!len || ny / len < 0.97) continue;
    const y = (A[1] + B[1] + C[1]) / 3, b = Math.round(y / STEP);
    bins.set(b, (bins.get(b) || 0) + len / 2);
  }
}
const levels = [...bins.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([b, area]) => [b * STEP, area]);
console.log('flat levels facing up (height, area):', levels.map(([y, a]) => `${y.toFixed(3)} ${a.toFixed(3)}`).join(' | '));
let cut = null;
if (CUT === 'auto') {         // the highest of the wide levels low in the model (a base's rim may be wider, under the water)
  const low = levels.filter(([y, a]) => y < H * 0.6 && a > 0.05 && a > 0.4 * levels[0][1]);
  cut = low.length ? Math.max(...low.map(([y]) => y)) + STEP * 1.5 : null;
}
else if (CUT !== 'none') cut = +CUT * H;
if (cut != null) {
  let gone = 0;
  for (const p of prims) {
    const a = p.getAttribute('POSITION'), ix = p.getIndices(), keep = [], e = [0, 0, 0];
    for (let t = 0; t < ix.getCount(); t += 3) {
      const v = [ix.getScalar(t), ix.getScalar(t + 1), ix.getScalar(t + 2)];
      if (v.every(j => a.getElement(j, e)[1] < cut)) { gone++; continue; }
      keep.push(...v);
    }
    ix.setArray(a.getCount() > 65535 ? new Uint32Array(keep) : new Uint16Array(keep));
    compactPrimitive(p);
  }
  for (const m of meshes) transformMesh(m, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -cut, 0, 1]);
  console.log(`water line at ${cut.toFixed(3)} (${(cut / H * 100).toFixed(1)}% of the height): ${gone} triangles under it cut away`);
} else console.log('nothing cut away');

// fewer triangles, a smaller picture, small numbers
const now = tri();
if (now > TRIS) await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: TRIS / now, error: ERR, lockBorder: false }));
await doc.transform(
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEX, TEX], quality: 82 }),
  quantize({ quantizePosition: 14, quantizeNormal: 8, quantizeTexcoord: 12 }),
  prune(), dedup());
await io.write(OUT, doc);
console.log(`${OUT}: ${Math.round(tri())} triangles, picture ${root.listTextures().map(t => t.getSize() ? t.getSize().join('x') : '?').join(', ')}, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
