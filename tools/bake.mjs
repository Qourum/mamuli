// A simpler model with its own picture, baked from the detailed one. A Meshy model's picture is cut into a great many
// small patches: simplifying it keeps every patch's edge (so it stops early) or crosses them (and the picture smears).
// Instead the shape alone is simplified, xatlas (or, for a model seen from above, boxmap.mjs) gives it a fresh layout of
// the picture, and every point of the new picture takes its colour from the nearest point of the detailed model.
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import * as watlas from 'watlas';
import { MeshoptSimplifier } from 'meshoptimizer';
import { boxLayout } from './boxmap.mjs';
import { seen } from './visible.mjs';

let ready = null;
const init = () => ready || (ready = Promise.all([watlas.Initialize(), MeshoptSimplifier.ready]));

// the detailed model: H = { pos Float32Array(n*3), uv Float32Array(n*2), idx Uint32Array }, its picture
// tex = { data, width, height, channels }; the simpler one gets `tris` triangles and a picture `size` square
export async function bake(H, tex, { tris, size, err = 0.01, maxCost = 2, pad = null, layout = 'xatlas', cull = null, swatches = null, paint = null, log = () => { } }) {
  await init();
  // 1. the shape alone: simplified across the picture's seams (its picture is made again anyway), then the vertices at
  // the same place made one, so the new layout sees one surface; with `cull` ({ edge, wall, over }: visible.mjs) the
  // faces that can never be seen left out (simplified to `over` times `tris` first, so about `tris` are left)
  const want = cull ? tris * (cull.over || 1.3) : tris;
  let low, e;
  for (const allow of [err, err * 4, err * 16, 1]) {
    [low, e] = MeshoptSimplifier.simplify(H.idx, H.pos, 3, Math.floor(want) * 3, allow, ['Permissive']);
    if (low.length / 3 <= want * 1.15) break;
  }
  if (cull) {
    const s = seen(H.pos, low, Object.assign({ log }, cull)), keep = [];
    for (let t = 0; t < low.length / 3; t++) if (s[t]) keep.push(low[t * 3], low[t * 3 + 1], low[t * 3 + 2]);
    low = Uint32Array.from(keep);
  }
  const remap = MeshoptSimplifier.generatePositionRemap(H.pos, 3), used = new Map(), list = [], Li = new Uint32Array(low.length);
  for (let k = 0; k < low.length; k++) { const v = remap[low[k]]; if (!used.has(v)) { used.set(v, list.length); list.push(v); } Li[k] = used.get(v); }
  const L = new Float32Array(list.length * 3);
  list.forEach((v, k) => { L[k * 3] = H.pos[v * 3]; L[k * 3 + 1] = H.pos[v * 3 + 1]; L[k * 3 + 2] = H.pos[v * 3 + 2]; });
  log(`shape: ${H.idx.length / 3} -> ${Li.length / 3} triangles (error ${e.toFixed(4)}), ${list.length} vertices`);
  if (process.env.BAKE_DUMP) (await import('fs')).writeFileSync(process.env.BAKE_DUMP, Buffer.concat([Buffer.from(new Uint32Array([L.length, Li.length]).buffer), Buffer.from(L.buffer, L.byteOffset, L.byteLength), Buffer.from(Li.buffer, Li.byteOffset, Li.byteLength)]));

  // 2. a fresh layout of the picture: xatlas's, or (layout 'box', for a model seen from above) boxmap.mjs's
  let out, nv;
  if (layout === 'box') {
    const b = boxLayout(L, Li, size, { pad: pad || 4, log });
    nv = b.xref.length;
    out = { pos: new Float32Array(nv * 3), uv: b.uv, idx: b.idx, xref: b.xref };
    for (let k = 0; k < nv; k++) out.pos.set(L.subarray(b.xref[k] * 3, b.xref[k] * 3 + 3), k * 3);
  } else {
    // (the patches are found once, then packed into one picture of `size` with less detail until they fit)
    const atlas = new watlas.Atlas(); pad = pad || Math.max(2, Math.round(size / 512)); const opt = { resolution: size, padding: pad, bilinear: true, rotateCharts: true };
    atlas.addMesh({ vertexPositionData: L, vertexCount: list.length, vertexPositionStride: 12, indexData: Li, indexCount: Li.length });
    atlas.computeCharts({ maxCost });          // (a higher cost: fewer, larger patches; for a hill, not a house)
    atlas.packCharts(opt);
    let tpu = atlas.texelsPerUnit;
    for (let tries = 0; tries < 40 && (atlas.atlasCount !== 1 || atlas.width > size || atlas.height > size); tries++) { tpu *= 0.93; atlas.packCharts(Object.assign({ texelsPerUnit: tpu }, opt)); }
    const AW = atlas.width, AH = atlas.height, mesh = atlas.getMesh(0);
    nv = mesh.vertexCount;
    out = { pos: new Float32Array(nv * 3), uv: new Float32Array(nv * 2), idx: new Uint32Array(mesh.indexCount), xref: new Uint32Array(nv) };
    mesh.getIndexArray(out.idx);
    for (let k = 0; k < nv; k++) {
      const v = mesh.getVertex(k);
      out.xref[k] = v.xref;
      out.pos.set(L.subarray(v.xref * 3, v.xref * 3 + 3), k * 3);
      out.uv[k * 2] = v.uv[0] / size; out.uv[k * 2 + 1] = v.uv[1] / size;
    }
    log(`layout: ${mesh.chartCount} patches in ${AW}x${AH} of ${size}, ${nv} vertices`);
    atlas.delete();
  }

  // normals: smooth over the shape, except across a crease (a face more than 60 degrees from the vertex's own side
  // does not count): a hill stays round, a wall's corner stays sharp; a vertex split at a seam keeps its neighbours'
  const nt = out.idx.length / 3, fn = new Float32Array(nt * 3), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < nt; t++) {
    a.fromArray(out.pos, out.idx[t * 3] * 3); b.fromArray(out.pos, out.idx[t * 3 + 1] * 3).sub(a); c.fromArray(out.pos, out.idx[t * 3 + 2] * 3).sub(a);
    b.cross(c).toArray(fn, t * 3);            // (its length is twice the area: larger faces weigh more)
  }
  const own = new Float32Array(nv * 3), around = Array.from({ length: list.length }, () => []);
  for (let t = 0; t < nt; t++) for (let j = 0; j < 3; j++) {
    const k = out.idx[t * 3 + j];
    own[k * 3] += fn[t * 3]; own[k * 3 + 1] += fn[t * 3 + 1]; own[k * 3 + 2] += fn[t * 3 + 2];
    around[out.xref[k]].push(t);
  }
  out.normal = new Float32Array(nv * 3);
  for (let k = 0; k < nv; k++) {
    a.fromArray(own, k * 3).normalize(); b.set(0, 0, 0);
    for (const t of around[out.xref[k]]) { c.fromArray(fn, t * 3); const l = c.length(); if (l && c.dot(a) / l > 0.5) b.add(c); }
    if (!b.lengthSq()) b.copy(a);
    b.normalize(); if (!b.lengthSq()) b.set(0, 1, 0);
    b.toArray(out.normal, k * 3);
  }

  // 3. the colours: each point of the new picture from the nearest point of the detailed model
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(H.pos, 3));
  geo.setIndex(new THREE.BufferAttribute(H.idx, 1));
  const bvh = new MeshBVH(geo), hit = {}, P = new THREE.Vector3(), tri = new THREE.Triangle(), bary = new THREE.Vector3();
  const img = new Uint8ClampedArray(size * size * 4), done = new Uint8Array(size * size);
  const { data, width: TW, height: TH, channels: CH } = tex;
  // (a face added to the model has a colour of its own: its picture coordinates past 2 down, its colour `swatches[1024 u]`)
  const sample = (u, v, o) => {          // bilinear, wrapping (Meshy's coordinates stay within 0..1)
    if (v >= 2 && swatches) { const c = swatches[Math.min(swatches.length - 1, Math.floor(u * 1024))]; img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2]; img[o + 3] = 255; return; }
    const x = (u - Math.floor(u)) * TW - 0.5, y = (v - Math.floor(v)) * TH - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    for (let ch = 0; ch < 3; ch++) {
      let s = 0;
      for (const [dx, dy, w] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
        const xx = Math.min(TW - 1, Math.max(0, x0 + dx)), yy = Math.min(TH - 1, Math.max(0, y0 + dy));
        s += data[(yy * TW + xx) * CH + ch] * w;
      }
      img[o + ch] = s;
    }
    img[o + 3] = 255;
  };
  const Hv = (i, out3) => out3.fromArray(H.pos, i * 3);
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  let texels = 0;
  const t0 = Date.now();
  // (paint: [{ x, y, z: ranges, paint(p, n, rgb) -> rgb or null }]: what is painted again over the baked colours, the
  // later over the earlier; p the point, n its face's normal)
  const Np = new THREE.Vector3(), inBox = (r, p) => (!r.x || (p.x >= r.x[0] && p.x <= r.x[1])) && (!r.y || (p.y >= r.y[0] && p.y <= r.y[1])) && (!r.z || (p.z >= r.z[0] && p.z <= r.z[1]));
  for (let t = 0; t < out.idx.length; t += 3) {
    const i0 = out.idx[t], i1 = out.idx[t + 1], i2 = out.idx[t + 2];
    if (paint) { A.fromArray(out.pos, i0 * 3); B.fromArray(out.pos, i1 * 3).sub(A); C.fromArray(out.pos, i2 * 3).sub(A); Np.crossVectors(B, C).normalize(); }
    const ax = out.uv[i0 * 2] * size, ay = out.uv[i0 * 2 + 1] * size, bx = out.uv[i1 * 2] * size, by = out.uv[i1 * 2 + 1] * size, cx = out.uv[i2 * 2] * size, cy = out.uv[i2 * 2 + 1] * size;
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(den) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx) - 1)), x1 = Math.min(size - 1, Math.ceil(Math.max(ax, bx, cx) + 1));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy) - 1)), y1 = Math.min(size - 1, Math.ceil(Math.max(ay, by, cy) + 1));
    // how far outside the triangle a texel may lie and still be its (about a texel, in barycentric terms)
    const edge = 1.2 / Math.sqrt(Math.abs(den));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const o = y * size + x;
      if (done[o] === 2) continue;
      const px = x + 0.5, py = y + 0.5;
      let w0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den, w1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den, w2 = 1 - w0 - w1;
      const inside = w0 >= 0 && w1 >= 0 && w2 >= 0;
      if (!inside && (w0 < -edge || w1 < -edge || w2 < -edge)) continue;
      if (!inside && done[o]) continue;               // already taken by a triangle it lies in, or near
      if (!inside) { w0 = Math.max(0, w0); w1 = Math.max(0, w1); w2 = Math.max(0, w2); const s = w0 + w1 + w2; w0 /= s; w1 /= s; w2 /= s; }
      P.set(out.pos[i0 * 3] * w0 + out.pos[i1 * 3] * w1 + out.pos[i2 * 3] * w2, out.pos[i0 * 3 + 1] * w0 + out.pos[i1 * 3 + 1] * w1 + out.pos[i2 * 3 + 1] * w2, out.pos[i0 * 3 + 2] * w0 + out.pos[i1 * 3 + 2] * w1 + out.pos[i2 * 3 + 2] * w2);
      bvh.closestPointToPoint(P, hit);
      const f = hit.faceIndex, j0 = H.idx[f * 3], j1 = H.idx[f * 3 + 1], j2 = H.idx[f * 3 + 2];
      tri.set(Hv(j0, A), Hv(j1, B), Hv(j2, C)); tri.getBarycoord(hit.point, bary);
      const u = H.uv[j0 * 2] * bary.x + H.uv[j1 * 2] * bary.y + H.uv[j2 * 2] * bary.z, v = H.uv[j0 * 2 + 1] * bary.x + H.uv[j1 * 2 + 1] * bary.y + H.uv[j2 * 2 + 1] * bary.z;
      sample(u, v, o * 4);
      if (paint && !(v >= 2 && swatches)) for (const r of paint) if (inBox(r, P)) { const c = r.paint(P, Np, [img[o * 4], img[o * 4 + 1], img[o * 4 + 2]]); if (c) { img[o * 4] = c[0]; img[o * 4 + 1] = c[1]; img[o * 4 + 2] = c[2]; } }
      if (!done[o]) texels++;
      done[o] = inside ? 2 : 1;
    }
  }
  log(`picture: ${texels} points baked in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  const baked = done.slice();                         // (which points are the model's own, before the gaps are filled)
  // the gaps between patches take their neighbours' colours (so nothing dark bleeds in from the edges)
  for (let pass = 0; pass < 16; pass++) {
    const add = [];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const o = y * size + x;
      if (done[o]) continue;
      let r = 0, g = 0, bl = 0, k = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue;
        const q = yy * size + xx;
        if (!done[q]) continue;
        r += img[q * 4]; g += img[q * 4 + 1]; bl += img[q * 4 + 2]; k++;
      }
      if (k) add.push([o, r / k, g / k, bl / k]);
    }
    if (!add.length) break;
    for (const [o, r, g, bl] of add) { img[o * 4] = r; img[o * 4 + 1] = g; img[o * 4 + 2] = bl; img[o * 4 + 3] = 255; done[o] = 1; }
  }
  return { pos: out.pos, normal: out.normal, uv: out.uv, idx: out.idx, image: Buffer.from(img.buffer), size, done: baked };
}
