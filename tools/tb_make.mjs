#!/usr/bin/env node
// ტფილისი's 3D models: from Meshy's GLB to the board's two files, art/m_tb_NAME.glb (a computer, and ultra) and
// art/mobile/m_tb_NAME.glb (a phone), in one reading of the large file. glb_prep.mjs's way (one mesh, its colour
// picture as webp, the numbers as small integers), with these steps of its own:
//   --turn DEG       turned about its up axis first
//   --cut auto|none|H  everything below the water line (found, or H as a part of the height) cut away; y = 0 there
//   --keep x0,x1,z0,z1  only what lies in this box (after the model is made 1 wide): a bridge without its banks
//   --recenter 1     stood in the middle again after the cut (and made 1 wide again)
//   --tris N --tex N        the computer's file;  --mtris N --mtex N  the phone's
//   --err E          how far the surface may move (a part of the model's size)
//   --bake desktop,mobile|no  which files are baked (bake.mjs): by themselves, those whose triangles the picture's seams
//                    keep from coming down; --charts N  bigger patches of the new picture (xatlas's cost; 2 by itself,
//                    10 for a model of many small pieces); --pad N  texels between patches; --htris N  the detailed model
//                    the colours come from (500000)
//   node tb_make.mjs IN.glb OUTDIR NAME [options]
// It needs, next to it: npm i @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions meshoptimizer sharp three@0.149 three-mesh-bvh@0.5 watlas
// (tb_models.sh has each model's own settings.)
import { NodeIO, VertexLayout } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { clearNodeTransform, flatten, join, weld, simplify, prune, dedup, quantize, dequantize, textureCompress, transformMesh, compactPrimitive, cloneDocument } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { bake } from './bake.mjs';

const argv = process.argv.slice(2), F = {}, files = [];
for (let k = 0; k < argv.length; k++) if (argv[k].startsWith('--')) F[argv[k].slice(2)] = argv[++k]; else files.push(argv[k]);
const [IN, OUTDIR, NAME] = files;
if (!IN || !OUTDIR || !NAME) { console.log('node tb_make.mjs IN.glb OUTDIR NAME [--turn D] [--cut auto|none|H] [--keep x0,x1,z0,z1] [--recenter 1] [--tris N] [--tex N] [--mtris N] [--mtex N] [--err E]'); process.exit(1); }
const TRIS = +(F.tris || 35000), TEX = +(F.tex || 1024), MTRIS = +(F.mtris || 8000), MTEX = +(F.mtex || 1024), ERR = +(F.err || 0.01);
const TURN = +(F.turn || 0) * Math.PI / 180, CUT = F.cut || 'none', MODE = F.mode || 'attr', UVW = +(F.uvw || 1);
const t0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);

await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }).setVertexLayout(VertexLayout.SEPARATE);
const doc = await io.read(IN), root = doc.getRoot();
const prims = () => root.listMeshes().flatMap(m => m.listPrimitives());
const tri = () => prims().reduce((a, p) => a + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0);
log(`${path.basename(IN)}: ${Math.round(tri())} triangles, pictures ${root.listTextures().map(t => (t.getSize() || ['?']).join('x')).join(', ')}`);

for (const m of root.listMaterials()) {
  m.setNormalTexture(null).setOcclusionTexture(null).setEmissiveTexture(null).setMetallicRoughnessTexture(null);
  m.setMetallicFactor(0).setRoughnessFactor(1).setEmissiveFactor([0, 0, 0]);
}
await doc.transform(dequantize(), flatten());
for (const n of root.listNodes()) if (n.getMesh()) clearNodeTransform(n);
await doc.transform(join({ keepMeshes: false, keepNamed: false }), weld(), prune());
const meshes = root.listMeshes();
log(`welded: ${Math.round(tri())} triangles, ${prims().reduce((a, p) => a + p.getAttribute('POSITION').getCount(), 0)} vertices, ${prims().length} pieces`);

