// ===== the archipelago in 3D, made in code like the land (models.js), with the same pieces =====
// Every place is an island raised out of the sea: its relief lifts its land above the water (a shelf of shallow water
// around it), then its own things stand on it: Heligoland's red cliffs and lighthouse, Visby's walls, Grace O'Malley's
// tower, Port Royal half sunk, the pirates' graves on Sainte-Marie, the Money Pit on Oak Island... The four ships ride at
// anchor in their water; the lighthouse, the shipyard, the customs house, the whirlpool and the islets of the chest and
// the bottle have theirs. The middle of the board is a volcano: lava in its crater, a waterfall into the sea, a rock with
// a skull's face, a galleon in its bay. Around the board the ocean goes on, with islands far off.
// A place's frame is the land's: x along the board's side, +z towards its square (and the camera), y up.

const SeaModels = (() => {
  const T = window.THREE;
  if (!T || typeof Models === 'undefined' || !Models) return null;
  const { Builder, rng, tone, PAL } = Models;
  const { box, cyl, cone, pyr, ball, roof, dome, lathe, taper, jitter, lump } = Models.shapes;
  const { tree, palm, bush, rock, house, wall, roundTower, squareTower, fortress, church, coins, moneyBag, caves, pine } = Models.parts;

  // ----- heights: a lot's frame scales heights by 1.25 (LS in board3d.js), the ring's corners by 1.3, the middle not -----
  const SEA = Terrain.SEA_Y, WL_LOT = SEA / 1.25, WL_RING = SEA / 1.3;
  const UP = 0.15;                                   // from the sea floor up to the water, in a lot's units
  const isle = (R, x, z, rx, rz, h, rot = 0, edge = 0.5) => R.mesa(x, z, rx, rz, UP + h, edge, rot);     // h above the water
  const knoll = (R, x, z, rx, rz, h, rot = 0) => R.hill(x, z, rx, rz, UP + h, rot);
  const mount = (R, x, z, r, h, seed) => R.peak(x, z, r, UP + h, seed);
  // a frame floating on the water (not on the sea floor)
  const afloat = (B, x, z, ry = 0, s = 1) => B.at(x, z, ry, s, B.wl - (B.ground ? B.ground(x, z) : 0));

  const C = { sand: 0xead7a2, wet: 0xc9b483, bamboo: 0xc9a46a, thatch: 0xb9955a, plank: 0x9a7650, hull: 0x5a3a22, hull2: 0x3f2a1c, trim: 0xc9a35a,
    sail: 0xf1e8d2, black: 0x1d1a1e, rust: 0x8a4a2a, granite: 0xb9a49a, lava: 0x4a423c, coral: 0xe07a5f, iron: 0x3a3a3c, red: 0xb8332a,
    white: 0xf2ece0, pink: 0xe9b7a8, yellow: 0xf0d58c, blue: 0x9cc7e0, green: 0x9fcf9f, lush: 0x4f9a42, jungle: 0x2f7a3a };

  // ===== pieces =====
  // a ship's hull seen from above: square at the stern, pointed at the bow (+x), narrower at the keel; y from 0 to h
  function hullGeo(len, wid, h) {
    const a = len / 2, b = wid / 2, sh = new T.Shape();
    sh.moveTo(-a, -b * 0.8); sh.lineTo(a * 0.35, -b); sh.quadraticCurveTo(a * 0.92, -b * 0.85, a * 1.12, 0); sh.quadraticCurveTo(a * 0.92, b * 0.85, a * 0.35, b); sh.lineTo(-a, b * 0.8); sh.closePath();
    const g = new T.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 3 }).rotateX(-Math.PI / 2), p = g.attributes.position;
    for (let k = 0; k < p.count; k++) if (p.getY(k) < h * 0.01) { p.setZ(k, p.getZ(k) * 0.6); p.setX(k, p.getX(k) * 0.94); }
    return g;
  }
  // a sail, its middle at (0, 0, 0), across the ship (z), filled by the wind towards +x
  function sailGeo(w, h, belly, top = 1) {
    const g = new T.BoxGeometry(0.005, h, w, 1, 2, 4), p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const y = p.getY(k) / h + 0.5, z = p.getZ(k) / (w / 2);
      p.setX(k, p.getX(k) + belly * (1 - z * z) * (0.7 + 0.3 * Math.sin(Math.PI * y)));
      p.setZ(k, p.getZ(k) * (top + (1 - top) * (1 - y)));                // narrower at the top
    }
    return g;
  }
  // a ship (facing +x, its water line at y = 0): masts with square sails, or a junk's battened sails, or oars too
  function ship(put, o = {}) {
    const L = o.len || 0.48, Wd = o.wid || 0.15, hc = o.hull || C.hull, tc = o.trim || C.trim, sc = o.sail || C.sail, masts = o.masts || [0.42, 0.36, 0.3];
    put(hullGeo(L, Wd, 0.1), hc, 0, -0.035, 0, { vary: 0.06 });
    put(hullGeo(L * 1.01, Wd * 1.03, 0.016), tc, 0, 0.048, 0, { vary: 0 });
    put(box(L * 0.92, 0.012, Wd * 0.78), C.plank, -0.01, 0.062, 0);
    put(box(L * 0.24, o.junk ? 0.1 : 0.07, Wd * 0.84), hc, -L * 0.37, 0.062, 0, { vary: 0.06 });           // the stern castle
    put(box(L * 0.25, 0.012, Wd * 0.88), tc, -L * 0.37, o.junk ? 0.162 : 0.132, 0);
    for (const zz of [-1, 1]) for (let k = 0; k < 3; k++) put(box(0.02, 0.014, 0.004), 0xffd27a, -L * 0.45 + k * 0.028, 0.095, zz * Wd * 0.42);
    put(box(L * 0.13, 0.035, Wd * 0.66), hc, L * 0.37, 0.062, 0);
    put(cyl(0.004, 0.006, 0.15, 5), 0x4a3020, L * 0.55, 0.075, 0, { rz: -1.25 });                           // the bowsprit
    const mx = [L * 0.1, L * 0.34, -L * 0.24];
    masts.forEach((h, k) => {
      if (!h) return;
      put(cyl(0.005, 0.007, h, 5), 0x4a3020, mx[k], 0.06, 0);
      if (o.junk) {                                   // battened sails, red, across the ship
        const sw = Wd * (1.45 - k * 0.2), sh = h * 0.72;
        put(sailGeo(sw, sh, 0.012, 0.75), o.sail || 0xb8452a, mx[k] + 0.008, 0.06 + h * 0.52, 0, { vary: 0.03 });
        for (let j = 0; j < 5; j++) put(box(0.008, 0.004, sw * (1 - j * 0.045)), 0x3b2414, mx[k] + 0.013, 0.06 + h * 0.2 + j * sh / 5, 0);
      } else {
        const sw = Wd * (1.55 - k * 0.15);
        put(sailGeo(sw, h * 0.32, 0.024, 0.9), sc, mx[k] + 0.01, 0.06 + h * 0.31, 0, { vary: 0.02 });
        put(sailGeo(sw * 0.8, h * 0.25, 0.019, 0.85), sc, mx[k] + 0.01, 0.06 + h * 0.64, 0, { vary: 0.02 });
        for (const y of [0.06 + h * 0.14, 0.06 + h * 0.47, 0.06 + h * 0.77]) put(box(0.006, 0.006, sw * 1.04), 0x4a3020, mx[k], y, 0);
      }
    });
    if (o.oars) for (const zz of [-1, 1]) for (let k = 0; k < 6; k++) put(box(0.004, 0.004, 0.12), 0x7a5232, -L * 0.28 + k * L * 0.1, 0.03, zz * (Wd / 2 + 0.04), { rx: zz * 0.55 });
    const top = 0.06 + masts[0];                       // the black flag at the top of the main mast, a skull on it
    put(box(0.003, 0.036, 0.056), o.flag || C.black, mx[0], top - 0.03, 0.03);
    put(ball(0.006), 0xf2efe6, mx[0] + 0.003, top - 0.027, 0.032);
  }
  function sloop(put, o = {}) {
    const L = o.len || 0.3, Wd = 0.1;
    put(hullGeo(L, Wd, 0.07), o.hull || 0x6a4428, 0, -0.03, 0, { vary: 0.06 });
    put(hullGeo(L * 1.01, Wd * 1.03, 0.012), o.trim || 0xe9e2d2, 0, 0.032, 0, { vary: 0 });
    put(box(L * 0.85, 0.01, Wd * 0.76), C.plank, 0, 0.042, 0);
    put(cyl(0.004, 0.006, 0.34, 5), 0x4a3020, 0.03, 0.04, 0);
    put(sailGeo(L * 0.62, 0.26, 0.018, 0.55), C.sail, -0.07, 0.19, 0, { ry: Math.PI / 2 });             // the mainsail, along the ship
    put(sailGeo(L * 0.34, 0.2, 0.012, 0.15), C.sail, 0.12, 0.15, 0, { ry: Math.PI / 2 });                // the jib
    put(box(0.003, 0.03, 0.045), o.flag || C.black, 0.03, 0.36, 0.024);
  }
  function rowboat(put, c = 0x8a5a36) {
    put(hullGeo(0.14, 0.06, 0.03), c, 0, -0.01, 0, { vary: 0.05 });
    put(box(0.02, 0.006, 0.05), C.plank, 0, 0.018, 0);
    for (const zz of [-1, 1]) put(box(0.004, 0.004, 0.08), 0x7a5232, 0, 0.022, zz * 0.04, { rx: zz * 0.4 });
  }
  function hut(B, x, z, s = 1, ry = 0, roofC = C.thatch, wallC = C.bamboo) {
    const put = B.at(x, z, ry, s);
    for (const [px, pz] of [[-0.05, -0.04], [0.05, -0.04], [-0.05, 0.04], [0.05, 0.04]]) put(box(0.01, 0.03, 0.01), 0x6a4a2a, px, 0, pz);
    put(box(0.12, 0.075, 0.1), wallC, 0, 0.025, 0, { vary: 0.08 });
    put(pyr(0.17, 0.09, 0.15), roofC, 0, 0.1, 0, { vary: 0.1 });
    put(box(0.03, 0.05, 0.008), PAL.dark, 0, 0.025, 0.051);
  }
  function tent(B, x, z, s = 1, c = 0xe8dcc0, ry = 0) {
    const put = B.at(x, z, ry, s);
    put(roof(0.14, 0.09, 0.12), c, 0, 0, 0, { vary: 0.05 });
    put(box(0.004, 0.11, 0.004), 0x5a3a20, 0.075, 0, 0);
    put(box(0.004, 0.11, 0.004), 0x5a3a20, -0.075, 0, 0);
  }
  function barrel(B, x, z, s = 1, lie = false, c = 0x8a5a32) {
    const put = B.at(x, z, lie ? 0.4 : 0, s);
    if (lie) {
      put(new T.CylinderGeometry(0.024, 0.024, 0.06, 9), c, 0, 0.024, 0, { rz: Math.PI / 2, vary: 0.06 });
      for (const t of [-0.018, 0.018]) put(new T.CylinderGeometry(0.0255, 0.0255, 0.005, 9), 0x3a3a3a, t, 0.024, 0, { rz: Math.PI / 2 });
    } else {
      put(cyl(0.024, 0.024, 0.06, 9), c, 0, 0, 0, { vary: 0.06 });
      for (const t of [0.012, 0.043]) put(cyl(0.0255, 0.0255, 0.005, 9), 0x3a3a3a, 0, t, 0);
    }
  }
  const crate = (B, x, z, s = 1, ry = 0) => B.add(box(0.05 * s, 0.045 * s, 0.05 * s), 0xa77b48, x, 0, z, { ry, vary: 0.12 });
  function cannon(B, x, z, ry = 0, s = 1) {
    const put = B.at(x, z, ry, s);
    put(box(0.05, 0.02, 0.035), 0x5a3a22);
    for (const zz of [-0.02, 0.02]) put(cyl(0.012, 0.012, 0.006, 8), 0x3b2414, 0, 0.012, zz, { rx: Math.PI / 2 });
    put(cyl(0.008, 0.012, 0.08, 8), C.iron, 0.0, 0.032, 0, { rz: -Math.PI / 2 + 0.12 });
  }
  // a wooden pier from the land into the water
  function pier(B, x, z, len, ry = 0) {
    const put = afloat(B, x, z, ry);
    put(box(0.07, 0.01, len), C.plank, 0, 0.022, len / 2, { vary: 0.12 });
    for (let k = 0; k <= 3; k++) for (const xx of [-0.03, 0.03]) put(box(0.01, 0.06, 0.01), 0x5a3a20, xx, -0.035, k * len / 3);
  }
  function lighthouse(B, x, z, s = 1, band = C.red) {
    const put = B.at(x, z, 0, s);
    for (let k = 0; k < 5; k++) put(cyl(0.05 - k * 0.006, 0.054 - k * 0.006, 0.06, 12), k % 2 ? band : C.white, 0, k * 0.06, 0, { vary: 0.02 });
    put(cyl(0.05, 0.05, 0.008, 12), 0x3a3a3a, 0, 0.3, 0);
    put(cyl(0.026, 0.026, 0.045, 10), 0x2e3a44, 0, 0.308, 0);
    put(ball(0.016, 1), 0xffe9a8, 0, 0.33, 0);
    put(cone(0.034, 0.04, 10), band, 0, 0.353, 0);
    put(box(0.02, 0.035, 0.006), PAL.dark, 0, 0, 0.052);
  }
  // a smooth boulder of the Seychelles' granite
  const boulder = (B, x, z, s, c = C.granite, ry = 0) => B.add(jitter(ball(s, 2), 0.08, x * 31 + z * 7), c, x, s * 0.35, z, { sy: 0.78, ry, smooth: true, vary: 0 });
  function cactus(B, x, z, s = 1) {
    const put = B.at(x, z, 0, s);
    put(cyl(0.012, 0.016, 0.09, 6), 0x7a8a52);
    for (const [px, py, rz] of [[0.02, 0.1, -0.5], [-0.02, 0.085, 0.6], [0.0, 0.13, 0.1], [0.025, 0.14, -0.9]]) put(ball(0.022, 0), 0x6f9a4a, px, py, 0, { sx: 1.1, sz: 0.35, rz, vary: 0.08 });
  }
  function tomb(B, x, z, ry = 0, skull = false) {
    const put = B.at(x, z, ry);
    if (skull) { put(box(0.05, 0.06, 0.016), 0x9a958c, 0, 0, 0, { vary: 0.05 }); put(ball(0.012, 1), 0xf2efe6, 0, 0.04, 0.009, { vary: 0 }); for (const xx of [-0.016, 0.016]) put(box(0.026, 0.005, 0.004), 0xf2efe6, 0, 0.02, 0.009, { rz: xx > 0 ? 0.7 : -0.7 }); }
    else { put(box(0.008, 0.06, 0.008), 0x7a7266); put(box(0.034, 0.008, 0.008), 0x7a7266, 0, 0.038, 0); }
  }
  function windmill(B, x, z, s = 1) {
    const put = B.at(x, z, 0, s);
    put(taper(0.09, 0.06, 0.18), 0xe9e0cc, 0, 0, 0, { vary: 0.04 });
    put(cone(0.055, 0.06, 8), 0x7a5a3a, 0, 0.18, 0);
    put(box(0.025, 0.04, 0.006), PAL.dark, 0, 0, 0.044);
  }
  function derrick(B, x, z, s = 1) {          // the Money Pit's headframe over its shaft
    const put = B.at(x, z, 0, s);
    put(box(0.1, 0.006, 0.1), 0x2a1d14);
    for (const [px, pz] of [[-0.05, -0.05], [0.05, -0.05], [-0.05, 0.05], [0.05, 0.05]]) put(box(0.008, 0.24, 0.008), 0x7a5a3a, px * 0.7, 0, pz * 0.7, { rx: pz * 0.9, rz: -px * 0.9 });
    put(box(0.07, 0.01, 0.01), 0x7a5a3a, 0, 0.23, 0);
    put(cyl(0.016, 0.016, 0.01, 10), 0x5a4a3a, 0, 0.215, 0, { rx: Math.PI / 2 });
    put(box(0.002, 0.2, 0.002), 0x2a2a2a, 0, 0.02, 0);
  }
  function chestOnSand(B, x, z, s = 1) {
    const put = B.at(x, z, 0.3, s);
    put(box(0.12, 0.05, 0.075), PAL.wood, 0, -0.012, 0);
    for (const k of [-0.04, 0.04]) put(box(0.011, 0.052, 0.077), PAL.gold, k, -0.012, 0);
    put(box(0.12, 0.05, 0.012), 0x7b4f2d, 0, 0.04, -0.04, { rx: -0.5 });
    put(box(0.1, 0.012, 0.06), PAL.gold, 0, 0.036, 0);
    for (let k = 0; k < 3; k++) put(cyl(0.012, 0.012, 0.005, 9), PAL.gold, -0.03 + k * 0.03, 0.045, 0.005 * k, { rx: 0.3 });
    for (const r of [0.6, -0.6]) put(box(0.12, 0.004, 0.016), C.red, 0.14, -0.008, 0.02, { ry: r });      // X marks the spot
    put(box(0.006, 0.006, 0.12), 0x7a5232, -0.11, 0.03, 0.04, { rx: 0.9 }); put(box(0.03, 0.004, 0.035), 0x6a6a6a, -0.11, 0.004, 0.09, { rx: 0.9 });   // the spade
  }
  function skullRock(B, x, z, ry, s = 1) {      // a rock with a skull's face, its cave the mouth
    const put = B.at(x, z, ry, s);
    put(jitter(ball(0.36, 2), 0.06, 4), 0xcfc4ad, 0, 0.18, 0, { sx: 0.9, sy: 0.95, sz: 0.85, smooth: true, vary: 0 });
    for (const xx of [-0.13, 0.13]) put(ball(0.075, 1), 0x1e1814, xx, 0.36, 0.27, { sz: 0.6 });
    put(cone(0.04, 0.07, 3), 0x1e1814, 0, 0.24, 0.29, { rx: Math.PI });
    put(box(0.26, 0.11, 0.06), 0x1e1814, 0, 0.04, 0.26);
    for (let k = 0; k < 5; k++) put(box(0.035, 0.035, 0.03), 0xe9e0cc, -0.1 + k * 0.05, 0.115, 0.27);
  }
  // the ruin of a ship, lying over in shallow water
  function wreck(B, x, z, ry = 0, s = 1, c = C.hull2) {
    const put = afloat(B, x, z, ry, s);
    put(hullGeo(0.42, 0.14, 0.09), c, 0, -0.05, 0, { rz: 0.32, rx: 0.12, vary: 0.1 });
    put(cyl(0.005, 0.007, 0.26, 5), 0x3b2a1c, 0.05, 0.02, 0, { rz: 0.75 });
    put(cyl(0.005, 0.007, 0.13, 5), 0x3b2a1c, -0.1, 0.02, 0.02, { rz: -0.4, rx: 0.3 });
    for (let k = 0; k < 4; k++) put(box(0.05, 0.004, 0.012), 0x5a3a22, 0.18 + k * 0.03, 0.008, -0.05 + k * 0.035, { ry: k });
  }

  // ===== the places =====
  const L = {};
  const tint = (R, c, rock) => R.tint(c, 9, 0.62, rock);
  // the north
  L[1] = {   // Heligoland: the red sandstone cliffs, a green top, the tall stack (Lange Anna) at its tip, the sandy Düne beside
    r: R => { tint(R, 0x86a35a, 0xa8553a); isle(R, -0.04, -0.08, 0.26, 0.22, 0.2, 0.25, 0.22); isle(R, 0.27, -0.2, 0.05, 0.05, 0.26, 0, 0.3); isle(R, 0.3, 0.12, 0.09, 0.07, 0.01, 0, 0.7);
      for (const [x, z] of [[-0.12, -0.12], [0.02, -0.02]]) R.pad(x, z, 0.07); R.pad(-0.1, 0.06, 0.06); },
    b: B => {
      lighthouse(B, -0.12, -0.12, 0.9);
      house(B, 0.02, -0.02, 0.1, 0.08, 0.07, 0xe9e1cf, 0xb8452a); house(B, -0.1, 0.06, 0.09, 0.08, 0.065, 0xd9d2c0, 0xb8452a, 0.3);
      bush(B, -0.22, -0.02, 0.7, 0x5f8a45); bush(B, 0.12, -0.16, 0.6, 0x5f8a45);
    }
  };
  L[3] = {   // Gotland: Visby's medieval walls and towers, its cathedral with black spires, limestone shores
    r: R => { tint(R, 0x7ea457, 0xd6cfbd); isle(R, 0.02, -0.08, 0.32, 0.25, 0.1, -0.2, 0.42); R.pad(0.0, -0.1, 0.22); },
    b: B => {
      fortress(B, 0.0, -0.12, 0.34, 0.24, 0.09, 0xd2c8b2, { tr: 0.032, roof: 0x3a3836 });
      const put = B.at(-0.02, -0.12, 0, 0.75);
      put(box(0.2, 0.12, 0.09), 0xe0d7c4); put(roof(0.21, 0.07, 0.1), 0x4a4644, 0, 0.12, 0);
      for (const xx of [-0.1, 0.1]) { put(box(0.05, 0.2, 0.05), 0xe0d7c4, xx, 0, -0.03); put(pyr(0.06, 0.12), 0x24221f, xx, 0.2, -0.03); }
      house(B, 0.12, 0.0, 0.08, 0.07, 0.06, 0xe6dcc6, 0xa8452a); house(B, -0.13, 0.02, 0.08, 0.07, 0.06, 0xe9ddc4, 0xa8452a, 0.2);
    }
  };
  // the Mediterranean
  L[6] = {   // Farmakonisi: a dry rocky islet; the pirates' camp and their galley drawn up on the beach (young Caesar was their captive)
    r: R => { tint(R, 0xb0a868, 0xb8a98c); knoll(R, -0.04, -0.12, 0.3, 0.24, 0.1, 0.3); for (const [x, z] of [[-0.12, -0.1], [0.04, -0.16]]) R.pad(x, z, 0.06); },
    b: B => {
      tent(B, -0.12, -0.1, 1, 0xe7d9b8, 0.3); tent(B, 0.04, -0.16, 0.9, 0xb8452a, -0.2);
      for (let k = 0; k < 3; k++) B.add(lathe([[0, 0], [0.012, 0.004], [0.018, 0.03], [0.008, 0.055], [0.01, 0.065], [0, 0.065]], 8), 0xb0613a, -0.22 + k * 0.025, 0, -0.02 + (k % 2) * 0.02);
      rock(B, 0.16, -0.24, 0.05, 0xb8a98c, 3); bush(B, -0.24, -0.2, 0.6, 0x8a9a52);
      const put = afloat(B, 0.15, 0.08, -0.5, 0.8); ship(put, { len: 0.42, wid: 0.11, masts: [0.26, 0, 0], oars: true, sail: 0xd9c9a8, trim: 0xb8452a });
    }
  };
  L[8] = {   // Djerba: a flat sandy island of palms, white houses with domes, the old fort
    r: R => { tint(R, 0xb4ac68, 0xd8c79a); isle(R, 0, -0.08, 0.34, 0.26, 0.05, 0, 0.6); R.pad(0.12, -0.14, 0.09); },
    b: B => {
      fortress(B, 0.12, -0.14, 0.15, 0.13, 0.07, 0xd9c49a, { tr: 0.025 });
      for (const [x, z] of [[-0.1, -0.04], [-0.02, 0.04]]) { B.add(box(0.06, 0.05, 0.06), C.white, x, 0, z); B.add(dome(0.026, 10), C.white, x, 0.05, z, { smooth: true, vary: 0 }); }
      B.add(cyl(0.012, 0.014, 0.14, 8), C.white, -0.18, 0, -0.14); B.add(cone(0.016, 0.03, 8), 0x7aa0b0, -0.18, 0.14, -0.14);
      for (const [x, z, s] of [[-0.24, 0.04, 0.9], [0.24, 0.02, 1], [0.0, -0.24, 0.8], [-0.12, -0.24, 0.9], [0.26, -0.2, 0.8]]) palm(B, x, z, s);
    }
  };
  L[9] = {   // Gramvousa: a steep rock crowned by a Venetian fortress; a rusting wreck in the turquoise bay below
    r: R => { tint(R, 0x9a9a62, 0xbaa88e); mount(R, -0.06, -0.14, 0.3, 0.3, 61); R.pad(-0.06, -0.15, 0.08); },
    b: B => {
      fortress(B, -0.06, -0.15, 0.17, 0.12, 0.06, 0xc7b38f, { tr: 0.022, gate: false });
      wall(B, 0.06, -0.02, 0.14, 0.05, -0.7, 0xc7b38f, 0.02);
      wreck(B, 0.2, 0.14, -0.3, 0.75, C.rust);
    }
  };
  // the Atlantic
  L[11] = {  // Clare Island: green hills, Grace O'Malley's tower house by the shore, sheep
    r: R => { tint(R, 0x5f9a45, 0x857b6e); knoll(R, -0.06, -0.16, 0.32, 0.26, 0.2, 0.2); knoll(R, 0.12, -0.02, 0.2, 0.16, 0.06); R.pad(0.12, 0.0, 0.07); },
    b: B => {
      const put = B.at(0.12, 0.0, 0.2);
      put(box(0.09, 0.2, 0.08), 0x9a948a, 0, 0, 0, { vary: 0.08 }); put(roof(0.1, 0.06, 0.09), 0x5b5751, 0, 0.2, 0);
      put(box(0.02, 0.03, 0.006), PAL.dark, 0, 0.12, 0.041); put(box(0.025, 0.04, 0.006), PAL.dark, 0, 0, 0.041);
      wall(B, -0.02, 0.06, 0.16, 0.03, 0.3, 0x8f897d, 0.015);
      bush(B, -0.2, -0.04, 0.7, 0x4f8a3b); rock(B, 0.26, 0.04, 0.04, 0x857b6e, 5);
    }
  };
  L[13] = {  // Ocracoke: a low sandy island of dunes and grass, its white lighthouse; Blackbeard's sloop offshore
    r: R => { tint(R, 0x9fae68, 0xd9c79a); isle(R, 0, -0.08, 0.36, 0.13, 0.03, 0.08, 0.65); R.pad(0.14, -0.08, 0.06); },
    b: B => {
      const put = B.at(0.14, -0.08);
      put(taper(0.06, 0.045, 0.22), C.white, 0, 0, 0, { vary: 0.02 }); put(box(0.05, 0.03, 0.05), 0x2e3a44, 0, 0.22, 0); put(pyr(0.06, 0.03), 0x3a3a3a, 0, 0.25, 0);
      house(B, 0.02, -0.12, 0.08, 0.07, 0.055, 0xe9e2d2, 0x5a6a7a);
      for (let k = 0; k < 9; k++) B.add(cone(0.012, 0.05, 4), k % 2 ? 0xa9b45a : 0x8c9c4a, -0.3 + k * 0.05, 0, -0.03 + (k % 3) * 0.03, { sway: 1, rz: (k % 3 - 1) * 0.2 });
    }
  };
  L[14] = {  // Gardiners Island: woods, a windmill and a manor, the spot where Kidd buried his treasure (dug up at once)
    r: R => { tint(R, 0x6e9a48, 0x857b6e); knoll(R, 0, -0.1, 0.33, 0.27, 0.12); for (const [x, z] of [[-0.14, -0.1], [0.1, -0.16], [0.08, 0.02]]) R.pad(x, z, 0.07); },
    b: B => {
      windmill(B, -0.14, -0.1); house(B, 0.1, -0.16, 0.13, 0.09, 0.08, 0xf0e9da, 0x6a5a4a);
      B.add(cyl(0.035, 0.035, 0.004, 12), 0x2a1d14, 0.08, 0.0, 0.02); chestOnSand(B, 0.08, 0.02, 0.6);
      tree(B, -0.24, -0.24, 0.9); tree(B, 0.24, -0.08, 0.8); tree(B, -0.02, -0.26, 0.85);
    }
  };
  // the Antilles
  L[16] = {  // Île-à-Vache: palms on a green island; the Oxford's wreck, still smoking, where Morgan's ship blew up
    r: R => { tint(R, 0x5aa34a, 0x9a8a6a); isle(R, -0.08, -0.1, 0.28, 0.24, 0.08, 0.2, 0.5); },
    b: B => {
      for (const [x, z, s] of [[-0.22, -0.06, 1], [-0.08, -0.22, 0.9], [0.04, -0.06, 1.05], [-0.2, -0.2, 0.8]]) palm(B, x, z, s);
      bush(B, -0.12, 0.02, 0.8, 0x3f8a3a); hut(B, 0.04, -0.18, 0.8);
      wreck(B, 0.2, 0.12, 0.6, 0.8);
    }
  };
  L[18] = {  // Tortuga, the turtle: its hill, the buccaneers' fort on a rock, their huts and the smoking fires of the boucan
    r: R => { tint(R, 0x4f9a42, 0x8a7d66); knoll(R, 0, -0.14, 0.34, 0.26, 0.24); R.mesa(-0.16, -0.12, 0.08, 0.08, UP + 0.27, 0.4); R.pad(-0.16, -0.12, 0.07); R.pad(0.1, 0.0, 0.07); R.pad(0.16, -0.12, 0.05); },
    b: B => {
      roundTower(B, -0.16, -0.12, 0.04, 0.1, 0xb9a786, 0x8a5a3a); wall(B, -0.12, -0.04, 0.1, 0.04, 0.4, 0xb9a786, 0.015);
      hut(B, 0.1, 0.0, 0.9, 0.3); hut(B, 0.16, -0.12, 0.8, -0.4);
      for (const x of [-0.02, 0.04]) { B.add(box(0.05, 0.004, 0.03), 0x6a4a2a, x, 0.04, 0.06); for (const xx of [-0.022, 0.022]) B.add(box(0.004, 0.04, 0.004), 0x5a3a20, x + xx, 0, 0.06); }
      for (const [x, z] of [[-0.26, 0.02], [0.26, -0.04], [0.02, -0.26]]) palm(B, x, z, 0.9);
    }
  };
  L[19] = {  // Port Royal: brick houses on a sandy spit, Fort Charles and its guns; part of the town sunk in 1692
    r: R => { tint(R, 0x7aa050, 0x9a8a6a); isle(R, 0, -0.04, 0.36, 0.15, 0.04, 0.12, 0.6); R.pad(-0.2, -0.06, 0.08); },
    b: B => {
      fortress(B, -0.2, -0.06, 0.13, 0.11, 0.05, PAL.brick, { tr: 0.02, gate: false });
      for (const k of [0, 1]) cannon(B, -0.21 + k * 0.05, 0.0, -Math.PI / 2, 0.7);
      for (const [x, z, c] of [[-0.04, -0.1, 0xb85c3c], [0.06, -0.04, 0xa85a3a], [0.15, -0.1, 0xc06a44]]) house(B, x, z, 0.08, 0.07, 0.075, c, 0x4a3a32);
      const put = afloat(B, 0.25, 0.08, 0.4);               // a house going down into the sea
      put(box(0.08, 0.08, 0.07), 0xa85a3a, 0, -0.04, 0, { rz: 0.35 }); put(roof(0.09, 0.04, 0.08), 0x4a3a32, -0.012, 0.035, 0, { rz: 0.35 });
    }
  };
  // the Caribbean
  L[21] = {  // Nassau: the pirates' republic: pastel houses, a little fort, palms, a pier with a sloop
    r: R => { tint(R, 0x5aa548, 0xc9b88f); isle(R, 0, -0.12, 0.34, 0.24, 0.06, 0, 0.55); R.pad(-0.16, -0.16, 0.07); },
    b: B => {
      fortress(B, -0.16, -0.16, 0.12, 0.1, 0.05, 0xd8cdb5, { tr: 0.02 });
      for (const [x, z, c] of [[-0.04, -0.06, C.pink], [0.06, -0.12, C.yellow], [0.16, -0.06, C.blue], [0.04, -0.22, C.green]]) house(B, x, z, 0.07, 0.06, 0.055, c, C.white);
      for (const [x, z] of [[-0.26, -0.02], [0.26, -0.2], [-0.12, -0.28]]) palm(B, x, z, 0.85);
      pier(B, 0.1, 0.04, 0.16); const put = afloat(B, 0.0, 0.18, 0, 0.6); sloop(put);
    }
  };
  L[23] = {  // Norman Island: hills, the treasure caves at the water's edge, palms (a model for "Treasure Island", they say)
    r: R => { tint(R, 0x5f9a45, 0x8a7d66); knoll(R, -0.02, -0.16, 0.32, 0.26, 0.22, 0.3); },
    b: B => {
      for (const [x, z] of [[-0.1, 0.02], [0.06, 0.04]]) B.add(box(0.045, 0.04, 0.03), PAL.dark, x, -0.015, z);
      for (const [x, z, s] of [[-0.22, -0.02, 0.9], [0.2, -0.04, 1], [0.0, -0.3, 0.8]]) palm(B, x, z, s);
      bush(B, -0.08, -0.16, 0.8, 0x3f8a3a); bush(B, 0.12, -0.2, 0.7, 0x4f9a42);
    }
  };
  L[24] = {  // Isla de la Juventud, once the Isle of Pines: pine woods and white beaches
    r: R => { tint(R, 0x6a9a45, 0x9a8a6a); isle(R, -0.02, -0.1, 0.34, 0.26, 0.07, 0.3, 0.5); R.pad(0.14, -0.04, 0.06); },
    b: B => {
      for (const [x, z, s] of [[-0.2, -0.14, 1.1], [-0.1, -0.24, 1], [0.0, -0.14, 1.2], [-0.24, -0.02, 0.9], [0.1, -0.24, 0.9]]) pine(B, x, z, s);
      hut(B, 0.14, -0.04, 0.85, 0.2); palm(B, 0.24, 0.02, 0.8);
    }
  };
  // the Indian Ocean
  L[26] = {  // Île Sainte-Marie: the pirates' cemetery, a skull and crossbones on one stone; palms and a pier
    r: R => { tint(R, 0x4f9e44, 0x8a7d66); knoll(R, 0, -0.12, 0.32, 0.26, 0.12); R.pad(-0.04, -0.12, 0.13); },
    b: B => {
      const r = rng(26);
      for (let k = 0; k < 7; k++) tomb(B, -0.14 + (k % 4) * 0.07, -0.18 + Math.floor(k / 4) * 0.08, (r() - 0.5) * 0.4, k === 2);
      for (const [x, z, s] of [[0.2, -0.16, 1], [-0.26, -0.06, 0.9], [0.14, 0.0, 0.8]]) palm(B, x, z, s);
      pier(B, -0.12, 0.04, 0.14, 0.1);
    }
  };
  L[27] = {  // Réunion: a volcano, green to its shoulders; La Buse was hanged here, throwing his cipher to the crowd
    r: R => { R.tint(0x47923d, 9, 0.62, 0x5d544b); mount(R, -0.02, -0.18, 0.34, 0.44, 71); R.pad(0.18, 0.0, 0.06); },
    b: B => {
      house(B, 0.18, 0.0, 0.08, 0.07, 0.06, C.white, 0xb8452a);
      for (const [x, z] of [[-0.2, -0.02], [0.08, 0.04], [-0.08, 0.04], [0.24, -0.12]]) tree(B, x, z, 0.75, 0x3f8a3a);
    }
  };
  L[29] = {  // Mahé: the Seychelles' great smooth granite rocks on a white beach; a pit dug for La Buse's treasure
    r: R => { tint(R, 0x4f9e44, 0x9a8d86); knoll(R, 0.02, -0.14, 0.3, 0.26, 0.15); },
    b: B => {
      for (const [x, z, s] of [[-0.2, -0.02, 0.07], [-0.12, 0.02, 0.05], [0.18, -0.02, 0.08], [0.22, -0.12, 0.05], [0.0, -0.3, 0.06]]) boulder(B, x, z, s);
      for (const [x, z, s] of [[-0.06, -0.12, 1], [0.08, -0.2, 1.1], [-0.2, -0.18, 0.9]]) palm(B, x, z, s);
      B.add(cyl(0.03, 0.03, 0.004, 12), 0x2a1d14, 0.06, 0, 0.0); B.add(box(0.006, 0.006, 0.1), 0x7a5232, 0.1, 0.03, 0.02, { rx: 0.8 });
    }
  };
  // the Pacific
  L[31] = {  // Cheung Chau: a fishing village of tiled roofs, the red temple; a junk with battened sails
    r: R => { tint(R, 0x5a9a48, 0x8a7d66); knoll(R, -0.14, -0.16, 0.2, 0.2, 0.16); knoll(R, 0.12, -0.12, 0.18, 0.18, 0.12); R.pad(0.0, -0.08, 0.1); },
    b: B => {
      const put = B.at(0.0, -0.1); put(box(0.1, 0.06, 0.07), 0xb8332a); put(roof(0.13, 0.04, 0.1), 0x4f6a5a, 0, 0.06, 0); put(box(0.13, 0.006, 0.1), 0xe0ad45, 0, 0.06, 0);
      for (const [x, z] of [[0.12, -0.02], [-0.12, -0.02], [0.08, -0.2]]) house(B, x, z, 0.07, 0.06, 0.05, 0xe8e0cc, 0x6a7a6a);
      tree(B, -0.18, -0.2, 0.8, 0x3f8a3a);
      const sp = afloat(B, 0.06, 0.18, 0.2, 0.62); ship(sp, { len: 0.4, wid: 0.13, masts: [0.32, 0.26, 0.22], junk: true, hull: 0x6a4a2a, trim: 0xb8452a, flag: 0xb8332a });
    }
  };
  L[32] = {  // the Galápagos: dark lava rock, tree cacti, the giant tortoises
    r: R => { R.tint(0x8a8a5a, 9, 0.62, 0x4a4540); knoll(R, 0, -0.12, 0.32, 0.26, 0.13); mount(R, -0.14, -0.2, 0.12, 0.18, 81); },
    b: B => {
      for (const [x, z, s] of [[0.04, -0.1, 1.1], [0.14, -0.18, 0.9], [-0.04, -0.04, 0.8], [0.2, -0.04, 0.9]]) cactus(B, x, z, s);
      for (const [x, z, s] of [[-0.22, 0.0, 0.05], [0.24, 0.04, 0.04], [-0.06, 0.06, 0.035]]) rock(B, x, z, s, C.lava, Math.round(x * 100));
    }
  };
  L[34] = {  // Robinson Crusoe Island: steep green peaks; Selkirk's hut by the bay, his lookout on the hill, goats
    r: R => { R.tint(0x4f9a42, 9, 0.62, 0x6f6a5e); mount(R, -0.12, -0.2, 0.3, 0.4, 91); mount(R, 0.16, -0.16, 0.2, 0.22, 92); isle(R, 0.04, 0.0, 0.2, 0.1, 0.02, 0, 0.6); },
    b: B => {
      hut(B, 0.06, 0.0, 0.9, 0.2);
      const top = B.at(0.16, -0.16); top(box(0.004, 0.08, 0.004), 0x5a3a20); top(box(0.004, 0.025, 0.035), 0xe9e2d2, 0, 0.055, 0.018);
      for (const [x, z] of [[-0.24, -0.02], [-0.02, -0.06], [0.24, -0.04]]) tree(B, x, z, 0.75, 0x3f8a3a);
    }
  };
  // the great treasures
  L[37] = {  // Oak Island: oaks, and the Money Pit: a deep shaft under its headframe, dug since 1795
    r: R => { tint(R, 0x5f9a45, 0x857b6e); isle(R, 0, -0.1, 0.34, 0.26, 0.08, 0.2, 0.5); R.pad(0.02, -0.08, 0.1); },
    b: B => {
      derrick(B, 0.02, -0.08, 1.1);
      for (let k = 0; k < 4; k++) B.add(box(0.06, 0.012, 0.016), 0x8a6a40, 0.14, k * 0.012, -0.06 + (k % 2) * 0.01);
      for (const [x, z, s, c] of [[-0.2, -0.16, 1, 0x7a8a3a], [-0.1, -0.26, 0.9, 0xb8752f], [0.2, -0.2, 0.9, 0x5f8a3a], [-0.24, 0.0, 0.8, 0xa86a2f]]) tree(B, x, z, s, c);
    }
  };
  L[39] = {  // Cocos Island: jungle on steep cliffs, waterfalls into the sea; the Treasure of Lima hidden in a cave, they say
    r: R => { R.tint(0x2f7a3a, 9, 0.62, 0x5d6650); mount(R, 0.02, -0.18, 0.32, 0.34, 101); R.mesa(0.02, -0.1, 0.24, 0.16, UP + 0.2, 0.25); },
    b: B => {
      for (const [x, z, s] of [[-0.2, -0.12, 1], [0.16, -0.16, 0.9], [-0.06, -0.24, 1.1], [0.22, -0.02, 0.8], [-0.24, 0.0, 0.8], [0.04, -0.08, 0.9]]) tree(B, x, z, s, k2(x));
      for (const x of [-0.1, 0.12]) { const top = B.ground(x, -0.02), h = top - B.wl; if (h > 0.05) B.add(box(0.035, h, 0.008), 0xb4dbea, x, B.wl, 0.045, { water: 2, free: true }); }
      B.add(box(0.04, 0.035, 0.02), PAL.dark, 0.0, 0.0, 0.02);
    }
  };
  function k2(x) { return x > 0 ? 0x2f7a3a : 0x3b8a3c; }
  // the four ships at anchor (each rides in its own water: see FX); a little sandbar and a buoy by each
  const shipLot = (spot) => ({
    r: R => { tint(R, 0x5aa34a, 0x9a8a6a); isle(R, spot[0], spot[1], 0.1, 0.07, 0.01, 0, 0.7); },
    b: B => { rock(B, spot[0] + 0.03, spot[1], 0.03, 0x8a8070, 4); palm(B, spot[0] - 0.02, spot[1] - 0.02, 0.6);
      const put = afloat(B, -spot[0] * 0.6, 0.22); put(cyl(0.014, 0.018, 0.035, 8), C.red, 0, -0.01, 0); put(cone(0.016, 0.03, 8), C.white, 0, 0.025, 0); }
  });
  L[5] = shipLot([0.28, -0.3]); L[15] = shipLot([-0.28, -0.3]); L[25] = shipLot([0.28, -0.32]); L[35] = shipLot([-0.26, -0.3]);
  L[12] = {  // the lighthouse on its rock
    r: R => { tint(R, 0x7a9a5a, 0x6d6a62); mount(R, 0.0, -0.1, 0.24, 0.16, 121); R.pad(0.0, -0.1, 0.06); R.pad(0.12, -0.02, 0.05); },
    b: B => { lighthouse(B, 0.0, -0.1, 1.15); house(B, 0.12, -0.02, 0.08, 0.06, 0.05, C.white, 0x4a5a6a); rock(B, -0.18, 0.02, 0.05, 0x6d6a62, 7); rock(B, 0.2, -0.16, 0.04, 0x6d6a62, 9); }
  };
  L[28] = {  // the shipyard: a ship hauled down on the beach to be cleaned (careening), timber, the tar pot
    r: R => { tint(R, 0x7aa050, 0x9a8a6a); isle(R, 0, -0.14, 0.34, 0.24, 0.05, 0, 0.5); R.pad(0.18, -0.2, 0.06); },
    b: B => {
      const put = B.at(-0.04, -0.06, 0.15); put(hullGeo(0.36, 0.13, 0.09), C.hull, 0, 0.015, 0, { rx: -0.95, vary: 0.08 }); put(cyl(0.005, 0.007, 0.28, 5), 0x4a3020, 0.02, 0.04, -0.03, { rx: -0.95 });
      for (const x of [-0.14, 0.0, 0.14]) B.add(box(0.006, 0.12, 0.006), 0x7a5a3a, x, 0, 0.04, { rx: 0.25 });
      for (let k = 0; k < 4; k++) B.add(box(0.12, 0.012, 0.014), 0xa07a4a, 0.18, k * 0.013, -0.12 + (k % 2) * 0.004);
      hut(B, 0.18, -0.2, 0.8); barrel(B, 0.1, 0.02, 0.9); barrel(B, 0.06, 0.04, 0.8, true);
      B.add(cyl(0.02, 0.016, 0.03, 9), C.iron, -0.24, 0, 0.0);
    }
  };
  L[4] = {   // the customs house on its pier: crates, barrels, the governor's flag, coins
    r: R => { tint(R, 0x7aa050, 0x9a8a6a); isle(R, 0, -0.16, 0.3, 0.2, 0.06, 0, 0.5); R.pad(0.0, -0.16, 0.12); },
    b: B => {
      const put = B.at(0.0, -0.18);
      put(box(0.18, 0.09, 0.1), C.white); put(roof(0.2, 0.05, 0.12), 0xa8452a, 0, 0.09, 0);
      for (const x of [-0.06, -0.02, 0.02, 0.06]) put(cyl(0.005, 0.005, 0.07, 6), 0xffffff, x, 0, 0.056);
      put(box(0.03, 0.05, 0.006), PAL.dark, 0, 0, 0.051);
      B.add(box(0.004, 0.2, 0.004), 0x5a3a20, 0.14, 0, -0.1); B.add(box(0.003, 0.04, 0.06), 0xc23b2a, 0.14, 0.15, -0.07); B.add(box(0.0035, 0.013, 0.06), 0xe8b44c, 0.14, 0.163, -0.07);
      for (const [x, z] of [[-0.14, -0.02], [-0.1, 0.0], [-0.12, -0.06]]) crate(B, x, z, 1, x * 9);
      barrel(B, 0.08, -0.02); barrel(B, 0.12, 0.0, 0.9); coins(B, 0.02, -0.04, 3, 0.7);
      pier(B, 0.0, -0.02, 0.2);
    }
  };
  L[38] = {  // the whirlpool: the sea turns round and round (see FX), rocks about it
    r: R => { tint(R, 0x6a8a5a, 0x5d5a52); for (const [x, z, s] of [[-0.28, -0.24, 0.06], [0.3, -0.12, 0.05], [0.24, -0.34, 0.04]]) R.peak(x, z, s, UP + 0.05, x * 10); },
    b: B => { for (const [x, z, s] of [[-0.28, -0.24, 0.05], [0.3, -0.12, 0.04], [0.24, -0.34, 0.035]]) rock(B, x, z, s, 0x5d5a52, Math.round(z * 100)); }
  };
  // the treasure chest's islets and the bottle's sandbars
  const chestLot = { r: R => { tint(R, 0x5aa34a); isle(R, 0, -0.12, 0.22, 0.18, 0.025, 0.4, 0.7); }, b: B => { chestOnSand(B, 0.02, -0.1, 0.9); palm(B, -0.12, -0.18, 0.9); palm(B, 0.14, -0.2, 0.7); rock(B, -0.16, 0.0, 0.03, 0x9a8a6a, 3); } };
  const bottleLot = { r: R => { tint(R, 0x5aa34a); isle(R, -0.12, -0.16, 0.16, 0.12, 0.012, 0, 0.7); }, b: B => { rock(B, -0.18, -0.14, 0.03, 0x9a8a6a, 6); B.add(cone(0.012, 0.04, 4), 0x6a9a4a, -0.08, 0, -0.2, { sway: 1 }); for (let k = 0; k < 4; k++) B.add(ball(0.008, 0), 0xf2e2d2, -0.14 + k * 0.03, 0, -0.08 + (k % 2) * 0.02, { sy: 0.5 }); } };
  L[2] = chestLot; L[17] = chestLot; L[33] = chestLot;
  L[7] = bottleLot; L[22] = bottleLot; L[36] = bottleLot;

  // ===== the inside corners of the ring: a reef with a palm, or a sandbar with an old rowboat =====
  const RING = [0, 1, 2, 3].map(k => ({
    r: R => { R.tint(0x5aa34a, 9, 0.62, 0x8a8070); R.mesa(0.02, 0.02, 0.2, 0.18, 0.138 + 0.015, 0.6); },
    b: B => {
      if (k % 2) { const put = afloat(B, 0.02, 0.1, 1.2); rowboat(put); rock(B, -0.06, -0.04, 0.03, 0x8a8070, k); }
      else { palm(B, 0.02, 0.0, 0.8); rock(B, 0.1, 0.06, 0.035, 0x8a8070, k + 3); }
    }
  }));

  // ===== the volcano in the middle of the board (board coordinates) =====
  // On the side of each row of squares something of its own: a bay with a galleon at anchor (side 0), the skull rock and
  // its treasure (1), a waterfall from a cliff into the sea (2), the lookout tower and a pirates' camp (3).
  const CENTER = { peak: [0.05, -0.15], bay: [0.45, 2.15], skull: [-2.05, 0.3], fall: [0.2, -1.75], lake: [0.25, -2.6], camp: [2.0, 0.15] };
  const UPC = 0.18;
  // The large central island keeps its authored PBR materials, proportions and native animation.
  // width is measured across the static island; its animated ocean is replaced by the board's sea.
  const CENTER_MODEL = { url: 'art/m_volcano_animated.glb', animated: true, width: 6.1, waterline: 0.055, ry: 0, top: 4.05 };
  if (CENTER_MODEL && !CENTER_MODEL.animated) {
    const k = CENTER_MODEL.s, [x, y, z] = CENTER_MODEL.crater;
    CENTER_MODEL.top = 0.47 * k * CENTER_MODEL.sy;
    CENTER.peak = [x * k, z * k];
    CENTER_MODEL.smoke = [[x * k, z * k, y * k * CENTER_MODEL.sy + 0.04], [x * k + 0.06, z * k - 0.03, y * k * CENTER_MODEL.sy + 0.02]];
  }
  function centerRelief(R) {
    if (CENTER_MODEL) { R.tint(0, 0, 0xe3cf98, 9, 2.4, 0xb8a27a); R.mesa(0.0, 0.0, 2.8, 2.7, SEA - 0.07, 0.6); return; }
    R.tint(0, 0, 0x4f9a42, 9, 2.4, 0x6a5e52);
    R.tint(CENTER.peak[0], CENTER.peak[1], 0x6f7a4a, 9, 0.75, 0x4a423c);
    R.mesa(0.0, 0.0, 2.75, 2.6, UPC + 0.1, 0.42);                              // the island's low land, its beaches
    R.peak(CENTER.peak[0], CENTER.peak[1], 1.9, 2.5, 3.3);                      // the volcano
    R.peak(-0.95, -0.85, 0.9, 0.55, 5.1); R.peak(1.0, 0.75, 0.8, 0.5, 7.7);
    R.lake(CENTER.peak[0], CENTER.peak[1], 0.3, 0.26, 0.42, 0, 'lava');
    R.dig(CENTER.bay[0] - 0.1, 1.15, CENTER.bay[0] + 0.05, 2.9, 0.55, 0.42, false);  // the bay
    R.mesa(CENTER.skull[0], CENTER.skull[1], 0.42, 0.5, UPC + 0.3, 0.35); R.pad(CENTER.skull[0] - 0.2, CENTER.skull[1], 0.18);
    R.mesa(CENTER.fall[0], CENTER.fall[1], 0.55, 0.36, UPC + 0.62, 0.3);
    R.hill(CENTER.camp[0], CENTER.camp[1], 0.62, 0.7, UPC + 0.22); R.pad(CENTER.camp[0], CENTER.camp[1], 0.4);
  }
  // the waterfall: off the cliff's lip, down to the sea; where it lands, for the spray
  function centerWater(R) {
    if (CENTER_MODEL) return null;
    const [fx, fz] = CENTER.fall, [lx, lz] = CENTER.lake, wl = Terrain.SEA_Y;
    const N = 140, step = Math.hypot(lx - fx, lz - fz) / N, pt = t => [fx + (lx - fx) * t, fz + (lz - fz) * t];
    let prev = R.height(fx, fz), lip = null, lipY = 0, foot = null;
    for (let k = 1; k <= N && !foot; k++) {
      const [x, z] = pt(k / N), y = R.height(x, z);
      if (!lip && (prev - y) / step > 1.6) { lip = pt((k - 1) / N); lipY = prev; }
      else if (lip && y <= wl + 0.004) foot = [x, z];
      prev = y;
    }
    if (!lip || !foot) return null;
    R.fall(lip[0], lipY + 0.012, lip[1], foot[0], wl + 0.003, foot[1], 0.16);
    return [foot[0], wl, foot[1]];
  }
  function center(ground) {
    const B = new Builder();
    B.ground = ground; B.wl = Terrain.SEA_Y;
    if (CENTER_MODEL) return { B, steps: [] };
    const r = rng(505);
    const steps = [
      () => {         // palms along the beaches: out from the middle until the land comes down to the sea
        for (let k = 0; k < 46; k++) {
          const a = k / 46 * Math.PI * 2 + r() * 0.08;
          let d = 1.2;
          while (d < 3.2 && ground(Math.cos(a) * d, Math.sin(a) * d) > Terrain.SEA_Y + 0.12) d += 0.04;
          const x = Math.cos(a) * (d - 0.18 - r() * 0.2), z = Math.sin(a) * (d - 0.18 - r() * 0.2);
          if (Math.hypot(x - CENTER.bay[0], z - CENTER.bay[1]) < 0.55 || Math.hypot(x - CENTER.fall[0], z - CENTER.fall[1]) < 0.5) continue;
          if (ground(x, z) < Terrain.SEA_Y + 0.02) continue;
          palm(B, x, z, 1.5 + r() * 0.6);
        }
      },
      () => {         // jungle on the volcano's lower slopes
        for (let k = 0; k < 60; k++) {
          const a = r() * Math.PI * 2, d = 0.9 + r() * 1.1, x = CENTER.peak[0] + Math.cos(a) * d, z = CENTER.peak[1] + Math.sin(a) * d, y = ground(x, z);
          if (y < 0.16 || y > 1.15) continue;
          if (Math.hypot(x - CENTER.camp[0], z - CENTER.camp[1]) < 0.5 || Math.hypot(x - CENTER.skull[0], z - CENTER.skull[1]) < 0.55) continue;
          tree(B, x, z, 1.5 + r() * 0.7, r() < 0.5 ? 0x3f8a3a : 0x2f7a3a);
        }
      },
      () => {         // the skull rock, its treasure at the mouth of the cave
        const [sx, sz] = CENTER.skull;
        skullRock(B, sx - 0.05, sz, -Math.PI / 2, 1.1);
        const put = B.at(sx - 0.62, sz + 0.02, -Math.PI / 2, 1.6);
        put(box(0.12, 0.06, 0.075), PAL.wood); for (const k of [-0.04, 0.04]) put(box(0.011, 0.062, 0.077), PAL.gold, k, 0, 0);
        put(box(0.12, 0.05, 0.012), 0x7b4f2d, 0, 0.06, -0.04, { rx: -0.6 }); put(box(0.1, 0.02, 0.06), PAL.gold, 0, 0.055, 0);
        coins(B, sx - 0.7, sz - 0.18, 5, 1.6);
      },
      () => {         // the lookout tower and the camp
        const [cx, cz] = CENTER.camp, put = B.at(cx + 0.1, cz - 0.15, Math.PI / 2, 1.7);
        for (const [px, pz] of [[-0.05, -0.05], [0.05, -0.05], [-0.05, 0.05], [0.05, 0.05]]) put(box(0.01, 0.34, 0.01), 0x7a5a3a, px, 0, pz);
        put(box(0.14, 0.012, 0.14), C.plank, 0, 0.34, 0); put(box(0.14, 0.035, 0.006), 0x8a6a40, 0, 0.346, 0.068);
        put(box(0.004, 0.14, 0.004), 0x5a3a20, 0.06, 0.34, 0.06); put(box(0.003, 0.04, 0.06), C.black, 0.06, 0.45, 0.09);
        tent(B, cx - 0.12, cz + 0.22, 1.8, 0xe7d9b8, Math.PI / 2); tent(B, cx - 0.2, cz - 0.25, 1.6, 0xb8452a, Math.PI / 2.4);
        barrel(B, cx + 0.2, cz + 0.25, 1.6); barrel(B, cx + 0.27, cz + 0.2, 1.5, true);
        B.add(cyl(0.05, 0.06, 0.02, 8), 0x5a5550, cx - 0.04, 0, cz + 0.02);
      },
      () => {         // rocks along the shores
        for (const [x, z, s, sd] of [[-1.6, 1.7, 0.12, 3], [1.9, -1.4, 0.1, 5], [-2.3, -1.2, 0.14, 7], [1.2, 2.2, 0.09, 9], [-0.6, -2.4, 0.1, 11], [2.5, 1.0, 0.08, 13]]) rock(B, x, z, s, 0x7a7266, sd);
      }
    ];
    return { B, steps };
  }

  // ===== far off in the ocean: islands in the haze =====
  function far() {
    const B = new Builder(), r = rng(919), OY = Terrain.OCEAN_Y;
    for (let k = 0; k < 9; k++) {
      const a = k / 9 * Math.PI * 2 + r() * 0.5, d = 19 + r() * 24, x = Math.cos(a) * d, z = Math.sin(a) * d, s = 1.1 + r() * 1.4 + d * 0.035;
      B.add(cyl(s * 1.06, s * 1.12, 0.05, 16), C.sand, x, OY - 0.03, z, { vary: 0.03 });
      if (r() < 0.35) B.add(jitter(cone(s * 0.9, s * 1.6, 10), 0.14, k), 0x4f6a48, x, OY, z, { smooth: true, vary: 0 });       // a volcanic one
      else {
        B.add(jitter(ball(s * 0.95, 1), 0.18, k), tone(0x3f8a3a, 0.9 + r() * 0.2), x, OY - s * 0.2, z, { sy: 0.62, round: true });
        B.add(jitter(ball(s * 0.55, 1), 0.2, k + 9), tone(0x4a9a42, 0.95 + r() * 0.1), x + s * 0.35, OY + s * 0.05, z - s * 0.2, { sy: 0.7, round: true });
      }
    }
    return B.build();
  }

  // ===== the corners of the board (on their squares) =====
  function corner(i) {
    if (CORNER_MODELS[i]) return null;
    const B = new Builder();
    if (i === 0) {           // the home port: an anchor, the harbour's arch, barrels and the plunder's coins
      const put = B.at(0.2, -0.38, 0.3);
      put(box(0.03, 0.34, 0.03), C.iron); put(box(0.18, 0.025, 0.025), C.iron, 0, 0.3, 0);
      put(new T.TorusGeometry(0.11, 0.018, 6, 16, Math.PI), C.iron, 0, 0.11, 0, { rz: Math.PI });
      for (const x of [-0.11, 0.11]) put(cone(0.03, 0.06, 4), C.iron, x, 0.1, 0, { rz: x > 0 ? -0.5 : 0.5 });
      put(new T.TorusGeometry(0.035, 0.01, 6, 12), C.iron, 0, 0.36, 0);
      coins(B, -0.3, -0.34, 6, 1.3); barrel(B, -0.05, -0.5, 1.8); barrel(B, 0.05, -0.55, 1.6, true);
      B.add(new T.TorusGeometry(0.06, 0.02, 6, 14), 0xc9b48a, -0.15, 0.02, -0.18, { rx: Math.PI / 2 });
    }
    if (i === 10) {          // the deserted island: a mound of sand, one palm, a castaway's signal and fire
      B.add(cyl(0.38, 0.42, 0.03, 18), C.sand, -0.08, 0, -0.32, { vary: 0.03 });
      palm(B, 0.3, -0.55, 2.2); rock(B, -0.45, -0.5, 0.06, 0x9a8a6a, 3);
      B.add(box(0.012, 0.3, 0.012), 0x6a4a2a, 0.42, 0.03, -0.3); B.add(box(0.004, 0.08, 0.11), 0xe9e2d2, 0.42, 0.24, -0.25);
      for (let k = 0; k < 5; k++) B.add(box(0.07, 0.012, 0.012), 0x5a3a20, 0.3, 0.03, -0.12, { ry: k * 0.6 });
    }
    if (i === 20) {          // the tavern: its hut and sign, barrels, a table with tankards
      const put = B.at(0.05, -0.42, 0, 1.6);
      put(box(0.3, 0.16, 0.18), 0x8a6a40, 0, 0, 0, { vary: 0.08 }); put(roof(0.34, 0.1, 0.22), 0x5a3a22, 0, 0.16, 0, { vary: 0.08 });
      put(box(0.06, 0.1, 0.008), PAL.dark, -0.06, 0, 0.091); put(box(0.05, 0.04, 0.008), 0xffd27a, 0.07, 0.07, 0.091);
      put(box(0.004, 0.06, 0.004), 0x3a2a1a, 0.14, 0.12, 0.13); put(box(0.07, 0.045, 0.006), 0xc9a35a, 0.14, 0.09, 0.13);
      put(box(0.02, 0.08, 0.02), 0x6a6a6a, -0.1, 0.2, -0.04);
      B.add(box(0.26, 0.012, 0.12), C.plank, -0.25, 0.08, -0.1); for (const [x, z] of [[-0.36, -0.15], [-0.14, -0.15], [-0.36, -0.05], [-0.14, -0.05]]) B.add(box(0.015, 0.08, 0.015), 0x5a3a20, x, 0, z);
      for (const x of [-0.3, -0.24, -0.18]) B.add(cyl(0.012, 0.011, 0.03, 8), 0xc9a35a, x, 0.092, -0.1);
      barrel(B, 0.4, -0.2, 1.6); barrel(B, 0.46, -0.32, 1.5);
    }
    if (i === 30) {          // the kraken: a dark hole in the sea, its arms come out of it (see FX), a broken mast
      B.add(cyl(0.34, 0.36, 0.008, 22), 0x123a5a, -0.05, 0, -0.32, { water: 1 });
      B.add(cyl(0.38, 0.38, 0.004, 22), 0xe9f4f6, -0.05, 0, -0.32);
      B.add(cyl(0.012, 0.016, 0.42, 6), 0x4a3020, 0.42, 0, -0.5, { rz: 0.5 });
      for (let k = 0; k < 5; k++) B.add(box(0.1, 0.008, 0.02), 0x6a4a2a, 0.3 - k * 0.07, 0.008, -0.1 - (k % 2) * 0.05, { ry: k * 1.3 });
    }
    return B.parts.length ? B.build() : null;
  }

  // ===== what the players build, painted in their colour: huts (1 to 4 on a square), then a sea fort =====
  function hutParts() {
    const B = new Builder(), R = new Builder();
    for (const [px, pz] of [[-0.06, -0.05], [0.06, -0.05], [-0.06, 0.05], [0.06, 0.05]]) B.add(box(0.012, 0.04, 0.012), 0x6a4a2a, px, 0, pz);
    B.add(box(0.15, 0.11, 0.13), C.bamboo, 0, 0.035, 0, { vary: 0.08 });
    B.add(box(0.04, 0.07, 0.008), PAL.dark, 0, 0.035, 0.066);
    R.add(pyr(0.22, 0.13, 0.19), 0xffffff, 0, 0.145, 0, { vary: 0.06 });
    R.add(box(0.006, 0.05, 0.006), 0xffffff, 0, 0.27, 0, { vary: 0 });
    return { body: B.build(), roof: R.build() };
  }
  function seaFortParts() {
    const B = new Builder(), R = new Builder();
    B.add(cyl(0.2, 0.22, 0.14, 14), 0xc9bda2, 0, 0, 0, { vary: 0.07 });
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; B.add(box(0.05, 0.04, 0.04), 0xc9bda2, Math.cos(a) * 0.19, 0.14, Math.sin(a) * 0.19, { ry: -a }); }
    B.add(cyl(0.08, 0.085, 0.3, 12), 0xd6cbb6, 0, 0, -0.02, { vary: 0.06 });
    for (const a of [0.5, -0.5]) B.add(cyl(0.012, 0.016, 0.08, 8), C.iron, Math.sin(a) * 0.2, 0.07, Math.cos(a) * 0.2, { rx: Math.PI / 2 - 0.1, ry: a });
    B.add(box(0.05, 0.08, 0.01), PAL.dark, 0, 0, 0.215);
    R.add(cone(0.1, 0.13, 12), 0xffffff, 0, 0.3, -0.02, { vary: 0 });
    R.add(box(0.004, 0.05, 0.06), 0xffffff, 0.0, 0.46, 0.01, { vary: 0 });
    return { body: B.build(), roof: R.build() };
  }

  // ===== what moves, place by place (in the place's frame; heights above its land) =====
  // moor: a ship at anchor; bob: something floating; spin: turning where it is; sway: rising and curling (the kraken's
  // arms); jump: a dolphin leaping; birds: gulls circling; walking ones go there and back.
  // ----- the places that have a model of their own, made from the Higgsfield pictures (art/m_*.glb, see glb.js): it
  // stands in its water instead of the island made here, whose relief is then only a shallow shelf round it. s is its
  // size (a lot is 1 wide), ry how far it is turned, x and z where it stands in the lot, y how high its water line is
  // (each file's own, from tools/glb_prep.mjs, is at its y = 0) -----
  // (the lots by a corner share their inner corner with the next side's lot: their models stand away from it, along
  // their side and towards their square)
  // (own: the model is a town without its island: it stands on the island made here, y above the water)
  const MODELS = {
    1: { url: 'art/m_heligoland_animated.glb', animated: true, s: 1.18, x: -0.16, z: -0.02 },
    3: { url: 'art/m_gotland_animated.glb', animated: true, s: 0.95, y: 0.122, own: true },
    4: { url: 'art/m_customs_animated.glb', animated: true, s: 1.10, z: -0.02 },
    9: { url: 'art/m_gramvousa_animated.glb', animated: true, s: 1.22, x: 0.12, z: -0.02 },
    12: { url: 'art/m_lighthouse_animated.glb', animated: true, s: 0.93 },
    28: { url: 'art/m_shipyard_animated.glb', animated: true, s: 1.18, z: -0.02 },
    31: { url: 'art/m_cheungchau_animated.glb', animated: true, s: 1.22, x: -0.12, z: -0.02 },
    37: { url: 'art/m_oak_animated.glb', animated: true, s: 1.22 },
    39: { url: 'art/m_cocos_animated.glb', animated: true, s: 1.22, x: 0.12, z: -0.02 }
  };
  const shelf = (R, d) => { tint(R, 0xe3cf98, 0xb8a27a); isle(R, d.x || 0, d.z || 0, 0.36 * (d.s || 1), 0.34 * (d.s || 1), -0.035, 0, 0.6); };
  // the corner squares' models: little dioramas standing on the square (in the square's frame, on its top)
  const CORNER_MODELS = {
    0: { url: 'art/m_port_animated.glb', animated: true, s: 1.32, x: 0.02, z: -0.38 },
    10: { url: 'art/m_castaway_animated.glb', animated: true, s: 1.30, x: 0.02, z: -0.38 },
    20: { url: 'art/m_tavern_animated.glb', animated: true, s: 1.35, x: 0.02, z: -0.38 },
    30: { url: 'art/m_kraken_animated.glb', animated: true, s: 1.32, x: 0.02, z: -0.38 }
  };
  // the ships' models (they ride at anchor in their lot's water: see FX), and the whirlpool's swirl, which turns: s their
  // size, y how far their water line is above their file's bottom, ry which way their bow points in it
  const SHIP_MODEL = {
    5: { url: 'art/m_qar_animated.glb', animated: true, s: 0.82, y: -0.045, ry: Math.PI },
    15: { url: 'art/m_whydah_animated.glb', animated: true, s: 0.85, y: -0.05, ry: Math.PI },
    25: { url: 'art/m_galley_animated.glb', animated: true, s: 0.85, y: -0.035, ry: Math.PI },
    35: { url: 'art/m_fortune_animated.glb', animated: true, s: 0.81, y: -0.05, ry: Math.PI }
  };
  const SWIRL_MODEL = { url: 'art/m_whirlpool_animated.glb', animated: true, s: 0.85, sy: 0.12, y: 0.004 };

  const ride = (x, z, ry, k = 'galleon', model = null) => ({ k, moor: true, at: [x, z], ry, model });
  const FX = {
    1: { birds: [{ at: [-0.05, -0.1], r: 0.2, h: 0.55, w: 0.5 }] },
    3: { smoke: [[0.12, 0.0, 0.1]] },
    6: { smoke: [[-0.05, -0.04, 0.02]] },
    11: { actors: [{ k: 'sheep', at: [-0.08, -0.08], r: 0.04 }, { k: 'sheep', at: [-0.2, -0.16], r: 0.03 }] },
    12: { sparkle: [[0.0, -0.1, 0.42, 2]], birds: [{ at: [0.0, -0.1], r: 0.22, h: 0.6, w: -0.45 }] },
    13: { sparkle: [[0.14, -0.08, 0.27, 2]], actors: [{ k: 'pony', a: [-0.24, -0.06], b: [0.0, -0.1], speed: 0.03 }, ride(0.0, 0.2, 0.1, 'sloop')] },
    14: { sparkle: [[0.08, 0.02, 0.05, 1]], actors: [{ k: 'mill', spin: 1.2, axis: 'x', ry: -Math.PI / 2, at: [-0.14, -0.035], h: 0.15 }] },
    16: { smoke: [[0.22, 0.14, 0.06]] },
    18: { smoke: [[-0.02, 0.06, 0.04], [0.04, 0.06, 0.04]] },
    19: { smoke: [[-0.04, -0.1, 0.11], [0.15, -0.1, 0.11]] },
    21: { smoke: [[0.06, -0.12, 0.08]] },
    23: { sparkle: [[-0.1, 0.02, 0.02, 1]] },
    26: { birds: [{ at: [0.0, -0.1], r: 0.18, h: 0.45, w: 0.4 }] },
    27: { smoke: [[-0.02, -0.18, 0.5], [0.0, -0.17, 0.5]] },
    29: { sparkle: [[0.06, 0.0, 0.02, 1]] },
    31: { smoke: [[0.12, -0.02, 0.08]] },
    32: { actors: [{ k: 'tortoise', a: [-0.1, -0.06], b: [0.12, 0.0], speed: 0.008 }, { k: 'tortoise', a: [0.16, -0.24], b: [-0.04, -0.2], speed: 0.006, phase: 0.6 }] },
    34: { actors: [{ k: 'goat', a: [-0.2, -0.1], b: [-0.04, -0.14], speed: 0.02 }, { k: 'goat', a: [0.1, -0.12], b: [0.22, -0.08], speed: 0.018, phase: 0.4 }] },
    37: { sparkle: [[0.02, -0.08, 0.0, 1]] },
    39: { sparkle: [[0.0, 0.02, 0.02, 1]] },
    5: { actors: [ride(-0.06, 0.12, 0.2, 'galleon', SHIP_MODEL[5])] }, 15: { actors: [ride(0.06, 0.12, -0.15, 'galleon', SHIP_MODEL[15])] },
    25: { actors: [ride(-0.06, 0.12, 0.1, 'galley', SHIP_MODEL[25])] }, 35: { actors: [ride(0.06, 0.12, -0.2, 'galleon', SHIP_MODEL[35])] },
    28: { smoke: [[-0.24, 0.0, 0.04]] },
    4: { sparkle: [[0.02, -0.04, 0.05, 1]] },
    38: { actors: [{ k: 'swirl', spin: -1.3, at: [0.0, -0.06], h: 0, model: SWIRL_MODEL }, { k: 'barrel', orbit: true, at: [0.0, -0.06], r: 0.2, w: -1.1 }, { k: 'barrel', orbit: true, at: [0.0, -0.06], r: 0.12, w: -1.6, phase: 3 }] },
    2: { sparkle: [[0.02, -0.1, 0.06, 1]] }, 17: { sparkle: [[0.02, -0.1, 0.06, 1]] }, 33: { sparkle: [[0.02, -0.1, 0.06, 1]] },
    7: { actors: [{ k: 'bottle', bob: true, at: [0.12, 0.06] }], sparkle: [[0.12, 0.06, 0.06, 2]] },
    22: { actors: [{ k: 'bottle', bob: true, at: [0.1, 0.04] }], sparkle: [[0.1, 0.04, 0.06, 2]] },
    36: { actors: [{ k: 'bottle', bob: true, at: [0.12, 0.06] }], sparkle: [[0.12, 0.06, 0.06, 2]] },
    // the corner squares (on the square itself)
    0: { sparkle: [[-0.3, -0.34, 0.1, 1]] },
    10: CORNER_MODELS[10] ? null : { smoke: [[0.3, -0.12, 0.05]] },
    20: CORNER_MODELS[20] ? null : { smoke: [[-0.1, -0.46, 0.45]] },
    30: CORNER_MODELS[30] ? null : { actors: [[-0.2, -0.36, 0.4], [0.12, -0.38, -0.6], [-0.05, -0.16, 2.6], [0.1, -0.22, -2.2], [-0.24, -0.2, 1.5]].map(([x, z, ry], k) => ({ k: 'tentacle', sway: true, at: [x, z], ry, phase: k * 1.3 })) }
  };
  const CENTER_FX = CENTER_MODEL && CENTER_MODEL.animated ? {
    smoke: [], mist: [], sheep: [], birds: [], actors: []
  } : CENTER_MODEL ? {
    // the model's: smoke from its crater, birds round it, ships sailing round the island
    smoke: CENTER_MODEL.smoke, mist: [], sheep: [],
    birds: [{ at: CENTER.peak, r: 1.4, h: CENTER_MODEL.top + 0.35, w: 0.22 }, { at: CENTER.peak, r: 2.0, h: CENTER_MODEL.top - 0.1, w: -0.17 }],
    actors: [
      { k: 'galleon', orbit: true, at: [0, 0], r: 2.95, w: 0.05, s: 1.25, phase: 1 },
      { k: 'sloop', orbit: true, at: [0, 0], r: 2.8, w: -0.07, s: 1.3, phase: 4 },
      { k: 'junk', orbit: true, at: [0, 0], r: 3.05, w: 0.045, s: 1.2, phase: 3.6 },
      { k: 'dolphin', jump: true, at: [2.2, 2.4], b: [2.9, 1.3], s: 1.3 },
      { k: 'dolphin', jump: true, at: [-2.8, -1.7], b: [-1.8, -2.8], s: 1.3, phase: 0.5 }
    ]
  } : {
    smoke: [[0.05, -0.15, 0.08], [0.12, -0.1, 0.06], [-0.02, -0.2, 0.07], [CENTER.camp[0] - 0.04, CENTER.camp[1] + 0.02, 0.04]],
    mist: [[0.24, -2.4, 0.05]],
    sheep: [],
    birds: [{ at: [0.05, -0.15], r: 1.5, h: 2.1, w: 0.22 }, { at: [0.05, -0.15], r: 2.1, h: 1.6, w: -0.17 }, { at: [-2.05, 0.3], r: 0.5, h: 0.95, w: 0.5 }],
    actors: [
      { k: 'galleon', moor: true, at: [CENTER.bay[0], CENTER.bay[1] + 0.4], ry: -Math.PI / 2 + 0.3, s: 1.5 },
      { k: 'galleon', orbit: true, at: [0, 0], r: 2.95, w: 0.05, s: 1.25, phase: 1 },
      { k: 'sloop', orbit: true, at: [0, 0], r: 2.75, w: -0.07, s: 1.3, phase: 4 },
      { k: 'junk', orbit: true, at: [0, 0], r: 3.0, w: 0.045, s: 1.2, phase: 3.6 },
      { k: 'dolphin', jump: true, at: [1.9, 2.3], b: [2.7, 1.2], s: 1.3 },
      { k: 'dolphin', jump: true, at: [-2.6, -1.6], b: [-1.6, -2.6], s: 1.3, phase: 0.5 }
    ]
  };

  // ----- the actors' own shapes (around their own origin, facing +x; ships with their water line at 0) -----
  function actor(k) {
    const B = new Builder(), put = (g, c, x = 0, y = 0, z = 0, o = {}) => B.add(g, c, x, y, z, o);
    if (k === 'galleon') ship(put);
    else if (k === 'galley') ship(put, { len: 0.52, wid: 0.13, masts: [0.36, 0.3, 0], oars: true, hull: 0x4a2e1c });
    else if (k === 'sloop') sloop(put);
    else if (k === 'junk') ship(put, { len: 0.4, wid: 0.13, masts: [0.32, 0.26, 0.22], junk: true, hull: 0x6a4a2a, trim: 0xb8452a, flag: 0xb8332a });
    else if (k === 'dolphin') {
      put(ball(0.035, 1), 0x6f8fa8, 0, 0, 0, { sx: 2.6, sy: 0.85, sz: 0.85, round: true });
      put(ball(0.02, 0), 0xdfe8ee, 0.01, -0.01, 0, { sx: 3, sy: 0.6, round: true });
      put(cone(0.016, 0.04, 4), 0x5f7f98, -0.005, 0.02, 0, { rz: -0.3, sz: 0.25 });
      put(box(0.02, 0.006, 0.07), 0x5f7f98, -0.1, 0, 0);
      put(cone(0.01, 0.03, 6), 0x6f8fa8, 0.1, -0.003, 0, { rz: -Math.PI / 2 });
    } else if (k === 'bottle') {
      put(lathe([[0, -0.03], [0.022, -0.028], [0.024, 0.02], [0.012, 0.04], [0.008, 0.06], [0.009, 0.07], [0, 0.07]], 10), 0x6fa88a, 0, 0, 0, { rz: Math.PI / 2 - 0.15, smooth: true, vary: 0 });
      put(cyl(0.008, 0.008, 0.016, 8), 0x9a6a3a, 0.07, 0.01, 0, { rz: Math.PI / 2 });
      put(cyl(0.012, 0.012, 0.05, 8), 0xf3e2b6, -0.01, 0.0, 0, { rz: Math.PI / 2 });
    } else if (k === 'tentacle') {
      // an arm rising out of the water and curling over at its tip; suckers on its inner side
      const n = 9;
      let x = 0, y = -0.02, a = Math.PI / 2;
      for (let j = 0; j < n; j++) {
        const t = j / n, len = 0.075 * (1 - t * 0.35), r0 = 0.05 * (1 - t) + 0.008, r1 = 0.05 * (1 - (j + 1) / n) + 0.006;
        const g = cyl(r1, r0, len, 8);
        put(g, j % 2 ? 0x8a2f4a : 0x9a3a55, x, y, 0, { rz: a - Math.PI / 2, smooth: true, vary: 0 });
        if (j > 1 && j < n - 1) put(ball(r0 * 0.4, 0), 0xf0c2c2, x + Math.cos(a + Math.PI / 2) * r0 * 0.8, y + Math.sin(a + Math.PI / 2) * r0 * 0.8, 0, { vary: 0 });
        x += Math.cos(a) * len; y += Math.sin(a) * len; a += 0.28 + t * 0.32;
      }
    } else if (k === 'swirl') {
      for (let arm = 0; arm < 3; arm++) for (let j = 0; j < 14; j++) {
        const t = j / 14, ang = arm * Math.PI * 2 / 3 + t * 4.2, d = 0.04 + t * 0.26;
        put(box(0.05, 0.004, 0.012 + t * 0.012), 0xe9f4f6, Math.cos(ang) * d, 0.002 + 0.002 * t, Math.sin(ang) * d, { ry: -ang - 1.2, vary: 0 });
      }
      put(cyl(0.06, 0.06, 0.003, 14), 0x0e2e4a, 0, 0.003, 0);
    } else if (k === 'barrel') {
      put(new T.CylinderGeometry(0.024, 0.024, 0.06, 9), 0x8a5a32, 0, 0.0, 0, { rz: Math.PI / 2, vary: 0.06 });
      for (const x of [-0.018, 0.018]) put(new T.CylinderGeometry(0.0255, 0.0255, 0.005, 9), 0x3a3a3a, x, 0, 0, { rz: Math.PI / 2 });
    } else if (k === 'tortoise') {
      put(dome(0.045, 10), 0x6a5a3a, 0, 0.018, 0, { sx: 1.25, smooth: true, vary: 0 });
      put(ball(0.014, 0), 0x8a7a5a, 0.06, 0.03, 0); put(box(0.03, 0.01, 0.01), 0x8a7a5a, 0.045, 0.026, 0);
      for (const [lx, lz] of [[-0.03, -0.03], [-0.03, 0.03], [0.03, -0.03], [0.03, 0.03]]) put(box(0.014, 0.02, 0.014), 0x8a7a5a, lx, 0, lz);
    } else if (k === 'goat' || k === 'pony') {
      const c = k === 'goat' ? 0xe9e2d2 : 0x8a5a3a, s = k === 'goat' ? 1 : 1.3;
      put(box(0.07 * s, 0.035 * s, 0.03 * s), c, 0, 0.045 * s, 0); put(box(0.02 * s, 0.04 * s, 0.018 * s), c, 0.035 * s, 0.065 * s, 0, { rz: -0.4 });
      put(box(0.03 * s, 0.018 * s, 0.018 * s), c, 0.05 * s, 0.09 * s, 0);
      for (const [lx, lz] of [[-0.025, -0.01], [-0.025, 0.01], [0.025, -0.01], [0.025, 0.01]]) put(box(0.008 * s, 0.045 * s, 0.008 * s), tone(c, 0.8), lx * s, 0, lz * s);
      if (k === 'goat') for (const z of [-0.006, 0.006]) put(cone(0.004, 0.025, 4), 0x5a4a3a, 0.045, 0.1, z, { rz: 0.6 });
      else put(box(0.04 * s, 0.012 * s, 0.006), 0x3a2a1a, 0.02 * s, 0.085 * s, 0, { rz: -0.4 });
    } else if (k === 'mill') {
      put(cyl(0.008, 0.008, 0.012, 8), 0x5a4a3a, 0, 0, 0, { rx: Math.PI / 2 });
      for (let j = 0; j < 4; j++) { const a = j * Math.PI / 2; put(box(0.004, 0.11, 0.024), 0xe9e2d2, 0.004, Math.cos(a) * 0.06, Math.sin(a) * 0.06, { rx: -a }); }
    } else if (k === 'gull') {
      put(ball(0.02, 1), 0xf4f4f0, 0, 0, 0, { sx: 2.2, sy: 0.75, round: true }); put(cone(0.006, 0.016, 4), 0xe3b23c, 0.05, 0.002, 0, { rz: -Math.PI / 2 });
      put(box(0.03, 0.004, 0.02), 0xd9d9d4, -0.045, 0.002, 0);
    } else if (k === 'gwing') {
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([0.02, 0, 0, -0.02, 0, 0, 0.005, 0, 0.11, -0.02, 0, 0, -0.03, 0, 0.08, 0.005, 0, 0.11], 3));
      put(g, 0xc9ccd2, 0, 0, 0, { vary: 0 });
    } else return Models.actor(k);
    return B.build();
  }

  // ----- public -----
  function relief(i, R) { if (MODELS[i] && !MODELS[i].own) shelf(R, MODELS[i]); else if (L[i] && L[i].r) L[i].r(R); else R.tint(0x5aa34a, 9); }
  function lot(i, ground) {
    if (MODELS[i]) return null;
    const B = new Builder();
    B.ground = ground; B.wl = WL_LOT;
    if (L[i] && L[i].b) L[i].b(B);
    return B.parts.length ? B.build() : null;
  }
  function ringRelief(k, R) { RING[k].r(R); }
  function inner(k, ground) { const B = new Builder(); B.ground = ground; B.wl = WL_RING; RING[k].b(B); return B.build(); }
  let hutCache = null, fortCache = null;
  // a ship to stand for a player on the board, facing +x: two masts, their sails in the player's colour and braced round
  // (as when the wind comes from the side), so that they are seen whole from beside the board
  function tokenShip(color) {
    const B = new Builder(), put = (g, c, x = 0, y = 0, z = 0, o = {}) => B.add(g, c, x, y, z, o);
    put(hullGeo(0.42, 0.14, 0.085), C.hull, 0, 0.0, 0, { vary: 0.05 });
    put(hullGeo(0.425, 0.143, 0.016), C.trim, 0, 0.072, 0, { vary: 0 });
    put(box(0.38, 0.01, 0.1), C.plank, -0.01, 0.08, 0);
    put(box(0.11, 0.055, 0.115), C.hull, -0.15, 0.08, 0); put(box(0.115, 0.01, 0.12), C.trim, -0.15, 0.135, 0);
    put(cyl(0.004, 0.006, 0.13, 5), 0x4a3020, 0.25, 0.09, 0, { rz: -1.2 });
    for (const [x, h, w] of [[0.06, 0.4, 0.26], [-0.08, 0.32, 0.2]]) {
      put(cyl(0.006, 0.008, h, 6), 0x4a3020, x, 0.085, 0);
      put(sailGeo(w, h * 0.38, 0.03, 0.9), color, x + 0.012, 0.085 + h * 0.36, 0, { ry: 0.75, vary: 0 });
      put(sailGeo(w * 0.78, h * 0.26, 0.024, 0.85), color, x + 0.012, 0.085 + h * 0.72, 0, { ry: 0.75, vary: 0 });
      for (const y of [0.085 + h * 0.17, 0.085 + h * 0.55, 0.085 + h * 0.86]) put(box(0.006, 0.006, w * 1.04), 0x4a3020, x + 0.004, y, 0, { ry: 0.75 });
    }
    put(box(0.003, 0.03, 0.07), color, 0.06, 0.47, 0.035);                     // the pennant at the top
    return B.build();
  }
  return {
    world: 'sea', relief, lot, corner, ringRelief, inner, centerRelief, centerWater, center, far, CENTER, CENTER_FX, actor, tokenShip, models: MODELS, cornerModels: CORNER_MODELS, centerModel: CENTER_MODEL,
    fx: i => FX[i] || null,
    tower: () => hutCache || (hutCache = hutParts()),
    castle: () => fortCache || (fortCache = seaFortParts()),
    LIFE: ['galleon', 'galley', 'sloop', 'junk', 'dolphin', 'bottle', 'tentacle', 'swirl', 'barrel', 'tortoise', 'goat', 'pony', 'sheep', 'mill', 'cloud', 'gull', 'gwing'],
    BIRD: ['gull', 'gwing']
  };
})();
