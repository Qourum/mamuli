// Which faces of a model on the board can ever be seen: the camera is always above the board, so a face counts as seen
// when, from a few points on it, at least one of a few dozen directions up into the sky (from low over the horizon to
// straight up) gets out without hitting the model; the squares round the board (from `edge` out, `wall` high) hide
// what lies under them. The tiles' bottoms, the soil inside, a roof's underside: never seen, left out.
// seen(P, I) -> Uint8Array, 1 for each face that can be seen
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

export function seen(P, I, { edge = 4.5, wall = 0.2, log = () => { } } = {}) {
  const nt = I.length / 3, geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setIndex(new THREE.BufferAttribute(I.slice(), 1));             // (the tree reorders its own copy)
  const bvh = new MeshBVH(geo), ray = new THREE.Ray(), out = new Uint8Array(nt);
  const dirs = [];
  for (const [deg, n] of [[8, 16], [20, 16], [38, 12], [58, 8], [78, 5], [90, 1]]) {
    const e = deg * Math.PI / 180;
    for (let k = 0; k < n; k++) { const a = (k + (deg % 20 ? 0.5 : 0)) / n * Math.PI * 2; dirs.push(new THREE.Vector3(Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a))); }
  }
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), N = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Vector3();
  // a ray from q along d: out into the sky (not into the squares)
  const free = d => {
    ray.origin.copy(q); ray.direction.copy(d);
    if (bvh.raycastFirst(ray, THREE.DoubleSide)) return false;
    let t = Infinity;
    if (d.x) t = Math.min(t, ((d.x > 0 ? edge : -edge) - q.x) / d.x);
    if (d.z) t = Math.min(t, ((d.z > 0 ? edge : -edge) - q.z) / d.z);
    return !(t < Infinity) || q.y + Math.max(0, t) * d.y >= wall;
  };
  let rays = 0;
  for (let f = 0; f < nt; f++) {
    A.fromArray(P, I[f * 3] * 3); B.fromArray(P, I[f * 3 + 1] * 3); C.fromArray(P, I[f * 3 + 2] * 3);
    N.subVectors(B, A).cross(q.subVectors(C, A));
    const area = N.length() / 2;
    if (!area) continue;
    N.normalize();
    const pts = [[1 / 3, 1 / 3]];
    if (area > 4e-4) pts.push([0.7, 0.15], [0.15, 0.7], [0.15, 0.15]);
    let vis = false;
    for (const [u, v] of pts) {
      p.set(0, 0, 0).addScaledVector(A, 1 - u - v).addScaledVector(B, u).addScaledVector(C, v);
      for (const d of dirs) {
        const c = d.dot(N);
        if (c < 0.03) continue;
        q.copy(p).addScaledVector(N, 2e-3).addScaledVector(d, 2e-3);
        rays++;
        if (free(d)) { vis = true; break; }
      }
      if (vis) break;
    }
    out[f] = vis ? 1 : 0;
  }
  const n = out.reduce((a, b) => a + b, 0);
  log(`seen: ${n} of ${nt} faces (${rays} rays)`);
  return out;
}
