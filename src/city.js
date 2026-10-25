// ===== ტფილისი in 3D: Tbilisi, made in code like the land (models.js), with its landmarks from files =====
// The Mtkvari runs through the middle of the board from corner to corner: in at the back left, between Didube and Dighomi,
// out at the front right, between Ortachala and the quiz's market. On its right bank Narikala stands on its ridge with
// Kartlis Deda beside it; three bridges cross it (the stone bridge, the Peace Bridge, Metekhi's); the cable car goes up
// from Rike Park over the water to the fortress. Around them the city: old houses with wooden balconies by the river,
// Soviet blocks and new towers further off, green hills at the back. Every district on the ring has its own scene
// (its card's), and nine have their own model (art/m_tb_*.glb: the bank, Sameba, the old courtyard, Rustaveli,
// Mtatsminda, the baths; Freedom Square and the embankment's bench on their corners). Cars, buses and trains go about,
// boats on the river and the lakes, the funicular and the cable cars up and down, falcons over Narikala.
// A place's frame is the land's: x along the board's side (to the right seen from its side), +z towards its square
// (and the camera), y up.

const CityModels = (() => {
  const T = window.THREE;
  if (!T || typeof Models === 'undefined' || !Models || typeof Terrain === 'undefined' || !Terrain) return null;
  const { Builder, rng, tone, PAL } = Models;
  const { box, cyl, cone, pyr, ball, roof, dome, jitter } = Models.shapes;
  const { tree, bigTree, pine, bush, rock, church, coins, moneyBag } = Models.parts;

  const C = {
    cream: 0xe9ddc3, sand: 0xdcc8a2, ochre: 0xd8b17a, peach: 0xe4b69e, rose: 0xd99d8c, sky: 0xbfd4d8, mint: 0xc7dac2, lilac: 0xd3c3da,
    tile: 0xb35a3c, tile2: 0x9c4a35, tin: 0x8f959a, tin2: 0x70757a, rust: 0x9b4d35, roofGreen: 0x5f7f6a,
    panel: 0xcac4b7, panel2: 0xb2aa9a, panel3: 0xd9d2c3, glass: 0x5b7889, glass2: 0x8aabbd, win: 0x39444f,
    wood: 0x7d5234, wood2: 0x5b3a24, balcony: 0x6b8f88, iron: 0x3a3c40,
    asphalt: 0x8e8a83, cobble: 0xb5a78f, paving: 0xcdbfa3, lawn: 0x86b74e, dusty: 0x9fb565,
    leaf: 0x57893d, leaf2: 0x467a36, autumn: 0xc98a33, cypress: 0x2f5536,
    bronze: 0x564838, gold: 0xe2b04a, red: 0xc23a2e, white: 0xf3efe6, blue: 0x2f62a8, yellow: 0xe9c449, stone: 0xcfc1a7, stone2: 0xb3a58c, brick: 0xae5c3d
  };
  const WALLS = [C.cream, C.sand, C.ochre, C.peach, C.rose, C.sky, C.mint, C.lilac, 0xe2d2b0, 0xd7c3a5];

  // ===== pieces =====
  // a window or a band of windows: a thin dark pane just in front of a wall facing +z
  const pane = (w, h) => new T.PlaneGeometry(w, h).translate(0, h / 2, 0);
  // an old Tbilisi house: fl floors, a hipped roof, windows in rows, and (bal) a wooden balcony along the upper floor
  function oldHouse(B, x, z, w, d, fl, wallC, roofC, ry = 0, bal = true, s = 1) {
    const put = B.at(x, z, ry, s), fh = 0.072, h = fh * fl;
    put(box(w, h, d), wallC, 0, 0, 0, { vary: 0.04 });
    put(pyr(w * 1.1, 0.05 + 0.25 * Math.min(w, d), d * 1.12), roofC, 0, h, 0, { vary: 0.07 });
    const n = Math.max(1, Math.round(w / 0.055));
    for (let f = 0; f < fl; f++) for (let k = 0; k < n; k++) {
      const wx = -w / 2 + (k + 0.5) * w / n;
      if (bal && f === fl - 1 && fl > 1) continue;                     // (behind the balcony)
      put(pane(w / n * 0.42, fh * 0.48), f === 0 && k === Math.floor(n / 2) ? C.wood2 : C.win, wx, f * fh + (f ? fh * 0.28 : 0), d / 2 + 0.002, { vary: 0 });
    }
    if (bal && fl > 1) {
      const by = (fl - 1) * fh;
      put(box(w * 0.9, 0.01, 0.045), C.wood, 0, by, d / 2 + 0.022);                          // its floor
      put(box(w * 0.9, fh * 0.62, 0.006), C.balcony, 0, by + 0.01, d / 2 + 0.044, { vary: 0.05 });   // carved and glazed
      put(box(w * 0.9, fh * 0.2, 0.008), C.wood2, 0, by + 0.01, d / 2 + 0.046);              // the carved rail
      put(box(w * 0.92, 0.008, 0.05), C.wood2, 0, by + fh * 0.7, d / 2 + 0.024);               // its little roof
    }
  }
  // a Soviet block: fl floors of panels, a band of windows on each, balconies in a few columns, a flat roof
  function block(B, x, z, w, d, fl, c = C.panel, ry = 0, balc = 3) {
    const put = B.at(x, z, ry), fh = 0.05, h = fh * fl;
    put(box(w, h, d), c, 0, 0, 0, { vary: 0.03 });
    put(box(w * 1.02, 0.012, d * 1.04), tone(c, 0.8), 0, h, 0);
    for (let f = 0; f < fl; f++) {
      for (const s of [1, -1]) put(pane(w * 0.9, fh * 0.34), C.win, 0, f * fh + fh * 0.36, s * (d / 2 + 0.002), { ry: s > 0 ? 0 : Math.PI, vary: 0 });
      for (let k = 0; k < balc; k++) put(box(w / balc * 0.5, fh * 0.42, 0.02), tone(c, 1.08), -w / 2 + (k + 0.5) * w / balc, f * fh + fh * 0.12, d / 2 + 0.01);
    }
  }
  // a new tower: glass in strips, a colour of its own on its corners
  function tower(B, x, z, w, d, h, c = C.panel3, accent = C.peach, ry = 0) {
    const put = B.at(x, z, ry), n = Math.max(2, Math.round(h / 0.05));
    put(box(w, h, d), c, 0, 0, 0, { vary: 0.03 });
    for (let f = 0; f < n; f++) for (const s of [1, -1]) put(pane(w * 0.84, h / n * 0.5), f % 2 ? C.glass : C.glass2, 0, f * h / n + h / n * 0.25, s * (d / 2 + 0.002), { ry: s > 0 ? 0 : Math.PI, vary: 0 });
    put(box(w * 0.18, h * 1.02, d * 1.02), accent, w * 0.41, 0, 0);
    put(box(w * 1.04, 0.015, d * 1.04), tone(c, 0.75), 0, h, 0);
  }
  const cypress = (B, x, z, s = 1) => { B.add(cyl(0.005 * s, 0.007 * s, 0.03 * s, 5), PAL.trunk, x, 0, z); B.add(jitter(cone(0.032 * s, 0.24 * s, 7), 0.1, x * 13 + z), C.cypress, x, 0.02 * s, z, { smooth: true, vary: 0, sway: 0.5 }); };
  const poplar = (B, x, z, s = 1) => { B.add(cyl(0.008 * s, 0.012 * s, 0.06 * s, 5), PAL.trunk, x, 0, z); B.add(jitter(ball(0.045 * s, 1), 0.14, x * 7 + z), C.leaf, x, 0.17 * s, z, { sy: 3, round: true, sway: 1.1 }); };
  const plane = (B, x, z, s = 1, leaf = C.leaf) => tree(B, x, z, s * 0.9, leaf);
  const lamp = (B, x, z, s = 1) => { B.add(cyl(0.004 * s, 0.005 * s, 0.13 * s, 5), C.iron, x, 0, z); B.add(box(0.016 * s, 0.022 * s, 0.016 * s), 0xffe9b0, x, 0.13 * s, z); };
  const bench = (B, x, z, ry = 0) => { const put = B.at(x, z, ry); put(box(0.07, 0.008, 0.024), C.wood, 0, 0.022, 0); put(box(0.07, 0.022, 0.005), C.wood, 0, 0.03, -0.011); for (const k of [-0.03, 0.03]) put(box(0.004, 0.022, 0.02), C.iron, k, 0, 0); };
  function car(B, x, z, ry = 0, c = C.red, s = 1) {
    const put = B.at(x, z, ry, s);
    put(box(0.075, 0.022, 0.036), c, 0, 0.008, 0); put(box(0.042, 0.018, 0.032), C.glass, -0.004, 0.03, 0);
    for (const [wx, wz] of [[-0.024, -0.018], [0.024, -0.018], [-0.024, 0.018], [0.024, 0.018]]) put(box(0.016, 0.016, 0.006), 0x222222, wx, 0, wz);
  }
  function bus(B, x, z, ry = 0, c = 0x3f7fc2, len = 0.17, s = 1) {
    const put = B.at(x, z, ry, s);
    put(box(len, 0.05, 0.045), c, 0, 0.008, 0); put(box(len * 0.92, 0.016, 0.047), C.glass, 0, 0.032, 0); put(box(len * 1.01, 0.008, 0.046), C.white, 0, 0.058, 0);
    for (const wx of [-len * 0.32, len * 0.32]) for (const wz of [-0.02, 0.02]) put(box(0.02, 0.016, 0.006), 0x222222, wx, 0, wz);
  }
  const minibus = (B, x, z, ry = 0) => { bus(B, x, z, ry, 0xf2f0ea, 0.085); B.at(x, z, ry)(box(0.086, 0.006, 0.047), C.yellow, 0, 0.024, 0); };
  function stall(B, x, z, ry = 0, awn = C.red) {
    const put = B.at(x, z, ry);
    put(box(0.09, 0.03, 0.05), C.wood, 0, 0, 0);
    for (let k = 0; k < 5; k++) put(ball(0.008), [0xd94a2e, 0xf0a530, 0x7cae3a, 0x8a3a6a, 0xe8c547][k], -0.032 + k * 0.016, 0.034, 0.008 * (k % 2), { vary: 0 });
    for (const k of [-0.042, 0.042]) put(box(0.004, 0.08, 0.004), C.wood2, k, 0, -0.022);
    put(box(0.1, 0.006, 0.06), awn, 0, 0.08, -0.004, { rx: 0.18 });
  }
  const umbrella = (B, x, z, c = C.white) => { B.add(cyl(0.003, 0.003, 0.06, 4), C.iron, x, 0, z); B.add(cone(0.035, 0.02, 8), c, x, 0.06, z); B.add(cyl(0.018, 0.018, 0.004, 8), C.white, x, 0.022, z); };
  function pylon(B, x, z, h = 0.42) {          // a power line's tower: a tall frame narrowing upward, with arms
    B.add(taperFrame(h), C.iron, x, 0, z);
    for (const y of [h * 0.72, h * 0.9]) B.add(box(0.11, 0.006, 0.006), C.iron, x, y, z);
  }
  function taperFrame(h) { const g = new T.CylinderGeometry(0.008, 0.04, h, 4, 1, true); g.rotateY(Math.PI / 4); g.translate(0, h / 2, 0); return g; }
  // the cars stuck in the traffic jam, one lane after another
  function jam(B, x, z, n, ry = 0, gap = 0.1, seed = 1) {
    const r = rng(seed), cs = [C.red, C.white, 0x2f62a8, 0x3c3c3c, 0xd9d4c8, C.yellow, 0x6a8a3a, 0x8a2a2a];
    for (let k = 0; k < n; k++) { const p = -(n - 1) * gap / 2 + k * gap; if (r() < 0.18) minibus(B, x + Math.cos(ry) * p, z - Math.sin(ry) * p, ry); else car(B, x + Math.cos(ry) * p, z - Math.sin(ry) * p, ry, cs[Math.floor(r() * cs.length)]); }
  }
  function trafficLight(B, x, z, ry = 0) {
    const put = B.at(x, z, ry);
    put(cyl(0.005, 0.006, 0.2, 6), C.iron, 0, 0, 0); put(box(0.024, 0.06, 0.02), 0x2a2a2a, 0, 0.2, 0.01);
    put(box(0.014, 0.014, 0.004), 0xff3b2b, 0, 0.243, 0.021, { vary: 0 }); put(box(0.014, 0.014, 0.004), 0x5a3a1a, 0, 0.226, 0.021, { vary: 0 }); put(box(0.014, 0.014, 0.004), 0x1a3a1a, 0, 0.209, 0.021, { vary: 0 });
  }
  // a vault of glass over the platforms (along x)
  function vault(B, x, z, len, r, c = C.glass2, ry = 0) {
    const g = new T.CylinderGeometry(r, r, len, 10, 1, true, -Math.PI / 2, Math.PI);
    g.rotateZ(Math.PI / 2); B.at(x, z, ry)(g, c, 0, 0, 0, { vary: 0.04 });
  }
  // the metro's round pavilion of the 1960s, its red sign
  function pavilion(B, x, z, s = 1) {
    const put = B.at(x, z, 0, s);
    put(cyl(0.11, 0.11, 0.07, 14), C.panel3); put(cyl(0.135, 0.135, 0.012, 16), C.white, 0, 0.07, 0);
    put(dome(0.09, 12), C.panel, 0, 0.08, 0, { smooth: true, vary: 0 });
    put(pane(0.06, 0.05), C.glass, 0, 0.005, 0.111, { vary: 0 });
    put(cyl(0.004, 0.004, 0.12, 5), C.iron, 0.16, 0, 0.06); put(box(0.04, 0.04, 0.01), C.red, 0.16, 0.12, 0.06);
  }
  // Didube's or Metekhi's church: Models' church in the city's stone
  const chapel = (B, x, z, s, ry = 0) => church(B, x, z, s, 0xd7c6a2, 0x7c6e5c, ry);

  // ===== the land inside the squares: one map of the old city (the concept the user chose, from the board's
  // skeleton), the river through its middle from the back to the front =====
  // (board coordinates, x to the right and z to the front seen from the front; the squares' own lots have no scenes of
  // their own: the players' houses and hotels stand on the squares, at their inner edge)
  // the Mtkvari: in under the back's squares (24), out under the front's (5); its branch round Metekhi's cliff, out
  // under the left side's (14)
  const RIVER = [[-1.35, -5.4], [-1.25, -4.6], [-1.0, -3.2], [-0.55, -1.9], [0.0, -0.7], [0.15, 0.5], [0.0, 1.7], [-0.2, 2.9], [0.0, 4.6], [0.05, 5.4]];
  const BRANCH = [[0.0, 1.0], [-1.4, 1.55], [-2.8, 1.5], [-4.45, 1.2], [-5.4, 1.1]];
  const WATER_Y = -0.05;
  let riverPts = RIVER, branchPts = BRANCH;
  // how far a point is from a line of points, and which way the line runs there
  function near(pts, x, z) {
    let best = Infinity, dir = [1, 0];
    for (let k = 1; k < pts.length; k++) {
      const [ax, az] = pts[k - 1], [bx, bz] = pts[k], dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (l * l))), d = Math.hypot(ax + dx * t - x, az + dz * t - z);
      if (d < best) { best = d; dir = [dx / l, dz / l]; }
    }
    return [best, dir];
  }
  const along = (x, z) => near(riverPts, x, z)[1];
  // the landmarks' places: Mtatsminda's hill (its tower a little behind its middle, turned with it), Narikala on the
  // right, Kartlis Deda behind it, the Old Town below it, the baths at the front; Sameba at the back left, Metekhi's
  // cliff on the left, Rike Park at the front left; the two bridges
  const MT = [1.2, -3.05], MT_W = 2.9, MT_RY = 1.1;
  const TOWER = [MT[0] + Math.sin(MT_RY) * -0.09 * MT_W, MT[1] + Math.cos(MT_RY) * -0.09 * MT_W];
  const CENTER = { peak: TOWER, mountain: MT, narikala: [3.05, -1.25], deda: [3.95, -3.25], sameba: [-2.95, -3.2], baths: [1.25, 3.65],
    bank: [1.6, 1.05], courtyard: [3.55, 2.45], cliff: [-2.3, -0.25], church: [-2.45, -0.45], rider: [-1.3, 0.3], rike: [-2.75, 3.1],
    peace: [0.0, -0.7], stone: [-0.12, 3.3] };
  const PATHS = [[[0.45, -0.5], [1.2, 0.2], [2.0, 0.5]], [[-0.5, -0.85], [-1.5, -0.95], [-2.0, -0.6]], [[-2.9, -2.25], [-2.6, -1.35]],
    [[0.45, 3.3], [0.75, 3.15]], [[-0.7, 3.35], [-1.6, 3.3], [-2.2, 2.9]], [[0.15, -1.75], [0.6, -1.95]], [[0.75, 0.6], [0.8, 1.9], [0.55, 3.0]]];
  const SAND = 0xd8ac66;
  function centerRelief(R) {
    R.tint(0, 0, 0x86b94e, 9, 5.5, 0xc8b088);                                    // the lawns all over (sandstone where it is steep)
    R.tint(MT[0], MT[1], 0x6fa046, 9, 1.4, 0x7f8f52);
    R.pad(MT[0], MT[1], MT_W / 2 + 0.05);                                         // level under the hill's model
    R.pad(CENTER.narikala[0], CENTER.narikala[1], 1.25);
    R.pad(CENTER.deda[0], CENTER.deda[1], 0.4); R.pad(CENTER.sameba[0], CENTER.sameba[1], 1.25);
    R.tint(CENTER.sameba[0], CENTER.sameba[1], 0xbdb6a6, 9, 0.75);               // Sameba's paved square
    R.pad(CENTER.baths[0], CENTER.baths[1], 0.85); R.pad(CENTER.bank[0], CENTER.bank[1], 0.6); R.pad(CENTER.courtyard[0], CENTER.courtyard[1], 0.65);
    R.tint(2.5, 1.8, 0xa9b16c, 9, 1.0, 0xa89878);                                 // the Old Town's dusty lanes
    // Metekhi's cliff: sheer sandstone, grass on its top
    R.mesa(CENTER.cliff[0], CENTER.cliff[1], 1.6, 1.15, 0.6, 0.22);
    for (const [dx, dz] of [[0, 0], [-1.1, -0.6], [1.0, -0.6], [-1.1, 0.7], [1.0, 0.7], [0, 1.0], [0, -1.0]]) R.tint(CENTER.cliff[0] + dx, CENTER.cliff[1] + dz, 0x86b94e, 9, 0.55, 0xd6bc8c);
    R.tint(CENTER.rike[0], CENTER.rike[1], 0x7fbf4a, 9, 0.8);                    // Rike Park's lawns
    // the river and its branch: turquoise, foam along their banks; sandstone where the banks are steep
    riverPts = R.flow(RIVER, 0.62, 0.2, WATER_Y, 0.9, 0x2a8a98, 0x6fc6c4);
    branchPts = R.flow(BRANCH, 0.4, 0.16, WATER_Y - 0.002, 0.55, 0x2a8a98, 0x6fc6c4);
    for (const pts of [riverPts, branchPts]) for (let k = 0; k < pts.length; k += 5) R.tint(pts[k][0], pts[k][1], 0x9fb46a, 9, 0.5, 0xd4c6a2);
    for (const pts of PATHS) for (let k = 1; k < pts.length; k++) R.path(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], 0.18, SAND);
  }
  function centerWater() { return null; }
  // the Old Town's houses: tall, close together, carved balconies, tile and tin roofs; none where a model stands
  function oldTown(B) {
    const r = rng(1801), keep = [[CENTER.bank, 0.62], [CENTER.courtyard, 0.68]];
    for (let gx = 0; gx < 7; gx++) for (let gz = 0; gz < 5; gz++) {
      const x = 1.05 + gx * 0.47 + (r() - 0.5) * 0.14, z = 0.8 + gz * 0.47 + (r() - 0.5) * 0.14;
      if (x > 4.15 || (x < 1.55 && z > 2.6) || keep.some(([[cx, cz], rr]) => Math.hypot(x - cx, z - cz) < rr)) continue;
      if (r() < 0.12) { tree(B, x, z, 1.5, C.leaf2); continue; }                       // a little yard with its tree
      if (near(PATHS[6], x, z)[0] < 0.25) continue;
      const wall = WALLS[Math.floor(r() * WALLS.length)], roofC = [C.tile, C.tile2, C.rust, C.tile, 0x6f8fb0, C.tile2, 0x8a6f5a][Math.floor(r() * 7)];
      oldHouse(B, x, z, 0.14 + r() * 0.06, 0.12 + r() * 0.03, 2 + Math.floor(r() * 2.6), wall, roofC, (r() - 0.5) * 0.5, true, 2.3);
    }
  }
  // Rike Park's two great tubes, silver, open at their ends, lying on the lawn
  function tubes(B, x, z, ry) {
    const put = B.at(x, z, ry), silver = 0xb9c1c9;
    put(cyl(0.2, 0.2, 1.0, 18), silver, 0, 0.2, 0, { rz: Math.PI / 2, smooth: true, vary: 0 });
    put(cyl(0.17, 0.17, 0.62, 18), silver, 0, 0.17, 0.32, { rx: Math.PI / 2, smooth: true, vary: 0 });
    for (const sx of [-1, 1]) put(cyl(0.16, 0.16, 0.012, 18), 0x3d4247, sx * 0.502, 0.2, 0, { rz: Math.PI / 2, vary: 0 });
    put(cyl(0.135, 0.135, 0.012, 18), 0x3d4247, 0, 0.17, 0.63, { rx: Math.PI / 2, vary: 0 });
  }
  // Gorgasali on his horse, on a stone pedestal, in bronze
  function rider(B, x, z, ry, s) {
    const put = B.at(x, z, ry, s), bronze = 0x5d5046;
    put(box(0.2, 0.14, 0.12), C.stone2); put(box(0.22, 0.02, 0.14), C.stone, 0, 0.14, 0);
    put(box(0.13, 0.05, 0.04), bronze, 0, 0.21, 0); put(box(0.05, 0.06, 0.03), bronze, 0.07, 0.24, 0, { rz: -0.5 });
    for (const lx of [-0.05, 0.05]) for (const lz of [-0.012, 0.012]) put(box(0.012, 0.06, 0.012), bronze, lx, 0.16, lz);
    put(box(0.025, 0.06, 0.03), bronze, 0, 0.26, 0); put(ball(0.014), bronze, 0, 0.33, 0); put(box(0.006, 0.08, 0.006), bronze, 0.02, 0.29, 0.02, { rz: -0.3 });
  }
  // the trees: in the corners and along the edges, wherever the map leaves its lawns free
  function trees(B, ground) {
    const r = rng(2468), placed = [];
    const away = (x, z) =>
      near(riverPts, x, z)[0] > 0.8 && near(branchPts, x, z)[0] > 0.55 && PATHS.every(p => near(p, x, z)[0] > 0.24) &&
      Math.hypot(x - MT[0], z - MT[1]) > MT_W / 2 + 0.15 && Math.hypot(x - CENTER.narikala[0], z - CENTER.narikala[1]) > 1.4 &&
      Math.hypot(x - CENTER.deda[0], z - CENTER.deda[1]) > 0.55 && Math.hypot(x - CENTER.sameba[0], z - CENTER.sameba[1]) > 1.3 &&
      Math.hypot(x - CENTER.baths[0], z - CENTER.baths[1]) > 0.95 && !(x > 0.75 && x < 4.35 && z > 0.5 && z < 3.15) &&
      Math.hypot(x - CENTER.church[0], z - CENTER.church[1]) > 0.75 && Math.hypot(x - CENTER.rider[0], z - CENTER.rider[1]) > 0.4 &&
      Math.hypot(x - (-3.05), z - 2.85) > 0.75 && Math.hypot(x - (-2.2), z - 3.45) > 0.7 &&
      Math.hypot(x - CENTER.peace[0], z - CENTER.peace[1]) > 0.9 && Math.hypot(x - CENTER.stone[0], z - CENTER.stone[1]) > 0.85;
    for (let k = 0; k < 900 && placed.length < 95; k++) {
      // more of them near the edges and in the corners
      const edge = r() < 0.65, x = edge ? (r() < 0.5 ? -1 : 1) * (3.55 + r() * 0.8) : (r() - 0.5) * 8.4, z = edge ? (r() - 0.5) * 8.4 : (r() - 0.5) * 8.4;
      const [px, pz] = edge && r() < 0.5 ? [z, x] : [x, z];
      if (Math.max(Math.abs(px), Math.abs(pz)) > 4.3 || !away(px, pz) || placed.some(([qx, qz]) => Math.hypot(px - qx, pz - qz) < 0.3)) continue;
      placed.push([px, pz]);
      const sc = 1.5 + r() * 0.6;
      if (r() < 0.3) pine(B, px, pz, sc * 1.1); else tree(B, px, pz, sc, [C.leaf, C.leaf2, 0x6a9a3a][Math.floor(r() * 3)]);
    }
  }
  function center(ground) {
    const B = new Builder();
    B.ground = ground;
    const steps = [
      () => oldTown(B),
      () => {
        chapel(B, CENTER.church[0], CENTER.church[1], 2.3, 0.25);                // Metekhi on its cliff
        rider(B, CENTER.rider[0], CENTER.rider[1], -0.6, 1.5);
        tubes(B, -3.05, 2.85, 0.15); tubes(B, -2.2, 3.45, -0.35);
        for (const [x, z] of [[0.55, -0.35], [-0.6, -1.1], [0.5, 3.0], [-0.65, 3.6]]) lamp(B, x, z, 1.5);
      },
      () => trees(B, ground)
    ];
    return { B, steps };
  }

  // ===== the landmarks from files (art/m_tb_*.glb; a computer's or ultra's, a phone's from art/mobile) =====
  const MODELS = {};                                    // (no lot has a model of its own: they stand on the map)
  // a corner's: at the back of its square, its name written in front of it (z: towards the square's outer edge)
  const CORNER_MODELS = {
    0: { url: 'art/m_tb_freedom.glb', fitWidth: 1.25, z: -0.22 },
    20: { url: 'art/m_tb_bench.glb', fitWidth: 1.05, z: -0.3, ry: 0 }
  };
  // the map's: board coordinates; on: what they stand on (the ground there, or the river's water)
  const FREE_MODELS = [
    { url: 'art/m_tb_mtatsminda.glb', x: MT[0], z: MT[1], s: MT_W, ry: MT_RY, on: 'ground', y: -0.05, top: true, topY: 1.049 * MT_W - 0.05 },
    { url: 'art/m_tb_narikala.glb', x: CENTER.narikala[0], z: CENTER.narikala[1], s: 2.4, ry: 0, on: 'ground', y: -0.05 },
    { url: 'art/m_tb_kartlisdeda.glb', x: CENTER.deda[0], z: CENTER.deda[1], s: 1.1, ry: 0.4, on: 'ground', y: -0.02 },
    { url: 'art/m_tb_sameba.glb', x: CENTER.sameba[0], z: CENTER.sameba[1], s: 2.0, ry: 0.15, on: 'ground', y: -0.01 },
    { url: 'art/m_tb_baths.glb', x: CENTER.baths[0], z: CENTER.baths[1], s: 1.45, ry: -0.1, on: 'ground', y: -0.01 },
    { url: 'art/m_tb_bank.glb', x: CENTER.bank[0], z: CENTER.bank[1], s: 1.0, ry: -0.35, on: 'ground', y: -0.01 },
    { url: 'art/m_tb_courtyard.glb', x: CENTER.courtyard[0], z: CENTER.courtyard[1], s: 1.15, ry: 0, on: 'ground', y: -0.01 },
    { url: 'art/m_tb_peace.glb', x: CENTER.peace[0], z: CENTER.peace[1], s: 1.45, bridge: true, on: 'water', y: 0.07 },
    { url: 'art/m_tb_stonebridge.glb', x: CENTER.stone[0], z: CENTER.stone[1], s: 1.45, bridge: true, on: 'water', y: 0 }
  ];
  for (const d of FREE_MODELS) if (d.bridge) { const [dx, dz] = along(d.x, d.z); d.ry = Math.atan2(dx, dz); }      // its length across the river

  // ===== what moves (on a corner: in its square's frame; on the map: board coordinates) =====
  const FX = {
    0: { sparkle: [[0.0, -0.3, 0.75, 1]] },
    10: { sparkle: [[0.52, -0.42, 0.25, 1]] },
    30: { actors: [{ k: 'police', a: [-0.5, -0.12], b: [0.5, -0.12], speed: 0.12 }], sparkle: [[0.0, -0.45, 0.06, 1]] }
  };
  const CENTER_FX = {
    smoke: [[1.25, 3.65, 0.5], [1.45, 3.5, 0.45]], mist: [], sheep: [],                // the baths' steam
    actors: [
      { k: 'boat', a: [-0.9, -2.9], b: [0.1, -0.15], speed: 0.04 },
      { k: 'boat', a: [0.05, 1.3], b: [-0.12, 4.1], speed: 0.035, phase: 0.4 },
      { k: 'cart', a: [0.45, -0.5], b: [2.0, 0.5], speed: 0.05 },
      { k: 'cart', a: [-0.7, 3.35], b: [-2.2, 2.9], speed: 0.04, phase: 0.6 }
    ],
    // eagles round the tower, one higher, one wider
    birds: [{ at: TOWER, h: 2.75, r: 1.05, w: 0.3 }, { at: TOWER, h: 2.2, r: 1.8, w: -0.22 }]
  };

  // ----- the moving things' own shapes (around their own origin, facing +x) -----
  function actor(k) {
    const B = new Builder();
    if (k === 'car' || k === 'car2' || k === 'police') {
      car(B, 0, 0, 0, k === 'car' ? C.red : k === 'car2' ? 0x2f62a8 : C.white, 1);
      if (k === 'police') { B.add(box(0.012, 0.008, 0.026), 0x2a5ad8, 0, 0.048, -0.007); B.add(box(0.012, 0.008, 0.012), 0xe8342a, 0, 0.048, 0.01); B.add(box(0.077, 0.006, 0.037), 0x2a5ad8, 0, 0.016, 0); }
    } else if (k === 'bus') bus(B, 0, 0, 0, 0x3f7fc2);
    else if (k === 'minibus') minibus(B, 0, 0, 0);
    else if (k === 'train') {
      for (let j = 0; j < 3; j++) { B.add(box(0.15, 0.05, 0.05), C.white, -j * 0.16, 0.012, 0); B.add(box(0.15, 0.014, 0.052), C.red, -j * 0.16, 0.03, 0); B.add(box(0.13, 0.012, 0.053), C.glass, -j * 0.16, 0.046, 0); }
    } else if (k === 'funicular') {
      B.add(box(0.07, 0.05, 0.04), C.red, 0, 0.006, 0, { rz: 0.3 }); B.add(box(0.072, 0.014, 0.042), C.white, 0, 0.04, 0, { rz: 0.3 }); B.add(box(0.06, 0.016, 0.043), C.glass, 0, 0.028, 0, { rz: 0.3 });
    } else if (k === 'plane') {
      B.add(cyl(0.012, 0.012, 0.14, 8), C.white, 0, 0, 0, { rz: Math.PI / 2 }); B.add(box(0.035, 0.003, 0.16), C.white, 0.0, 0.0, 0); B.add(box(0.02, 0.03, 0.003), 0xc23a2e, -0.06, 0.006, 0);
    } else if (k === 'carousel') {
      B.add(cyl(0.05, 0.05, 0.008, 12), C.yellow, 0, 0.012, 0); B.add(cyl(0.004, 0.004, 0.06, 5), C.iron, 0, 0, 0); B.add(cone(0.05, 0.025, 12), C.red, 0, 0.06, 0);
      for (let j = 0; j < 4; j++) B.add(box(0.012, 0.016, 0.012), [C.red, 0x2f62a8, 0x55ad5f, C.white][j], Math.cos(j * Math.PI / 2) * 0.035, 0.02, Math.sin(j * Math.PI / 2) * 0.035);
    } else if (k === 'ferris') {
      B.add(new T.TorusGeometry(0.2, 0.005, 5, 40).rotateY(Math.PI / 2), C.white, 0, 0, 0, { vary: 0, free: true });
      B.add(new T.TorusGeometry(0.155, 0.003, 4, 32).rotateY(Math.PI / 2), C.white, 0, 0, 0, { vary: 0, free: true });
      B.add(cyl(0.016, 0.016, 0.03, 8), C.iron, -0.015, 0, 0, { rz: Math.PI / 2, free: true });
      const cols = [C.red, C.yellow, 0x2f62a8, 0x55ad5f, 0xee8f3e, 0xa8365f, 0x72bde6, C.white, C.red, C.yellow, 0x2f62a8, 0x55ad5f];
      for (let j = 0; j < 12; j++) {
        const a = j / 12 * Math.PI * 2;
        B.add(box(0.003, 0.2, 0.003), C.white, 0, 0, 0, { rx: a, free: true });
        B.add(ball(0.02, 1), cols[j], 0, Math.cos(a) * 0.205, Math.sin(a) * 0.205, { vary: 0, free: true });
      }
    } else if (k === 'cart') {
      B.add(box(0.08, 0.03, 0.05), C.wood, -0.02, 0.022, 0); B.add(box(0.084, 0.012, 0.054), C.red, -0.02, 0.05, 0);
      for (const lz of [-0.028, 0.028]) B.add(cyl(0.018, 0.018, 0.006, 10), C.wood2, -0.03, 0.018, lz, { rx: Math.PI / 2 });
      B.add(box(0.05, 0.022, 0.018), 0x8a5a36, 0.06, 0.035, 0); B.add(box(0.016, 0.026, 0.014), 0x8a5a36, 0.088, 0.05, 0, { rz: -0.4 });
      for (const lx of [0.042, 0.078]) for (const lz of [-0.006, 0.006]) B.add(box(0.006, 0.035, 0.006), 0x6a4428, lx, 0, lz);
    } else if (k === 'cyclist') {
      B.add(box(0.03, 0.004, 0.004), C.iron, 0, 0.01, 0); for (const x of [-0.014, 0.014]) B.add(cyl(0.009, 0.009, 0.003, 8), 0x222222, x, 0.009, 0, { rx: Math.PI / 2 });
      B.add(box(0.008, 0.026, 0.01), 0x2f62a8, 0, 0.014, 0); B.add(ball(0.007), 0xe8bf98, 0, 0.044, 0, { vary: 0 });
    } else return Models.actor(k);
    return B.build();
  }

  // ===== what the players build, painted in their colour: a house (1 to 4 on a square) or a hotel =====
  function houseParts() {
    const B = new Builder(), R = new Builder();
    B.add(box(0.14, 0.14, 0.12), C.cream, 0, 0, 0);
    B.add(box(0.13, 0.05, 0.03), C.balcony, 0, 0.075, 0.065);
    B.add(box(0.13, 0.012, 0.04), C.wood2, 0, 0.07, 0.065);
    for (const x of [-0.035, 0.035]) B.add(pane(0.03, 0.04), C.win, x, 0.025, 0.061, { vary: 0 });
    B.add(pane(0.03, 0.05), C.wood2, 0, 0, 0.0615, { vary: 0 });
    R.add(pyr(0.17, 0.09, 0.15), 0xffffff, 0, 0.14, 0, { vary: 0 });
    R.add(box(0.018, 0.04, 0.018), 0xffffff, 0.04, 0.17, -0.02, { vary: 0 });
    return { body: B.build(), roof: R.build() };
  }
  function hotelParts() {
    const B = new Builder(), R = new Builder();
    B.add(box(0.36, 0.34, 0.16), C.panel3, 0, 0, 0);
    for (let f = 0; f < 6; f++) B.add(pane(0.32, 0.026), C.glass, 0, 0.03 + f * 0.05, 0.081, { vary: 0 });
    B.add(box(0.12, 0.05, 0.04), C.glass2, 0, 0, 0.09);
    R.add(box(0.38, 0.024, 0.18), 0xffffff, 0, 0.34, 0, { vary: 0 });
    R.add(box(0.22, 0.06, 0.012), 0xffffff, 0, 0.364, 0.02, { vary: 0 });         // its sign on the roof
    R.add(box(0.04, 0.34, 0.165), 0xffffff, 0.16, 0, 0, { vary: 0 });              // a band down its side
    return { body: B.build(), roof: R.build() };
  }

  // ===== public =====
  function relief() { }                               // (the map draws all the land inside the squares)
  function lot() { return null; }
  // the corners: the traffic jam (10) and the patrol at Heroes Square (30) made here, the others from their files
  function corner(i) {
    const B = new Builder();
    if (i === 10) {
      jam(B, -0.08, -0.5, 7, 0, 0.13, 3); jam(B, -0.1, -0.32, 6, 0, 0.14, 7);
      trafficLight(B, 0.52, -0.46, 0); trafficLight(B, -0.58, -0.2, Math.PI);
      B.add(box(1.2, 0.002, 0.012), 0xf0ead8, 0, 0.001, -0.41);
    }
    if (i === 30) {
      // the memorial's arc of tall slabs, its eternal flame, the patrol car's lane
      for (let k = 0; k < 7; k++) { const a = Math.PI * (0.15 + 0.7 * k / 6); B.add(box(0.07, 0.24 + (k % 2) * 0.05, 0.03), 0x9a9286, Math.cos(a) * 0.4, 0, -0.62 + Math.sin(a) * 0.18, { ry: Math.PI / 2 - a }); }
      B.add(cyl(0.05, 0.06, 0.03, 10), 0x6a6458, 0, 0, -0.45);
      B.add(box(1.25, 0.002, 0.012), 0xf0ead8, 0, 0.001, -0.2);
      trafficLight(B, -0.6, -0.3, 0);
    }
    return B.parts.length ? B.build() : null;
  }
  function ringRelief() { }
  function inner() { return new Builder().build(); }
  let houseCache = null, hotelCache = null;
  return {
    world: 'city', PAL, relief, lot, corner, ringRelief, inner, centerRelief, centerWater, center, CENTER, CENTER_FX, actor,
    models: MODELS, cornerModels: CORNER_MODELS, freeModels: FREE_MODELS, clouds: 2, waterY: WATER_Y,
    fx: i => FX[i] || null,
    tower: () => houseCache || (houseCache = houseParts()),
    castle: () => hotelCache || (hotelCache = hotelParts()),
    LIFE: ['police', 'cart', 'boat', 'eagle', 'wing'],
    BIRD: ['eagle', 'wing']
  };
})();
