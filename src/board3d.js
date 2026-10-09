// ===== the board in 3D: raised squares with their writing, the scenery behind them, figures, flags, towers, the camera =====
// Board coordinates: y up, the board's middle at (0, 0, 0). Side 0 (start .. jail) is nearest +z, then the board goes on
// clockwise seen from above: side 1 at -x, side 2 at -z, side 3 at +x. Each square has its own frame: x along its writing,
// +z towards its outer edge; its writing is upright for someone sitting at that side, where the camera goes.

const Board3D = (() => {
  const T = window.THREE;
  const S = 12, C = 1.5, D = 1.5, TW = 1, TH = 0.2, LOT = 1.25;
  const OUT = [[0, 1], [-1, 0], [0, -1], [1, 0]], ALONG = [[-1, 0], [0, -1], [1, 0], [0, 1]];
  const sideOf = i => Math.floor(i / 10) % 4;
  const yawOf = s => -s * Math.PI / 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = {
    out: t => 1 - Math.pow(1 - t, 3), inOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    back: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    lin: t => t
  };

  let ok = false, R = null, scene = null, cam = null, host = null, W = 1, H = 1, root = null, sun = null, ray = null, maxAniso = 4;
  const tiles = [], labelCv = [], labelTex = [], labelMat = [], sideMat = [], lotMesh = [], lotGround = [], flags = [], mark = [];
  const toks = [];
  let st = null, pos = [], turnSeat = -1, pickCb = null, built = false, mats = null, ownerMats = [], clouds = [], wheel = null;

  // ----- where things are -----
  function centerOf(i) {
    const s = sideOf(i), k = i % 10, [ox, oz] = OUT[s], [ax, az] = ALONG[s], h = S / 2;
    if (!k) return new T.Vector3(ox * (h - C / 2) - ax * (h - C / 2), 0, oz * (h - C / 2) - az * (h - C / 2));
    const a = -(h - C) + (k - 0.5) * TW, o = h - D / 2;
    return new T.Vector3(ox * o + ax * a, 0, oz * o + az * a);
  }
  function toWorld(i, lx, lz, y = 0) {
    const c = centerOf(i), r = yawOf(sideOf(i)), cs = Math.cos(r), sn = Math.sin(r);
    return new T.Vector3(c.x + lx * cs + lz * sn, y, c.z - lx * sn + lz * cs);
  }

  // ----- small animations, run by the frame loop -----
  const tweens = [];
  let speedK = 1, epoch = 0;
  function tween(dur, fn, ez = ease.inOut) {
    if (!ok || dur <= 0 || document.visibilityState === 'hidden') { fn(1); return Promise.resolve(); }
    return new Promise(res => tweens.push({ t: 0, dur, fn, ez, res }));
  }
  // everything that is moving jumps to its end (the screen skips ahead to the present)
  function halt() {
    epoch++;
    const all = tweens.splice(0);
    for (const w of all) { try { w.fn(1); } catch (e) { } w.res(); }
    if (Dice3D.busy) Dice3D.skip();
  }
  function stepTweens(dt) {
    for (let k = tweens.length - 1; k >= 0; k--) {
      const w = tweens[k];
      w.t = Math.min(w.dur, w.t + dt);
      try { w.fn(w.ez(w.t / w.dur)); } catch (e) { console.warn(e); }
      if (w.t >= w.dur) { tweens.splice(k, 1); w.res(); }
    }
  }
  const later = s => new Promise(r => setTimeout(r, s * 1000));

  // ===== the writing on the squares =====
  const FONT = { sans: "'Noto Sans Georgian', 'Sylfaen', sans-serif", serif: "'Noto Serif Georgian', 'Sylfaen', serif", num: "'Lilita One', 'Arial Rounded MT Bold', sans-serif" };
  const IMG = {};
  let relabelT = 0;
  function pic(name) {
    if (!IMG[name]) {
      const im = new Image();
      im.onload = () => { clearTimeout(relabelT); relabelT = setTimeout(relabelAll, 60); };
      im.src = ART(name);
      IMG[name] = im;
    }
    return IMG[name].complete && IMG[name].naturalWidth ? IMG[name] : null;
  }
  function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
  function fit(x, text, weight, family, size, maxW, min = 12) {
    let s = size;
    for (; s > min; s--) { x.font = `${weight} ${s}px ${family}`; if (x.measureText(text).width <= maxW) break; }
    x.font = `${weight} ${s}px ${family}`;
    return s;
  }
  // a name on one line, or on two (split at a space or a soft hyphen), as large as fits
  function lines(x, name, weight, family, size, maxW, min = 18) {
    const plain = name.replace(/­/g, '');
    for (let s = size; s >= min; s--) {
      x.font = `${weight} ${s}px ${family}`;
      if (x.measureText(plain).width <= maxW) return [plain];
      let best = null;
      for (let k = 1; k < name.length - 1; k++) {
        const ch = name[k];
        if (ch !== ' ' && ch !== '­') continue;
        const a = name.slice(0, k).replace(/­/g, '') + (ch === '­' ? '-' : ''), b = name.slice(k + 1).replace(/­/g, '');
        const w = Math.max(x.measureText(a).width, x.measureText(b).width);
        if (w <= maxW && (!best || w < best.w)) best = { w, l: [a, b] };
      }
      if (best) return best.l;
    }
    x.font = `${weight} ${min}px ${family}`;
    return [plain];
  }
  function coinIcon(x, cx, cy, r) {
    const im = pic('ui_coin');
    if (im) { x.drawImage(im, cx - r, cy - r, r * 2, r * 2); return; }
    x.fillStyle = '#e8b44c'; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#8d5f17'; x.lineWidth = 3; x.stroke();
  }
  function priceLine(x, cx, cy, text, color = '#4a2a12', size = 52) {
    x.font = `400 ${size}px ${FONT.num}`;
    const w = x.measureText(text).width, r = size * 0.36, total = r * 2 + 8 + w, left = cx - total / 2;
    coinIcon(x, left + r, cy, r);
    x.fillStyle = color; x.textAlign = 'left'; x.fillText(text, left + r * 2 + 8, cy + 2);
    x.textAlign = 'center';
  }
  function iconAt(x, name, cx, cy, size) {
    const im = pic(name);
    if (!im) return;
    const k = Math.min(size / im.naturalWidth, size / im.naturalHeight);
    const w = im.naturalWidth * k, h = im.naturalHeight * k;
    x.drawImage(im, cx - w / 2, cy - h / 2, w, h);
  }
  function drawLabel(i) {
    const t = BOARD[i], corner = i % 10 === 0, cw = corner ? 384 : 256, ch = 384, mid = cw / 2;
    const cv = labelCv[i] || (labelCv[i] = document.createElement('canvas'));
    cv.width = cw; cv.height = ch;
    const x = cv.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, ch);
    g.addColorStop(0, '#fcf5e0'); g.addColorStop(1, '#f0dfb3');
    x.fillStyle = g; x.fillRect(0, 0, cw, ch);
    x.strokeStyle = 'rgba(122, 86, 44, .45)'; x.lineWidth = 3; rr(x, 15, 15, cw - 30, ch - 30, 12); x.stroke();
    x.textAlign = 'center'; x.textBaseline = 'middle';
    const ink = '#2c1b10', soft = '#7a5a3a';
    const name = (n, top, bottom, size = 40) => {
      const ls = lines(x, n, 800, FONT.sans, size, cw - 40);
      const lh = parseInt(x.font, 10) * 1.12, y0 = (top + bottom) / 2 - (ls.length - 1) * lh / 2;
      x.fillStyle = ink;
      ls.forEach((l, k) => x.fillText(l, mid, y0 + k * lh));
    };
    if (t.k === 'p' || t.k === 'road' || t.k === 'util') {
      const band = t.k === 'p' ? GROUPS[t.g].c : '#7b5532', bandText = t.k === 'p' ? GROUPS[t.g].n : t.k === 'road' ? 'ქარვასლა' : 'მეურნეობა';
      x.fillStyle = band; rr(x, 18, 18, cw - 36, 80, 10); x.fill();
      x.fillStyle = 'rgba(255, 255, 255, .2)'; rr(x, 18, 18, cw - 36, 14, 7); x.fill();
      x.fillStyle = '#fff'; fit(x, bandText, 800, FONT.sans, 27, cw - 60);
      x.shadowColor = 'rgba(0, 0, 0, .35)'; x.shadowBlur = 4; x.fillText(bandText, mid, 60); x.shadowBlur = 0;
      name(t.k === 'road' ? t.s : t.n, 110, 240);
      x.fillStyle = soft; x.font = `700 21px ${FONT.sans}`; x.fillText('ფასი', mid, 280);
      priceLine(x, mid, 326, String(t.p));
    } else if (t.k === 'scroll' || t.k === 'chest') {
      name(t.k === 'scroll' ? 'ბედის გრაგნილი' : 'საგანძური', 46, 130, 38);
      iconAt(x, t.k === 'scroll' ? 'ui_page' : 'ui_chest_wood', mid, 222, 128);
      x.fillStyle = soft; fit(x, 'აიღე ბარათი', 700, FONT.sans, 25, cw - 50); x.fillText('აიღე ბარათი', mid, 330);
    } else if (t.k === 'tax') {
      name(t.n, 50, 120, 42);
      iconAt(x, t.a > 150 ? 'ui_coinbag' : 'ui_coin', mid, 200, 110);
      x.fillStyle = soft; x.font = `700 22px ${FONT.sans}`; x.fillText('გადაიხადე', mid, 280);
      priceLine(x, mid, 326, String(t.a), '#a3261c');
    } else if (corner) {
      const big = (text, y, color, size = 58) => { x.fillStyle = color; fit(x, text, 900, FONT.serif, size, cw - 50); x.fillText(text, mid, y); };
      const small = (text, y) => { x.fillStyle = soft; fit(x, text, 700, FONT.sans, 26, cw - 50); x.fillText(text, mid, y); };
      if (t.k === 'start') {
        // the big arrow along the way
        x.fillStyle = '#c8372d'; x.strokeStyle = '#7a1d14'; x.lineWidth = 5;
        x.beginPath(); x.moveTo(60, 196); x.lineTo(140, 146); x.lineTo(140, 176); x.lineTo(320, 176); x.lineTo(320, 216); x.lineTo(140, 216); x.lineTo(140, 246); x.closePath(); x.fill(); x.stroke();
        big('სტარტი', 282, '#8d2a1f');
        x.fillStyle = '#2f7a2a'; x.font = `400 40px ${FONT.num}`;
        priceLine(x, mid - 40, 336, '+' + SALARY, '#2f7a2a', 40);
        x.fillStyle = soft; x.font = `700 21px ${FONT.sans}`; x.textAlign = 'left'; x.fillText('ყოველ წრეზე', mid + 34, 338); x.textAlign = 'center';
      } else if (t.k === 'jail') { big('ზინდანი', 290, '#3b2c22'); small('აქ სტუმრად ხარ', 340); }
      else if (t.k === 'feast') { big('სუფრა', 290, '#8d2a1f'); small('დაისვენე', 340); }
      else if (t.k === 'gojail') { big('ზინდანში!', 290, '#8d2a1f', 54); small('მცველი წაგიყვანს', 340); }
    }
    return cv;
  }
  function relabelAll() {
    if (!ok) return;
    for (let i = 0; i < 40; i++) { drawLabel(i); if (labelTex[i]) labelTex[i].needsUpdate = true; }
  }

  // ===== building the board =====
  function slabGeo(w, d, h, r = 0.08, bevel = 0.03, hole = null) {
    const sh = new T.Shape(), x0 = -w / 2 + bevel, y0 = -d / 2 + bevel, ww = w - 2 * bevel, dd = d - 2 * bevel, rad = Math.max(0.001, Math.min(r, ww / 2, dd / 2));
    sh.moveTo(x0 + rad, y0); sh.lineTo(x0 + ww - rad, y0); sh.quadraticCurveTo(x0 + ww, y0, x0 + ww, y0 + rad); sh.lineTo(x0 + ww, y0 + dd - rad);
    sh.quadraticCurveTo(x0 + ww, y0 + dd, x0 + ww - rad, y0 + dd); sh.lineTo(x0 + rad, y0 + dd); sh.quadraticCurveTo(x0, y0 + dd, x0, y0 + dd - rad);
    sh.lineTo(x0, y0 + rad); sh.quadraticCurveTo(x0, y0, x0 + rad, y0);
    if (hole) { const p = new T.Path(), a = hole / 2; p.moveTo(-a, -a); p.lineTo(-a, a); p.lineTo(a, a); p.lineTo(a, -a); p.closePath(); sh.holes.push(p); }
    const g = new T.ExtrudeGeometry(sh, { depth: Math.max(0.001, h - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 3 });
    g.rotateX(-Math.PI / 2); g.translate(0, bevel, 0);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let k = 0; k < p.count; k++) uv.setXY(k, p.getX(k) / w + 0.5, -p.getZ(k) / d + 0.5);
    return g;
  }
  function makeMaterials() {
    mats = {
      scenery: new T.MeshLambertMaterial({ vertexColors: true }),
      plinthTop: new T.MeshLambertMaterial({ color: 0x4a2e1a }),
      plinthSide: new T.MeshLambertMaterial({ color: 0x6b4528 }),
      gold: new T.MeshLambertMaterial({ color: 0xe0ad45 }),
      stone: new T.MeshLambertMaterial({ vertexColors: true }),
      pole: new T.MeshLambertMaterial({ color: 0x4a3020 })
    };
    ownerMats = SEAT_COLORS.map(c => new T.MeshLambertMaterial({ color: c }));
  }
  function buildStatic() {
    root = new T.Group();
    scene.add(root);
    // the plinth with a gold rim, and a soft shadow on the landscape under it
    const pl = new T.Mesh(slabGeo(S + 0.9, S + 0.9, 0.5, 0.35, 0.06), [mats.plinthTop, mats.plinthSide]);
    pl.position.y = -0.5; pl.receiveShadow = true; root.add(pl);
    const rim = new T.Mesh(slabGeo(S + 0.98, S + 0.98, 0.07, 0.38, 0.02, S + 0.62), mats.gold);
    rim.position.y = -0.02; root.add(rim);
    const sc = document.createElement('canvas'); sc.width = sc.height = 128;
    const sx = sc.getContext('2d'), gr = sx.createRadialGradient(64, 64, 20, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    sx.fillStyle = gr; sx.fillRect(0, 0, 128, 128);
    const sh = new T.Mesh(new T.PlaneGeometry(S * 1.7, S * 1.7), new T.MeshBasicMaterial({ map: new T.CanvasTexture(sc), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = -0.62; root.add(sh);
    // the painting in the middle, in a gold frame
    const inner = S - 2 * D - 2 * LOT;
    const tex = new T.TextureLoader().load(ART('g_svan'), tx => { const a = tx.image.width / tx.image.height; if (a > 1) { tx.repeat.set(1 / a, 1); tx.offset.set((1 - 1 / a) / 2, 0); } });
    tex.encoding = T.sRGBEncoding; tex.anisotropy = maxAniso;
    const pic = new T.Mesh(new T.PlaneGeometry(inner - 0.12, inner - 0.12), new T.MeshLambertMaterial({ map: tex }));
    pic.rotation.x = -Math.PI / 2; pic.position.y = 0.045; pic.receiveShadow = true; root.add(pic);
    const fr = new T.Mesh(slabGeo(inner + 0.08, inner + 0.08, 0.08, 0.06, 0.015, inner - 0.12), mats.gold);
    root.add(fr);
    // the squares
    const geoP = slabGeo(TW - 0.06, D - 0.06, TH, 0.07, 0.03), geoC = slabGeo(C - 0.06, C - 0.06, TH, 0.1, 0.03);
    const grounds = new Models.Builder();
    for (let i = 0; i < 40; i++) {
      const cv = drawLabel(i), tx = new T.CanvasTexture(cv);
      tx.encoding = T.sRGBEncoding; tx.anisotropy = maxAniso;
      labelTex[i] = tx;
      labelMat[i] = new T.MeshLambertMaterial({ map: tx });
      sideMat[i] = new T.MeshLambertMaterial({ color: 0xe9d6a8 });
      const m = new T.Mesh(i % 10 ? geoP : geoC, [labelMat[i], sideMat[i]]);
      const c = centerOf(i);
      m.position.set(c.x, 0, c.z); m.rotation.y = yawOf(sideOf(i));
      m.receiveShadow = true;
      m.userData.i = i;
      root.add(m); tiles[i] = m;
      // the lot behind it: its ground and its scenery
      if (i % 10) {
        const t = BOARD[i], gc = t.k === 'p' ? Models.GROUND[t.g] : t.k === 'road' ? 0xc9b88e : t.k === 'util' ? 0x9cbc66 : 0xbfc08c;
        const lc = toWorld(i, 0, -(D / 2 + LOT / 2));
        grounds.add(new T.BoxGeometry(TW, 0.05, LOT).translate(0, 0.025, 0), gc, lc.x, 0, lc.z, { ry: yawOf(sideOf(i)) });
        const lg = Models.lot(i);
        if (lg) {
          lg.scale(1.18, 1.25, 1.12);
          const lm = new T.Mesh(lg, mats.scenery);
          lm.position.set(lc.x, 0.05, lc.z); lm.rotation.y = yawOf(sideOf(i));
          lm.castShadow = true; lm.receiveShadow = true; lm.userData.i = i;
          root.add(lm); lotMesh[i] = lm;
        }
      } else {
        const cg = Models.corner(i);
        if (cg) { const cm = new T.Mesh(cg, mats.scenery); cm.position.set(0, TH, 0); m.add(cm); cm.castShadow = true; cm.receiveShadow = true; cm.userData.i = i; lotMesh[i] = cm; }
      }
    }
    // the inside corners of the ring
    for (let k = 0; k < 4; k++) {
      const [ox, oz] = OUT[k], [ax, az] = ALONG[k], a = S / 2 - D - LOT / 2;
      const x = ox * a - ax * a, z = oz * a - az * a;
      grounds.add(new T.BoxGeometry(LOT, 0.05, LOT).translate(0, 0.025, 0), [0x8fb85e, 0x9fa889, 0x96b45a, 0xa8b07c][k], x, 0, z);
      const ig = Models.inner(k); ig.scale(1.2, 1.3, 1.2);
      const sm = new T.Mesh(ig, mats.scenery);
      sm.position.set(x, 0.05, z); sm.rotation.y = yawOf(k); sm.castShadow = true; sm.receiveShadow = true; root.add(sm);
      lotMesh[100 + k] = sm;
    }
    const gmesh = new T.Mesh(grounds.build(), mats.scenery);
    gmesh.receiveShadow = true; gmesh.userData.ground = true;
    root.add(gmesh); lotGround.push(gmesh);
    buildingMeshes();
    // the mill's wheel turns
    const M = Models.shapes, WB = new Models.Builder();
    WB.add(new T.TorusGeometry(0.1, 0.014, 5, 14), 0x4a3020);
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; WB.add(new T.BoxGeometry(0.02, 0.09, 0.05), 0x7a5232, Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0, { rz: a }); }
    const wg = new T.Mesh(WB.build(), mats.scenery);
    wg.rotation.y = Math.PI / 2; wg.castShadow = true;
    const wpos = toWorld(12, 0.17, -(D / 2 + LOT / 2) - 0.12, 0.16);
    wheel = new T.Group(); wheel.add(wg); wheel.position.copy(wpos); wheel.rotation.y = yawOf(1); wheel.castShadow = true;
    root.add(wheel);
    // clouds drifting over the mountains
    for (let k = 0; k < 0; k++) {
      const B = new Models.Builder(), r = Models.rng(k + 5);
      for (let j = 0; j < 5; j++) B.add(M.ball(0.18 + r() * 0.14, 1), 0xffffff, (j - 2) * 0.2, r() * 0.1, (r() - 0.5) * 0.2, { sy: 0.65 });
      const cm = new T.Mesh(B.build(), new T.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.92 }));
      cm.userData = { a: k * 1.3, r: 8.2 + r() * 1.8, h: 1.2 + r() * 1.2, sp: 0.02 + r() * 0.02 };
      cm.castShadow = true;
      root.add(cm); clouds.push(cm);
    }
  }

  // ===== owners: the flag on the lot, towers on the colour band, the square's sides in the owner's colour =====
  function flagFor(i) {
    if (flags[i]) return flags[i];
    const g = new T.Group();
    if (!mats.poleGeo) { const B = new Models.Builder(); B.add(Models.shapes.cyl(0.011, 0.014, 0.62, 6), 0x4a3020); B.add(new T.SphereGeometry(0.022, 8, 6), 0xe0ad45, 0, 0.63, 0); mats.poleGeo = B.build(); }
    const pole = new T.Mesh(mats.poleGeo, mats.scenery);
    pole.castShadow = true; g.add(pole);
    const cg = new T.PlaneGeometry(0.26, 0.16, 8, 1);
    cg.translate(0.13, 0, 0);
    const cloth = new T.Mesh(cg, new T.MeshLambertMaterial({ color: 0xffffff, side: T.DoubleSide }));
    cloth.position.set(0.012, 0.52, 0); cloth.castShadow = true;
    cloth.userData.base = Float32Array.from(cg.attributes.position.array);
    g.add(cloth);
    const p = toWorld(i, 0.38, -(D / 2) + 0.03, 0.05);
    g.position.copy(p); g.rotation.y = yawOf(sideOf(i));
    g.visible = false;
    root.add(g);
    flags[i] = { g, cloth, h: 1 };
    return flags[i];
  }
  const towerSlots = [[], [0], [-0.17, 0.17], [-0.28, 0, 0.28], [-0.33, -0.11, 0.11, 0.33]];
  // all the towers of the board are drawn as one instanced mesh (and the fortresses as another), roofs coloured per copy
  const BLD = { ready: false, grow: {}, busy: 0 };
  function buildingMeshes() {
    const tw = Models.tower(), ca = Models.castle();
    const roofMat = new T.MeshLambertMaterial({ color: 0xffffff });
    BLD.tb = new T.InstancedMesh(tw.body, mats.stone, 96); BLD.tr = new T.InstancedMesh(tw.roof, roofMat, 96);
    BLD.cb = new T.InstancedMesh(ca.body, mats.stone, 24); BLD.cr = new T.InstancedMesh(ca.roof, roofMat, 24);
    BLD.tr.setColorAt(0, new T.Color(0xffffff)); BLD.cr.setColorAt(0, new T.Color(0xffffff));      // so the shader is made with colours per copy
    for (const m of [BLD.tb, BLD.tr, BLD.cb, BLD.cr]) { m.count = 0; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; root.add(m); }
    BLD.ready = true;
  }
  const _m = new T.Matrix4(), _q = new T.Quaternion(), _s = new T.Vector3(), _c = new T.Color(), _up = new T.Vector3(0, 1, 0);
  function layoutBuildings(now) {
    if (!BLD.ready) return;
    let nt = 0, nc = 0, anim = 0;
    for (let i = 0; i < 40; i++) {
      const k = mark[i];
      if (!k || k.o < 0 || !k.lv) continue;
      _c.set(SEAT_COLORS[k.o] || '#888');
      if (k.m) _c.lerp(new T.Color(0x777777), 0.5);
      _q.setFromAxisAngle(_up, yawOf(sideOf(i)));
      const castle = k.lv >= 5, slots = castle ? [0] : towerSlots[k.lv];
      slots.forEach((x, j) => {
        const g = BLD.grow[i + ':' + (castle ? 'c' : j)];
        let sc = 1;
        if (g != null) { const e = Math.min(1, (now - g) / 450); sc = Math.max(0.001, ease.back(e)); if (e < 1) anim++; else delete BLD.grow[i + ':' + (castle ? 'c' : j)]; }
        const p = toWorld(i, x, -D / 2 + 0.2, tiles[i] ? tiles[i].position.y + TH : TH);
        _m.compose(p, _q, _s.set(sc, sc, sc));
        if (castle) { BLD.cb.setMatrixAt(nc, _m); BLD.cr.setMatrixAt(nc, _m); BLD.cr.setColorAt(nc, _c); nc++; }
        else { BLD.tb.setMatrixAt(nt, _m); BLD.tr.setMatrixAt(nt, _m); BLD.tr.setColorAt(nt, _c); nt++; }
      });
    }
    BLD.tb.count = BLD.tr.count = nt; BLD.cb.count = BLD.cr.count = nc;
    for (const m of [BLD.tb, BLD.tr, BLD.cb, BLD.cr]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    BLD.busy = anim;
  }
  function placeBuildings(i, lv, seat, anim, prev) {
    if (anim && lv > (prev || 0)) {
      const now = performance.now();
      if (lv >= 5) BLD.grow[i + ':c'] = now; else for (let j = Math.min(prev || 0, 4); j < lv; j++) BLD.grow[i + ':' + j] = now;
      if (lv < 5) dust(toWorld(i, towerSlots[lv][lv - 1], -D / 2 + 0.2, TH)); else dust(toWorld(i, 0, -D / 2 + 0.2, TH));
    }
    layoutBuildings(performance.now());
  }
  function dust(p) {
    if (!ok) return;
    for (let k = 0; k < 6; k++) {
      const m = new T.Mesh(new T.IcosahedronGeometry(0.05, 0), new T.MeshBasicMaterial({ color: 0xe8dcc4, transparent: true, opacity: 0.8 }));
      const a = k * Math.PI / 3;
      m.position.set(p.x, TH + 0.04, p.z); root.add(m);
      tween(0.55, e => { m.position.set(p.x + Math.cos(a) * 0.25 * e, TH + 0.04 + 0.1 * e, p.z + Math.sin(a) * 0.25 * e); m.material.opacity = 0.8 * (1 - e); m.scale.setScalar(1 + e); }, ease.out).then(() => root.remove(m));
    }
  }
  const CREAM = new T.Color(0xe9d6a8);
  function setOwner(i, seat, anim) {
    if (!ok || !OWNABLE(BOARD[i])) return;
    const k = mark[i] || (mark[i] = { o: -1, lv: 0, m: false });
    const was = k.o;
    k.o = seat;
    sideMat[i].color.copy(CREAM);
    if (seat >= 0) sideMat[i].color.lerp(new T.Color(SEAT_COLORS[seat]), 0.6);
    const f = flagFor(i);
    if (seat < 0) { f.g.visible = false; layoutBuildings(performance.now()); return; }
    f.cloth.material.color.set(SEAT_COLORS[seat]);
    f.g.visible = true;
    layoutBuildings(performance.now());
    if (anim && was !== seat) {
      f.cloth.position.y = 0.12;
      tween(0.7, e => { f.cloth.position.y = 0.12 + (topOf(k) - 0.12) * e; }, ease.out);
      pop(i);
    } else f.cloth.position.y = topOf(k);
  }
  const topOf = k => k.m ? 0.3 : 0.52;
  function setLevel(i, lv, anim) {
    if (!ok || BOARD[i].k !== 'p') return;
    const k = mark[i] || (mark[i] = { o: -1, lv: 0, m: false });
    const prev = k.lv;
    k.lv = lv;
    placeBuildings(i, lv, k.o, anim, prev);
    if (anim) pop(i, 0.06);
  }
  function setMort(i, m, anim) {
    if (!ok || !OWNABLE(BOARD[i])) return;
    const k = mark[i] || (mark[i] = { o: -1, lv: 0, m: false });
    k.m = m;
    layoutBuildings(performance.now());
    labelMat[i].color.set(m ? 0x9b8f7a : 0xffffff);
    if (lotMesh[i]) lotMesh[i].material = m ? (mats.mortScenery || (mats.mortScenery = new T.MeshLambertMaterial({ vertexColors: true, color: 0x8a8a8a }))) : mats.scenery;
    const f = flags[i];
    if (f && f.g.visible) {
      const to = topOf(k), from = f.cloth.position.y;
      if (anim) tween(0.5, e => { f.cloth.position.y = from + (to - from) * e; }); else f.cloth.position.y = to;
      f.cloth.material.color.set(SEAT_COLORS[k.o] || '#888');
      if (m) f.cloth.material.color.lerp(new T.Color(0x777777), 0.55);
    }
  }
  // a square's scenery jumps up a little (bought, built on)
  function pop(i, amt = 0.14) {
    const m = lotMesh[i];
    if (!m) return;
    tween(0.5, e => { const s = 1 + Math.sin(e * Math.PI) * amt; m.scale.set(1, s, 1); }, ease.lin);
  }
  // a whole region has one owner: its lots jump one after another and confetti flies
  function celebrate(g, seat) {
    if (!ok) return;
    GROUP_TILES[g].forEach((i, k) => later(k * 0.18).then(() => { pop(i, 0.28); confetti(toWorld(i, 0, -(D / 2 + LOT / 2), 0.6), seat); }));
  }
  let confGeo = null;
  function confetti(p, seat) {
    if (REDUCED) return;
    confGeo = confGeo || new T.BoxGeometry(0.05, 0.05, 0.012);
    const cols = [SEAT_COLORS[seat] || '#e8b44c', '#e8b44c', '#fff4da'];
    for (let k = 0; k < 14; k++) {
      const m = new T.Mesh(confGeo, new T.MeshBasicMaterial({ color: cols[k % 3], transparent: true }));
      const a = Math.random() * Math.PI * 2, sp = 0.4 + Math.random() * 0.6, up = 1.2 + Math.random() * 1.2, spin = (Math.random() - 0.5) * 16;
      m.position.copy(p); root.add(m);
      tween(1.1, e => {
        m.position.set(p.x + Math.cos(a) * sp * e, p.y + up * e - 1.9 * e * e, p.z + Math.sin(a) * sp * e);
        m.rotation.set(spin * e, spin * 0.7 * e, 0);
        m.material.opacity = e > 0.7 ? (1 - e) / 0.3 : 1;
      }, ease.lin).then(() => { root.remove(m); m.material.dispose(); });
    }
  }
  // money changing hands: coins fly from one figure to another (or up into the air: to the treasury)
  let coinGeo = null, coinMat = null;
  function coins(from, to, amount) {
    if (!ok || REDUCED || !toks[from]) return;
    coinGeo = coinGeo || new T.CylinderGeometry(0.07, 0.07, 0.02, 14);
    coinMat = coinMat || new T.MeshLambertMaterial({ color: 0xf0c050 });
    const a = toks[from].g.position.clone().add(new T.Vector3(0, 0.6, 0));
    const b = to >= 0 && toks[to] && toks[to].g.visible ? toks[to].g.position.clone().add(new T.Vector3(0, 0.6, 0)) : a.clone().add(new T.Vector3(0, 2.4, 0));
    const n = Math.min(9, 3 + Math.round(amount / 60));
    for (let k = 0; k < n; k++) {
      const m = new T.Mesh(coinGeo, coinMat);
      m.position.copy(a); m.visible = false; root.add(m);
      const lift = 1 + Math.random() * 0.6, jx = (Math.random() - 0.5) * 0.4, jz = (Math.random() - 0.5) * 0.4;
      later(k * 0.06).then(() => {
        m.visible = true;
        return tween(0.65, e => {
          m.position.set(a.x + (b.x - a.x) * e + jx * Math.sin(Math.PI * e), a.y + (b.y - a.y) * e + lift * Math.sin(Math.PI * e), a.z + (b.z - a.z) * e + jz * Math.sin(Math.PI * e));
          m.rotation.set(e * 9, e * 4, 0);
          const s = e > 0.85 ? (1 - e) / 0.15 : 1; m.scale.setScalar(Math.max(0.001, s));
        }, ease.inOut);
      }).then(() => root.remove(m));
    }
  }
  function bounceTile(i) {
    const m = tiles[i];
    if (!m) return;
    tween(0.28, e => { m.position.y = -Math.sin(e * Math.PI) * 0.06; }, ease.lin);
  }

  // ===== the players' figures: a coin with the hero's face on a pedestal of the player's colour =====
  const texLoader = () => new T.TextureLoader();
  let goldRim = null;
  function makeToken(seat, hero) {
    const color = new T.Color(SEAT_COLORS[seat]);
    const g = new T.Group();
    const ped = new T.Mesh(new T.CylinderGeometry(0.16, 0.19, 0.07, 24), new T.MeshLambertMaterial({ color }));
    ped.position.y = 0.035; ped.castShadow = true; ped.receiveShadow = true;
    const stem = new T.Mesh(new T.CylinderGeometry(0.03, 0.045, 0.14, 10), mats.gold);
    stem.position.y = 0.13; stem.castShadow = true;
    const face = new T.Group();
    face.rotation.order = 'YXZ';
    face.position.y = 0.43;
    goldRim = goldRim || new T.MeshLambertMaterial({ color: 0xd9a443 });
    const tx = texLoader().load(ART('por_h_' + hero));
    tx.encoding = T.sRGBEncoding;
    const pm = new T.MeshLambertMaterial({ map: tx });
    const coinG = new T.CylinderGeometry(0.24, 0.24, 0.06, 40);
    const coin = new T.Mesh(coinG, [goldRim, pm, goldRim]);
    coin.rotation.x = Math.PI / 2;
    coin.rotation.y = Math.PI / 2;           // the face upright
    coin.castShadow = true;
    const ring = new T.Mesh(new T.TorusGeometry(0.245, 0.03, 8, 40), new T.MeshLambertMaterial({ color }));
    ring.position.z = 0.012;
    face.add(coin, ring);
    // the glow under whoever's turn it is
    const glow = new T.Mesh(new T.TorusGeometry(0.27, 0.035, 8, 40), new T.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.85 }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.02; glow.visible = false;
    g.add(ped, stem, face, glow);
    root.add(g);
    return { g, face, coin, pm, glow, hero, seat, hop: 0 };
  }
  function ensureTokens() {
    for (let s = 0; s < st.players.length; s++) {
      const p = st.players[s];
      if (!toks[s]) toks[s] = makeToken(s, p.hero);
      else if (toks[s].hero !== p.hero) {
        const tx = texLoader().load(ART('por_h_' + p.hero)); tx.encoding = T.sRGBEncoding;
        toks[s].pm.map = tx; toks[s].pm.needsUpdate = true; toks[s].hero = p.hero;
      }
      toks[s].g.visible = !p.out;
    }
    for (let s = st.players.length; s < toks.length; s++) if (toks[s]) toks[s].g.visible = false;
  }
  const jailedNow = s => !!(st.players[s] && st.players[s].jail && pos[s] === JAIL);
  function spot(seat, at) {
    const caught = jailedNow(seat);
    const here = st.players.map((p, s) => s).filter(s => !st.players[s].out && pos[s] === at && jailedNow(s) === caught);
    const k = Math.max(0, here.indexOf(seat)), n = Math.max(1, here.length);
    const cols = n <= 2 ? n : n <= 4 ? 2 : 3, rows = Math.ceil(n / cols);
    const gx = (k % cols) - (cols - 1) / 2, gz = Math.floor(k / cols) - (rows - 1) / 2;
    if (at === JAIL && caught) return toWorld(at, -0.08 + gx * 0.22, -0.3 + gz * 0.14, TH + 0.03);
    const corner = at % 10 === 0;
    return toWorld(at, gx * (corner ? 0.34 : 0.3), (corner ? 0.3 : 0.33) + gz * 0.2, TH);
  }
  function placeTokens(anim) {
    if (!ok || !st) return;
    st.players.forEach((p, s) => {
      const tk = toks[s];
      if (!tk || p.out) return;
      const to = spot(s, pos[s]);
      if (anim) { const from = tk.g.position.clone(); tween(0.25, e => tk.g.position.lerpVectors(from, to, e)); }
      else tk.g.position.copy(to);
    });
  }
  function hop(seat, a, b, dur = 0.2) {
    const tk = toks[seat];
    if (!tk) return Promise.resolve();
    const p0 = tk.g.position.clone(), p1 = spot(seat, b);
    return tween(dur, e => {
      tk.g.position.lerpVectors(p0, p1, e);
      tk.g.position.y = p0.y + (p1.y - p0.y) * e + Math.sin(Math.PI * e) * 0.42;
      const sq = e > 0.85 ? 1 - (e - 0.85) * 1.2 : 1;
      tk.g.scale.set(1, sq, 1);
    }, ease.lin).then(() => tk.g.scale.set(1, 1, 1));
  }
  async function walk(seat, from, to, n) {
    if (!ok || !toks[seat]) { pos[seat] = to; return; }
    const dir = n > 0 ? 1 : -1, my = epoch;
    let at = from;
    for (let k = 0; k < Math.abs(n); k++) {
      const next = (at + dir + 40) % 40;
      pos[seat] = next;
      await hop(seat, at, next, REDUCED ? 0.05 : 0.19);
      at = next;
      if (epoch !== my) return;                   // halted: the board has been set to the present meanwhile
      bounceTile(at);
      Sound.step();
    }
    if (epoch !== my) return;
    pos[seat] = to;
    placeTokens(true);
  }
  async function fly(seat, to) {
    if (!ok || !toks[seat]) { pos[seat] = to; return; }
    const tk = toks[seat], p0 = tk.g.position.clone(), my = epoch;
    pos[seat] = to;
    const p1 = spot(seat, to);
    await tween(REDUCED ? 0.1 : 0.75, e => { tk.g.position.lerpVectors(p0, p1, e); tk.g.position.y += Math.sin(Math.PI * e) * 2.2; }, ease.inOut);
    if (epoch !== my) return;
    bounceTile(to);
    placeTokens(true);
  }
  function setTurn(seat) {
    turnSeat = seat;
    toks.forEach((tk, s) => { if (tk) tk.glow.visible = s === seat; });
  }

  // ===== the camera: it follows the figure whose turn it is and turns so that its side of the board is nearest =====
  const camS = { x: 0, y: 0, z: 0, d: 20, yaw: 0, el: 1 }, camT = { x: 0, y: 0, z: 0, d: 20, yaw: 0, el: 1 };
  let mode = 'follow', modeSet = false, focusSeat = -1, followD = 11, overD = 24, elFollow = 0.9, elOver = 1.05, camInit = false;
  function aim() {
    let s = 0;
    if (focusSeat >= 0 && toks[focusSeat] && st && st.players[focusSeat] && !st.players[focusSeat].out) {
      const at = pos[focusSeat];
      s = sideOf(at);
      if (mode === 'follow') {
        // look a little inwards and ahead along the way, so the squares coming up are in view
        const p = toks[focusSeat].g.position, [ox, oz] = OUT[s], [ax, az] = ALONG[s];
        const f = clamp((overD - followD) / (overD * 0.35), 0, 1);    // on a big screen the whole board is in view anyway
        camT.x = (p.x - ox * 2.0 + ax * 1.0) * f; camT.z = (p.z - oz * 2.0 + az * 1.0) * f; camT.y = 0.3 * f; camT.d = followD; camT.el = elFollow;
      }
    } else if (st && st.turn >= 0 && pos[st.turn] != null) s = sideOf(pos[st.turn]);
    if (mode !== 'follow' || focusSeat < 0) { camT.x = 0; camT.z = 0; camT.y = 0; camT.d = overD; camT.el = elOver; }
    let y = yawOf(s);
    y += Math.PI * 2 * Math.round((camS.yaw - y) / (Math.PI * 2));
    camT.yaw = y;
  }
  function moveCamera(dt) {
    aim();
    const k = camInit ? 1 - Math.exp(-dt * 3.2) : 1, ky = camInit ? 1 - Math.exp(-dt * 2.6) : 1;
    camInit = true;
    for (const f of ['x', 'y', 'z', 'd', 'el']) camS[f] += (camT[f] - camS[f]) * k;
    camS.yaw += (camT.yaw - camS.yaw) * ky;
    const ce = Math.cos(camS.el);
    cam.position.set(camS.x + camS.d * ce * Math.sin(camS.yaw), camS.y + camS.d * Math.sin(camS.el), camS.z + camS.d * ce * Math.cos(camS.yaw));
    cam.lookAt(camS.x, camS.y, camS.z);
    // the sun turns with the camera, so the side in front is always lit from the front left
    const a = camS.yaw;
    sun.position.set(-6 * Math.cos(a) + 7 * Math.sin(a), 12, 6 * Math.sin(a) + 7 * Math.cos(a));
  }
  function distances() {
    const vf = cam.fov * Math.PI / 180, aspect = W / H, hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
    // follow: about this many squares across the screen (fewer on a phone, so the writing can be read)
    const across = clamp(W / 80, 4.6, 12);
    followD = clamp((across / 2) / Math.tan(hf / 2), 7, 40);
    const vis = 2 * followD * Math.tan(vf / 2);
    if (vis < 6.2) followD = 6.2 / (2 * Math.tan(vf / 2));
    // overview: the whole board fits
    elOver = W > H ? 0.95 : 1.08; elFollow = W > H ? 0.74 : 0.8;
    const pts = [];
    for (const x of [-S / 2 - 0.5, S / 2 + 0.5]) for (const z of [-S / 2 - 0.5, S / 2 + 0.5]) for (const y of [-0.5, 1.2]) pts.push(new T.Vector3(x, y, z));
    const c2 = cam.clone();
    let lo = 6, hi = 90;
    for (let it = 0; it < 22; it++) {
      const d = (lo + hi) / 2, ce = Math.cos(elOver);
      c2.position.set(0, d * Math.sin(elOver), d * ce); c2.lookAt(0, 0, 0); c2.updateMatrixWorld(); c2.updateProjectionMatrix();
      const inside = pts.every(p => { const v = p.clone().project(c2); return Math.abs(v.x) < 0.96 && Math.abs(v.y) < 0.94 && v.z < 1; });
      if (inside) hi = d; else lo = d;
    }
    overD = hi;
    if (followD > overD) followD = overD;
  }
  function resize() {
    if (!ok || !host) return;
    const r = host.getBoundingClientRect();
    W = Math.max(50, r.width); H = Math.max(50, r.height);
    // a big screen shows the whole board, a phone follows the figure (the button switches)
    if (!modeSet) mode = Math.min(W, H) > 560 ? 'overview' : 'follow';
    R.setSize(W, H, false);
    cam.aspect = W / H; cam.updateProjectionMatrix();
    distances();
    Dice3D.layout(W, H);
    if (running) draw(0);                          // a resized canvas is blank until drawn: draw it now, not a frame later
  }

  // ===== tapping a square =====
  let down = null;
  function onDown(ev) { down = { x: ev.clientX, y: ev.clientY, t: performance.now() }; }
  function onUp(ev) {
    if (!down) return;
    const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y), dt = performance.now() - down.t;
    down = null;
    if (moved > 12 || dt > 600 || !pickCb) return;
    const r = host.getBoundingClientRect();
    const v = new T.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(v, cam);
    const objs = [...tiles, ...lotGround, ...lotMesh.filter(Boolean)];
    const hit = ray.intersectObjects(objs, false)[0];
    if (!hit) return;
    let o = hit.object;
    if (o.userData.ground) {
      // the lot whose rectangle holds the point
      for (let i = 0; i < 40; i++) {
        if (!(i % 10)) continue;
        const c = toWorld(i, 0, -(D / 2 + LOT / 2)), r = yawOf(sideOf(i)), dx = hit.point.x - c.x, dz = hit.point.z - c.z;
        const lx = dx * Math.cos(r) - dz * Math.sin(r), lz = dx * Math.sin(r) + dz * Math.cos(r);
        if (Math.abs(lx) <= TW / 2 && Math.abs(lz) <= LOT / 2) return pickCb(i);
      }
      return;
    }
    while (o && o.userData.i == null) o = o.parent;
    if (o && o.userData.i != null && o.userData.i < 40) pickCb(o.userData.i);
  }

  // ===== the frame loop =====
  // quality follows the device: when frames come slowly the picture gets fewer pixels, then loses its shadows
  let last = 0, running = false, frame = 0, slow = 0, quality = 2, basePR = 1;
  function adapt(real) {
    if (real > 0.2) return;                       // a hiccup (a tab switch), not the device
    slow = slow * 0.97 + (real > 1 / 26 ? 1 : 0) * 0.03;
    if (frame % 90 || frame < 120 || slow < 0.55 || quality <= 0) return;
    quality--;
    slow = 0;
    if (quality === 1) { R.setPixelRatio(Math.max(1, basePR * 0.7)); resize(); }
    if (quality === 0) { R.setPixelRatio(1); R.shadowMap.enabled = false; scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); }); resize(); }
  }
  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);
    const real = last ? (now - last) / 1000 : 0.016, dt = Math.min(0.25, real);
    last = now;
    frame++;
    adapt(real);
    if (riseAt && frame >= riseAt) riseGo();
    stepTweens(dt * speedK);
    moveCamera(dt * speedK);
    const t = now / 1000;
    // the figures face the camera; the one whose turn it is glows
    for (const tk of toks) {
      if (!tk || !tk.g.visible) continue;
      tk.face.rotation.y = Math.atan2(cam.position.x - tk.g.position.x, cam.position.z - tk.g.position.z);
      tk.face.rotation.x = -camS.el * 0.6;
      if (tk.glow.visible) { const s = 1 + Math.sin(t * 4) * 0.08; tk.glow.scale.set(s, s, s); tk.glow.material.opacity = 0.6 + Math.sin(t * 4) * 0.25; }
    }
    // flags wave, the wheel turns, clouds drift
    for (const f of flags) {
      if (!f || !f.g.visible) continue;
      const p = f.cloth.geometry.attributes.position, b = f.cloth.userData.base;
      for (let k = 0; k < p.count; k++) { const x = b[k * 3]; p.array[k * 3 + 2] = Math.sin(t * 5 + x * 22 + f.g.position.x) * 0.025 * (x / 0.26); }
      p.needsUpdate = true;
    }
    if (wheel) wheel.children[0].rotation.z = t * 1.4;
    if (BLD.busy || tweens.length) layoutBuildings(now);
    for (const c of clouds) { const u = c.userData; u.a += dt * u.sp; c.position.set(Math.cos(u.a) * u.r, u.h, Math.sin(u.a) * u.r); }
    const still = !tweens.length && !BLD.busy && !Dice3D.busy && Math.abs(camT.yaw - camS.yaw) < 0.002 && Math.abs(camT.d - camS.d) < 0.01 && Math.abs(camT.x - camS.x) < 0.005 && Math.abs(camT.z - camS.z) < 0.005;
    if (still && frame % 2) return;          // nothing but flags and glows moving: half the frames are enough
    draw((still ? dt * 2 : dt) * speedK);
  }
  function draw(diceDt) {
    R.setViewport(0, 0, W, H); R.setScissorTest(false);
    R.clear();
    R.render(scene, cam);
    Dice3D.frame(R, diceDt);
  }
  function start() {
    if (running || !ok) return;
    running = true; last = 0;
    requestAnimationFrame(loop);
  }
  function stop() { running = false; }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') stop(); else if (built) start(); });

  // ===== the rise: the squares come up and the scenery grows when a game appears =====
  // everything goes down at once; it comes up a few frames later, when the first (slow) frame has been drawn
  let riseAt = 0;
  function rise() {
    if (!ok || REDUCED) return;
    for (let i = 0; i < 40; i++) { tiles[i].position.y = -0.6; if (lotMesh[i]) lotMesh[i].scale.set(1, 0.001, 1); }
    for (let k = 0; k < 4; k++) if (lotMesh[100 + k]) lotMesh[100 + k].scale.set(1, 0.001, 1);
    riseAt = frame + 3;
  }
  function riseGo() {
    riseAt = 0;
    for (let i = 0; i < 40; i++) {
      const m = tiles[i], l = lotMesh[i], d = (i / 40) * 0.9;
      later(d).then(() => tween(0.45, e => { m.position.y = -0.6 + 0.6 * e; }, ease.back));
      if (l) later(d + 0.25).then(() => tween(0.6, e => l.scale.set(1, Math.max(0.001, e), 1), ease.back));
    }
    for (let k = 0; k < 4; k++) { const l = lotMesh[100 + k]; if (l) later(0.3 + k * 0.25).then(() => tween(0.7, e => l.scale.set(1, Math.max(0.001, e), 1), ease.back)); }
  }

  // ===== public =====
  function init(el) {
    host = el;
    if (ok) { if (R.domElement.parentNode !== el) el.appendChild(R.domElement); resize(); return true; }
    if (!T || !Models || /[?&]nogl\b/.test(location.search)) return false;
    try {
      R = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (e) { console.warn('no WebGL', e); return false; }
    const mobile = Math.min(screen.width, screen.height) < 700;
    basePR = Math.min(window.devicePixelRatio || 1, mobile ? 2 : 1.75);
    if (/[?&]lq\b/.test(location.search)) { basePR = 1; quality = 0; }
    R.setPixelRatio(basePR);
    R.outputEncoding = T.sRGBEncoding;
    R.shadowMap.enabled = quality > 0; R.shadowMap.type = T.PCFSoftShadowMap;
    R.setClearColor(0x000000, 0);
    R.autoClear = false;
    maxAniso = Math.min(8, R.capabilities.getMaxAnisotropy());
    const cv = R.domElement;
    cv.className = 'board3d';
    el.appendChild(cv);
    scene = new T.Scene();
    cam = new T.PerspectiveCamera(32, 1, 0.5, 200);
    scene.add(new T.HemisphereLight(0xe6f2ff, 0x8a6a48, 0.62));
    sun = new T.DirectionalLight(0xfff0d6, 1.0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(mobile ? 1536 : 2048, mobile ? 1536 : 2048);
    const sc = sun.shadow.camera; sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 2; sc.far = 40;
    sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02;
    scene.add(sun); scene.add(sun.target);
    ray = new T.Raycaster();
    ok = true;
    makeMaterials();
    buildStatic();
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('webglcontextlost', e => { e.preventDefault(); stop(); });
    cv.addEventListener('webglcontextrestored', () => { start(); });
    if (document.fonts) {
      Promise.all(['800 40px "Noto Sans Georgian"', '900 50px "Noto Serif Georgian"', '400 50px "Lilita One"'].map(f => document.fonts.load(f, 'ქალაქი 120').catch(() => null))).then(relabelAll);
      document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', () => { clearTimeout(relabelT); relabelT = setTimeout(relabelAll, 60); });
    }
    Dice3D.init(T, host);
    if (window.ResizeObserver) new ResizeObserver(() => resize()).observe(el);
    window.addEventListener('resize', resize);
    resize();
    return true;
  }
  // a game appears (a new one, or after joining): everything set from the state, the board rises
  function show(state, positions, animate) {
    if (!ok) return;
    st = state; pos = positions.slice();
    ensureTokens();
    for (let i = 0; i < 40; i++) {
      if (!OWNABLE(BOARD[i])) continue;
      const o = st.own[i];
      setOwner(i, o ? o.o : -1, false);
      if (BOARD[i].k === 'p') setLevel(i, o ? o.lv : 0, false);
      setMort(i, !!(o && o.m), false);
    }
    placeTokens(false);
    setTurn(st.phase === 'over' ? -1 : st.turn);
    focusSeat = st.phase === 'over' ? -1 : st.turn;
    if (!built) { built = true; camInit = false; if (animate) rise(); }
    start();
  }
  // the state changed without animation (end of the animations, a resync): the same, without the rise
  function sync(state, positions) {
    if (!ok) return;
    st = state; pos = positions.slice();
    ensureTokens();
    for (let i = 0; i < 40; i++) {
      if (!OWNABLE(BOARD[i])) continue;
      const o = st.own[i], k = mark[i] || {};
      if ((o ? o.o : -1) !== k.o) setOwner(i, o ? o.o : -1, false);
      if (BOARD[i].k === 'p' && (o ? o.lv : 0) !== (k.lv || 0)) setLevel(i, o ? o.lv : 0, false);
      if (!!(o && o.m) !== !!k.m) setMort(i, !!(o && o.m), false);
    }
    placeTokens(true);
    setTurn(st.phase === 'over' ? -1 : st.turn);
    if (st.phase === 'over') focusSeat = -1;
  }
  function focus(seat) { focusSeat = seat; }
  function snap() { camInit = false; }
  function setMode(m) { mode = m === 'overview' ? 'overview' : 'follow'; modeSet = true; return mode; }
  function leave() { built = false; stop(); }

  return {
    init, show, sync, walk, fly, setOwner, setLevel, setMort, pop, celebrate, coins, focus, snap, setMode, setTurn, leave, resize, halt,
    speed(k) { speedK = k > 0 ? k : 1; },
    get ok() { return ok; }, get mode() { return mode; },
    onPick(cb) { pickCb = cb; },
    setPos(seat, at) { pos[seat] = at; },
    tween, ease, toWorld,
    _screen(i) { const c = centerOf(i).setY(TH); c.project(cam); const r = host.getBoundingClientRect(); return [r.left + (c.x + 1) / 2 * r.width, r.top + (1 - c.y) / 2 * r.height]; },
    _dbg: () => ({ y: tiles.slice(0, 6).map(t => +t.position.y.toFixed(2)), tw: tweens.length, built, running, frame, quality })
  };
})();
