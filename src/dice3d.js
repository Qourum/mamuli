// ===== the dice: two rounded cubes thrown into view, tumbling under a small physics simulation =====
// The throw is simulated first (gravity, bounces off the floor and an invisible tray, friction), then played back. Once
// it is known which face of each die ends up on top, the die's picture is turned by one of the cube's own symmetries so
// that this face shows the number that was rolled: the motion stays exactly as simulated.
// Since a throw does not depend on the numbers, the next one is simulated ahead, a little at a time while the page is
// idle: a roll starts at once, without a pause for the arithmetic (which a phone would feel).
// A throw comes from a seed the game gives (Engine.throwSeed), and the simulation uses nothing but arithmetic and
// square roots, which every browser works out to the same last digit: so on every phone in the room the dice fly,
// bounce and come to rest exactly alike.

const Dice3D = (() => {
  let T = null, ok = false, scene = null, cam = null, host = null, badge = null;
  const SZ = 0.44, HS = SZ / 2, AX = 1.75, AZ = 1.05;
  let W = 1, H = 1, rect = { x: 0, y: 0, w: 1, h: 1 };
  const dice = [];
  let play = null, visible = false;
  // which face shows which number: the box's faces are +x, -x, +y, -y, +z, -z
  const FACES = [3, 4, 1, 6, 2, 5];
  let NORMAL = null;

  function pipTexture(n) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 54, 10, 64, 64, 90);
    g.addColorStop(0, '#fffdf6'); g.addColorStop(1, '#efe4cc');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const P = { 1: [[64, 64]], 2: [[36, 36], [92, 92]], 3: [[34, 34], [64, 64], [94, 94]], 4: [[36, 36], [92, 36], [36, 92], [92, 92]],
      5: [[34, 34], [94, 34], [64, 64], [34, 94], [94, 94]], 6: [[36, 32], [92, 32], [36, 64], [92, 64], [36, 96], [92, 96]] }[n];
    for (const [px, py] of P) {
      const r = n === 1 ? 17 : 11.5;
      x.fillStyle = n === 1 ? '#b8231b' : '#2c1b10';
      x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
      x.fillStyle = 'rgba(255, 255, 255, .25)';
      x.beginPath(); x.arc(px - r * 0.3, py - r * 0.35, r * 0.3, 0, Math.PI * 2); x.fill();
    }
    const t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    return t;
  }
  function roundedBox(size, r, seg) {
    const g = new T.BoxGeometry(size, size, size, seg, seg, seg), p = g.attributes.position, n = g.attributes.normal, h = size / 2 - r;
    const v = new T.Vector3(), c = new T.Vector3();
    for (let k = 0; k < p.count; k++) {
      v.fromBufferAttribute(p, k);
      c.set(Math.max(-h, Math.min(h, v.x)), Math.max(-h, Math.min(h, v.y)), Math.max(-h, Math.min(h, v.z)));
      v.sub(c);
      if (v.lengthSq() < 1e-12) continue;
      v.normalize();
      p.setXYZ(k, c.x + v.x * r, c.y + v.y * r, c.z + v.z * r);
      n.setXYZ(k, v.x, v.y, v.z);
    }
    return g;
  }

  const mobile = Math.min(screen.width, screen.height) < 700;
  function init(THREE, el) {
    if (ok) return;
    T = THREE; host = el;
    NORMAL = { 3: new T.Vector3(1, 0, 0), 4: new T.Vector3(-1, 0, 0), 1: new T.Vector3(0, 1, 0), 6: new T.Vector3(0, -1, 0), 2: new T.Vector3(0, 0, 1), 5: new T.Vector3(0, 0, -1) };
    scene = new T.Scene();
    cam = new T.PerspectiveCamera(30, 1, 0.1, 50);
    scene.add(new T.HemisphereLight(0xffffff, 0x9a7a58, 0.75));
    const sun = new T.DirectionalLight(0xfff3dc, 0.85);
    sun.position.set(-2.5, 6, 3); sun.castShadow = true;
    sun.shadow.mapSize.set(mobile ? 512 : 1024, mobile ? 512 : 1024);
    const sc = sun.shadow.camera; sc.left = -3; sc.right = 3; sc.top = 3; sc.bottom = -3; sc.near = 1; sc.far = 15;
    sun.shadow.bias = -0.001;
    scene.add(sun);
    // the floor only where shadows fall (the tray, and the near side the dice come in over): fewer pixels to shade
    const floor = new T.Mesh(new T.PlaneGeometry(4.9, 3.9), new T.ShadowMaterial({ opacity: 0.32 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0.25, 0, 0.35); floor.receiveShadow = true;
    scene.add(floor);
    const geo = roundedBox(SZ, SZ * 0.16, 5);
    const mats = FACES.map(f => new T.MeshPhongMaterial({ map: pipTexture(f), shininess: 46, specular: 0x2c2c2c }));
    for (let k = 0; k < 2; k++) {
      const m = new T.Mesh(geo, mats);
      m.castShadow = true;
      m.position.set(k ? 0.4 : -0.4, HS, 0);
      scene.add(m);
      dice.push({ m, off: new T.Quaternion() });
    }
    badge = document.createElement('div');
    badge.className = 'dicesum';
    badge.hidden = true;
    host.appendChild(badge);
    ok = true;
    if (todo.length) later(work);                  // throws asked for before the dice were here
  }
  // the dice are shown over the lower part of the board
  function layout(w, h) {
    W = w; H = h;
    const rh = Math.round(Math.min(h * 0.52, w * 0.66)), rw = Math.round(w);
    rect = { x: 0, y: Math.round(Math.max(0, (h - rh) * 0.42)), w: rw, h: rh };
    if (!ok) return;
    cam.aspect = rect.w / rect.h;
    const el = 0.98, vf = cam.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * cam.aspect);
    const d = Math.max((AX * 2.25) / (2 * Math.tan(hf / 2)), (AZ * 2.6) / (2 * Math.tan(vf / 2)));
    cam.position.set(0, d * Math.sin(el), d * Math.cos(el));
    cam.lookAt(0, 0, 0.05);
    cam.updateProjectionMatrix();
    if (badge) { badge.style.bottom = (rect.y + rect.h * 0.9) + 'px'; }
  }

  // ----- the simulation: a throw that is advanced step by step (run(n)), until both dice rest -----
  function throwOf(rnd) {
    const V3 = T.Vector3, Q4 = T.Quaternion;
    const bodies = [0, 1].map(k => ({
      p: new V3((k ? 0.5 : -0.5) + (rnd() - 0.5) * 0.3, 0.75 + rnd() * 0.35, AZ + 0.9),
      v: new V3((rnd() - 0.5) * 1.2 + (k ? -0.35 : 0.35), 1.6 + rnd() * 1.2, -(4.6 + rnd() * 1.3)),
      q: new Q4(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(),     // (no sines here: see above)
      w: new V3((rnd() - 0.5) * 30, (rnd() - 0.5) * 20, (rnd() - 0.5) * 30),
      rest: 0, sleep: false
    }));
    const g = -30, dt = 1 / 240, e = 0.42, mu = 0.5, invI = 6 / (SZ * SZ);
    const corners = [];
    for (const a of [-HS, HS]) for (const b of [-HS, HS]) for (const c of [-HS, HS]) corners.push(new V3(a, b, c));
    const r = new V3(), vc = new V3(), n = new V3(), rn = new V3(), tq = new Q4();
    const frames = [], hits = [];
    let entered = [false, false];
    const planes = [[0, 1, 0, 0], [1, 0, 0, -AX], [-1, 0, 0, -AX], [0, 0, 1, -AZ], [0, 0, -1, -AZ]];
    let step = 0, result = null;
    function once() {
      bodies.forEach((b, bi) => {
        if (b.sleep) return;
        b.v.y += g * dt;
        if (b.p.z < AZ - HS) entered[bi] = true;
        // contacts with the floor and the tray's sides, solved a few times over so a die can rest on four corners
        let touching = 0;
        for (let it = 0; it < 4; it++) {
          for (let pi = 0; pi < planes.length; pi++) {
            if (pi === 4 && !entered[bi]) continue;              // the near side is open until the die is in
            const [nx, ny, nz, off] = planes[pi];
            n.set(nx, ny, nz);
            for (const cl of corners) {
              r.copy(cl).applyQuaternion(b.q);
              const dist = (b.p.x + r.x) * nx + (b.p.y + r.y) * ny + (b.p.z + r.z) * nz - off;
              if (ny && it === 0 && dist < 0.012) touching++;
              if (dist > 0.003) continue;
              vc.copy(b.w).cross(r).add(b.v);
              const vn = vc.dot(n);
              if (vn >= 0) continue;
              rn.copy(r).cross(n);
              const k = 1 + rn.lengthSq() * invI;
              const jn = -(1 + (it === 0 && vn < -1.2 ? e : 0)) * vn / k;
              b.v.addScaledVector(n, jn);
              b.w.addScaledVector(rn, jn * invI);
              if (it === 0 && ny && jn > 0.45) hits.push({ f: frames.length, v: Math.min(1, jn / 2.5) });
              // friction
              vc.copy(b.w).cross(r).add(b.v);
              vc.addScaledVector(n, -vc.dot(n));
              const vt = vc.length();
              if (vt > 1e-5) {
                vc.multiplyScalar(1 / vt);
                rn.copy(r).cross(vc);
                const kt = 1 + rn.lengthSq() * invI, jt = Math.min(vt / kt, mu * jn);
                b.v.addScaledVector(vc, -jt);
                b.w.addScaledVector(rn, -jt * invI);
              }
            }
          }
        }
        if (touching) { b.w.multiplyScalar(1 - 2.4 * dt); b.v.x *= 1 - 1.2 * dt; b.v.z *= 1 - 1.2 * dt; }
        b.p.addScaledVector(b.v, dt);
        tq.set(b.w.x * dt * 0.5, b.w.y * dt * 0.5, b.w.z * dt * 0.5, 0).multiply(b.q);
        b.q.set(b.q.x + tq.x, b.q.y + tq.y, b.q.z + tq.z, b.q.w + tq.w).normalize();
        // push out of the floor and the sides
        for (let pi = 0; pi < planes.length; pi++) {
          if (pi === 4 && !entered[bi]) continue;
          const [nx, ny, nz, off] = planes[pi];
          let deep = 0;
          for (const cl of corners) { r.copy(cl).applyQuaternion(b.q); const dist = (b.p.x + r.x) * nx + (b.p.y + r.y) * ny + (b.p.z + r.z) * nz - off; if (dist < deep) deep = dist; }
          if (deep < 0) { b.p.x -= nx * deep * 0.9; b.p.y -= ny * deep * 0.9; b.p.z -= nz * deep * 0.9; }
        }
        // at rest: lying on the floor, hardly moving, for a moment
        if (touching >= 3 && b.v.lengthSq() < 0.02 && b.w.lengthSq() < 0.4) { b.rest += dt; if (b.rest > 0.2) b.sleep = true; } else b.rest = 0;
      });
      // the dice knock into each other (as two balls)
      const A = bodies[0], B = bodies[1];
      n.copy(A.p).sub(B.p);
      const dd = n.length(), R2 = SZ * 1.06;
      if (dd < R2 && dd > 1e-6) {
        n.multiplyScalar(1 / dd);
        const pen = R2 - dd;
        A.p.addScaledVector(n, pen / 2); B.p.addScaledVector(n, -pen / 2);
        const vrel = vc.copy(A.v).sub(B.v).dot(n);
        if (vrel < 0) { const j = -(1 + 0.35) * vrel / 2; A.v.addScaledVector(n, j); B.v.addScaledVector(n, -j); A.sleep = B.sleep = false; if (j > 0.3) hits.push({ f: frames.length, v: Math.min(1, j) }); }
      }
      if (step % 4 === 0) frames.push(bodies.map(b => [b.p.x, b.p.y, b.p.z, b.q.x, b.q.y, b.q.z, b.q.w]));
      step++;
      return bodies.every(b => b.sleep) || step >= 240 * 4.5;
    }
    // land exactly flat: turn each die the last little bit onto its nearest face
    function finish() {
    const ends = bodies.map(b => {
      const up = new V3(0, 1, 0).applyQuaternion(b.q.clone().invert());
      const ax = Math.abs(up.x) > Math.abs(up.y) ? (Math.abs(up.x) > Math.abs(up.z) ? 'x' : 'z') : (Math.abs(up.y) > Math.abs(up.z) ? 'y' : 'z');
      const u = new V3(); u[ax] = Math.sign(up[ax]) || 1;
      const worldUp = u.clone().applyQuaternion(b.q);
      const fix = new Q4().setFromUnitVectors(worldUp, new V3(0, 1, 0));
      return { u, q: fix.multiply(b.q.clone()), p: new V3(b.p.x, HS, b.p.z) };
    });
    const last = frames[frames.length - 1];
    for (let k = 1; k <= 8; k++) {
      const f = k / 8;
      frames.push(ends.map((en, bi) => {
        const q0 = new Q4(last[bi][3], last[bi][4], last[bi][5], last[bi][6]).slerp(en.q, f);
        return [last[bi][0] + (en.p.x - last[bi][0]) * f, last[bi][1] + (en.p.y - last[bi][1]) * f, last[bi][2] + (en.p.z - last[bi][2]) * f, q0.x, q0.y, q0.z, q0.w];
      }));
    }
    return { frames, hits, ends, bodies };
    }
    return {
      run(n) { while (!result && n-- > 0) if (once()) result = finish(); return !!result; },
      get result() { return result; }
    };
  }
  function simulate(rnd) { const t = throwOf(rnd); t.run(Infinity); return t.result; }
  // the throws the game will ask for next, worked out ahead in slices of a few milliseconds (by their seeds)
  const ahead = new Map(), todo = [];
  let making = null;
  const later = fn => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 600 }) : setTimeout(fn, 30));
  const rndOf = seed => Engine.mulberry(seed >>> 0);
  function expect(seed) {
    seed = seed >>> 0;
    if (!seed || ahead.has(seed) || (making && making.seed === seed) || todo.includes(seed)) return;
    todo.push(seed);
    if (todo.length > 3) todo.shift();
    later(work);
  }
  function work() {
    if (!ok) return;
    if (!making) {
      const seed = todo.shift();
      if (!seed) return;
      making = throwOf(rndOf(seed)); making.seed = seed;
    }
    const job = making, t = performance.now();
    while (performance.now() - t < 4) {
      if (!job.run(12)) continue;
      ahead.set(job.seed, job.result);
      while (ahead.size > 4) ahead.delete(ahead.keys().next().value);
      making = null;
      if (todo.length) later(work);
      return;
    }
    later(work);
  }
  // the throw for this seed: ready, half done (finished now), or worked out now (an old game without seeds: any throw)
  function nextThrow(seed) {
    seed = seed >>> 0;
    let sim = null;
    if (seed && ahead.has(seed)) { sim = ahead.get(seed); ahead.delete(seed); }
    else if (seed && making && making.seed === seed) { making.run(Infinity); sim = making.result; making = null; }
    else sim = simulate(rndOf(seed || ((Math.random() * 4294967295) >>> 0) || 1));
    if (todo.length) later(work);
    return sim;
  }

  // ----- a throw -----
  const qa = () => new T.Quaternion(), tmpQ = [null, null];
  function roll(values, seed) {
    if (!ok) return Promise.resolve();
    return new Promise(res => {
      const sim = nextThrow(seed);
      sim.ends.forEach((en, k) => { dice[k].off.setFromUnitVectors(NORMAL[values[k]], en.u); });
      badge.hidden = true;
      visible = true;
      dice.forEach(d => { d.m.visible = true; d.m.scale.setScalar(1); });
      play = { sim, t: 0, hitAt: 0, values, res, done: false, after: 0 };
      if (REDUCED) play.t = sim.frames.length / 60;
    });
  }
  function apply(fi) {
    const fr = play.sim.frames, a = Math.min(fr.length - 1, Math.floor(fi)), b = Math.min(fr.length - 1, a + 1), f = fi - Math.floor(fi);
    for (let k = 0; k < 2; k++) {
      const A = fr[a][k], B = fr[b][k], m = dice[k].m;
      m.position.set(A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f);
      const q = tmpQ[k] || (tmpQ[k] = qa());
      q.set(A[3], A[4], A[5], A[6]);
      const q2 = qa().set(B[3], B[4], B[5], B[6]);
      q.slerp(q2, f);
      m.quaternion.copy(q).multiply(dice[k].off);
    }
  }
  function step(dt) {
    if (!play) return;
    const n = play.sim.frames.length;
    play.t += dt;
    const fi = Math.min(n - 1, play.t * 60);
    apply(fi);
    while (play.hitAt < play.sim.hits.length && play.sim.hits[play.hitAt].f <= fi) { Sound.tick(play.sim.hits[play.hitAt].v); play.hitAt++; }
    if (fi >= n - 1 && !play.done) {
      play.done = true;
      const [a, b] = play.values;
      badge.innerHTML = `<b>${a + b}</b>${a === b ? '<span>დუბლი!</span>' : ''}`;
      badge.hidden = false;
      badge.classList.remove('go'); void badge.offsetWidth; badge.classList.add('go');
      setTimeout(() => { const r = play && play.res; if (r) { play.res = null; r(); } }, REDUCED ? 100 : 420);
    }
    if (play.done) {
      play.after += dt;
      if (play.after > 1.6) {
        const e = Math.min(1, (play.after - 1.6) / 0.3);
        dice.forEach(d => d.m.scale.setScalar(Math.max(0.001, 1 - e)));
        if (e >= 1) { visible = false; badge.hidden = true; const r = play.res; play = null; if (r) r(); }
      }
    }
  }
  function frame(R, dt) {
    if (!ok || !visible) return;
    step(dt);
    if (!visible) return;
    R.setScissorTest(true);
    R.setScissor(rect.x, rect.y, rect.w, rect.h);
    R.setViewport(rect.x, rect.y, rect.w, rect.h);
    R.clearDepth();
    R.shadowMap.needsUpdate = true;              // the dice move: their shadows with them
    R.render(scene, cam);
    R.setScissorTest(false);
    R.setViewport(0, 0, W, H);
  }
  // the screen is going away mid-throw: finish at once
  function skip() { if (play && play.res) { const r = play.res; play.res = null; r(); } play = null; visible = false; if (badge) badge.hidden = true; }
  // drawn once, out of sight, so that its shaders are compiled and its pictures uploaded before the first throw
  function warm(R) {
    if (!ok) return;
    dice.forEach(d => { d.m.visible = true; });
    R.compile(scene, cam);
    R.setScissorTest(true); R.setScissor(0, 0, 1, 1); R.setViewport(0, 0, 1, 1);
    R.shadowMap.needsUpdate = true;
    R.render(scene, cam);
    R.setScissorTest(false); R.setViewport(0, 0, W, H);
  }
  // (for tests) the numbers the dice show on top now, and whether a throw is ready ahead
  function top() {
    return dice.map(d => {
      const u = new T.Vector3(0, 1, 0).applyQuaternion(d.m.quaternion.clone().invert()), a = [Math.abs(u.x), Math.abs(u.y), Math.abs(u.z)];
      const ax = a.indexOf(Math.max(...a));
      return FACES[ax * 2 + (u.getComponent(ax) > 0 ? 0 : 1)];
    });
  }
  // (for tests) where the dice are now
  const where = () => dice.map(d => [d.m.position.x, d.m.position.y, d.m.position.z, d.m.quaternion.x, d.m.quaternion.y, d.m.quaternion.z, d.m.quaternion.w].map(v => +v.toFixed(5)));
  return { init, layout, roll, expect, frame, skip, warm, get busy() { return !!play; }, _sim: (THREE, rnd) => { T = T || THREE; return simulate(rnd); },
    _top: top, _where: where, _ahead: seed => ahead.has(seed >>> 0), get _landed() { return !!(play && play.done); } };
})();