const bounds = () => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], v = [0, 0, 0];
  for (const p of prims()) {
    const a = p.getAttribute('POSITION'), ix = p.getIndices();
    // only vertices still used by a triangle
    const used = new Uint8Array(a.getCount());
    for (let t = 0; t < ix.getCount(); t++) used[ix.getScalar(t)] = 1;
    for (let k = 0; k < a.getCount(); k++) { if (!used[k]) continue; a.getElement(k, v); for (let j = 0; j < 3; j++) { lo[j] = Math.min(lo[j], v[j]); hi[j] = Math.max(hi[j], v[j]); } }
  }
  return { lo, hi };
};
const normalize = () => {
  const { lo, hi } = bounds(), k = 1 / Math.max(hi[0] - lo[0], hi[2] - lo[2]);
  for (const m of meshes) transformMesh(m, [k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0, -k * (lo[0] + hi[0]) / 2, -k * lo[1], -k * (lo[2] + hi[2]) / 2, 1]);
};
if (Math.abs(TURN) > 1e-6) for (const m of meshes) transformMesh(m, [Math.cos(TURN), 0, -Math.sin(TURN), 0, 0, 1, 0, 0, Math.sin(TURN), 0, Math.cos(TURN), 0, 0, 0, 0, 1]);
normalize();
let { lo, hi } = bounds();
const H = hi[1];
log(`size 1 x ${H.toFixed(3)} x ${(hi[2] - lo[2]).toFixed(3)} (width x height x depth)`);

// keep only the triangles that pass a test of their three corners
function keepIf(test, what) {
  let gone = 0;
  const A = [0, 0, 0], B = [0, 0, 0], C = [0, 0, 0];
  for (const p of prims()) {
    const a = p.getAttribute('POSITION'), ix = p.getIndices(), keep = [];
    for (let t = 0; t < ix.getCount(); t += 3) {
      const i0 = ix.getScalar(t), i1 = ix.getScalar(t + 1), i2 = ix.getScalar(t + 2);
      a.getElement(i0, A); a.getElement(i1, B); a.getElement(i2, C);
      if (!test(A, B, C)) { gone++; continue; }
      keep.push(i0, i1, i2);
    }
    ix.setArray(a.getCount() > 65535 ? new Uint32Array(keep) : new Uint16Array(keep));
    compactPrimitive(p);
  }
  log(`${what}: ${gone} triangles gone`);
}

// the water line: the widest flat level facing up, low in the model
if (CUT !== 'none') {
  let cut;
  if (CUT === 'auto') {
    const bins = new Map(), STEP = 0.004, A = [0, 0, 0], B = [0, 0, 0], C = [0, 0, 0];
    for (const p of prims()) {
      const a = p.getAttribute('POSITION'), ix = p.getIndices();
      for (let t = 0; t < ix.getCount(); t += 3) {
        a.getElement(ix.getScalar(t), A); a.getElement(ix.getScalar(t + 1), B); a.getElement(ix.getScalar(t + 2), C);
        const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
        const nx = u[1] * w[2] - u[2] * w[1], ny = u[2] * w[0] - u[0] * w[2], nz = u[0] * w[1] - u[1] * w[0], len = Math.hypot(nx, ny, nz);
        if (!len || ny / len < 0.97) continue;
        const b = Math.round((A[1] + B[1] + C[1]) / 3 / STEP);
        bins.set(b, (bins.get(b) || 0) + len / 2);
      }
    }
    const levels = [...bins.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([b, area]) => [b * STEP, area]);
    log('flat levels facing up (height, area):', levels.map(([y, a]) => `${y.toFixed(3)} ${a.toFixed(3)}`).join(' | '));
    const low = levels.filter(([y, a]) => y < H * 0.6 && a > 0.05 && a > 0.4 * levels[0][1]);
    cut = low.length ? Math.max(...low.map(([y]) => y)) + STEP * 1.5 : 0;
  } else cut = +CUT * H;
  keepIf((A, B, C) => !(A[1] < cut && B[1] < cut && C[1] < cut), `cut at ${cut.toFixed(3)} (${(cut / H * 100).toFixed(1)}% of the height)`);
  for (const m of meshes) transformMesh(m, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -cut, 0, 1]);
}
if (F.keep) {
  const [x0, x1, z0, z1] = F.keep.split(',').map(Number);
  keepIf((A, B, C) => { const x = (A[0] + B[0] + C[0]) / 3, z = (A[2] + B[2] + C[2]) / 3; return x > x0 && x < x1 && z > z0 && z < z1; }, `kept ${F.keep}`);
}
if (F.recenter) {
  const b = bounds(), k = 1 / Math.max(b.hi[0] - b.lo[0], b.hi[2] - b.lo[2]);
  // (the water line stays at y = 0)
  for (const m of meshes) transformMesh(m, [k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0, -k * (b.lo[0] + b.hi[0]) / 2, 0, -k * (b.lo[2] + b.hi[2]) / 2, 1]);
}
({ lo, hi } = bounds());
log(`now ${(hi[0] - lo[0]).toFixed(3)} x ${(hi[1] - lo[1]).toFixed(3)} x ${(hi[2] - lo[2]).toFixed(3)}, y from ${lo[1].toFixed(3)}; ${Math.round(tri())} triangles`);

