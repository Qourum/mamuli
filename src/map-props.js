// Real event props live in the board's existing scene. Geometry, grain and
// materials are shared within this world; no canvas renderer or timers are made.
const MapProps3D = (() => {
  const T = window.THREE;
  if (!T) return null;
  const CHESTS = new Set([2, 17, 33]), BOTTLES = new Set([7, 22, 36]);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const mix = (a, b, u) => a * (1 - u) + b * u;
  function create(opts) {
    if (!opts || !opts.parent) return null;
    const parent = opts.parent, waterY = opts.waterY == null ? .02 : opts.waterY;
    const group = new T.Group(); group.name = 'Animated treasure chests and message bottles'; parent.add(group);
    const own = new Set(), actors = [], byIndex = new Map(), temp = new T.Object3D();
    let dead = false, lastTime = null, triggers = 0;
    const keep = resource => { own.add(resource); return resource; };
    const material = (color, properties = {}, physical = false) => {
      const m = new (physical ? T.MeshPhysicalMaterial : T.MeshStandardMaterial)({ color, roughness: .64, ...properties });
      if (!T.ColorManagement || T.ColorManagement.legacyMode !== false) { m.color.convertSRGBToLinear(); if (properties.attenuationColor && m.attenuationColor) m.attenuationColor.convertSRGBToLinear(); }
      return keep(m);
    };
    const mesh = (geometry, mat, holder, name) => { const o = new T.Mesh(geometry, mat); o.name = name || ''; o.castShadow = true; o.receiveShadow = true; holder.add(o); return o; };
    const piece = (g, x = 0, y = 0, z = 0, rotation, color) => ({ g, p: [x, y, z], r: rotation || [0, 0, 0], c: color });
    function merged(parts, colored = false) {
      const p = [], n = [], uv = [], colors = [], tint = new T.Color();
      for (const part of parts) {
        let g = part.g; if (g.index) { const expanded = g.toNonIndexed(); g.dispose(); g = expanded; }
        temp.position.fromArray(part.p); temp.rotation.fromArray([...part.r, 'XYZ']); temp.scale.setScalar(1); temp.updateMatrix(); g.applyMatrix4(temp.matrix);
        if (!g.attributes.normal) g.computeVertexNormals();
        const a = g.attributes.position, normal = g.attributes.normal, coords = g.attributes.uv;
        if (colored) { tint.setHex(part.c == null ? 0xffffff : part.c); if (!T.ColorManagement || T.ColorManagement.legacyMode !== false) tint.convertSRGBToLinear(); }
        for (let i = 0; i < a.count; i++) { p.push(a.getX(i), a.getY(i), a.getZ(i)); n.push(normal.getX(i), normal.getY(i), normal.getZ(i)); uv.push(coords ? coords.getX(i) : 0, coords ? coords.getY(i) : 0); if (colored) colors.push(tint.r, tint.g, tint.b); }
        g.dispose();
      }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(n, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); if (colored) g.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); g.computeBoundingBox(); g.computeBoundingSphere(); return keep(g);
    }
    function bevel(w, h, d, r = .0025) {
      const s = new T.Shape(), x = w / 2 - r, y = h / 2 - r; s.moveTo(-x, -y); s.lineTo(x, -y); s.lineTo(x, y); s.lineTo(-x, y); s.closePath();
      const g = new T.ExtrudeGeometry(s, { depth: Math.max(.001, d - r * 2), bevelEnabled: true, bevelSegments: 1, bevelThickness: r, bevelSize: r, steps: 1 }); g.translate(0, 0, -d / 2 + r); return g;
    }
    function canvasTexture(w, h, paint) {
      if (typeof document === 'undefined' || !document.createElement) return null;
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); if (!x) return null; paint(x, w, h);
      const texture = keep(new T.CanvasTexture(c)); texture.encoding = T.sRGBEncoding; texture.anisotropy = 2; return texture;
    }
    const grain = canvasTexture(256, 128, (x, w, h) => {
      x.fillStyle = '#b78b57'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 72; i++) { x.strokeStyle = i % 3 ? 'rgba(59,31,14,.30)' : 'rgba(237,205,149,.32)'; x.lineWidth = .4 + i % 4 * .15; x.beginPath(); x.moveTo(0, i * 1.82); for (let k = 1; k <= 8; k++) x.lineTo(k * 34, i * 1.82 + Math.sin(k * .8 + i) * 1.7); x.stroke(); }
    });
    const parchment = canvasTexture(256, 256, (x, w, h) => {
      x.fillStyle = '#ead7ac'; x.fillRect(0, 0, w, h); x.strokeStyle = '#806039'; x.lineWidth = 1.5; x.strokeRect(15, 15, 226, 226);
      x.beginPath(); x.arc(128, 80, 32, 0, Math.PI * 2); x.moveTo(128, 39); x.lineTo(139, 80); x.lineTo(128, 121); x.lineTo(117, 80); x.closePath(); x.stroke();
      for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(35, 146 + i * 15); x.lineTo(217 - i % 3 * 12, 146 + i * 15); x.stroke(); }
    });
    const wood = material(0xa37442, { map: grain, roughness: .77, envMapIntensity: .35 });
    const lining = material(0x483021, { map: grain, roughness: .90 });
    const gold = material(0xd7a43c, { metalness: .72, roughness: .30, envMapIntensity: .70 });
    const brass = material(0x9c7533, { metalness: .74, roughness: .43, envMapIntensity: .65 });
    const iron = material(0x343a39, { metalness: .68, roughness: .57 });
    const jewels = material(0xffffff, { vertexColors: true, roughness: .25, metalness: .07, clearcoat: .58, envMapIntensity: .45 }, true);
    const paperMaterial = material(0xffffff, { map: parchment, side: T.DoubleSide, roughness: .94 });
    const corkMaterial = material(0x987044, { map: grain, roughness: .93 });
    const wax = material(0x8e241d, { roughness: .42, clearcoat: .3 }, true);
    const glass = material(0x5c957d, { roughness: .16, transmission: opts.mobile ? 0 : .40, thickness: .018, attenuationColor: 0x307757, attenuationDistance: .32, ior: 1.50, metalness: 0, clearcoat: .70, envMapIntensity: .80, transparent: true, opacity: opts.mobile ? .84 : 1, depthWrite: true, side: T.DoubleSide }, true);

    const L = .38, D = .272, H = .172, timber = [], metal = [], dark = [];
    for (let j = 0; j < 4; j++) { const y = .025 + j * .043; for (const s of [-1, 1]) { timber.push(piece(bevel(L, .041, .014), 0, y, s * D / 2)); timber.push(piece(bevel(.014, .041, D - .024), s * (L / 2 - .006), y)); } }
    timber.push(piece(bevel(L - .027, .015, D - .02), 0, .008));
    for (const s of [-1, 1]) { timber.push(piece(bevel(L + .006, .011, .020), 0, H, s * D / 2)); timber.push(piece(bevel(.021, .011, D), s * L / 2, H)); }
    for (const x of [-.126, .126]) { for (const s of [-1, 1]) { metal.push(piece(bevel(.023, H + .01, .008), x, H / 2, s * (D / 2 + .010))); for (const y of [.022, .069, .115, .160]) metal.push(piece(new T.SphereGeometry(.0043, 7, 5), x, y, s * (D / 2 + .015))); } dark.push(piece(new T.CylinderGeometry(.009, .009, .041, 10), x, H + .002, -D / 2, [0, 0, Math.PI / 2])); }
    metal.push(piece(bevel(.037, .049, .011, .004), 0, .104, D / 2 + .015)); dark.push(piece(new T.CircleGeometry(.0047, 10), 0, .113, D / 2 + .021));
    dark.push(piece(bevel(.005, .012, .003, .001), 0, .104, D / 2 + .022));
    const chestBody = merged(timber), chestBrass = merged(metal), chestIron = merged(dark);
    const innerFloor = keep(bevel(L - .038, .008, D - .033));
    function arch(width, depth, height, from, to, thickness = .006) {
      const p = [], uv = [], ix = [], steps = Math.max(2, Math.ceil((to - from) * 12));
      for (let k = 0; k <= steps; k++) {
        const a = mix(from, to, k / steps), ny = depth / 2 * Math.sin(a), nz = -height * Math.cos(a), norm = Math.hypot(ny, nz);
        for (const inside of [false, true]) for (const x of [-width / 2, width / 2]) { p.push(x, height * Math.sin(a) - (inside ? thickness * ny / norm : 0), depth / 2 * (1 - Math.cos(a)) - (inside ? thickness * nz / norm : 0)); uv.push(x / width + .5, a / Math.PI); }
        if (k < steps) { const q = k * 4; ix.push(q, q + 4, q + 5, q, q + 5, q + 1, q + 2, q + 3, q + 7, q + 2, q + 7, q + 6, q, q + 2, q + 6, q, q + 6, q + 4, q + 1, q + 5, q + 7, q + 1, q + 7, q + 3); }
      }
      ix.push(0, 1, 3, 0, 3, 2); const e = steps * 4; ix.push(e, e + 2, e + 3, e, e + 3, e + 1);
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(ix); g.computeVertexNormals(); return g;
    }
    const staves = [], lidMetal = [];
    for (let i = 0; i < 9; i++) staves.push(piece(arch(L + .007, D, .084, i * Math.PI / 9 + .008, (i + 1) * Math.PI / 9 - .008)));
    const endcap = new T.Shape(); endcap.moveTo(-D / 2, 0); for (let i = 0; i <= 22; i++) { const a = i / 22 * Math.PI; endcap.lineTo(-D / 2 + D / 2 * (1 - Math.cos(a)), .084 * Math.sin(a)); } endcap.closePath();
    for (const s of [-1, 1]) { const g = new T.ExtrudeGeometry(endcap, { depth: .008, bevelEnabled: false }); g.rotateY(Math.PI / 2); staves.push(piece(g, s * L / 2 - .004, 0, D / 2)); }
    for (const x of [-.126, .126]) { lidMetal.push(piece(arch(.024, D + .005, .088, 0, Math.PI, .004), x)); for (const a of [.35, .94, 1.57, 2.20, 2.79]) lidMetal.push(piece(new T.SphereGeometry(.004, 7, 5), x, .09 * Math.sin(a), D / 2 * (1 - Math.cos(a)))); }
    lidMetal.push(piece(bevel(.027, .044, .009), 0, -.012, D + .009));
    const lidWood = merged(staves), lidBrass = merged(lidMetal);
    function coin() { return merged([piece(new T.CylinderGeometry(.018, .018, .0055, 16)), piece(new T.TorusGeometry(.0146, .0011, 4, 16), 0, .0030, 0, [Math.PI / 2, 0, 0]), piece(bevel(.0026, .0015, .015, .0005), 0, .004, 0)]); }
    const coinGeometry = coin(), coins = [];
    for (let k = 0; k < 27; k++) { const a = k * 2.39996, r = .024 + .079 * Math.sqrt(k / 27), geometry = coinGeometry.clone(); coins.push(piece(geometry, Math.cos(a) * r * 1.4, .115 + k % 4 * .010, Math.sin(a) * r * .65, [.13 * Math.sin(k), a, .15 * Math.cos(k)])); }
    const coinPile = merged(coins), gemParts = [];
    function cutGem() {
      const profiles = [[0, -.012], [.019, -.004], [.020, .002], [.012, .013]], p = [], ix = [], count = 8;
      for (const [r, y] of profiles) for (let j = 0; j < count; j++) { const a = j / count * Math.PI * 2; p.push(r * Math.cos(a), y, r * Math.sin(a)); }
      for (let k = 0; k < 3; k++) for (let j = 0; j < count; j++) { const a = k * count + j, b = k * count + (j + 1) % count; ix.push(a, a + count, b, b, a + count, b + count); }
      for (let j = 1; j < count - 1; j++) ix.push(24, 24 + j + 1, 24 + j);
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setIndex(ix); const out = g.toNonIndexed(); g.dispose(); out.computeVertexNormals(); return out;
    }
    for (let k = 0; k < 6; k++) gemParts.push(piece(cutGem(), -.096 + k % 3 * .088, .146 + k % 2 * .005, k < 3 ? -.045 : .030, [0, k * .6, .12], [0x7b1224, 0x0b6844, 0x174989][k % 3]));
    const gemPile = merged(gemParts, true);

    const profile = [[0, .003], [.045, .003], [.064, .014], [.075, .054], [.078, .108], [.076, .252], [.065, .279], [.040, .304], [.025, .331], [.024, .402], [.032, .412], [.034, .431], [.023, .441], [.018, .434], [.0175, .404], [.0175, .342], [.034, .317], [.059, .289], [.067, .250], [.067, .058], [.054, .027], [.035, .023], [0, .023]];
    const curve = new T.CatmullRomCurve3(profile.map(([r, y]) => new T.Vector3(r, y, 0)), false, 'centripetal');
    const bottleBody = merged([piece(new T.LatheGeometry(curve.getPoints(76).map(p => new T.Vector2(Math.max(0, p.x), p.y)), 28)), piece(new T.TorusGeometry(.027, .0042, 7, 28), 0, .431, 0, [Math.PI / 2, 0, 0]), piece(new T.TorusGeometry(.067, .0034, 6, 28), 0, .025, 0, [Math.PI / 2, 0, 0])]);
    const corkGeometry = keep(new T.CylinderGeometry(.022, .020, .046, 16));
    const waxGeometry = merged([piece(new T.CylinderGeometry(.020, .019, .005, 20), 0, 0, 0, [Math.PI / 2, 0, 0]), piece(bevel(.010, .024, .002, .0005), .002, -.022, -.001)]);
    const wakeGeometry = keep(new T.TorusGeometry(.095, .0017, 4, 32)); wakeGeometry.rotateX(Math.PI / 2);
    const wakeMaterial = material(0xa9e6df, { roughness: .69, transparent: true, opacity: .32, depthWrite: false });
    const wakes = new T.InstancedMesh(wakeGeometry, wakeMaterial, Math.min(3, (opts.places || []).filter(p => BOTTLES.has(p.i)).length)); wakes.name = 'Bottle waterline ripples'; wakes.instanceMatrix.setUsage(T.DynamicDrawUsage); wakes.frustumCulled = false; wakes.raycast = () => {}; group.add(wakes);

    for (const place of opts.places || []) {
      if (byIndex.has(place.i) || !place.frame || typeof place.frame.at !== 'function' || (!CHESTS.has(place.i) && !BOTTLES.has(place.i))) continue;
      const type = CHESTS.has(place.i) ? 'chest' : 'bottle', rig = new T.Group(), point = place.frame.at(type === 'chest' ? .02 : 0, type === 'chest' ? -.10 : .12, type === 'chest' ? .009 : 0);
      rig.name = 'Animated ' + type + ' place ' + place.i; rig.position.copy(point); rig.rotation.y = (place.frame.yaw || 0) + (type === 'chest' ? .10 : -.10); group.add(rig);
      const accent = material(0xd7a43c, { metalness: .73, roughness: .24, emissive: 0xc98d2b, emissiveIntensity: .04, envMapIntensity: .8 });
      const actor = { i: place.i, type, rig, baseY: point.y, baseYaw: rig.rotation.y, phase: place.i * .71, born: null, active: false, staticReveal: false, poseTime: 0, accent };
      if (type === 'chest') {
        mesh(chestBody, wood, rig, 'Hollow plank chest'); mesh(chestBrass, brass, rig, 'Chest straps and latch'); mesh(chestIron, iron, rig, 'Chest hinges and keyhole');
        mesh(innerFloor, lining, rig, 'Dark inner chest floor').position.y = .025;
        mesh(coinPile, gold, rig, 'Twenty-seven gold doubloons'); mesh(gemPile, jewels, rig, 'Six cut precious stones');
        actor.coin = mesh(coinGeometry, accent, rig, 'Living highlight doubloon'); actor.coin.position.set(-.017, .157, .029);
        actor.lid = new T.Group(); actor.lid.name = 'Back hinge lid'; actor.lid.position.set(0, H + .004, -D / 2); rig.add(actor.lid); mesh(lidWood, wood, actor.lid, 'Vaulted lid staves'); mesh(lidBrass, brass, actor.lid, 'Lid brasswork');
      } else {
        rig.position.y = actor.baseY = waterY - .028;
        actor.glass = mesh(bottleBody, glass, rig, 'Thick hollow glass with neck'); actor.glass.castShadow = false;
        actor.cork = mesh(corkGeometry, corkMaterial, rig, 'Bottle cork');
        actor.letterRig = new T.Group(); actor.letterRig.name = 'Neck-sized letter rig'; rig.add(actor.letterRig);
        actor.paper = mesh(keep(new T.PlaneGeometry(.29, .215, 36, 10)), paperMaterial, actor.letterRig, 'Physical rolled parchment'); actor.rest = actor.paper.geometry.attributes.position.array.slice();
        actor.seal = mesh(waxGeometry, wax, actor.letterRig, 'Letter wax seal'); actor.seal.position.set(.071, -.073, .007);
        actor.neckRadius = .0175; actor.mouthY = .441; actor.wakeIndex = actors.filter(a => a.type === 'bottle').length;
      }
      rig.traverse(o => { o.userData.i = place.i; });
      actors.push(actor); byIndex.set(actor.i, actor);
    }
    const isReduced = () => typeof opts.reducedMotion === 'function' ? !!opts.reducedMotion() : !!opts.reducedMotion;
    function pose(actor, q, time, reduced) {
      const idleTime = reduced ? 0 : time, phase = actor.phase, amount = smooth(.42, 2.35, q);
      actor.poseTime = q;
      actor.accent.emissiveIntensity = .025 + (reduced ? 0 : .026 * Math.pow(Math.max(0, Math.sin(idleTime * .83 + phase)), 12)) + .10 * amount;
      if (actor.type === 'chest') {
        actor.lid.rotation.x = -.09 - (reduced ? 0 : .014 * Math.sin(idleTime * .56 + phase)) - 1.10 * smooth(.36, 1.75, q);
        actor.coin.rotation.set(reduced ? .06 : .06 + .055 * Math.sin(idleTime * .71 + phase), .22, .12 + .15 * amount);
        actor.coin.position.y = .157 + (reduced ? 0 : .0020 * Math.sin(idleTime * .76 + phase));
        return;
      }
      const idle = reduced ? 0 : 1;
      actor.rig.position.y = actor.baseY + idle * .006 * Math.sin(idleTime * .94 + phase);
      actor.rig.rotation.x = idle * .038 * Math.sin(idleTime * .73 + phase); actor.rig.rotation.z = -.11 + idle * .035 * Math.sin(idleTime * .83 + phase);
      const pop = smooth(.10, .43, q), fall = smooth(.45, .92, q), extract = smooth(.50, 1.45, q), travel = smooth(1.51, 2.17, q), lower = smooth(1.90, 2.38, q), open = smooth(1.57, 2.31, q);
      actor.cork.position.set(mix(.045 * pop, .131, fall), mix(.455 + .13 * pop, .066, fall) + .035 * Math.sin(Math.PI * fall), .027 * fall);
      actor.cork.rotation.set(.18 * fall, .22, mix(-.2 * pop, 1.58, fall));
      // Translate clear of the glass first, then lower the unfurled parchment.
      // The reversed trajectory raises and recoils it before neck re-entry.
      actor.letterRig.position.set(.251 * travel, mix(mix(.235, .578, extract), .386, lower), .009 * travel);
      actor.letterRig.rotation.set(0, .11 * travel, -actor.rig.rotation.z * travel);
      const attr = actor.paper.geometry.attributes.position, W = .29, H2 = .215 / 2, R = .012, released = W * open;
      if (actor.deformedOpen !== open) {
        actor.deformedOpen = open;
        for (let k = 0; k < attr.count; k++) {
          const s = actor.rest[k * 3] + W / 2, y = actor.rest[k * 3 + 1], r = R + .0012 * (1 - s / W);
          let x, z; if (s <= released) { x = -released / 2 + s; z = -R * (1 - open) + .002 * Math.sin(x * 21) * open; }
          else { const a = (s - released) / r; x = released / 2 + Math.sin(a) * r; z = R * open - Math.cos(a) * r; }
          attr.setXYZ(k, x, y + .0010 * Math.sin(s * 115) * Math.pow(Math.abs(y) / H2, 8), z);
        }
        attr.needsUpdate = true; actor.paper.geometry.computeVertexNormals(); actor.paper.geometry.computeBoundingSphere();
      }
      actor.seal.visible = open > .87; actor.seal.scale.setScalar(smooth(.87, .99, open));
      temp.position.copy(actor.rig.position); temp.position.y = waterY + .004; temp.rotation.set(0, 0, 0); const ripple = reduced ? 1 : 1 + .12 * Math.sin(idleTime * .74 + phase); temp.scale.set(ripple, 1, ripple); temp.updateMatrix(); wakes.setMatrixAt(actor.wakeIndex, temp.matrix);
    }
    function update(time, dt) {
      if (dead || !Number.isFinite(time)) return;
      const reduced = isReduced(); lastTime = time;
      for (const actor of actors) {
        let q = actor.staticReveal ? 2.6 : 0;
        if (actor.active) {
          if (actor.born == null) actor.born = time;
          const age = Math.max(0, time - actor.born);
          q = age <= 2.6 ? age : age < 3.3 ? 2.6 : 2.6 * (1 - smooth(3.3, 5.8, age));
          if (age >= 5.8) { actor.active = false; q = 0; }
        }
        pose(actor, reduced && actor.active ? 2.6 : q, time, reduced);
      }
      wakes.instanceMatrix.needsUpdate = true;
    }
    function trigger(index, kind, color) {
      if (dead || !byIndex.has(index)) return false;
      const actor = byIndex.get(index); triggers++;
      if (color != null) { actor.accent.emissive.set(color); if (!T.ColorManagement || T.ColorManagement.legacyMode !== false) actor.accent.emissive.convertSRGBToLinear(); actor.accent.emissive.lerp(new T.Color(0xc98d2b), .58); }
      actor.staticReveal = isReduced(); actor.active = !actor.staticReveal;
      actor.born = lastTime == null ? null : lastTime - Math.min(actor.poseTime, 2.6);
      if (actor.staticReveal) pose(actor, 2.6, 0, true);
      return true;
    }
    update(0, 0); lastTime = null;
    return {
      group, update, trigger,
      stats() { let draws = 0; group.traverse(o => { if (o.isMesh) draws++; }); return { disposed: dead, places: actors.length, chests: actors.filter(a => a.type === 'chest').length, bottles: actors.filter(a => a.type === 'bottle').length, triggers, draws, resources: own.size, duration: 5.8, states: actors.map(a => ({ i: a.i, type: a.type, revealing: a.active || a.staticReveal, phase: a.poseTime, lid: a.lid ? a.lid.rotation.x : null, letter: a.letterRig ? a.letterRig.position.toArray() : null })) }; },
      dispose() { if (dead) return; dead = true; parent.remove(group); group.traverse(o => { if (o.isInstancedMesh && o.dispose) o.dispose(); }); group.clear(); for (const resource of own) resource.dispose(); own.clear(); }
    };
  }
  return { create };
})();
