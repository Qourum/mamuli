// Small, fully submerged coral gardens and fish schools. All scenery is real geometry:
// one merged reef draw, two instanced fish draws, and the board's existing animation clock.
const Reef3D = (() => {
  const T = window.THREE;
  if (!T) return null;
  const TAU = Math.PI * 2;
  const PALETTE = [0xc06e9a, 0x9568bf, 0x55bba9, 0xe4b955, 0xeb977d, 0x669bbb];
  const FISH = [0xefc867, 0xe99469, 0x6dbcc3, 0x9b86d4];
  const Y = new T.Vector3(0, 1, 0);
  const PATCHES = [];
  // The centre's original coral is preserved. These gardens occupy the clear diagonal
  // lagoon corners; their closest geometry stays beyond radius 3.2 and away from deeds.
  for (let q = 0; q < 4; q++) for (const offset of [-.085, .085]) {
    const a = Math.PI / 4 + q * Math.PI / 2 + offset;
    PATCHES.push({ x: Math.cos(a) * 3.57, z: Math.sin(a) * 3.57, outer: false, a });
  }
  for (let q = 0; q < 4; q++) {
    const a = .31 + q * Math.PI / 2;
    PATCHES.push({ x: Math.cos(a) * 8.45, z: Math.sin(a) * 8.45, outer: true, a });
  }

  function rng(seed) {
    let n = seed >>> 0;
    return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
  }

  // Merge with vertex colour, without loading another utility or keeping temporary meshes.
  function builder() {
    const p = [], n = [], c = [], colour = new T.Color();
    return {
      add(geometry, hex, matrix) {
        if (matrix) geometry.applyMatrix4(matrix);
        const flat = geometry.index ? geometry.toNonIndexed() : geometry;
        if (!flat.attributes.normal) flat.computeVertexNormals();
        colour.setHex(hex);
        const ps = flat.attributes.position.array, ns = flat.attributes.normal.array;
        for (let k = 0; k < ps.length; k++) { p.push(ps[k]); n.push(ns[k]); }
        for (let k = 0; k < ps.length / 3; k++) c.push(colour.r, colour.g, colour.b);
        if (flat !== geometry) flat.dispose();
        geometry.dispose();
      },
      finish() {
        const geometry = new T.BufferGeometry();
        geometry.setAttribute('position', new T.Float32BufferAttribute(p, 3));
        geometry.setAttribute('normal', new T.Float32BufferAttribute(n, 3));
        geometry.setAttribute('color', new T.Float32BufferAttribute(c, 3));
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        return geometry;
      }
    };
  }

  function pose(x, y, z, sx = 1, sy = 1, sz = 1, angle = 0) {
    return new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromAxisAngle(Y, angle), new T.Vector3(sx, sy, sz));
  }

  // Curved, tapering branches have a real rounded cross-section and closed ends.
  function branch(points, radius) {
    const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p))), steps = 4, radial = 6;
    const frames = curve.computeFrenetFrames(steps, false), p = [], ix = [];
    for (let j = 0; j <= steps; j++) {
      const at = curve.getPoint(j / steps), r = radius * (1 - .73 * j / steps);
      for (let k = 0; k < radial; k++) {
        const a = k / radial * TAU;
        const v = at.clone().addScaledVector(frames.normals[j], Math.cos(a) * r).addScaledVector(frames.binormals[j], Math.sin(a) * r);
        p.push(v.x, v.y, v.z);
      }
    }
    for (let j = 0; j < steps; j++) for (let k = 0; k < radial; k++) {
      const a = j * radial + k, b = j * radial + (k + 1) % radial, d = a + radial, e = b + radial;
      ix.push(a, b, d, b, e, d);
    }
    for (const end of [0, steps]) {
      const center = p.length / 3, at = curve.getPoint(end / steps); p.push(at.x, at.y, at.z);
      for (let k = 0; k < radial; k++) {
        const a = end * radial + k, b = end * radial + (k + 1) % radial;
        if (end === 0) ix.push(center, b, a); else ix.push(center, a, b);
      }
    }
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(p, 3)); geometry.setIndex(ix); geometry.computeVertexNormals();
    return geometry;
  }

  // Wavy plate coral grows in overlapping shelves, rather than a stack of spheres.
  function plate(radius, height, phase) {
    const segments = 20, p = [], ix = [];
    for (let ring = 0; ring < 3; ring++) for (let k = 0; k <= segments; k++) {
      const a = k / segments * TAU, r = radius * [0.09, .58, 1][ring] * (1 + .10 * Math.sin(a * 5 + phase));
      p.push(Math.cos(a) * r, height * [0, .18, .68][ring] + Math.sin(a * 6 + phase) * height * .12 * ring, Math.sin(a) * r);
    }
    for (let j = 0; j < 2; j++) for (let k = 0; k < segments; k++) {
      const a = j * (segments + 1) + k, b = a + 1, c = a + segments + 1, d = c + 1;
      ix.push(a, b, c, b, d, c);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setIndex(ix); g.computeVertexNormals(); return g;
  }

  function sponge(radius, height) {
    const p = [], ix = [], seg = 10;
    // Outer base/top then inner lip/base make an open, visibly hollow cup.
    for (let j = 0; j < 4; j++) for (let k = 0; k < seg; k++) {
      const a = k / seg * TAU, r = radius * [0.72, 1, .62, .45][j];
      p.push(Math.cos(a) * r, [0, height, height * .96, height * .20][j], Math.sin(a) * r);
    }
    for (let j = 0; j < 3; j++) for (let k = 0; k < seg; k++) {
      const a = j * seg + k, b = j * seg + (k + 1) % seg, c = a + seg, d = b + seg;
      ix.push(a, c, b, b, c, d);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setIndex(ix); g.computeVertexNormals(); return g;
  }

  function fishGeometry(tail = false) {
    const b = builder();
    if (tail) {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute([0,0,0, -.26,.19,.025, -.20,0,.01, 0,0,0, -.20,0,.01, -.26,-.19,.025,
        0,0,0, -.20,0,-.01, -.26,.19,-.025, 0,0,0, -.26,-.19,-.025, -.20,0,-.01], 3));
      g.computeVertexNormals(); b.add(g, 0xf1db9d); return b.finish();
    }
    b.add(new T.SphereGeometry(1, 10, 6), 0xffffff, pose(0, 0, 0, .44, .16, .12));
    b.add(new T.SphereGeometry(1, 8, 5), 0xe6f1d8, pose(.04, -.065, 0, .32, .085, .10));
    for (const side of [-1, 1]) b.add(new T.SphereGeometry(1, 6, 4), 0x142a35, pose(.28, .032, side * .105, .028, .028, .014));
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute([-.18,.10,0, -.13,.27,0, .10,.11,0, .10,.11,0, -.13,.27,0, -.18,.10,0,
      .05,0,.1, -.18,-.10,.23, -.22,0,.09, -.22,0,.09, -.18,-.10,.23, .05,0,.1,
      .05,0,-.1, -.22,0,-.09, -.18,-.10,-.23, -.18,-.10,-.23, -.22,0,-.09, .05,0,-.1], 3));
    g.computeVertexNormals(); b.add(g, 0xf0db9e); return b.finish();
  }

  function create(opts) {
    if (!opts || !opts.parent) return null;
    const parent = opts.parent, waterY = opts.waterY == null ? .02 : opts.waterY, outerY = opts.outerWaterY == null ? -.3 : opts.outerWaterY;
    const group = new T.Group(); group.name = 'Submerged coral gardens and little fish'; parent.add(group);
    const own = new Set(), b = builder(), patches = [];
    let dead = false, lastTime = null;
    PATCHES.forEach((spec, id) => {
      const rand = rng(73891 + id * 419), surface = spec.outer ? outerY : waterY;
      const baseY = surface - (spec.outer ? .22 : .17);
      patches.push({ ...spec, surface, baseY });
      const matrix = pose(spec.x, baseY, spec.z, 1, 1, 1, spec.a);
      const add = (g, color, x, y, z, sx = 1, sy = 1, sz = 1, a = 0) => b.add(g, color, matrix.clone().multiply(pose(x, y, z, sx, sy, sz, a)));
      for (let j = 0; j < 4; j++) {
        const a = rand() * TAU, r = rand() * .12;
        add(new T.IcosahedronGeometry(1, 1), j % 2 ? 0x8eaea5 : 0x6d9da0, Math.cos(a) * r, .018, Math.sin(a) * r, .085 + rand() * .02, .035 + rand() * .012, .07 + rand() * .04, rand() * TAU);
      }
      for (let j = 0; j < 3; j++) {
        const a = (j + .12 * rand()) / 3 * TAU, r = .13, x = Math.cos(a) * r, z = Math.sin(a) * r;
        const color = PALETTE[(id + j * 2) % PALETTE.length], h = .062 + rand() * .027;
        add(branch([[0,0,0], [.002,.035,0], [.008,h,.004]], .009), color, x, .031, z, 1, 1, 1, a);
        for (const s of [-1, 1]) {
          add(branch([[0,.024,0], [s * .022,.045,.002], [s * .038,h * .96,.006]], .0068), color, x, .031, z, 1, 1, 1, a);
          add(branch([[s * .02,.044,.002], [s * .033,.055,-.015], [s * .042,h * .85,-.024]], .0045), color, x, .031, z, 1, 1, 1, a);
        }
      }
      for (let j = 0; j < 3; j++) add(plate(.046 + j * .009, .025, id + j), PALETTE[(id + 4) % PALETTE.length], -.052 + j * .015, .024 + j * .018, .032 - j * .008, 1, 1, 1, j * .8);
      for (let j = 0; j < 5; j++) add(sponge(.016, .031 + rand() * .027), PALETTE[(id + 2) % PALETTE.length], .055 + Math.cos(j * 2.4) * .033, .032, -.045 + Math.sin(j * 2.4) * .029);
      // A small sea fan: curved yellow/aqua fingers spread across a vertical plane.
      for (let j = 0; j < 5; j++) {
        const x = (j - 2) * .011;
        add(branch([[0,0,0], [x * .7,.022,.002], [x * 1.7,.048 + (2 - Math.abs(j - 2)) * .013,.008]], .0046), PALETTE[(id + 3) % PALETTE.length], .016, .031, .103, 1, 1, 1, id);
      }
    });
    const reefGeometry = b.finish(), reefMaterial = new T.MeshStandardMaterial({ vertexColors: true, roughness: .76, metalness: 0, side: T.DoubleSide });
    const reef = new T.Mesh(reefGeometry, reefMaterial); reef.name = 'Merged rocks, branching coral, plate coral and hollow sponges'; reef.receiveShadow = true; group.add(reef);
    own.add(reefGeometry); own.add(reefMaterial);
    const fishMaterial = new T.MeshStandardMaterial({ vertexColors: true, roughness: .50, metalness: 0, side: T.DoubleSide });
    const bodies = new T.InstancedMesh(fishGeometry(), fishMaterial, patches.length * 3), tails = new T.InstancedMesh(fishGeometry(true), fishMaterial, patches.length * 3);
    bodies.name = 'Reef fish schools'; tails.name = 'Reef fish moving tails';
    for (const mesh of [bodies, tails]) { mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.frustumCulled = false; mesh.receiveShadow = true; group.add(mesh); own.add(mesh.geometry); }
    own.add(fishMaterial);
    const fish = [], colour = new T.Color(), q = new T.Quaternion(), tailQ = new T.Quaternion(), bodyM = new T.Matrix4(), tailM = new T.Matrix4();
    const position = new T.Vector3(), scale = new T.Vector3(), tailOffset = new T.Vector3(-.37, 0, 0), unit = new T.Vector3(1, 1, 1);
    patches.forEach((patch, pi) => {
      for (let k = 0; k < 3; k++) {
        const i = fish.length, phase = pi * .8 + k * .31;
        fish.push({ patch, phase, size: .084 + (i % 4) * .007, speed: .13 + (pi % 3) * .028, radius: .13 + k * .027 });
        colour.setHex(FISH[(pi + k) % FISH.length]); bodies.setColorAt(i, colour); tails.setColorAt(i, colour);
      }
    });
    function update(t) {
      if (dead) return;
      const time = opts.reducedMotion ? 0 : (Number.isFinite(t) ? t : 0);
      if (time === lastTime) return;
      lastTime = time;
      fish.forEach((f, i) => {
        const a = f.phase + time * f.speed, x = f.patch.x + Math.cos(a) * f.radius, z = f.patch.z + Math.sin(a) * f.radius;
        const y = f.patch.surface - .075 - (i % 3) * .012 + .008 * Math.sin(time * .48 + f.phase);
        // Local +X is the nose; its heading follows the tangent continuously around the school.
        q.setFromAxisAngle(Y, -a - Math.PI / 2);
        position.set(x, y, z); scale.setScalar(f.size);
        bodyM.compose(position, q, scale); bodies.setMatrixAt(i, bodyM);
        tailQ.setFromAxisAngle(Y, Math.sin(time * 5.2 + f.phase * 2) * .45);
        tailM.compose(tailOffset, tailQ, unit);
        tailM.premultiply(bodyM); tails.setMatrixAt(i, tailM);
      });
      bodies.instanceMatrix.needsUpdate = true; tails.instanceMatrix.needsUpdate = true;
    }
    function dispose() {
      if (dead) return;
      dead = true; parent.remove(group);
      // InstancedMesh owns GPU instance buffers in addition to the shared material/geometry.
      bodies.dispose(); tails.dispose();
      for (const resource of own) resource.dispose();
      own.clear(); group.clear();
    }
    update(0);
    return { update, dispose, stats: () => ({ patches: patches.length, lagoon: 8, outer: 4, fish: fish.length, drawCalls: 3, triangles: reefGeometry.attributes.position.count / 3 + 36 * (bodies.geometry.attributes.position.count + tails.geometry.attributes.position.count) / 3, disposed: dead }) };
  }
  return { create };
})();
