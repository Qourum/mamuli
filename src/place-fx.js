// Bounded, shared 3D event effects for every archipelago square. No extra render
// loop, sprites or renderer: the board owns time and this module owns its pool.
const PlaceFX3D = (() => {
  const MAX = 8, PER = 18, TAU = Math.PI * 2;
  function create({ parent, places, reducedMotion = false }) {
    const T = window.THREE, group = new T.Group(); group.name = 'Archipelago_Place_Events'; parent.add(group);
    const lookup = new Map(places.map(p => [p.i, p])), events = Array(MAX).fill(null), obj = new T.Object3D();
    const ringGeo = new T.TorusGeometry(1, .014, 5, 48), dropGeo = new T.IcosahedronGeometry(1, 1);
    const coinGeo = new T.CylinderGeometry(.042, .042, .012, 14);
    const ringMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .63, depthWrite: false });
    const dropMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: .23, metalness: .12 });
    const coinMat = new T.MeshStandardMaterial({ color: 0xffd777, metalness: .72, roughness: .28, emissive: 0x4d2904, emissiveIntensity: .18 });
    function pool(geo, mat, n, name) { const mesh = new T.InstancedMesh(geo, mat, n); mesh.name = name; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.count = 0; mesh.visible = false; group.add(mesh); return mesh; }
    const rings = pool(ringGeo, ringMat, MAX * 2, 'Landing and ownership ripples');
    const drops = pool(dropGeo, dropMat, MAX * PER, 'Solid water and gem particles');
    const coins = pool(coinGeo, coinMat, MAX * PER, 'Purchase doubloons');
    rings.renderOrder = 3;
    let time = 0, initialized = false, disposed = false, sequence = 0;
    const color = new T.Color(), pearl = new T.Color(0xe2fff4), spray = new T.Color(0xd7fbfa);
    function show(m, count) {
      m.count = count; m.visible = count > 0;
      // Hidden pools submit no vertices. Their stale buffer tail stays outside
      // count; a later event overwrites every live instance before showing it.
      if (count) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    }
    function reset() {
      for (let i = 0; i < MAX; i++) events[i] = null;
      for (const m of [rings, drops, coins]) show(m, 0);
    }
    reset();
    // Allocate instance colours before the first shader warmup, never mid-turn.
    for (let i = 0; i < MAX * 2; i++) rings.setColorAt(i, color.set(0xffffff));
    for (let i = 0; i < MAX * PER; i++) drops.setColorAt(i, color.set(0xcaf8ec));
    function trigger(i, kind = 'arrival', ownerColor = '#ffcc75') {
      if (disposed || !lookup.has(i) || reducedMotion) return false;
      let slot = events.findIndex(e => !e || e.i === i);
      if (slot < 0) slot = sequence % MAX;
      const p = lookup.get(i), treasure = kind === 'purchase' || kind === 'build' || kind === 'celebrate';
      const c = new T.Color(ownerColor), duration = treasure ? 2.9 : 1.8;
      events[slot] = { i, kind, start: initialized ? time : null, duration, at: p.at.clone(), scale: p.corner ? .86 : .56, treasure, color: c, phase: ++sequence * .73 };
      return true;
    }
    function update(t) {
      if (disposed) return;
      time = Number.isFinite(t) ? t : time; initialized = true;
      if (!events.some(Boolean)) return;
      let ringCount = 0, dropCount = 0, coinCount = 0;
      for (let slot = 0; slot < MAX; slot++) {
        const e = events[slot];
        if (!e) continue;
        if (e.start == null) e.start = time;
        const u = Math.max(0, (time - e.start) / e.duration);
        if (u >= 1) { events[slot] = null; continue; }
        for (let j = 0; j < 2; j++) {
          const q = Math.max(0, (u - j * .16) / (1 - j * .16));
          if (!q && j) continue;
          obj.position.copy(e.at); obj.position.y += .018 + j * .009;
          obj.rotation.set(Math.PI / 2, 0, 0); const r = e.scale * (.52 + q * .83);
          obj.scale.set(r, r, Math.max(.001, (1 - q) * .85)); obj.updateMatrix();
          rings.setMatrixAt(ringCount, obj.matrix);
          rings.setColorAt(ringCount++, color.copy(e.color).lerp(pearl, .42));
        }
        const count = e.treasure ? PER : 10;
        for (let k = 0; k < count; k++) {
          const q = Math.max(0, Math.min(1, (u - (k % 3) * .025) / .84));
          if (q >= 1) continue;
          const a = k / count * TAU + e.phase, r = e.scale * (.2 + q * .85);
          const arc = Math.sin(q * Math.PI), shrink = Math.min(1, q * 12) * Math.pow(1 - q, .5);
          if (!shrink) continue;
          obj.position.set(e.at.x + Math.cos(a) * r, e.at.y + .045 + arc * (e.treasure ? .78 : .42) * (.7 + (k % 4) * .1), e.at.z + Math.sin(a) * r);
          obj.rotation.set(q * 9 + a, q * 7 + k, q * 4);
          if (e.treasure) { obj.scale.setScalar(shrink * (k % 3 ? 1 : 1.25)); obj.updateMatrix(); coins.setMatrixAt(coinCount++, obj.matrix); }
          else { obj.scale.set(.023 * shrink, .046 * shrink, .023 * shrink); obj.updateMatrix(); drops.setMatrixAt(dropCount, obj.matrix); drops.setColorAt(dropCount++, color.copy(e.color).lerp(spray, .76)); }
        }
      }
      show(rings, ringCount); show(drops, dropCount); show(coins, coinCount);
    }
    function dispose() { if (disposed) return; disposed = true; parent.remove(group); for (const m of [rings, drops, coins]) m.dispose(); for (const g of [ringGeo, dropGeo, coinGeo]) g.dispose(); for (const m of [ringMat, dropMat, coinMat]) m.dispose(); events.fill(null); }
    return { update, trigger, reset, dispose, stats: () => ({ places: lookup.size, active: events.filter(Boolean).length, capacity: MAX, meshes: 3, disposed }) };
  }
  return { create };
})();