// fewer triangles, keeping the picture's seams (its patches' edges stay where they are)
const prim = d => d.getRoot().listMeshes()[0].listPrimitives()[0];
const count = d => prim(d).getIndices().getCount() / 3;
async function plain(d, target) {
  if (count(d) > target) await d.transform(simplify({ simplifier: MeshoptSimplifier, ratio: target / count(d), error: ERR, lockBorder: false }));
  return count(d);
}
// the detailed model for baking: its shape, its picture's coordinates, its picture
await plain(doc, +(F.htris || 500000));
let HD = null, TX = null;
async function source() {
  if (HD) return;
  const p = prim(doc), a = p.getAttribute('POSITION'), u = p.getAttribute('TEXCOORD_0');
  HD = { pos: Float32Array.from(a.getArray()), uv: Float32Array.from(u.getArray()), idx: Uint32Array.from(p.getIndices().getArray()) };
  const tex = doc.getRoot().listTextures()[0];
  const { data, info } = await sharp(Buffer.from(tex.getImage())).raw().toBuffer({ resolveWithObject: true });
  TX = { data, width: info.width, height: info.height, channels: info.channels };
  log(`bake source: ${HD.idx.length / 3} triangles, picture ${TX.width}x${TX.height}`);
}
// a copy of the model with the baked shape and picture in place of its own
async function baked(target, size) {
  await source();
  const b = await bake(HD, TX, { tris: target, size, err: ERR, maxCost: +(F.charts || 2), pad: F.pad ? +F.pad : undefined, log });
  const d = cloneDocument(doc), p = prim(d);
  for (const sem of p.listSemantics()) if (!['POSITION', 'NORMAL', 'TEXCOORD_0'].includes(sem)) p.setAttribute(sem, null);
  p.getAttribute('POSITION').setArray(b.pos);
  if (p.getAttribute('NORMAL')) p.getAttribute('NORMAL').setArray(b.normal);
  else p.setAttribute('NORMAL', d.createAccessor().setType('VEC3').setArray(b.normal).setBuffer(d.getRoot().listBuffers()[0]));
  p.getAttribute('TEXCOORD_0').setArray(b.uv);
  p.getIndices().setArray(b.idx);
  const png = await sharp(b.image, { raw: { width: b.size, height: b.size, channels: 4 } }).png().toBuffer();
  d.getRoot().listTextures()[0].setImage(new Uint8Array(png)).setMimeType('image/png');
  return d;
}
async function write(d, file, tex) {
  await d.transform(
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex], quality: 84 }),
    quantize({ quantizePosition: 14, quantizeNormal: 8, quantizeTexcoord: 12 }), prune(), dedup());
  await io.write(file, d);
  const r = d.getRoot();
  log(`${file}: ${count(d)} triangles, picture ${r.listTextures().map(t => (t.getSize() || ['?']).join('x')).join(', ')}, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
}
fs.mkdirSync(path.join(OUTDIR, 'mobile'), { recursive: true });
const BAKE = (F.bake || '').split(',');
for (const [which, target, size, file] of [['desktop', TRIS, TEX, path.join(OUTDIR, NAME + '.glb')], ['mobile', MTRIS, MTEX, path.join(OUTDIR, 'mobile', NAME + '.glb')]]) {
  let d = cloneDocument(doc);
  const got = await plain(d, target);
  if (BAKE.includes(which) || (got > target * 1.25 && !BAKE.includes('no'))) {
    log(`${which}: the seams stop at ${got} triangles; baking ${target}`);
    d = await baked(target, size);
  }
  await write(d, file, size);
}
log('done');
