// ===== the lagoon: real curved vortex, sailing craft and captured flotsam =====
// The board's water cuts a circular hole described by `mask`; this mesh supplies
// its sloping water, narrow drain and foam. No image plate is rotated here.
const Lagoon3D = (() => {
  const T = window.THREE;
  if (!T) return null;
  const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const p = clamp((x - a) / (b - a), 0, 1); return p * p * (3 - 2 * p); };
  const mix = (a, b, t) => a * (1 - t) + b * t;

  function create(opts) {
    const parent = opts.parent, center = { x: opts.center.x, z: opts.center.z };
    const waterY = opts.waterY == null ? .02 : opts.waterY;
    const radius = Math.max(.56, opts.radius || .59), holeRadius = .55, depth = .72;
    const mask = { x: center.x, z: center.z, radius: holeRadius };
    const group = new T.Group(); group.name = 'Lagoon vortex and sailing craft'; parent.add(group);
    const own = new Set(), boats = [], props = [], U = { time: { value: 0 } };
    let dead = false, lastTime = null, t = 0, stepNumber = 0, nativeLoaded = 0;
    const temp = new T.Object3D(), basis = new T.Matrix4(), facing = new T.Quaternion(), bank = new T.Quaternion();
    const p = new T.Vector3(), next = new T.Vector3(), prev = new T.Vector3(), forward = new T.Vector3(), up = new T.Vector3(), side = new T.Vector3();
    const WORLD_UP = new T.Vector3(0, 1, 0), LOCAL_X = new T.Vector3(1, 0, 0), hidden = new T.Matrix4().makeScale(0, 0, 0);
    const centerAngle = Math.atan2(center.z, center.x), intakeAngle = centerAngle + Math.PI;
    const keep = item => { own.add(item); return item; };
    const material = (color, roughness = .6, extra = {}) => keep(new T.MeshStandardMaterial({ color, roughness, ...extra }));
    const mesh = (geometry, mat, holder = group) => { keep(geometry); const o = new T.Mesh(geometry, mat); holder.add(o); return o; };
    const waterAt = (x, z, time) => opts.waterHeight ? opts.waterHeight(x, z, time) : waterY + .005 * Math.sin(x * 1.5 + z * .7 + time * .85);
    const funnelY = r => .012 - depth * Math.pow(clamp(1 - r / radius, 0, 1), 2.15);

    // Merge static parts into one colored mesh per surface type; the cloth alone
    // changes its actual vertices in the wind. All geometries belong to this world.
    function mergeParts(parts) {
      const positions = [], normals = [], colors = [], c = new T.Color();
      for (const entry of parts) {
        let g = entry.g;
        if (g.index) { const expanded = g.toNonIndexed(); g.dispose(); g = expanded; }
        temp.position.fromArray(entry.p || [0, 0, 0]); temp.rotation.fromArray([...(entry.r || [0, 0, 0]), 'XYZ']); temp.scale.fromArray(entry.s || [1, 1, 1]); temp.updateMatrix(); g.applyMatrix4(temp.matrix);
        if (!g.attributes.normal) g.computeVertexNormals();
        c.setHex(entry.c); const a = g.attributes.position, n = g.attributes.normal;
        for (let i = 0; i < a.count; i++) { positions.push(a.getX(i), a.getY(i), a.getZ(i)); normals.push(n.getX(i), n.getY(i), n.getZ(i)); colors.push(c.r, c.g, c.b); }
        g.dispose();
      }
      const result = new T.BufferGeometry(); result.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); result.setAttribute('normal', new T.Float32BufferAttribute(normals, 3)); result.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
      result.computeBoundingSphere(); return result;
    }
    const piece = (g, c, x = 0, y = 0, z = 0, r, s) => ({ g, c, p: [x, y, z], r, s });
    const box = (x, y, z) => new T.BoxGeometry(x, y, z);
    const cylinder = (r, h, n = 8) => new T.CylinderGeometry(r, r, h, n);
    const ball = (r, n = 12) => new T.SphereGeometry(r, n, Math.max(6, Math.floor(n * .65)));

    // A circular annulus, densely sampled in radius, forms a visibly concave
    // funnel. Its central neck is open until the deep dark bottom.
    const FP = [], FC = [], FI = [], RAD = 32, ANG = 96, deep = new T.Color(0x063749), rim = new T.Color(0x46bec2), color = new T.Color();
    for (let j = 0; j <= RAD; j++) {
      const r = .034 + (radius - .034) * j / RAD;
      for (let k = 0; k <= ANG; k++) {
        const a = k / ANG * TAU;
        FP.push(Math.cos(a) * r, funnelY(r), Math.sin(a) * r);
        color.copy(deep).lerp(rim, Math.pow(r / radius, .8)); FC.push(color.r, color.g, color.b);
        if (j < RAD && k < ANG) { const v = j * (ANG + 1) + k; FI.push(v, v + 1, v + ANG + 1, v + 1, v + ANG + 2, v + ANG + 1); }
      }
    }
    const funnelGeo = new T.BufferGeometry(); funnelGeo.setAttribute('position', new T.Float32BufferAttribute(FP, 3)); funnelGeo.setAttribute('color', new T.Float32BufferAttribute(FC, 3)); funnelGeo.setIndex(FI); funnelGeo.computeVertexNormals();
    const funnelMaterial = material(0xffffff, .31, { vertexColors: true, metalness: .03 });
    funnelMaterial.onBeforeCompile = shader => {
      shader.uniforms.lagoonTime = U.time;
      shader.vertexShader = 'uniform float lagoonTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float lr = length(position.xz);
        float la = atan(position.z, position.x);
        transformed.y += .008 * sin(la * 6.0 - lr * 30.0 + lagoonTime * 2.2) * smoothstep(.12, .55, lr);`);
    };
    funnelMaterial.customProgramCacheKey = () => 'lagoon-round-funnel-v1';
    const funnel = mesh(funnelGeo, funnelMaterial); funnel.name = 'Round concave water funnel'; funnel.position.set(center.x, waterY, center.z); funnel.receiveShadow = true;
    const throatY = funnelY(.034), neckMat = material(0x073343, .34);
    const neck = mesh(new T.CylinderGeometry(.034, .025, .15, 32, 1, true), neckMat); neck.position.set(center.x, waterY + throatY - .075, center.z);
    const bottom = mesh(new T.CircleGeometry(.026, 32), material(0x031820, .82)); bottom.rotation.x = -Math.PI / 2; bottom.position.set(center.x, waterY + throatY - .145, center.z);

    const foamMaterial = material(0xc8f1e9, .58, { transparent: true, opacity: .78, depthWrite: false });
    const spiralHolder = new T.Group(); spiralHolder.position.set(center.x, waterY, center.z); group.add(spiralHolder);
    for (let arm = 0; arm < 2; arm++) {
      const points = [];
      for (let i = 0; i <= 160; i++) { const u = i / 160, r = .055 + (radius - .066) * u, a = arm * Math.PI + u * TAU * 2.3; points.push(new T.Vector3(Math.cos(a) * r, funnelY(r) + .009, Math.sin(a) * r)); }
      const curve = new T.CatmullRomCurve3(points); mesh(new T.TubeGeometry(curve, 160, .0045, 5, false), foamMaterial, spiralHolder);
    }
    const foamGeo = keep(new T.SphereGeometry(1, 6, 4)), foam = new T.InstancedMesh(foamGeo, foamMaterial, 96);
    foam.name = 'Foam following the spiral current'; foam.instanceMatrix.setUsage(T.DynamicDrawUsage); foam.frustumCulled = false; group.add(foam);
    const wakeGeo = keep(new T.TorusGeometry(1, .018, 4, 24)); wakeGeo.rotateX(Math.PI / 2);
    const wakes = new T.InstancedMesh(wakeGeo, foamMaterial, 21); wakes.instanceMatrix.setUsage(T.DynamicDrawUsage); wakes.frustumCulled = false; group.add(wakes);
    const wakePool = Array.from({ length: 21 }, () => ({ born: -100 })); let wakeCursor = 0;
    for (let i = 0; i < wakePool.length; i++) wakes.setMatrixAt(i, hidden);

    function hullGeo(L, W) {
      const xs = [[-.5, .74], [-.31, .98], [.02, 1], [.36, .68], [.56, .03]], section = [[-.5, .043], [-.57, .002], [-.32, -.046], [0, -.072], [.32, -.046], [.57, .002], [.5, .043]], vertices = [], indices = [];
      for (const [x, w] of xs) for (const [z, y] of section) vertices.push(x * L, y, z * W * w);
      for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < section.length; j++) { const a = i * section.length + j, b = i * section.length + (j + 1) % section.length, c = b + section.length, d = a + section.length; indices.push(a, c, b, a, d, c); }
      for (const off of [0, (xs.length - 1) * section.length]) for (let j = 1; j < section.length - 1; j++) { if (!off) indices.push(off, off + j, off + j + 1); else indices.push(off, off + j + 1, off + j); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
    }
    function cloth(w, h, x, y, z = 0, flag = false) {
      const g = new T.PlaneGeometry(w, h, flag ? 5 : 8, 4); g.rotateY(Math.PI / 2);
      const at = g.attributes.position;
      for (let i = 0; i < at.count; i++) { const yy = at.getY(i) / h + .5, zz = at.getZ(i) / (w / 2); at.setX(i, .012 + .023 * (1 - zz * zz) * Math.sin(yy * Math.PI)); }
      g.translate(x, y, z); g.computeVertexNormals(); return g;
    }
    function sailingBoat(index, L, W, masts) {
      const holder = new T.Group(); holder.name = ['Lagoon pirate sloop', 'Lagoon merchant brig', 'Lagoon rowing skiff'][index]; group.add(holder);
      const timber = [piece(hullGeo(L, W), index === 1 ? 0x653323 : 0x785038), piece(box(L * .85, .014, W * .82), 0xb68a59, -.025, .043), piece(box(L * .18, .08, W * .72), 0x654127, -L * .33, .075)];
      const brass = [], sails = [], blacks = [];
      for (const s of [-1, 1]) {
        timber.push(piece(box(L * .84, .018, .014), 0xd4b074, -.04, .065, s * W * .44));
        brass.push(piece(cylinder(.014, .055), 0x403b34, -.06, .088, s * W * .36, [Math.PI / 2, 0, 0]));
      }
      const height = masts.length ? Math.max(...masts.map(m => m[1])) : .09;
      for (const [mx, mh] of masts) {
        timber.push(piece(cylinder(.005, mh, 7), 0x64482b, mx, .052 + mh / 2));
        timber.push(piece(cylinder(.004, W * 1.56, 7), 0x775231, mx, .052 + mh * .72, 0, [Math.PI / 2, 0, 0]));
        sails.push(piece(cloth(W * 1.43, mh * .46, mx, .052 + mh * .47), index === 1 ? 0xdbceb0 : 0xf2e3c2));
        for (const sx of [-1, 1]) {
          const dx = sx * L * .43 - mx, dy = .04 - (.052 + mh * .77), len = Math.hypot(dx, dy);
          timber.push(piece(cylinder(.0022, len, 5), 0xc3a677, (mx + sx * L * .43) / 2, .052 + mh * .77 + dy / 2, W * .12, [0, 0, -Math.atan2(dx, dy)]));
        }
      }
      if (masts.length) {
        const [mx, mh] = masts[0]; blacks.push(piece(cloth(.095, .061, mx, mh + .025, .055, true), 0x101c20));
        brass.push(piece(ball(.009, 10), 0xe2d4ae, mx + .018, mh + .023, .055));
        for (const a of [-.65, .65]) brass.push(piece(cylinder(.002, .026, 5), 0xe2d4ae, mx + .018, mh + .010, .055, [a, 0, Math.PI / 2]));
      } else {
        for (const z of [-1, 1]) timber.push(piece(box(.006, .006, .23), 0xb99158, .01, .057, z * .10, [z * .17, -.25 * z, 0]));
        timber.push(piece(box(.026, .012, W * .78), 0xc09a69, -.015, .057));
      }
      timber.push(piece(cylinder(.028, .052, 10), 0x885735, -L * .15, .072, .015));
      brass.push(piece(new T.TorusGeometry(.029, .0028, 4, 10), 0x3b3830, -L * .15, .087, .015, [Math.PI / 2, 0, 0]));
      const mats = [], wind = [];
      const addMerged = (parts, rough, metallic = 0, isCloth = false) => {
        if (!parts.length) return;
        const mat = material(0xffffff, rough, { metalness: metallic, vertexColors: true, side: isCloth ? T.DoubleSide : T.FrontSide, transparent: true, opacity: 1 }); mats.push(mat);
        const o = mesh(mergeParts(parts), mat, holder); o.castShadow = true; o.receiveShadow = true;
        if (isCloth) { o.frustumCulled = false; wind.push({ mesh: o, rest: o.geometry.attributes.position.array.slice() }); }
      };
      addMerged(timber, .64); addMerged(brass, .4, .32); addMerged(sails, .76, 0, true); addMerged(blacks, .82, 0, true);
      const boat = { holder, mats, wind, height, length: L, phase: [8, 34, 62][index], speed: [-.053, -.043, -.065][index], lane: 3.52 + index * .035, endAngle: centerAngle + .12 + index * .06, intake: intakeAngle + index * .05, lastWake: -10, lastCycle: -1 };
      boats.push(boat); return boat;
    }
    sailingBoat(0, .52, .17, [[.01, .46]]);
    sailingBoat(1, .60, .21, [[.09, .61], [-.15, .43]]);
    sailingBoat(2, .34, .13, []);
    // The user's own ships replace the two procedural stand-ins. Their source
    // meshes contain the ship alone, so no rectangular water image comes along.
    // Both source bows point -X (their narrow bow ends confirm this), while routes
    // use +X forward. Cloned materials let one ship fade without affecting its
    // stationary copy or the other boat's native wind animation.
    if (typeof GLB !== 'undefined' && GLB && GLB.loadScene) for (const [i, url] of [[0, 'art/m_qar_animated.glb'], [1, 'art/m_galley_animated.glb']]) {
      const a = boats[i];
      GLB.loadScene(url).then(pack => {
        if (dead) return;
        const model = pack.scene; model.rotation.y += Math.PI; model.updateMatrixWorld(true);
        const bounds = new T.Box3().setFromObject(model), size = bounds.getSize(new T.Vector3()), midpoint = bounds.getCenter(new T.Vector3());
        const scale = a.length / Math.max(size.x, size.z);
        if (!Number.isFinite(scale) || scale <= 0) return;
        model.scale.multiplyScalar(scale); model.position.set(-midpoint.x * scale, -bounds.min.y * scale - .024, -midpoint.z * scale);
        const nativeMats = new Map();
        model.traverse(o => {
          if (!o.isMesh) return;
          o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
          const cloned = m => { if (!nativeMats.has(m)) { const copy = keep(m.clone()); copy.transparent = true; copy.opacity = 1; nativeMats.set(m, copy); } return nativeMats.get(m); };
          o.material = Array.isArray(o.material) ? o.material.map(cloned) : cloned(o.material);
        });
        a.holder.clear(); a.holder.add(model); a.wind = []; a.mats = [...nativeMats.values()]; a.height = size.y * scale; a.native = model;
        if (pack.animations.length) { a.mixer = new T.AnimationMixer(model); for (const clip of pack.animations) a.mixer.clipAction(clip).play(); a.mixer.setTime(t + a.phase); }
        nativeLoaded++;
      }).catch(() => { /* The full 3D procedural stand-in keeps sailing. */ });
    }

    // Wooden flotsam uses three instanced meshes, not one draw per prop.
    const propMaterial = material(0xffffff, .69, { vertexColors: true });
    const propGeos = [
      mergeParts([piece(cylinder(.04, .082, 10), 0x93613b), ...[-1, 1].map(s => piece(new T.TorusGeometry(.041, .004, 4, 10), 0x3c423c, 0, s * .027, 0, [Math.PI / 2, 0, 0]))]),
      mergeParts([piece(box(.072, .065, .068), 0xa77340), piece(box(.075, .009, .071), 0xcba266, 0, .028), piece(box(.009, .067, .071), 0xcba266)]),
      mergeParts([piece(box(.17, .015, .032), 0xa37a45), piece(box(.008, .018, .034), 0x654c2c, -.055)])
    ];
    const propMeshes = propGeos.map((g, kind) => { keep(g); const im = new T.InstancedMesh(g, propMaterial, 4); im.name = ['Captured barrels', 'Captured crates', 'Captured planks'][kind]; im.instanceMatrix.setUsage(T.DynamicDrawUsage); im.frustumCulled = false; im.castShadow = true; group.add(im); return im; });
    for (let kind = 0; kind < 3; kind++) for (let j = 0; j < 4; j++) props.push({ kind, slot: j, phase: j * 4.6 + kind * 2.3 });

    // All phases join in position and direction. A fully submerged craft stays
    // hidden before returning at its distant harbor; there is no visible teleport.
    function boatRoute(a, time, out) {
      const cycle = ((time + a.phase) % 84 + 84) % 84;
      const sailEnd = 43, approachEnd = 55, sinkEnd = 73;
      if (cycle < sailEnd) {
        const angle = a.endAngle + a.speed * (cycle - sailEnd);
        out.set(Math.cos(angle) * a.lane, 0, Math.sin(angle) * a.lane);
        out.y = waterAt(out.x, out.z, time) + .006 * Math.sin(time * 1.7 + a.phase);
      } else if (cycle < approachEnd) {
        const u = (cycle - sailEnd) / (approachEnd - sailEnd), v = 1 - u;
        const x0 = Math.cos(a.endAngle) * a.lane, z0 = Math.sin(a.endAngle) * a.lane;
        const x3 = center.x + Math.cos(a.intake) * .73, z3 = center.z + Math.sin(a.intake) * .73;
        const x1 = x0 + Math.sin(a.endAngle) * .42, z1 = z0 - Math.cos(a.endAngle) * .42;
        const x2 = x3 + Math.sin(a.intake) * .34, z2 = z3 - Math.cos(a.intake) * .34;
        out.set(v * v * v * x0 + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * x3, 0, v * v * v * z0 + 3 * v * v * u * z1 + 3 * v * u * u * z2 + u * u * u * z3);
        out.y = waterAt(out.x, out.z, time);
      } else {
        const u = clamp((cycle - approachEnd) / (sinkEnd - approachEnd), 0, 1), r = mix(.73, .025, Math.pow(u, 1.15)), angle = a.intake + 4 * u + 14 * u * u;
        out.set(center.x + Math.cos(angle) * r, waterAt(center.x, center.z, time) + funnelY(r) - smooth(sinkEnd, 78, cycle) * .75, center.z + Math.sin(angle) * r);
      }
      return cycle;
    }
    function update(time, dt) {
      if (dead) return;
      const reduced = typeof opts.reducedMotion === 'function' ? opts.reducedMotion() : !!opts.reducedMotion;
      t = reduced ? 3 : time; const delta = reduced ? 0 : clamp(dt == null ? lastTime == null ? 0 : t - lastTime : dt, 0, .1);
      U.time.value = t; spiralHolder.rotation.y = -t * .67; stepNumber++;
      const level = waterAt(center.x, center.z, t);
      funnel.position.y = level; neck.position.y = level + throatY - .075; bottom.position.y = level + throatY - .145; spiralHolder.position.y = level;
      for (let i = 0; i < foam.count; i++) {
        const u = ((i / foam.count + t * .085) % 1 + 1) % 1, r = mix(radius - .035, .04, u), angle = i * 2.39996 + t * (.68 + u * 1.55);
        temp.position.set(center.x + Math.cos(angle) * r, level + funnelY(r) + .012, center.z + Math.sin(angle) * r); temp.rotation.set(0, -angle, 0);
        const scale = .010 + .009 * (1 - u); temp.scale.set(scale * 1.8, .006, scale * .65); temp.updateMatrix(); foam.setMatrixAt(i, temp.matrix);
      }
      foam.instanceMatrix.needsUpdate = true;
      for (const a of boats) {
        const phase = boatRoute(a, t, p), alpha = smooth(0, 2, phase) * (1 - smooth(73, 77, phase));
        a.holder.visible = alpha > .015; a.holder.position.copy(p);
        boatRoute(a, t + .045, next); boatRoute(a, t - .045, prev); forward.copy(next).sub(prev);
        if (forward.lengthSq() < 1e-9) forward.set(1, 0, 0).applyQuaternion(a.holder.quaternion); forward.normalize();
        side.crossVectors(forward, WORLD_UP);
        if (side.lengthSq() < 1e-6) { side.set(0, 0, 1); side.addScaledVector(forward, -side.dot(forward)); }
        side.normalize(); up.crossVectors(side, forward).normalize(); basis.makeBasis(forward, up, side); facing.setFromRotationMatrix(basis).normalize();
        const captured = smooth(55, 70, phase), roll = .045 * Math.sin(t * 1.5 + a.phase) + captured * .35;
        facing.multiply(bank.setFromAxisAngle(LOCAL_X, roll));
        if (lastTime == null || reduced || !a.holder.visible) a.holder.quaternion.copy(facing); else a.holder.quaternion.slerp(facing, 1 - Math.exp(-delta * 9));
        for (const m of a.mats) m.opacity = alpha;
        if (a.mixer) a.mixer.setTime(t + a.phase);
        for (const cloth of a.wind) {
          const at = cloth.mesh.geometry.attributes.position, rest = cloth.rest;
          for (let j = 0; j < at.count; j++) { const k = j * 3; at.setX(j, rest[k] + .010 * Math.sin(t * 2.7 + rest[k + 2] * 17 + rest[k + 1] * 5)); }
          at.needsUpdate = true; if (stepNumber % 4 === 0 || lastTime == null) cloth.mesh.geometry.computeVertexNormals();
        }
        if (!reduced && a.holder.visible && phase < 55 && t - a.lastWake > .75) {
          const w = wakePool[wakeCursor++ % wakePool.length]; Object.assign(w, { x: p.x - forward.x * a.length * .44, z: p.z - forward.z * a.length * .44, born: t, size: a.length * .20 }); a.lastWake = t;
        }
      }
      for (const item of props) {
        const u = ((t * .058 + item.phase / 20) % 1 + 1) % 1, r = mix(.72, .025, Math.pow(u, 1.12)), angle = intakeAngle + item.phase * .13 + u * 22;
        temp.position.set(center.x + Math.cos(angle) * r, level + funnelY(r) - smooth(.83, 1, u) * .20, center.z + Math.sin(angle) * r);
        temp.rotation.set((item.kind === 0 ? Math.PI / 2 : .15) + u * .4, -angle + t * .2, Math.sin(t + item.phase) * .12 + u * .6);
        const scale = (1 - smooth(.89, 1, u)) * smooth(0, .045, u); temp.scale.setScalar(scale); temp.updateMatrix(); propMeshes[item.kind].setMatrixAt(item.slot, temp.matrix);
      }
      for (const im of propMeshes) im.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < wakePool.length; i++) {
        const w = wakePool[i], age = t - w.born;
        if (age < 0 || age > 2.2) { wakes.setMatrixAt(i, hidden); continue; }
        const r = w.size * (.5 + age * 1.7); temp.position.set(w.x, waterAt(w.x, w.z, t) + .008, w.z); temp.rotation.set(0, 0, 0); temp.scale.set(r, r * (1 - age / 2.2), r * .62); temp.updateMatrix(); wakes.setMatrixAt(i, temp.matrix);
      }
      wakes.instanceMatrix.needsUpdate = true; lastTime = t;
    }
    update(0, 0);
    return {
      mask, group, update,
      dispose() { if (dead) return; dead = true; for (const a of boats) if (a.mixer) { a.mixer.stopAllAction(); a.mixer.uncacheRoot(a.native); } parent.remove(group); group.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); group.clear(); for (const item of own) item.dispose(); own.clear(); },
      stats() { return { boats: boats.length, native: nativeLoaded, props: props.length, foam: foam.count, wakes: wakePool.length, funnel: { radius, depth }, geometry: true, states: boats.map(a => ({ name: a.holder.name, visible: a.holder.visible, position: a.holder.position.toArray() })) }; }
    };
  }
  return { create };
})();
