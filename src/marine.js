// ===== native 3D ocean life =====
// Each animal has its own PBR GLB and native tail/fluke clip. Routes and jumps are
// world-space motion: the head follows the actual path tangent, including pitch.
// Eight animals, fixed splash pools and cached immutable assets keep work bounded.
const Marine3D = (() => {
  const T = window.THREE;
  if (!T) return null;
  const TAU = Math.PI * 2, clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const smooth = (a, b, n) => { const p = clamp((n - a) / (b - a), 0, 1); return p * p * (3 - 2 * p); };
  const ASSETS = { shark: 'art/m_shark.glb', orca: 'art/m_orca.glb', bluewhale: 'art/m_bluewhale.glb', dolphin: 'art/m_dolphin.glb' };

  // Recognizable real geometry remains available if a GLB fails to load. These
  // shared fallback resources are immutable and are never freed by world remakes.
  const fallback = new Map();
  function fallbackFor(kind) {
    if (fallback.has(kind)) return fallback.get(kind).clone(true);
    const g = new T.Group(), black = kind === 'orca', shark = kind === 'shark';
    const skin = new T.MeshStandardMaterial({ color: black ? 0x071a21 : kind === 'bluewhale' ? 0x39798b : shark ? 0x425f66 : 0x728c93, roughness: .35 });
    const pale = new T.MeshStandardMaterial({ color: 0xd4dfd8, roughness: .43 });
    const eye = new T.MeshStandardMaterial({ color: 0x02090c, roughness: .15 });
    const part = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => {
      const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; g.add(m); return m;
    };
    const sphere = new T.SphereGeometry(1, 24, 16);
    part(sphere, skin, 0, 0, 0, .47, kind === 'bluewhale' ? .145 : .12, kind === 'bluewhale' ? .165 : .115);
    part(sphere, pale, .12, -.061, 0, .31, .068, .086);
    part(sphere, skin, -.39, 0, 0, .17, .037, .033);
    if (kind === 'dolphin') part(sphere, skin, .41, -.025, 0, .125, .023, .023);
    const fin = (pts, thickness, x, y, z, rx = 0) => {
      const sh = new T.Shape(); pts.forEach(([a, b], i) => i ? sh.lineTo(a, b) : sh.moveTo(a, b)); sh.closePath();
      const geo = new T.ExtrudeGeometry(sh, { depth: thickness, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: thickness * .4, bevelThickness: thickness * .4 });
      geo.translate(0, 0, -thickness / 2); const m = part(geo, skin, x, y, z); m.rotation.x = rx; return m;
    };
    fin([[-.13, .07], [-.12, black ? .4 : .25], [.03, .19], [.09, .075]], .014, 0, 0, 0);
    for (const s of [-1, 1]) {
      fin([[.14, .07], [.04, .26], [-.1, .25], [-.02, .07]], .012, 0, -.047, 0, s * Math.PI / 2);
      if (black) part(sphere, pale, .26, .053, s * .102, .069, .039, .012);
      part(sphere, eye, .35, .024, s * .089, .008, .008, .005);
    }
    const tail = new T.Group(); tail.position.x = -.39; tail.name = 'Fallback tail'; g.add(tail);
    const fluke = fin([[-.12, 0], [-.20, .20], [-.28, .19], [-.21, .05], [-.26, 0], [-.21, -.05], [-.28, -.19], [-.20, -.20]], .012, 0, 0, 0, shark ? 0 : Math.PI / 2);
    g.remove(fluke); tail.add(fluke); fluke.position.x = 0;
    g.traverse(o => { if (o.geometry) o.geometry.userData.keep = true; if (o.material) o.material.userData.keep = true; });
    fallback.set(kind, g); return g.clone(true);
  }

  function create(opts) {
    const mobile = !!opts.mobile, ringCapacity = mobile ? 18 : 32, dropCapacity = mobile ? 48 : 120;
    const parent = opts.parent, oceanY = opts.oceanY == null ? -.3 : opts.oceanY;
    const group = new T.Group(); group.name = 'Archipelago marine wildlife'; parent.add(group);
    const actors = [], rings = [], drops = [], own = new Set();
    let dead = false, time = 0, lastTime = null, focusAngle = Math.PI / 2, loads = 0, failed = 0;
    const v = new T.Vector3(), ahead = new T.Vector3(), back = new T.Vector3(), forward = new T.Vector3(), side = new T.Vector3(), up = new T.Vector3();
    const worldUp = new T.Vector3(0, 1, 0), localForward = new T.Vector3(1, 0, 0), basis = new T.Matrix4(), facing = new T.Quaternion(), bankQ = new T.Quaternion(), temp = new T.Object3D();
    const offscreen = new T.Matrix4().makeScale(0, 0, 0);
    const ringMaterial = new T.MeshStandardMaterial({ color: 0xe8ffff, transparent: true, opacity: .53, roughness: .35, depthWrite: false });
    const sprayMaterial = new T.MeshStandardMaterial({ color: 0xc5f8ff, transparent: true, opacity: .76, roughness: .24, depthWrite: false });
    const ringGeo = new T.TorusGeometry(1, .022, 4, mobile ? 20 : 36); ringGeo.rotateX(Math.PI / 2);
    const dropGeo = new T.SphereGeometry(1, 5, 4);
    const ringMesh = new T.InstancedMesh(ringGeo, ringMaterial, ringCapacity), dropMesh = new T.InstancedMesh(dropGeo, sprayMaterial, dropCapacity);
    ringMesh.name = 'Expanding 3D wildlife ripples'; dropMesh.name = 'Ballistic 3D splash droplets';
    ringMesh.instanceMatrix.setUsage(T.DynamicDrawUsage); dropMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    ringMesh.frustumCulled = false; dropMesh.frustumCulled = false; ringMesh.renderOrder = 2; dropMesh.renderOrder = 2;
    own.add(ringGeo); own.add(dropGeo); own.add(ringMaterial); own.add(sprayMaterial);
    for (let i = 0; i < ringCapacity; i++) { rings.push({ born: -100 }); ringMesh.setMatrixAt(i, offscreen); }
    for (let i = 0; i < dropCapacity; i++) { drops.push({ born: -100 }); dropMesh.setMatrixAt(i, offscreen); }
    group.add(ringMesh, dropMesh);
    let ringCursor = 0, dropCursor = 0;
    function waterAt(x, z, t) {
      return opts.waterHeight ? opts.waterHeight(x, z, t) : oceanY + .018 * Math.sin(x * .7 + t * .65) + .012 * Math.sin(z * .9 - t * .54);
    }
    function ripple(x, z, t, size, wake = false) {
      const r = rings[ringCursor++ % rings.length]; Object.assign(r, { x, z, born: t, size, life: wake ? 1.65 : 3.1, wake });
    }
    function splash(x, z, t, size) {
      ripple(x, z, t, size); ripple(x, z, t + .16, size * .7);
      for (let j = 0; j < (mobile ? 12 : 30); j++) {
        const d = drops[dropCursor++ % drops.length], a = j * 2.39996, speed = (.38 + (j % 5) * .095) * size;
        Object.assign(d, { x, z, y0: oceanY + .08, born: t, vx: Math.cos(a) * speed, vz: Math.sin(a) * speed, vy: (.65 + (j % 7) * .12) * Math.sqrt(size), r: .024 + (j % 4) * .008, life: 1.45 });
      }
    }

    const settings = [
      { k: 'shark', size: 1.55, radius: 9.85, speed: .059, phase: .5, depth: -.155 },
      { k: 'shark', size: 1.35, radius: 11.4, speed: -.043, phase: 3.8, depth: -.23 },
      { k: 'orca', size: 2.30, radius: 10.8, speed: .037, phase: 2.4, event: 35, depth: -.22 },
      { k: 'orca', size: 1.9, radius: 11.8, speed: -.031, phase: 5.7, event: 15, depth: -.20 },
      { k: 'bluewhale', size: 4.05, radius: 12.1, speed: .018, phase: 4.15, depth: -.24 },
      { k: 'bluewhale', size: 1.9, radius: 12.1, speed: .018, phase: 4.15, calf: true, depth: -.14 },
      { k: 'dolphin', size: 1.12, radius: 9.9, speed: .083, phase: 1.3, event: 4, depth: -.14 },
      { k: 'dolphin', size: .94, radius: 10.6, speed: .083, phase: 1.45, event: 11, depth: -.13 }
    ];
    for (const spec of settings) {
      const carrier = new T.Group(); carrier.name = spec.calf ? 'Blue whale calf' : spec.k; carrier.scale.setScalar(spec.size); group.add(carrier);
      const fallbackModel = fallbackFor(spec.k); carrier.add(fallbackModel);
      const rec = { ...spec, carrier, model: fallbackModel, native: false, mixer: null, prevY: null, lastWake: -10, lastBlow: -1, tail: fallbackModel.getObjectByName('Fallback tail') };
      actors.push(rec);
      if (typeof GLB !== 'undefined' && GLB && GLB.loadScene) GLB.loadScene(ASSETS[spec.k]).then(pack => {
        if (dead) return;
        carrier.remove(rec.model); rec.model = pack.scene; carrier.add(pack.scene);
        pack.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = true; } });
        rec.native = true; rec.tail = null; loads++;
        if (pack.animations.length) {
          rec.mixer = new T.AnimationMixer(pack.scene);
          for (const clip of pack.animations) rec.mixer.clipAction(clip).play();
          rec.mixer.setTime((time + spec.phase) * (spec.calf ? 1.15 : 1));
        }
      }).catch(() => { if (!dead) failed++; });
    }

    // Rounded routes remain beyond the square board, even on the diagonals.
    // Visits approach the active tile from its ocean side, never cross the board.
    function route(a, t, out) {
      let angle = a.phase + t * a.speed, radius = a.radius + .22 * Math.sin(t * .071 + a.phase);
      let y = a.depth + .04 * Math.sin(t * .75 + a.phase), jump = false;
      if (a.k === 'dolphin') {
        const visitPhase = (t + a.event) % 26, visit = smooth(1, 6, visitPhase) * (1 - smooth(17, 23, visitPhase));
        angle += (a.visitAnchor - angle) * visit * .92 + .11 * Math.sin(t * .75 + a.phase);
        const near = 7.30 / Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle)));
        radius = radius * (1 - visit) + near * visit;
        const p = ((t + a.event) % 12.5) / 12.5;
        if (p > .11 && p < .25) { const q = (p - .11) / .14; y += Math.sin(Math.PI * q) * (a.size > 1 ? 1.35 : 1.08); jump = true; }
      } else if (a.k === 'orca') {
        const p = (t + a.event) % 44;
        if (p > 39 && p < 42.2) { const q = (p - 39) / 3.2; y += Math.sin(Math.PI * q) * 2.35; jump = true; }
      } else if (a.k === 'bluewhale' && a.calf) {
        // The calf follows behind and swims a little closer/further from its
        // mother; it does not occupy a rigid track slot.
        angle -= .12 + .012 * Math.sin(t * .19); radius -= .74 + .12 * Math.sin(t * .31);
        const p = t % 68;
        y -= 1.15 * smooth(21, 26, p) * (1 - smooth(42, 49, p));
      }
      out.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      const minEdge = a.k === 'bluewhale' ? 7.8 : 7.1;
      const edge = Math.max(Math.abs(out.x), Math.abs(out.z)); if (edge < minEdge) { out.x *= minEdge / edge; out.z *= minEdge / edge; }
      out.y += waterAt(out.x, out.z, t);
      return jump;
    }

    function update(t, dt) {
      if (dead) return;
      const frozen = typeof opts.reducedMotion === 'function' ? opts.reducedMotion() : !!opts.reducedMotion;
      time = frozen ? 3 : t;
      const step = frozen ? 0 : clamp(dt == null ? lastTime == null ? 0 : time - lastTime : dt, 0, .10);
      const focus = opts.focus && opts.focus();
      if (focus && Number.isFinite(focus.x) && Number.isFinite(focus.z)) {
        const target = Math.atan2(focus.z, focus.x), delta = Math.atan2(Math.sin(target - focusAngle), Math.cos(target - focusAngle));
        focusAngle += delta * (lastTime == null ? 1 : Math.min(1, step * .5));
      }
      for (const a of actors) {
        if (a.k === 'dolphin') {
          const cycle = Math.floor((time + a.event) / 26);
          if (a.visitCycle !== cycle) {
            a.visitCycle = cycle;
            const startAngle = a.phase + (cycle * 26 + 1 - a.event) * a.speed;
            a.visitAnchor = startAngle + Math.atan2(Math.sin(focusAngle - startAngle), Math.cos(focusAngle - startAngle));
          } else {
            const delta = Math.atan2(Math.sin(focusAngle - a.visitAnchor), Math.cos(focusAngle - a.visitAnchor));
            a.visitAnchor += delta * Math.min(1, step * .5);
          }
        }
        const jumping = route(a, time, v); route(a, time + .06, ahead); route(a, time - .06, back);
        a.carrier.position.copy(v); forward.copy(ahead).sub(back);
        if (forward.lengthSq() < 1e-7) forward.set(1, 0, 0).applyQuaternion(a.carrier.quaternion);
        forward.normalize();
        // +X is the model nose. Proper orthonormal tangent/up basis prevents
        // backward flight, incorrect pitch and sudden Euler flips at headings.
        side.crossVectors(forward, worldUp).normalize(); up.crossVectors(side, forward).normalize();
        basis.makeBasis(forward, up, side); facing.setFromRotationMatrix(basis);
        facing.multiply(bankQ.setFromAxisAngle(localForward, jumping ? .14 * Math.sin(time * 2 + a.phase) : .055 * Math.sin(time * .53 + a.phase)));
        if (lastTime == null || frozen) a.carrier.quaternion.copy(facing);
        else a.carrier.quaternion.slerp(facing, 1 - Math.exp(-step * 10));
        if (a.mixer) a.mixer.setTime((time + a.phase) * (a.calf ? 1.15 : 1));
        else if (a.tail) { if (a.k === 'shark') a.tail.rotation.y = Math.sin(time * 2.6 + a.phase) * .22; else a.tail.rotation.z = Math.sin(time * (a.k === 'bluewhale' ? 1.6 : 3.6) + a.phase) * .19; }
        const y = v.y - waterAt(v.x, v.z, time);
        if (!frozen && a.prevY != null && a.prevY > .10 && y <= .10) splash(v.x, v.z, time, a.k === 'orca' ? 1.75 : .6);
        if (!frozen && y < .12 && y > -.38 && time - a.lastWake > (a.k === 'bluewhale' ? 1.2 : .75)) {
          ripple(v.x - forward.x * a.size * .38, v.z - forward.z * a.size * .38, time, a.k === 'bluewhale' ? .52 : .25, true); a.lastWake = time;
        }
        // A breathing mother whale briefly sends a tall, narrow 3D spray from
        // its blowhole; these droplets share the same bounded splash pool.
        const breath = Math.floor((time + a.phase) / 19);
        if (!frozen && a.k === 'bluewhale' && !a.calf && breath !== a.lastBlow) {
          a.lastBlow = breath;
          const x = v.x + forward.x * a.size * .21, z = v.z + forward.z * a.size * .21;
          for (let j = 0; j < (mobile ? 8 : 16); j++) {
            const d = drops[dropCursor++ % drops.length], angle = j * 2.39996;
            Object.assign(d, { x, z, y0: v.y + up.y * a.size * .116 + .02, born: time + j * .025, vx: Math.cos(angle) * .11, vz: Math.sin(angle) * .11, vy: 1.8 + (j % 4) * .12, r: .026, life: 1.45 });
          }
        }
        a.prevY = y;
      }
      // Pack live instances: zero-scaled particles still ran the vertex shader.
      let visibleRings = 0, visibleDrops = 0;
      for (let i = 0; i < rings.length; i++) {
        const r = rings[i], age = time - r.born, p = age / r.life;
        if (age < 0 || p >= 1 || !Number.isFinite(p)) continue;
        const size = r.size * (.28 + p * 2.1);
        temp.position.set(r.x, waterAt(r.x, r.z, time) + .016, r.z); temp.rotation.set(0, 0, 0);
        temp.scale.set(size, Math.max(.08, 1 - p) * size, size * (r.wake ? .58 : 1)); temp.updateMatrix(); ringMesh.setMatrixAt(visibleRings++, temp.matrix);
      }
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i], age = time - d.born;
        if (age < 0 || age >= d.life || !Number.isFinite(d.life)) continue;
        const y = d.y0 + d.vy * age - 1.7 * age * age;
        if (y < waterAt(d.x, d.z, time)) continue;
        temp.position.set(d.x + d.vx * age, y, d.z + d.vz * age); temp.rotation.set(0, 0, 0); temp.scale.set(d.r, d.r * 1.7, d.r); temp.updateMatrix(); dropMesh.setMatrixAt(visibleDrops++, temp.matrix);
      }
      ringMesh.count = visibleRings; dropMesh.count = visibleDrops;
      ringMesh.visible = visibleRings > 0; dropMesh.visible = visibleDrops > 0;
      if (visibleRings) ringMesh.instanceMatrix.needsUpdate = true;
      if (visibleDrops) dropMesh.instanceMatrix.needsUpdate = true;
      lastTime = time;
    }
    update(0, 0);
    return {
      update,
      dispose() { if (dead) return; dead = true; for (const a of actors) if (a.mixer) { a.mixer.stopAllAction(); a.mixer.uncacheRoot(a.model); } parent.remove(group); group.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); group.clear(); for (const item of own) item.dispose(); own.clear(); },
      stats() { return { animals: actors.length, native: loads, fallbacks: actors.length - loads, failed, rings: rings.length, droplets: drops.length, activeRings: ringMesh.count, activeDrops: dropMesh.count, mobile }; },
      group
    };
  }
  return { create, assets: ASSETS };
})();
