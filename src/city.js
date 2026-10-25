// ===== ტფილისი in 3D: Tbilisi, made in code like the land (models.js), with its landmarks from files =====
// In the middle the old city, as one map (the concept the user chose): the Mtkvari through it from the back to the
// front, its branch round Metekhi's cliff out to the left; Mtatsminda's hill with its tower, Narikala on its ridge with
// Kartlis Deda behind it, the Old Town's roofs below them, the baths at the front; Sameba at the back left, Metekhi's
// church and Gorgasali on the cliff, Rike Park's tubes at the front left; the Peace Bridge and the stone bridge.
// Round it, between the middle and the squares, the ring of the city's districts, each its own little scene (its
// card's); the river and its branch go out through the ring between two of them (the central station's railway bridge,
// Saburtalo's road bridge, Aghmashenebeli's footbridge). The bank, the old courtyard and Rustaveli stand in their
// districts as models of their own (art/m_tb_*.glb), Freedom Square and the embankment's bench on their corners. Cars,
// buses and trains go about, boats on the river and the lakes, the funicular and the cable car up and down, the Ferris
// wheel turns, eagles circle the tower.
// A place's frame is the land's: x along the board's side (to the right seen from its side), +z towards its square
// (and the camera), y up.

const CityModels = (() => {
  const T = window.THREE;
  if (!T || typeof Models === 'undefined' || !Models || typeof Terrain === 'undefined' || !Terrain) return null;
  const { Builder, rng, tone, PAL } = Models;
  const { box, cyl, cone, pyr, ball, roof, dome, jitter, taper } = Models.shapes;
  const { tree, bigTree, pine, bush, church, wall } = Models.parts;

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
  const FRUIT = [0xd94a2e, 0xf0a530, 0x7cae3a, 0x8a3a6a, 0xe8c547];
  const PANELS = [0xdccfbc, 0xc6d3d8, 0xe3c8b6, 0xcbd8c3, 0xe6dac4, 0xd6c2cc];      // the blocks' pastel panels
  // the land's colours: the lawns (the middle's), a park's deeper green, paving, roads, cobbles, the sandy paths
  const LAWN = 0x86b94e, PARK = 0x70a947, PAVE = 0xdccba5, ROAD = 0xa29e95, COBBLE = 0xc4b291, SAND = 0xd8ac66;

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
  function block(B, x, z, w, d, fl, c = C.panel, ry = 0, balc = 3, s = 1) {
    const put = B.at(x, z, ry, s), fh = 0.05, h = fh * fl;
    put(box(w, h, d), c, 0, 0, 0, { vary: 0.03 });
    put(box(w * 1.02, 0.012, d * 1.04), tone(c, 0.8), 0, h, 0);
    for (let f = 0; f < fl; f++) {
      for (const sd of [1, -1]) put(pane(w * 0.9, fh * 0.34), C.win, 0, f * fh + fh * 0.36, sd * (d / 2 + 0.002), { ry: sd > 0 ? 0 : Math.PI, vary: 0 });
      for (let k = 0; k < balc; k++) put(box(w / balc * 0.5, fh * 0.42, 0.02), tone(c, 1.08), -w / 2 + (k + 0.5) * w / balc, f * fh + fh * 0.12, d / 2 + 0.01);
    }
  }
  // a new tower: glass in strips, a colour of its own on its corners
  function tower(B, x, z, w, d, h, c = C.panel3, accent = C.peach, ry = 0, s = 1) {
    const put = B.at(x, z, ry, s), n = Math.max(2, Math.round(h / 0.05));
    put(box(w, h, d), c, 0, 0, 0, { vary: 0.03 });
    for (let f = 0; f < n; f++) for (const sd of [1, -1]) put(pane(w * 0.84, h / n * 0.5), f % 2 ? C.glass : C.glass2, 0, f * h / n + h / n * 0.25, sd * (d / 2 + 0.002), { ry: sd > 0 ? 0 : Math.PI, vary: 0 });
    put(box(w * 0.18, h * 1.02, d * 1.02), accent, w * 0.41, 0, 0);
    put(box(w * 1.04, 0.015, d * 1.04), tone(c, 0.75), 0, h, 0);
  }
  const cypress = (B, x, z, s = 1) => { B.add(cyl(0.005 * s, 0.007 * s, 0.03 * s, 5), PAL.trunk, x, 0, z); B.add(jitter(cone(0.032 * s, 0.24 * s, 7), 0.1, x * 13 + z), C.cypress, x, 0.02 * s, z, { smooth: true, vary: 0, sway: 0.5 }); };
  const poplar = (B, x, z, s = 1) => { B.add(cyl(0.008 * s, 0.012 * s, 0.06 * s, 5), PAL.trunk, x, 0, z); B.add(jitter(ball(0.045 * s, 1), 0.14, x * 7 + z), C.leaf, x, 0.17 * s, z, { sy: 3, round: true, sway: 1.1 }); };
  const plane = (B, x, z, s = 1, leaf = C.leaf) => tree(B, x, z, s * 0.9, leaf);
  // a fruit tree: its fruit among its leaves
  function fruitTree(B, x, z, s = 1, fruit = FRUIT[0]) {
    tree(B, x, z, s, 0x5f9a3e);
    const r = rng(Math.round(x * 331 + z * 787) + 11);
    for (let k = 0; k < 7; k++) {
      const a = r() * Math.PI * 2, e = -0.1 + r() * 0.9, rr = 0.086 * s;
      B.add(ball(0.012 * s), fruit, x + Math.cos(a) * Math.cos(e) * rr, 0.17 * s + Math.sin(e) * rr * 0.95, z + Math.sin(a) * Math.cos(e) * rr, { vary: 0 });
    }
  }
  const lamp = (B, x, z, s = 1) => { B.add(cyl(0.004 * s, 0.005 * s, 0.13 * s, 5), C.iron, x, 0, z); B.add(box(0.016 * s, 0.022 * s, 0.016 * s), 0xffe9b0, x, 0.13 * s, z); };
  const bench = (B, x, z, ry = 0, s = 1) => { const put = B.at(x, z, ry, s); put(box(0.07, 0.008, 0.024), C.wood, 0, 0.022, 0); put(box(0.07, 0.022, 0.005), C.wood, 0, 0.03, -0.011); for (const k of [-0.03, 0.03]) put(box(0.004, 0.022, 0.02), C.iron, k, 0, 0); };
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
  const minibus = (B, x, z, ry = 0, s = 1) => { bus(B, x, z, ry, 0xf2f0ea, 0.085, s); B.at(x, z, ry, s)(box(0.086, 0.006, 0.047), C.yellow, 0, 0.024, 0); };
  function stall(B, x, z, ry = 0, awn = C.red, s = 1) {
    const put = B.at(x, z, ry, s);
    put(box(0.09, 0.03, 0.05), C.wood, 0, 0, 0);
    for (let k = 0; k < 5; k++) put(ball(0.008), FRUIT[k], -0.032 + k * 0.016, 0.034, 0.008 * (k % 2), { vary: 0 });
    for (const k of [-0.042, 0.042]) put(box(0.004, 0.08, 0.004), C.wood2, k, 0, -0.022);
    put(box(0.1, 0.006, 0.06), awn, 0, 0.08, -0.004, { rx: 0.18 });
    put(box(0.1, 0.012, 0.004), C.white, 0, 0.072, 0.026);                       // the awning's white edge
  }
  // the kinto's cart heaped with fruit, its two wheels, its handles
  function fruitCart(B, x, z, ry = 0, s = 1) {
    const put = B.at(x, z, ry, s);
    put(box(0.08, 0.022, 0.05), C.wood, 0, 0.026, 0);
    for (const sz of [-1, 1]) put(cyl(0.022, 0.022, 0.006, 10), C.wood2, -0.01, 0.022, sz * 0.028 - (sz > 0 ? 0 : 0.006), { rx: Math.PI / 2 });
    for (let k = 0; k < 9; k++) put(ball(0.011), FRUIT[k % 5], -0.028 + (k % 3) * 0.022, 0.056 + Math.floor(k / 3) * 0.008, -0.014 + Math.floor(k / 3) * 0.014, { vary: 0 });
    for (const sz of [-0.018, 0.018]) put(box(0.05, 0.004, 0.004), C.wood2, 0.06, 0.038, sz);
  }
  function umbrella(B, x, z, c = C.white, s = 1) {
    const put = B.at(x, z, 0, s);
    put(cyl(0.003, 0.003, 0.06, 4), C.iron); put(cone(0.035, 0.02, 8), c, 0, 0.06, 0); put(cyl(0.018, 0.018, 0.004, 8), C.white, 0, 0.022, 0);
  }
  // a café's table under its umbrella, two chairs
  function cafe(B, x, z, c = C.white, s = 1) {
    umbrella(B, x, z, c, s);
    const put = B.at(x, z, 0, s);
    for (const sx of [-1, 1]) { put(box(0.014, 0.016, 0.014), C.wood, sx * 0.03, 0, 0); put(box(0.014, 0.014, 0.003), C.wood, sx * 0.037, 0.016, 0); }
  }
  function pylon(B, x, z, h = 0.42, c = 0x7f878e) {          // a power line's tower: a tall frame narrowing upward, with arms
    B.add(taperFrame(h), c, x, 0, z);
    for (const y of [h * 0.72, h * 0.9]) B.add(box(0.11, 0.006, 0.006), c, x, y, z);
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
    put(box(0.026, 0.006, 0.012), C.white, 0.16, 0.137, 0.061);                    // its letter
  }
  // Didube's or Metekhi's church: Models' church in the city's stone
  const chapel = (B, x, z, s, ry = 0) => church(B, x, z, s, 0xd7c6a2, 0x7c6e5c, ry);
  // a poster column, banded with posters, its little green dome
  function posterColumn(B, x, z, s = 1) {
    const put = B.at(x, z, 0, s);
    put(cyl(0.032, 0.035, 0.15, 12), y => [0xe9ddc3, 0xc23a2e, 0xe9c449, 0x3f7fc2][Math.floor(y / 0.035) % 4], 0, 0, 0, { vary: 0 });
    put(dome(0.038, 10), 0x3a5a46, 0, 0.15, 0, { smooth: true, vary: 0 }); put(ball(0.008), C.gold, 0, 0.188, 0);
  }
  // a newspaper kiosk
  function kiosk(B, x, z, ry = 0, s = 1) {
    const put = B.at(x, z, ry, s);
    put(box(0.09, 0.075, 0.065), 0x4f7f6a); put(box(0.1, 0.008, 0.075), C.white, 0, 0.075, 0);
    put(pane(0.06, 0.03), 0xf4efe4, 0, 0.03, 0.033, { vary: 0 }); put(box(0.07, 0.006, 0.02), 0x3a5a46, 0, 0.026, 0.04);
  }
  // a fountain: its round basin of still water, the jet
  function fountain(B, x, z, s = 1) {
    const put = B.at(x, z, 0, s);
    put(cyl(0.07, 0.075, 0.025, 16), C.stone); put(cyl(0.062, 0.062, 0.004, 16), 0x6fc6c4, 0, 0.022, 0, { water: 1, vary: 0 });
    put(cyl(0.012, 0.016, 0.05, 8), C.stone2, 0, 0.02, 0); put(cone(0.02, 0.06, 8), 0xd6f2f2, 0, 0.066, 0, { vary: 0 });
  }
  // the railway: two rails on their sleepers, along x on the land
  function rails(B, x0, x1, z, g = 0.034) {
    const len = x1 - x0, n = Math.max(2, Math.round(len / 0.04));
    for (let k = 0; k < n; k++) B.add(box(0.012, 0.005, g * 1.7), C.wood2, x0 + (k + 0.5) * len / n, 0, z, { vary: 0.1 });
    for (const sz of [-1, 1]) B.add(box(len, 0.006, 0.004), 0x8a8f94, (x0 + x1) / 2, 0.004, z + sz * g / 2);
  }
  // a steel railway bridge across the river along x (from x0 to x1 at z): its deck level with the banks, two stone piers
  // in the water, a truss either side (the train goes through it)
  function railBridge(B, x0, x1, z, w = 0.1) {
    const y = Math.max(B.ground(x0, z), B.ground(x1, z)), len = x1 - x0, cx = (x0 + x1) / 2, steel = 0x5d7487, h = 0.085, n = 6, dx = len / n;
    const at = (g, c, x, yy, zz, o = {}) => B.add(g, c, x, yy, zz, Object.assign({ free: true }, o));
    at(box(len, 0.02, w), C.stone2, cx, y - 0.02, z);
    for (const k of [1 / 3, 2 / 3]) at(box(0.04, 0.3, w * 0.86), C.stone2, x0 + len * k, y - 0.32, z, { vary: 0.08 });
    for (let k = 0; k <= n * 3; k++) at(box(0.012, 0.004, 0.058), C.wood2, x0 + k * len / (n * 3), y, z);
    for (const sz of [-0.017, 0.017]) at(box(len, 0.005, 0.004), 0x8a8f94, cx, y + 0.004, z + sz);
    for (const sz of [-w / 2, w / 2]) {
      at(box(len, 0.008, 0.008), steel, cx, y, z + sz); at(box(len - dx, 0.008, 0.008), steel, cx, y + h, z + sz);
      for (let k = 0; k < n; k++) {
        const up = k % 2 === 0;
        at(box(0.006, Math.hypot(dx, h), 0.006), steel, x0 + k * dx + (up ? 0 : dx), y, z + sz, { rz: (up ? -1 : 1) * Math.atan2(dx, h) });
      }
    }
    for (let k = 1; k < n; k += 2) at(box(0.006, 0.006, w), steel, x0 + k * dx, y + h, z);
  }
  // a road bridge across the river along x: its deck on two piers, the road on it, railings
  function roadBridge(B, x0, x1, z, w = 0.13) {
    const y = Math.max(B.ground(x0, z), B.ground(x1, z)), len = x1 - x0, cx = (x0 + x1) / 2;
    const at = (g, c, x, yy, zz, o = {}) => B.add(g, c, x, yy, zz, Object.assign({ free: true }, o));
    at(box(len, 0.025, w), 0xcfc8ba, cx, y - 0.022, z);
    at(box(len, 0.004, w * 0.72), ROAD, cx, y + 0.002, z, { vary: 0 });
    for (const sd of [-1, 1]) { at(box(len, 0.018, 0.008), 0x8e959b, cx, y + 0.003, z + sd * (w / 2 - 0.004)); at(box(len, 0.003, 0.012), 0xe9e4d8, cx, y + 0.021, z + sd * (w / 2 - 0.004)); }
    for (const k of [0.3, 0.7]) at(box(0.045, 0.3, w * 0.8), 0xbdb6a8, x0 + len * k, y - 0.32, z, { vary: 0.06 });
  }
  // a footbridge across the water: a light arch of planks with its railings
  function footbridge(B, x0, x1, z, w = 0.06, rise = 0.045) {
    const y = Math.max(B.ground(x0, z), B.ground(x1, z)), n = 8, len = x1 - x0;
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n, y0 = y + rise * Math.sin(Math.PI * t0), y1 = y + rise * Math.sin(Math.PI * t1);
      const seg = Math.hypot(len / n, y1 - y0) * 1.04, mx = x0 + len * (t0 + t1) / 2, my = (y0 + y1) / 2, a = Math.atan2(y1 - y0, len / n);
      B.add(box(seg, 0.01, w), C.wood, mx, my - 0.008, z, { free: true, rz: a });
      for (const sd of [-1, 1]) {
        B.add(box(seg, 0.004, 0.004), C.white, mx, my + 0.03, z + sd * w / 2, { free: true, rz: a });
        B.add(box(0.004, 0.032, 0.004), C.white, x0 + len * t0, y0, z + sd * w / 2, { free: true });
      }
    }
  }
  // a wooden pier out into a lake
  function pier(B, x, z, len, ry = 0, s = 1) {
    const put = B.at(x, z, ry, s);
    put(box(0.04, 0.008, len), C.wood, 0, 0.012, len / 2);
    for (let k = 0; k < 3; k++) for (const sx of [-0.016, 0.016]) put(box(0.006, 0.05, 0.006), C.wood2, sx, -0.035, 0.04 + k * len / 3);
  }

  // ===== the districts' own landmarks, made here =====
  // Gabriadze's clock tower: a crooked little tower of brick and stone with its clock, its gallery, a cap on top
  function clockTower(B, x, z, s = 1) {
    const put = B.at(x, z, 0, s), tiers = [[0.13, 0.11, C.brick], [0.118, 0.1, C.cream], [0.106, 0.09, 0xc98b62], [0.096, 0.085, C.stone], [0.088, 0.08, C.brick]];
    let y = 0, lean = 0;
    tiers.forEach(([w, h, c], k) => {
      put(box(w, h, w), c, lean, y, 0, { vary: 0.08, rz: 0.03 * (k % 2 ? 1 : -1) });
      put(box(w * 1.08, 0.01, w * 1.08), 0x7a5a44, lean, y + h, 0);                     // a ledge of tiles
      if (k === 1) {                                                                   // the clock
        put(cyl(0.04, 0.04, 0.006, 18), C.white, lean, y + h * 0.5, w / 2 + 0.002, { rx: Math.PI / 2, vary: 0 });
        put(box(0.004, 0.03, 0.003), 0x2b2b2b, lean, y + h * 0.5, w / 2 + 0.01, { vary: 0 }); put(box(0.022, 0.004, 0.003), 0x2b2b2b, lean + 0.009, y + h * 0.5, w / 2 + 0.01, { vary: 0 });
      }
      if (k !== 1) for (const sx of [-1, 1]) put(pane(0.018, 0.03), C.win, lean + sx * w * 0.24, y + h * 0.3, w / 2 + 0.002, { vary: 0 });
      y += h + 0.01; lean += k % 2 ? -0.006 : 0.011;
    });
    put(box(0.11, 0.008, 0.11), C.wood2, lean, y, 0); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(box(0.006, 0.05, 0.006), C.wood2, lean + sx * 0.05, y, sz * 0.05);
    put(box(0.014, 0.034, 0.012), C.white, lean + 0.02, y + 0.008, 0.03);               // the angel with its hammer
    put(cone(0.07, 0.12, 8), C.tile, lean, y + 0.05, 0); put(ball(0.012), C.gold, lean, y + 0.175, 0);
  }
  // the presidential palace on Avlabari's hill: its long front of columns, the glass dome over its middle
  function palace(B, x, z, s = 1, ry = 0) {
    const put = B.at(x, z, ry, s);
    put(box(0.34, 0.1, 0.15), C.cream, 0, 0, 0, { vary: 0.03 }); put(box(0.36, 0.012, 0.17), C.stone, 0, 0.1, 0);
    for (let k = 0; k < 8; k++) put(cyl(0.007, 0.007, 0.088, 6), C.white, -0.14 + k * 0.04, 0, 0.083);
    put(box(0.3, 0.012, 0.03), C.white, 0, 0.088, 0.083);
    put(cyl(0.055, 0.06, 0.04, 14), C.cream, 0, 0.112, 0); put(dome(0.062, 14), C.glass2, 0, 0.152, 0, { smooth: true, vary: 0 });
    put(cyl(0.003, 0.003, 0.06, 4), C.iron, 0, 0.21, 0); put(box(0.03, 0.02, 0.002), C.white, 0.016, 0.248, 0, { vary: 0 }); put(box(0.01, 0.02, 0.0025), C.red, 0.016, 0.248, 0, { vary: 0 });
  }
  // the stacked blocks of the old Ministry of Highways: long slabs crossing each other high on their cores
  function ministry(B, x, z, s = 1, ry = 0) {
    const put = B.at(x, z, ry, s);
    for (const [cx, cz] of [[-0.09, 0.02], [0.08, -0.04], [0.01, 0.09]]) put(box(0.045, 0.42, 0.045), C.panel3, cx, 0, cz);
    put(box(0.34, 0.07, 0.08), C.panel, 0, 0.12, 0.02); put(box(0.08, 0.07, 0.3), C.panel, 0.06, 0.19, 0); put(box(0.3, 0.07, 0.08), C.panel, -0.02, 0.26, -0.03); put(box(0.08, 0.07, 0.26), C.panel, -0.07, 0.33, 0.02);
    put(pane(0.3, 0.035), C.win, 0, 0.138, 0.061, { vary: 0 }); put(pane(0.27, 0.035), C.win, -0.02, 0.278, 0.011, { vary: 0 });
    for (const [px, py] of [[0.06, 0.208], [-0.07, 0.348]]) for (const sd of [-1, 1]) put(pane(0.03, 0.035), C.win, px + sd * 0.0405, py, 0, { ry: sd * Math.PI / 2, vary: 0 });
  }
  // the Chronicle of Georgia: tall bronze pillars in a half ring on their hill, a stair up to them
  function chronicle(B, x, z, s = 1) {
    const put = B.at(x, z, 0, s);
    put(cyl(0.2, 0.22, 0.02, 20), C.stone);
    for (let k = 0; k < 9; k++) { const a = Math.PI * (0.06 + 0.88 * k / 8); put(taper(0.045, 0.034, 0.25 + (k % 3 === 1 ? 0.05 : 0)), C.bronze, Math.cos(a) * 0.16, 0.02, -Math.sin(a) * 0.1, { vary: 0.12 }); }
    for (let k = 0; k < 4; k++) put(box(0.12 - k * 0.012, 0.01 + k * 0.005, 0.03), C.stone2, 0, 0, 0.2 + (3 - k) * 0.03);
  }
  // Vake Park's memorial: a tall stone figure on its pedestal, at the top of the stair
  function memorial(B, x, z, s = 1) {
    const put = B.at(x, z, 0, s);
    put(box(0.1, 0.04, 0.1), C.stone2); put(taper(0.05, 0.022, 0.34), C.stone, 0, 0.04, 0); put(ball(0.022, 1), C.stone, 0, 0.39, 0);
  }
  // the Ferris wheel's two A-frames and its axle (the wheel itself turns: FX), its platform
  function ferrisFrame(B, x, z, ry, s) {
    const fw = B.at(x, z, ry, s);
    for (const sx of [-0.04, 0.04]) for (const sz of [-1, 1]) fw(box(0.009, 0.27, 0.009), C.white, sx, 0, sz * 0.075, { rx: -sz * 0.28 });
    fw(box(0.1, 0.012, 0.012), C.iron, 0, 0.245, 0); fw(box(0.14, 0.012, 0.2), C.paving, 0, 0, 0);
  }
  // swings and a slide for the yard's children
  function swings(B, x, z, s = 1) {
    const put = B.at(x, z, 0, s);
    for (const sx of [-0.04, 0.04]) put(box(0.004, 0.07, 0.004), C.red, sx, 0, 0);
    put(box(0.086, 0.004, 0.004), C.red, 0, 0.07, 0);
    for (const sx of [-0.02, 0.02]) { put(box(0.002, 0.045, 0.002), C.iron, sx, 0.025, 0); put(box(0.016, 0.003, 0.01), C.yellow, sx, 0.024, 0); }
    put(box(0.02, 0.05, 0.02), 0x2f62a8, 0.09, 0, 0.02); put(box(0.016, 0.004, 0.07), C.yellow, 0.09, 0.025, 0.06, { rx: 0.62 });
  }
  // a covered market: a long brick hall under a tin roof, its doors
  function market(B, x, z, s = 1) {
    const put = B.at(x, z, 0, s);
    put(box(0.42, 0.07, 0.15), C.brick, 0, 0, 0, { vary: 0.06 }); put(roof(0.46, 0.06, 0.18), C.tin, 0, 0.07, 0, { vary: 0.06 });
    for (const sx of [-0.12, 0, 0.12]) put(pane(0.04, 0.05), C.wood2, sx, 0, 0.0765, { vary: 0 });
  }
  // the old stone station of the funicular, its windows, its tile roof
  function funicularStation(B, x, z, s = 1) {
    const put = B.at(x, z, 0, s);
    put(box(0.22, 0.1, 0.1), C.stone); for (let k = 0; k < 3; k++) put(pane(0.04, 0.06), C.win, -0.06 + k * 0.06, 0, 0.051, { vary: 0 });
    put(roof(0.24, 0.05, 0.12), C.tile, 0, 0.1, 0);
  }
  // the central station: its classical front with a clock over the door
  function stationHouse(B, x, z, s = 1) {
    const put = B.at(x, z, 0, s);
    put(box(0.3, 0.085, 0.1), C.cream, 0, 0, 0, { vary: 0.03 }); put(box(0.1, 0.125, 0.112), C.sand, 0, 0, 0);
    put(roof(0.32, 0.035, 0.112), C.tile, 0, 0.085, 0); put(pyr(0.12, 0.05, 0.13), C.tile2, 0, 0.125, 0);
    for (let k = 0; k < 6; k++) { const wx = -0.13 + k * 0.052; if (Math.abs(wx) < 0.06) continue; put(pane(0.022, 0.042), C.win, wx, 0.02, 0.051, { vary: 0 }); }
    put(pane(0.04, 0.06), C.wood2, 0, 0, 0.057, { vary: 0 });
    put(cyl(0.02, 0.02, 0.004, 14), C.white, 0, 0.095, 0.056, { rx: Math.PI / 2, vary: 0 });
  }
  // a flower bed: a low mound of leaves, flowers of a few colours on it
  function flowers(B, x, z, s, r) {
    const cs = [0xe8574a, 0xf2c14e, 0xf3f0e8, 0xd96aa7, 0x9a6ad9];
    B.add(jitter(ball(0.032 * s, 0), 0.2, x * 9 + z), 0x4f8f3a, x, 0.004, z, { sy: 0.42, round: true });
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + r(), rr = 0.02 * s * (0.3 + r() * 0.7); B.add(new T.OctahedronGeometry(0.009 * s, 0), cs[(k + Math.floor(r() * 5)) % 5], x + Math.cos(a) * rr, 0.014 * s, z + Math.sin(a) * rr, { vary: 0 }); }
  }
  // a basketball court in the blocks' yard: its orange ground, white lines, two hoops
  function court(B, x, z, ry = 0, s = 1) {
    const put = B.at(x, z, ry, s);
    put(box(0.22, 0.004, 0.13), 0xd9844a, 0, 0, 0, { vary: 0 });
    put(box(0.004, 0.0046, 0.13), C.white, 0, 0, 0, { vary: 0 }); put(cyl(0.025, 0.025, 0.0047, 14), 0xe9a066, 0, 0, 0, { vary: 0 });
    for (const sx of [-1, 1]) { put(box(0.004, 0.06, 0.004), C.white, sx * 0.112, 0, 0); put(box(0.004, 0.02, 0.026), C.white, sx * 0.108, 0.055, 0); }
  }
  // the ethnographic museum's wooden house
  function woodHouse(B, x, z, ry = 0, s = 1) {
    const put = B.at(x, z, ry, s);
    put(box(0.11, 0.06, 0.08), C.wood); put(roof(0.13, 0.045, 0.1), 0x6d5a45, 0, 0.06, 0, { vary: 0.08 }); put(box(0.1, 0.012, 0.02), C.wood2, 0, 0.0, 0.05);
  }

  // ===== the districts: first their land (relief R), then what stands on it (B) =====
  // (in lot units: the land there is 1 wide; a district by a corner shares the corner's square of land with the next
  // side's: each keeps to its half of it, z >= 0.15 + 1.05 x for the first one after a corner (1, 11, 21, 31), z >=
  // 0.15 - 1.05 x for the last one before it (9, 19, 29, 39); the rivers go out between 5 and 6, 14 and 15, 24 and 25:
  // each of them keeps to its side of the water)
  const L = {};
  const lawn = (R, c = LAWN) => R.tint(c, 9, undefined, 0xb4a37f);           // (where it is steep: the warm stone)
  const park = (R, c = PARK) => R.tint(c, 9, undefined, 0x6f7c4e);           // (where it is steep: the wooded slope)
  const ROADS = {};                                         // each district's roads and paved squares (kept clear of its garden)
  let curLot = -1;
  const road = (R, x1, z1, x2, z2, w = 0.05, c = ROAD) => { (ROADS[curLot] || (ROADS[curLot] = [])).push([x1, z1, x2, z2, w]); R.path(x1, z1, x2, z2, w, c); };
  const pave = (R, x, z, len, hw, c = PAVE) => road(R, x - len / 2, z, x + len / 2, z, hw, c);   // a paved square, len along x

  // --- ქვემო სანაპირო ---
  L[1] = {   // Ortachala: the riverside tavern with its pergola and feast table, poplars, a fruit tree (its half of the corner)
    r: R => { lawn(R, 0x8cbd52); R.pad(-0.33, 0.04, 0.15); pave(R, -0.06, 0.36, 0.2, 0.08, 0xd9c49a); },
    b: B => {
      oldHouse(B, -0.33, 0.03, 0.15, 0.11, 2, C.cream, C.tile, 0.1, true, 1.45);
      const put = B.at(-0.05, 0.36, 0.1, 1.2);                                   // the pergola, the vine over it, the table under it
      for (const [px, pz] of [[-0.07, -0.04], [0.07, -0.04], [-0.07, 0.04], [0.07, 0.04]]) put(box(0.006, 0.075, 0.006), C.wood2, px, 0, pz);
      put(box(0.17, 0.008, 0.11), C.leaf2, 0, 0.075, 0, { sway: 0.3 }); put(box(0.12, 0.008, 0.04), C.wood, 0, 0.028, 0); put(box(0.13, 0.004, 0.05), C.white, 0, 0.034, 0);
      for (let k = 0; k < 4; k++) put(ball(0.008), FRUIT[k], -0.045 + k * 0.03, 0.04, 0, { vary: 0 });
      for (const [x, z] of [[-0.47, -0.3], [-0.47, -0.1]]) poplar(B, x, z, 1.3);
      fruitTree(B, -0.36, 0.38, 0.95, FRUIT[1]);
    }
  };
  const kintoLot = v => ({   // Kinto's question: his fruit stalls in the street, his cart heaped with fruit, a plane tree's shade
    r: R => { lawn(R); pave(R, 0, 0.0, 0.62, 0.16); },
    b: B => {
      const m = v % 2 ? -1 : 1;
      stall(B, -0.19 * m, -0.1, 0.15 * m, C.red, 1.6); stall(B, 0.11 * m, -0.15, -0.2 * m, v === 2 ? C.blue : C.yellow, 1.6);
      fruitCart(B, 0.05 * m, 0.15, 0.4 * m, 1.5);
      bigTree(B, -0.36 * m, -0.33, 0.95, C.leaf2); tree(B, 0.38 * m, -0.34, 1.15);
      lamp(B, 0.33 * m, 0.22, 1.4); bench(B, -0.3 * m, 0.2, 0, 1.4); bush(B, 0.43 * m, 0.04, 1.2);
    }
  });
  L[2] = kintoLot(0); L[17] = kintoLot(1); L[33] = kintoLot(2);
  L[3] = {   // Ponichala: cottages with tin roofs among fruit gardens on the river's bend, the road out of town
    r: R => { lawn(R, 0x8fbf55); R.hill(0.05, -0.52, 0.66, 0.2, 0.1); road(R, -0.6, 0.31, 0.6, 0.28); for (const [x, z] of [[-0.3, -0.12], [0.02, -0.18], [0.31, -0.1]]) R.pad(x, z, 0.13); },
    b: B => {
      oldHouse(B, -0.3, -0.12, 0.14, 0.11, 2, C.cream, C.tin, 0.12, false, 1.45);
      oldHouse(B, 0.02, -0.18, 0.13, 0.1, 2, C.peach, C.rust, -0.08, false, 1.45);
      oldHouse(B, 0.31, -0.1, 0.14, 0.11, 2, C.sand, C.tin2, 0.18, false, 1.45);
      [[-0.15, 0.1], [0.16, 0.08], [0.43, 0.14], [-0.43, 0.12]].forEach(([x, z], k) => fruitTree(B, x, z, 0.95, FRUIT[k % 2]));
      for (const [x, z] of [[-0.46, -0.34], [0.47, -0.32]]) poplar(B, x, z, 1.3);
    }
  };
  L[4] = { r: R => { lawn(R); R.pad(0, -0.06, 0.42); pave(R, 0, 0.32, 0.86, 0.07); }, b: B => { lamp(B, -0.44, 0.34, 1.4); lamp(B, 0.44, 0.34, 1.4); } };     // the bank (its model)
  // the central station: the train comes over the river on its bridge (from Varketili's bank) into the platforms' vault
  const RAIL5 = -0.16;
  L[5] = {
    r: R => { lawn(R, 0x91be59); R.pad(0.2, RAIL5, 0.24); R.pad(0.22, 0.16, 0.15); road(R, -0.8, RAIL5, 0.6, RAIL5, 0.04, 0x8f8576); pave(R, 0.2, 0.36, 0.62, 0.07); },
    b: B => {
      railBridge(B, -0.76, -0.1, RAIL5, 0.1);
      rails(B, -0.1, 0.5, RAIL5); rails(B, -0.9, -0.76, RAIL5);
      B.add(box(0.012, 0.03, 0.05), C.red, -0.9, 0, RAIL5);                          // the buffer stop on the far bank
      vault(B, 0.22, RAIL5, 0.5, 0.125); for (const x of [-0.03, 0.47]) B.add(box(0.025, 0.07, 0.26), C.panel3, x, 0, RAIL5);
      stationHouse(B, 0.3, 0.15, 1.15);
      bus(B, 0.02, 0.36, 0, 0xd9a03a, 0.17, 1.2); lamp(B, 0.46, 0.3, 1.4); tree(B, 0.45, 0.02, 0.95, C.leaf2);
    }
  };
  // --- აღმოსავლეთი ---
  L[6] = {   // Varketili: panel blocks on their plateau, the metro's last station (the river at its right)
    r: R => { lawn(R, 0x8ab752); R.mesa(-0.2, -0.26, 0.3, 0.22, 0.07, 0.5); R.pad(-0.2, -0.26, 0.2); road(R, -0.6, 0.3, 0.02, 0.3); },
    b: B => {
      block(B, -0.34, -0.24, 0.1, 0.28, 8, PANELS[2], 0, 3, 1.2);
      block(B, -0.08, -0.32, 0.2, 0.09, 8, PANELS[1], 0, 4, 1.2);
      court(B, -0.27, 0.14, 0.1, 1.2);
      for (const [x, z] of [[-0.04, 0.04], [-0.47, 0.0], [0.06, 0.22]]) tree(B, x, z, 1.0);
      bench(B, -0.12, 0.24, 0, 1.3);
    }
  };
  L[8] = {   // Samgori: the wide avenue to the airport, the fruit market, big blocks
    r: R => { lawn(R, 0x8cb853); road(R, -0.6, 0.2, 0.6, 0.22, 0.075); road(R, -0.6, 0.2, 0.6, 0.22, 0.005, 0xece6d6); R.pad(0, -0.31, 0.3); pave(R, 0, -0.06, 0.6, 0.07); },
    b: B => {
      block(B, -0.27, -0.33, 0.24, 0.1, 7, PANELS[4], 0, 4, 1.2); block(B, 0.26, -0.35, 0.22, 0.1, 8, PANELS[3], 0, 4, 1.2);
      for (let k = 0; k < 4; k++) stall(B, -0.21 + k * 0.14, -0.07, 0, [C.red, C.yellow, 0x3f7fc2, 0x55ad5f][k], 1.35);
      for (const [x, z] of [[-0.46, 0.4], [0.46, 0.41]]) tree(B, x, z, 0.95);
    }
  };
  L[9] = {   // Isani: the round metro pavilion on its square, a kiosk, plane trees, a block (its half of the corner)
    r: R => { lawn(R); R.pad(0.2, 0.2, 0.15); pave(R, 0.26, 0.38, 0.4, 0.06); },
    b: B => {
      pavilion(B, 0.2, 0.18, 1.15);
      block(B, 0.43, -0.12, 0.2, 0.09, 5, PANELS[5], Math.PI / 2, 3, 1.15);
      plane(B, 0.02, 0.4, 1.0); kiosk(B, 0.42, 0.3, -0.3, 1.3); plane(B, 0.47, 0.12, 0.9);
    }
  };
  // --- მარცხენა სანაპირო ---
  L[11] = {  // Avlabari: the presidential palace's glass dome, old houses on the slope (Sameba stands in the middle; its half of the corner)
    r: R => { lawn(R); R.hill(-0.36, -0.1, 0.22, 0.3, 0.07); R.pad(-0.27, 0.22, 0.17); },
    b: B => {
      palace(B, -0.27, 0.23, 0.85);
      oldHouse(B, -0.42, -0.1, 0.12, 0.1, 2, C.rose, C.tin, Math.PI / 2, true, 1.3);
      oldHouse(B, -0.05, 0.39, 0.13, 0.1, 2, C.cream, C.tile, 0, true, 1.25);
      cypress(B, -0.49, 0.4, 1.2); cypress(B, -0.46, 0.1, 1.1);
    }
  };
  L[12] = {  // the Tbilisi Sea: the reservoir, its beach and pier, the Chronicle's bronze pillars on the hill
    r: R => { R.tint(0x9fc262, 9, undefined, 0x9c917a); R.lake(0.02, 0.15, 0.42, 0.24, 0.08); R.hill(0.0, -0.42, 0.5, 0.2, 0.14); R.pad(0, -0.4, 0.17); road(R, -0.46, -0.13, 0.46, -0.13, 0.06, 0xeedcab); },
    b: B => {
      chronicle(B, 0, -0.42, 1.0);
      [[-0.32, C.red], [-0.12, C.yellow], [0.12, C.white], [0.32, C.red]].forEach(([x, c]) => umbrella(B, x, -0.13, c, 1.4));
      pier(B, 0.36, 0.06, 0.2, 0, 1.2);
    }
  };
  L[13] = { r: R => { lawn(R); R.pad(0, -0.04, 0.44); }, b: B => { lamp(B, -0.45, 0.38, 1.4); lamp(B, 0.45, 0.38, 1.4); } };     // Chughureti: the old courtyard (its model)
  L[14] = {  // Aghmashenebeli Avenue: its pastel houses and cafés, the fountain, the footbridge over the branch (at its left)
    r: R => { lawn(R); for (const x of [-0.02, 0.2, 0.41]) R.pad(x, -0.25, 0.12); road(R, -0.14, 0.04, 0.6, 0.04, 0.075, COBBLE); },
    b: B => {
      const cols = [C.peach, C.sky, C.cream];
      [-0.02, 0.2, 0.41].forEach((x, k) => oldHouse(B, x, -0.25, 0.14, 0.12, 3, cols[k], k % 2 ? C.tile : C.tin, 0, true, 1.4));
      [[-0.04, C.white], [0.18, C.red], [0.4, C.white]].forEach(([x, c]) => cafe(B, x, 0.16, c, 1.3));
      fountain(B, 0.1, 0.37, 1.15);
      footbridge(B, -0.8, -0.12, 0.22, 0.07);
      tree(B, -0.15, -0.34, 0.95);
    }
  };
  L[15] = {  // the metro: its round pavilion, the sign, the little square under the plane trees (the branch at its right)
    r: R => { lawn(R); R.pad(-0.15, -0.07, 0.27); pave(R, -0.15, 0.25, 0.5, 0.07); road(R, 0.08, 0.22, 0.2, 0.22, 0.05, PAVE); },     // (the footbridge from Aghmashenebeli lands at its right)
    b: B => {
      pavilion(B, -0.15, -0.08, 1.4);
      for (const [x, z] of [[-0.44, -0.33], [0.1, -0.35], [-0.46, 0.18], [0.13, -0.1]]) plane(B, x, z, 1.0);
      bench(B, -0.34, 0.31, 0, 1.3); bench(B, -0.08, 0.36, 0, 1.3); lamp(B, -0.2, 0.37, 1.4);
    }
  };
  // --- ჩრდილოეთი ---
  L[16] = {  // Gldani: tall blocks round a big courtyard, its swings and carousel, the cars along the street
    r: R => { lawn(R); R.pad(0, -0.06, 0.42); road(R, -0.6, 0.38, 0.6, 0.38); },
    b: B => {
      block(B, -0.36, -0.15, 0.1, 0.36, 10, PANELS[0], 0, 3, 1.15); block(B, 0.04, -0.37, 0.36, 0.1, 9, PANELS[1], 0, 4, 1.15); block(B, 0.39, -0.1, 0.1, 0.3, 10, PANELS[2], 0, 3, 1.15);
      swings(B, -0.12, 0.06, 1.3); B.add(cyl(0.065, 0.07, 0.012, 14), C.stone, 0.14, 0, 0.14);
      car(B, -0.36, 0.3, 0, C.white, 1.3); car(B, -0.22, 0.3, 0, 0x3c3c3c, 1.3); car(B, 0.3, 0.3, 0, C.red, 1.3);
      tree(B, -0.14, -0.14, 0.9); tree(B, 0.2, -0.14, 0.85);
    }
  };
  L[18] = {  // Nadzaladevi: the railway and its train, the covered market, the footbridge over the tracks
    r: R => { lawn(R); road(R, -0.6, 0.06, 0.6, 0.06, 0.065, 0x8f8576); R.pad(-0.12, -0.31, 0.25); R.pad(0.33, -0.3, 0.13); },
    b: B => {
      rails(B, -0.55, 0.55, 0.02); rails(B, -0.55, 0.55, 0.11);
      market(B, -0.12, -0.31, 1.2);
      oldHouse(B, 0.34, -0.3, 0.15, 0.12, 2, C.cream, C.tin2, 0, false, 1.4);
      const fb = B.at(0.3, 0.065, Math.PI / 2, 1.2); fb(box(0.03, 0.006, 0.34), C.iron, 0, 0.12, 0); for (const zz of [-0.15, 0.15]) fb(box(0.03, 0.12, 0.03), C.stone2, 0, 0, zz);
      for (const [x, z] of [[-0.44, 0.32], [0.0, 0.33], [0.44, 0.31]]) tree(B, x, z, 0.9);
    }
  };
  L[19] = {  // Didube: the bus station full of minibuses, a stall, the old church among cypresses (its half of the corner)
    r: R => { lawn(R); R.pad(0.32, 0.02, 0.15); pave(R, 0.3, 0.33, 0.4, 0.09); },
    b: B => {
      for (let k = 0; k < 3; k++) minibus(B, 0.16 + k * 0.13, 0.33, Math.PI / 2, 1.3);
      chapel(B, 0.36, 0.02, 0.72);
      for (const [x, z] of [[0.18, 0.12], [0.48, -0.3], [0.49, 0.18]]) cypress(B, x, z, 1.1);
    }
  };
  // --- ჩრდილო-დასავლეთი ---
  L[21] = {  // Dighomi: new coloured towers by the forest park (its half of the corner)
    r: R => { park(R); R.pad(-0.3, 0.06, 0.2); },
    b: B => {
      tower(B, -0.37, -0.05, 0.11, 0.1, 0.5, C.panel3, C.peach, 0, 1.1); tower(B, -0.15, 0.2, 0.11, 0.1, 0.58, C.panel3, 0x8fb5d0, 0, 1.1); tower(B, -0.4, 0.3, 0.1, 0.1, 0.42, C.panel3, 0xb7d08f, 0, 1.1);
      for (const [x, z] of [[-0.47, -0.3], [-0.29, -0.28], [0.02, 0.4], [-0.05, 0.28]]) pine(B, x, z, 1.0);
    }
  };
  L[23] = {  // Vashlijvari: towers on the green hill above Lisi Lake, its pier
    r: R => { park(R, 0x7cb24c); R.hill(0, -0.4, 0.62, 0.24, 0.13); R.pad(0, -0.38, 0.25); R.lake(0.04, 0.2, 0.4, 0.2, 0.07); },
    b: B => {
      for (const [x, h] of [[-0.24, 0.48], [0.02, 0.6], [0.28, 0.44]]) tower(B, x, -0.38, 0.13, 0.11, h, C.panel3, 0xd9a07a, 0, 1.1);
      pier(B, 0.33, 0.12, 0.16, 0, 1.2);
      for (const [x, z] of [[-0.45, 0.0], [0.46, -0.06], [-0.43, 0.34]]) tree(B, x, z, 1.0);
    }
  };
  L[24] = {  // Saburtalo: the stacked blocks of the old ministry, the road over the river on its bridge (the river at its left)
    r: R => { lawn(R); R.pad(0.22, -0.2, 0.24); road(R, -0.86, 0.14, 0.6, 0.14); road(R, -0.86, 0.14, -0.92, 0.6); },
    b: B => {
      ministry(B, 0.22, -0.2, 1.25);
      roadBridge(B, -0.78, -0.1, 0.14, 0.13);
      for (const [x, z] of [[-0.04, -0.32], [0.47, 0.0], [0.0, 0.37], [0.4, 0.37]]) tree(B, x, z, 0.95);
    }
  };
  // --- ვაკე-ვერა ---
  L[26] = {  // Vera: the steep cobbled street, houses with iron balconies, great plane trees in autumn, the ravine
    r: R => { lawn(R); R.hill(0, -0.32, 0.62, 0.28, 0.15); R.dig(0.56, 0.2, 0.22, 0.56, 0.07, 0.05, false); road(R, -0.5, -0.12, 0.2, 0.32, 0.05, COBBLE); R.pad(-0.3, -0.28, 0.15); R.pad(0.06, -0.3, 0.14); R.pad(-0.3, 0.16, 0.12); },
    b: B => {
      oldHouse(B, -0.3, -0.28, 0.16, 0.12, 3, C.peach, C.tin, 0.2, true, 1.4); oldHouse(B, 0.06, -0.3, 0.15, 0.12, 3, C.sky, C.tile, -0.1, true, 1.4);
      oldHouse(B, -0.3, 0.16, 0.13, 0.1, 2, C.cream, C.rust, 0.5, true, 1.35);
      for (const [x, z] of [[0.27, -0.08], [-0.02, 0.05], [0.38, -0.36], [0.36, 0.3]]) bigTree(B, x, z, 0.8, C.autumn);
    }
  };
  L[27] = {  // Vake: the leafy avenue, the tall houses of the fifties with tile roofs, cafés
    r: R => { lawn(R); road(R, -0.6, 0.13, 0.6, 0.13, 0.06); R.pad(0, -0.28, 0.32); },
    b: B => {
      [-0.3, 0.0, 0.3].forEach((x, k) => { block(B, x, -0.29, 0.22, 0.13, 5, [C.ochre, C.cream, C.sand][k], 0, 4, 1.15); B.at(x, -0.29, 0, 1.15)(roof(0.24, 0.05, 0.15), C.tile, 0, 0.25, 0, { vary: 0.06 }); });
      for (let k = 0; k < 5; k++) { tree(B, -0.44 + k * 0.22, 0.02, 0.85, C.leaf2); tree(B, -0.44 + k * 0.22, 0.26, 0.8, C.leaf2); }
      cafe(B, -0.15, -0.1, C.red, 1.2); cafe(B, 0.15, -0.1, C.white, 1.2);
    }
  };
  L[28] = {  // ZAHES: the stone dam across the water, the classical power station, the pylons
    r: R => { lawn(R); R.lake(0.0, 0.08, 0.6, 0.11, 0.07); R.pad(0.25, -0.3, 0.16); },
    b: B => {
      const d = B.at(-0.1, 0.08, Math.PI / 2, 1.3); d(box(0.22, 0.09, 0.05), C.stone2, 0, -0.04, 0, { vary: 0.06 }); for (let k = 0; k < 3; k++) d(box(0.04, 0.05, 0.052), 0x2c3a3e, -0.06 + k * 0.06, -0.03, 0);
      const p = B.at(0.25, -0.3, 0, 1.25); p(box(0.22, 0.12, 0.13), C.cream); for (let k = 0; k < 4; k++) p(cyl(0.008, 0.008, 0.12, 6), C.white, -0.075 + k * 0.05, 0, 0.07); p(roof(0.24, 0.045, 0.15), C.tile, 0, 0.12, 0); p(box(0.06, 0.02, 0.005), 0x8a2a2a, 0, 0.13, 0.075);
      pylon(B, -0.38, -0.34, 0.46); pylon(B, 0.0, -0.42, 0.42);
      for (const [x, z] of [[-0.42, 0.36], [0.44, 0.36], [0.47, -0.1]]) tree(B, x, z, 1.0);
    }
  };
  L[29] = {  // Vake Park: the great stair with its fountains up to the memorial (its half of the corner)
    r: R => { park(R); R.hill(0.38, -0.22, 0.2, 0.26, 0.13); R.pad(0.4, -0.22, 0.09); road(R, 0.38, 0.46, 0.38, -0.12, 0.05, PAVE); },
    b: B => {
      for (let k = 0; k < 5; k++) B.add(box(0.11, 0.014, 0.07), k % 2 ? C.stone : C.stone2, 0.38, 0, 0.36 - k * 0.09);
      for (const z of [0.3, 0.1]) { fountain(B, 0.24, z, 0.85); fountain(B, 0.5, z, 0.85); }
      memorial(B, 0.4, -0.22, 1.05);
      for (const [x, z] of [[0.08, 0.4], [0.2, -0.04], [0.5, -0.42]]) tree(B, x, z, 0.95);
    }
  };
  // --- მთაწმინდის კალთა ---
  L[31] = {  // Turtle Lake: the little lake in the forest, its pier, the ethnographic museum's wooden house (its half of the corner)
    r: R => { park(R, 0x6a9e44); R.lake(-0.3, 0.15, 0.16, 0.2, 0.06); R.pad(-0.07, 0.39, 0.1); },
    b: B => {
      for (let k = 0; k < 11; k++) { const a = k / 11 * Math.PI * 2, x = -0.3 + Math.cos(a) * 0.26, z = 0.13 + Math.sin(a) * 0.31; if (z >= 0.2 + 1.05 * x && x > -0.52) pine(B, x, z, 0.85 + (k % 3) * 0.1); }
      pier(B, -0.3, 0.32, 0.1, Math.PI, 1.2);
      woodHouse(B, -0.07, 0.39, 0.3, 1.2);
    }
  };
  L[32] = { r: R => { lawn(R); R.pad(0, -0.02, 0.44); pave(R, 0, 0.34, 0.86, 0.07); }, b: B => { lamp(B, -0.45, 0.38, 1.4); lamp(B, 0.45, 0.38, 1.4); } };     // Rustaveli (its model)
  // Mtatsminda Park (the hill itself stands in the middle): the Ferris wheel over the city, the carousel, the kiosks
  const FERRIS = [-0.18, -0.18], FERRIS_RY = Math.PI / 4, FERRIS_S = 1.3, FERRIS_H = 0.245 * FERRIS_S, CAROUSEL = [0.25, -0.16];
  L[34] = {
    r: R => { park(R, 0x76ad48); R.pad(0, -0.12, 0.44); pave(R, 0, 0.08, 0.8, 0.12); },
    b: B => {
      ferrisFrame(B, FERRIS[0], FERRIS[1], FERRIS_RY, FERRIS_S);
      B.add(cyl(0.1, 0.105, 0.014, 18), C.stone, CAROUSEL[0], 0, CAROUSEL[1]);
      stall(B, 0.32, 0.22, -0.4, C.red, 1.4); stall(B, -0.38, 0.24, 0.3, C.blue, 1.4);
      for (const [x, z] of [[-0.45, 0.02], [0.45, 0.04], [0.04, 0.32]]) lamp(B, x, z, 1.3);
      bench(B, -0.12, 0.26, 0, 1.3); bench(B, 0.16, 0.28, 0, 1.3);
      for (const [x, z, sc] of [[-0.44, -0.4, 0.95], [0.46, -0.42, 0.9], [0.08, -0.44, 0.85]]) tree(B, x, z, sc, C.leaf2);
    }
  };
  // the funicular: its old stone station below, the track straight up the wooded slope
  L[35] = {
    r: R => { park(R, 0x6f9a46); R.hill(0, -0.5, 0.75, 0.55, 0.34); R.pad(0, 0.32, 0.13); },
    b: B => {
      funicularStation(B, 0, 0.32, 1.25);
      for (let k = 0; k < 12; k++) B.add(box(0.06, 0.008, 0.012), C.wood2, 0, 0.004, 0.2 - k * 0.06);
      for (const x of [-0.018, 0.018]) for (let k = 0; k < 6; k++) B.add(box(0.004, 0.006, 0.12), 0x8a8a8a, x, 0.008, 0.16 - k * 0.12);
      for (let k = 0; k < 12; k++) { const r = rng(35 + k); pine(B, (k % 2 ? 1 : -1) * (0.13 + r() * 0.3), 0.16 - Math.floor(k / 2) * 0.11, 0.8 + r() * 0.35); }
    }
  };
  // --- ძველი ქალაქი ---
  L[37] = {  // Sololaki: the mansions with carved balconies, the old walls on the ridge above
    r: R => { lawn(R); R.ridge(-0.6, -0.42, 0.6, -0.4, 0.3, 0.16); road(R, -0.6, 0.16, 0.6, 0.14, 0.045, COBBLE); R.pad(-0.27, -0.1, 0.16); R.pad(0.1, -0.12, 0.16); R.pad(0.39, -0.07, 0.12); },
    b: B => {
      oldHouse(B, -0.27, -0.1, 0.18, 0.13, 3, C.ochre, C.tin, 0, true, 1.4); oldHouse(B, 0.1, -0.12, 0.17, 0.13, 3, C.rose, C.tin2, 0, true, 1.4); oldHouse(B, 0.4, -0.07, 0.13, 0.11, 2, C.cream, C.tile, 0, true, 1.4);
      wall(B, 0.0, -0.43, 1.0, 0.1, 0.0, 0xb3a184, 0.05);
      for (const [x, z] of [[-0.45, 0.3], [0.0, 0.32], [0.44, 0.31]]) tree(B, x, z, 0.9);
    }
  };
  L[38] = {  // the Dry Bridge: its stone arches over a dry garden, the painters' market under them
    r: R => { lawn(R); R.pad(0, -0.14, 0.42); pave(R, 0, 0.16, 0.8, 0.1); },
    b: B => {
      const put = B.at(0, -0.26, 0, 1.25);
      put(box(0.7, 0.03, 0.12), C.stone2, 0, 0.12, 0, { vary: 0.06 }); put(box(0.72, 0.01, 0.13), C.stone, 0, 0.15, 0);
      for (const x of [-0.3, -0.1, 0.1, 0.3]) put(box(0.05, 0.12, 0.12), C.stone, x, 0, 0, { vary: 0.06 });
      for (const x of [-0.2, 0.0, 0.2]) put(new T.TorusGeometry(0.075, 0.012, 4, 10, Math.PI).scale(1, 1, 5), C.stone, x, 0.045, 0, { vary: 0.05 });
      for (let k = 0; k < 7; k++) { const x = -0.33 + k * 0.11, e = B.at(x, 0.08, 0.12 * Math.sin(k * 1.7), 1.3); e(box(0.004, 0.06, 0.004), C.wood2, 0, 0, -0.01); e(box(0.05, 0.04, 0.004), [0x3f7fc2, 0xe9c449, 0xc23a2e, 0x55ad5f, 0xd99d8c][k % 5], 0, 0.035, 0, { rx: -0.2 }); }
      lamp(B, -0.45, 0.3, 1.4); lamp(B, 0.45, 0.3, 1.4);
    }
  };
  L[39] = {  // Old Tbilisi: Gabriadze's crooked clock tower by his puppet theatre, the houses of the old town (its half of the corner)
    r: R => { lawn(R); R.pad(0.4, -0.04, 0.12); R.pad(0.2, 0.19, 0.13); road(R, -0.05, 0.4, 0.5, 0.18, 0.05, COBBLE); },
    b: B => {
      clockTower(B, 0.41, -0.05, 1.3);
      oldHouse(B, 0.2, 0.19, 0.15, 0.11, 2, C.ochre, C.tile, 0, true, 1.4);
      oldHouse(B, 0.44, 0.35, 0.12, 0.1, 2, C.sky, C.tin, -0.2, true, 1.3);
      tree(B, 0.0, 0.41, 1.0, C.leaf2); lamp(B, 0.27, 0.36, 1.3);
    }
  };
  // the old Tiflis story: a poster column and a newspaper kiosk by an old house, a bench under a plane tree
  const storyLot = v => ({
    r: R => { lawn(R); pave(R, 0, 0.07, 0.62, 0.15); R.pad(0.1 * (v % 2 ? -1 : 1), -0.25, 0.16); },
    b: B => {
      const m = v % 2 ? -1 : 1;
      oldHouse(B, 0.12 * m, -0.26, 0.17, 0.12, 2, [C.peach, C.sky, C.mint][v], [C.tile, C.tin, C.rust][v], 0, true, 1.45);
      posterColumn(B, -0.15 * m, 0.04, 1.5); kiosk(B, 0.2 * m, 0.12, -0.2 * m, 1.35);
      bigTree(B, -0.36 * m, -0.25, 0.9, C.leaf2); bench(B, -0.3 * m, 0.25, 0, 1.4); lamp(B, 0.02 * m, 0.27, 1.4);
    }
  });
  L[7] = storyLot(0); L[22] = storyLot(1); L[36] = storyLot(2);
  // the cable car: its glass station below, the line up to the hill at the back (the river at its right)
  const CAB25 = [[-0.16, 0.14, 0.2], [-0.2, 0.18, -0.4]];          // its two masts: x, height, z
  L[25] = {
    r: R => { park(R); R.hill(-0.2, -0.5, 0.42, 0.34, 0.3); R.pad(-0.16, 0.22, 0.16); },
    b: B => {
      const put = B.at(-0.16, 0.24, 0, 1.2); put(box(0.2, 0.08, 0.12), C.glass2); put(box(0.22, 0.01, 0.14), C.white, 0, 0.08, 0); put(box(0.06, 0.05, 0.01), C.red, 0.06, 0.03, 0.062);
      for (const [x, h, z] of CAB25) { B.add(box(0.014, h, 0.014), 0x5b5f66, x, 0, z); B.add(box(0.05, 0.01, 0.02), 0x5b5f66, x, h, z); }
      const top2 = B.at(-0.2, -0.47, 0, 1.0); top2(box(0.12, 0.065, 0.09), C.glass2); top2(box(0.14, 0.01, 0.11), C.white, 0, 0.065, 0);          // the station at the top
      const top = CAB25.map(([x, h, z]) => [x, B.ground(x, z) + h, z]), [a, b] = top, len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const up = Math.atan2(b[1] - a[1], Math.hypot(b[0] - a[0], b[2] - a[2])), ry = Math.atan2(-(b[2] - a[2]), b[0] - a[0]);
      B.add(box(len, 0.004, 0.004), 0x2b2d31, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, { ry, rz: up, free: true });
      for (const [x, z] of [[-0.45, 0.06], [0.08, 0.06], [-0.43, -0.3], [0.06, -0.3], [-0.46, 0.38]]) tree(B, x, z, 0.95);
    }
  };

  // ===== the old city in the middle: one map, inside the districts' ring =====
  // (board coordinates, x to the right and z to the front seen from the front)
  // the Mtkvari: in under the back's squares (between Saburtalo, 24, and the cable car, 25), out under the front's
  // (between the station, 5, and Varketili, 6); its branch round Metekhi's cliff, out under the left side's (between
  // Aghmashenebeli, 14, and the metro, 15). A point's third number: how wide the river is there (narrower through the
  // districts)
  const RIVER = [[-0.5, -5.4, 0.7], [-0.5, -4.5, 0.7], [-0.52, -3.7, 0.72], [-0.6, -3.0, 0.88], [-0.62, -2.3, 1], [-0.4, -1.37, 1], [0.0, -0.5, 1],
    [0.11, 0.36, 1], [0.0, 1.22, 1], [-0.2, 2.1, 1], [-0.42, 2.85, 0.88], [-0.5, 3.6, 0.72], [-0.5, 4.5, 0.7], [-0.5, 5.4, 0.7]];
  const BRANCH = [[0.0, 0.72, 1], [-1.0, 1.1, 1], [-2.0, 1.05, 1], [-2.85, 0.75, 1], [-3.45, 0.54, 0.9], [-4.1, 0.5, 0.85], [-4.8, 0.5, 0.85], [-5.4, 0.5, 0.85]];
  const WATER_Y = -0.05;
  // the same smooth line through the points as the land's (Terrain's flow): known here before the land is made
  function curve(ctrl, n = 8) {
    const out = [], P = k => ctrl[Math.max(0, Math.min(ctrl.length - 1, k))];
    for (let k = 0; k < ctrl.length - 1; k++) for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t, a = P(k - 1), b = P(k), c = P(k + 1), e = P(k + 2);
      out.push([0, 1, 2].map(q => 0.5 * (2 * b[q] + (c[q] - a[q]) * t + (2 * a[q] - 5 * b[q] + 4 * c[q] - e[q]) * t2 + (3 * b[q] - a[q] - 3 * c[q] + e[q]) * t3)));
    }
    out.push(ctrl[ctrl.length - 1].slice());
    return out;
  }
  let riverPts = curve(RIVER), branchPts = curve(BRANCH);
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
  // where the river is at a given z (from the back to the front, it crosses each z once)
  function riverX(z) {
    for (let k = 1; k < riverPts.length; k++) { const [ax, az] = riverPts[k - 1], [bx, bz] = riverPts[k]; if ((az - z) * (bz - z) <= 0 && az !== bz) return ax + (bx - ax) * (z - az) / (bz - az); }
    return 0;
  }
  // the landmarks' places: Mtatsminda's hill (its tower a little behind its middle, turned with it), Narikala on the
  // right, Kartlis Deda behind it, the Old Town below it, the baths at the front; Sameba at the back left, Metekhi's
  // cliff on the left, Rike Park at the front left; the two bridges
  const MT = [0.92, -2.12], MT_W = 2.2, MT_RY = 1.1;
  const TOWER = [MT[0] + Math.sin(MT_RY) * -0.09 * MT_W, MT[1] + Math.cos(MT_RY) * -0.09 * MT_W];
  const CENTER = { peak: TOWER, mountain: MT, narikala: [2.3, -0.75], deda: [2.8, -2.4], sameba: [-2.12, -2.3], baths: [0.95, 2.62],
    cliff: [-1.66, -0.18], church: [-1.76, -0.32], rider: [-0.94, 0.22], rike: [-1.98, 2.23], peace: [riverX(-0.5), -0.5], stone: [riverX(2.45), 2.45] };
  // the sandy paths: from the bridges' ends to the Old Town, up the cliff, down Sameba's stair, to the baths and Rike
  // Park, to Mtatsminda's foot, the Old Town's street
  const PATHS = [[[0.46, -0.68], [0.85, -0.05], [1.12, 0.42]], [[-0.46, -0.3], [-0.8, -0.44], [-1.2, -0.4]], [[-2.08, -1.58], [-1.9, -1.05]],
    [[0.2, 2.58], [0.42, 2.62]], [[-0.78, 2.31], [-1.2, 2.35], [-1.55, 2.1]], [[-0.1, -1.28], [0.3, -1.42]], [[0.62, 0.42], [0.66, 1.35], [0.5, 2.05]]];
  function centerRelief(R) {
    R.tint(0, 0, LAWN, 9, 4.2, 0xc8b088);                                       // the lawns all over (sandstone where it is steep)
    R.tint(MT[0], MT[1], 0x6fa046, 9, 1.05, 0x7f8f52);
    R.pad(MT[0], MT[1], MT_W / 2 + 0.04);                                        // level under the hill's model
    R.pad(CENTER.narikala[0], CENTER.narikala[1], 0.92);
    R.pad(CENTER.deda[0], CENTER.deda[1], 0.3); R.pad(CENTER.sameba[0], CENTER.sameba[1], 0.92);
    R.tint(CENTER.sameba[0], CENTER.sameba[1], 0xbdb6a6, 9, 0.55);              // Sameba's paved square
    R.pad(CENTER.baths[0], CENTER.baths[1], 0.62);
    R.tint(2.0, 1.3, 0xa9b16c, 9, 0.75, 0xa89878);                               // the Old Town's dusty lanes
    // Metekhi's cliff: sheer sandstone, grass on its top
    R.mesa(CENTER.cliff[0], CENTER.cliff[1], 1.15, 0.83, 0.48, 0.22);
    for (const [dx, dz] of [[0, 0], [-0.8, -0.43], [0.72, -0.43], [-0.8, 0.5], [0.72, 0.5], [0, 0.72], [0, -0.72]]) R.tint(CENTER.cliff[0] + dx, CENTER.cliff[1] + dz, LAWN, 9, 0.4, 0xd6bc8c);
    R.tint(CENTER.rike[0], CENTER.rike[1], 0x7fbf4a, 9, 0.58);                   // Rike Park's lawns
    // the river and its branch: turquoise, foam along their banks; sandstone where the banks are steep
    riverPts = R.flow(RIVER, 0.45, 0.2, WATER_Y, 0.65, 0x2a8a98, 0x6fc6c4);
    branchPts = R.flow(BRANCH, 0.29, 0.16, WATER_Y - 0.002, 0.4, 0x2a8a98, 0x6fc6c4);
    for (const pts of [riverPts, branchPts]) for (let k = 0; k < pts.length; k += 5) if (Math.max(Math.abs(pts[k][0]), Math.abs(pts[k][1])) < 3.15) R.tint(pts[k][0], pts[k][1], 0x9fb46a, 9, 0.36, 0xd4c6a2);
    for (const pts of PATHS) for (let k = 1; k < pts.length; k++) R.path(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], 0.13, SAND);
  }
  function centerWater() { return null; }
  // the Old Town's houses: tall, close together, carved balconies, tile and tin roofs; none on its street or by the baths
  function oldTown(B) {
    const r = rng(1801);
    for (let gx = 0; gx < 7; gx++) for (let gz = 0; gz < 5; gz++) {
      const x = 0.78 + gx * 0.34 + (r() - 0.5) * 0.1, z = 0.6 + gz * 0.34 + (r() - 0.5) * 0.1;
      if (x > 3.0 || (x < 1.5 && z > 1.95) || x < riverX(z) + 0.62) continue;
      if (r() < 0.12) { tree(B, x, z, 1.15, C.leaf2); continue; }                       // a little yard with its tree
      if (near(PATHS[6], x, z)[0] < 0.18) continue;
      const wall = WALLS[Math.floor(r() * WALLS.length)], roofC = [C.tile, C.tile2, C.rust, C.tile, 0x6f8fb0, C.tile2, 0x8a6f5a][Math.floor(r() * 7)];
      oldHouse(B, x, z, 0.14 + r() * 0.06, 0.12 + r() * 0.03, 2 + Math.floor(r() * 2.6), wall, roofC, (r() - 0.5) * 0.5, true, 1.7);
    }
  }
  // Rike Park's two great tubes, silver, open at their ends, lying on the lawn
  function tubes(B, x, z, ry, s = 1) {
    const put = B.at(x, z, ry, s), silver = 0xb9c1c9;
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
  // the trees: along the middle's edges and in its corners, wherever the map leaves its lawns free
  function trees(B) {
    const r = rng(2468), placed = [];
    const away = (x, z) =>
      near(riverPts, x, z)[0] > 0.55 && near(branchPts, x, z)[0] > 0.4 && PATHS.every(p => near(p, x, z)[0] > 0.18) &&
      Math.hypot(x - MT[0], z - MT[1]) > MT_W / 2 + 0.1 && Math.hypot(x - CENTER.narikala[0], z - CENTER.narikala[1]) > 1.0 &&
      Math.hypot(x - CENTER.deda[0], z - CENTER.deda[1]) > 0.4 && Math.hypot(x - CENTER.sameba[0], z - CENTER.sameba[1]) > 0.95 &&
      Math.hypot(x - CENTER.baths[0], z - CENTER.baths[1]) > 0.7 && !(x > 0.55 && x < 3.1 && z > 0.38 && z < 2.15) &&
      Math.hypot(x - CENTER.church[0], z - CENTER.church[1]) > 0.55 && Math.hypot(x - CENTER.rider[0], z - CENTER.rider[1]) > 0.3 &&
      Math.hypot(x + 2.2, z - 2.05) > 0.55 && Math.hypot(x + 1.58, z - 2.48) > 0.5 &&
      Math.hypot(x - CENTER.peace[0], z - CENTER.peace[1]) > 0.65 && Math.hypot(x - CENTER.stone[0], z - CENTER.stone[1]) > 0.62;
    for (let k = 0; k < 1200 && placed.length < 72; k++) {
      // more of them near the edges and in the corners
      const edge = r() < 0.6, x = edge ? (r() < 0.5 ? -1 : 1) * (2.5 + r() * 0.58) : (r() - 0.5) * 6.1, z = (r() - 0.5) * 6.1;
      const [px, pz] = edge && r() < 0.5 ? [z, x] : [x, z];
      if (Math.max(Math.abs(px), Math.abs(pz)) > 3.06 || !away(px, pz) || placed.some(([qx, qz]) => Math.hypot(px - qx, pz - qz) < 0.24)) continue;
      placed.push([px, pz]);
      const sc = 1.15 + r() * 0.45;
      if (r() < 0.3) pine(B, px, pz, sc * 1.1); else tree(B, px, pz, sc, [C.leaf, C.leaf2, 0x6a9a3a][Math.floor(r() * 3)]);
    }
  }
  function center(ground) {
    const B = new Builder();
    B.ground = ground;
    const steps = [
      () => oldTown(B),
      () => {
        chapel(B, CENTER.church[0], CENTER.church[1], 1.75, 0.25);                // Metekhi on its cliff
        rider(B, CENTER.rider[0], CENTER.rider[1], -0.6, 1.15);
        tubes(B, -2.2, 2.05, 0.15, 0.72); tubes(B, -1.58, 2.48, -0.35, 0.72);
        for (const [x, z] of [[0.42, -0.25], [-0.45, -0.8], [0.3, 2.2], [-0.62, 2.62]]) lamp(B, x, z, 1.3);
      },
      () => trees(B)
    ];
    return { B, steps };
  }

  // ===== the landmarks from files (art/m_tb_*.glb; a computer's or ultra's, a phone's from art/mobile) =====
  // a district's: s its size (a district's land is 1 wide), z where it stands in it, on its own ground; main: the model
  // is the district (it greys when mortgaged, it jumps when bought)
  const MODELS = {
    4: { url: 'art/m_tb_bank.glb', s: 1.05, z: -0.06, ground: true, y: -0.006, main: true },
    13: { url: 'art/m_tb_courtyard.glb', s: 1.08, z: -0.04, ground: true, y: -0.004, main: true },
    32: { url: 'art/m_tb_rustaveli.glb', s: 1.1, z: -0.02, ground: true, y: -0.004, main: true }
  };
  // a corner's: at the back of its square, its name written in front of it (z: towards the square's outer edge)
  const CORNER_MODELS = {
    0: { url: 'art/m_tb_freedom.glb', fitWidth: 1.25, z: -0.22 },
    20: { url: 'art/m_tb_bench.glb', fitWidth: 1.05, z: -0.3, ry: 0 }
  };
  // the middle's: board coordinates; on: what they stand on (the ground there, or the river's water)
  const FREE_MODELS = [
    { url: 'art/m_tb_mtatsminda.glb', x: MT[0], z: MT[1], s: MT_W, ry: MT_RY, on: 'ground', y: -0.05, top: true, topY: 1.049 * MT_W - 0.05 },
    { url: 'art/m_tb_narikala.glb', x: CENTER.narikala[0], z: CENTER.narikala[1], s: 1.8, ry: 0, on: 'ground', y: -0.05 },
    { url: 'art/m_tb_kartlisdeda.glb', x: CENTER.deda[0], z: CENTER.deda[1], s: 0.85, ry: 0.4, on: 'ground', y: -0.02 },
    { url: 'art/m_tb_sameba.glb', x: CENTER.sameba[0], z: CENTER.sameba[1], s: 1.5, ry: 0.15, on: 'ground', y: -0.01 },
    { url: 'art/m_tb_baths.glb', x: CENTER.baths[0], z: CENTER.baths[1], s: 1.1, ry: -0.1, on: 'ground', y: -0.01 },
    { url: 'art/m_tb_peace.glb', x: CENTER.peace[0], z: CENTER.peace[1], s: 1.12, bridge: true, on: 'water', y: 0.06 },
    { url: 'art/m_tb_stonebridge.glb', x: CENTER.stone[0], z: CENTER.stone[1], s: 1.1, bridge: true, on: 'water', y: 0 }
  ];
  for (const d of FREE_MODELS) if (d.bridge) { const [dx, dz] = along(d.x, d.z); d.ry = Math.atan2(dx, dz); }      // its length across the river

  // ===== what moves (in a district's frame, heights above its land; on a corner: in its square's frame) =====
  const V = 1.4;                                            // (the districts' cars, buses and trains: their size)
  const FX = {
    1: { sparkle: [[-0.05, 0.36, 0.1, 1]] },
    3: { actors: [{ k: 'minibus', a: [-0.55, 0.31], b: [0.55, 0.28], speed: 0.06, s: V }] },
    5: { actors: [{ k: 'train', a: [-0.6, RAIL5], b: [0.3, RAIL5], speed: 0.06, h: 0.012, s: 1.3, level: true }] },
    6: { actors: [{ k: 'cyclist', a: [-0.55, 0.3], b: [0.0, 0.3], speed: 0.04, s: V }] },
    8: { actors: [{ k: 'car', a: [-0.55, 0.18], b: [0.55, 0.2], speed: 0.09, s: V }, { k: 'bus', a: [0.55, 0.24], b: [-0.55, 0.23], speed: 0.06, s: V }, { k: 'plane', a: [-0.6, -0.1], b: [0.6, 0.0], h: 0.95, speed: 0.12, s: 1.2 }] },
    12: { actors: [{ k: 'boat', sail: true, a: [-0.26, 0.16], b: [0.18, 0.22], speed: 0.03, s: 1.3 }], sparkle: [[0.0, 0.2, 0.02, 2]] },
    14: { sparkle: [[0.1, 0.37, 0.08, 2], [-0.46, 0.22, 0.02, 2]] },
    16: { actors: [{ k: 'carousel', spin: 0.9, at: [0.14, 0.14], h: 0.012, s: 1.5 }] },
    18: { actors: [{ k: 'train', a: [-0.45, 0.02], b: [0.45, 0.02], speed: 0.05, h: 0.008, s: 1.3 }] },
    19: { actors: [{ k: 'minibus', a: [0.08, 0.2], b: [0.46, 0.2], speed: 0.04, s: V }] },
    21: { actors: [{ k: 'cyclist', a: [-0.48, 0.42], b: [-0.12, 0.42], speed: 0.04, s: V }] },
    23: { actors: [{ k: 'boat', a: [-0.24, 0.22], b: [0.22, 0.18], speed: 0.025, s: 1.3 }] },
    24: { actors: [{ k: 'car', a: [-0.7, 0.12], b: [0.5, 0.12], speed: 0.07, s: V, level: true }, { k: 'bus', a: [0.5, 0.16], b: [-0.7, 0.16], speed: 0.05, s: V, level: true }] },
    25: { actors: [{ k: 'gondola', cable: CAB25 }] },
    26: { leaves: [[0.27, -0.08, 0.32], [-0.02, 0.05, 0.3]] },
    27: { actors: [{ k: 'car', a: [-0.55, 0.11], b: [0.55, 0.11], speed: 0.08, s: V }, { k: 'car2', a: [0.55, 0.15], b: [-0.55, 0.15], speed: 0.07, s: V }] },
    28: { sparkle: [[-0.1, 0.1, 0.02, 2], [-0.1, 0.14, 0.0, 2]] },
    29: { sparkle: [[0.24, 0.3, 0.06, 2], [0.5, 0.1, 0.06, 2]] },
    31: { actors: [{ k: 'boat', a: [-0.32, 0.04], b: [-0.28, 0.24], speed: 0.02, s: 1.2 }] },
    32: { actors: [{ k: 'car', a: [-0.55, 0.34], b: [0.55, 0.34], speed: 0.07, s: V }] },
    34: { actors: [{ k: 'ferris', spin: 0.22, axis: 'x', at: FERRIS, h: FERRIS_H, ry: FERRIS_RY, s: 1.18 * FERRIS_S }, { k: 'carousel', spin: 0.8, at: CAROUSEL, h: 0.016, s: 1.8 }] },
    35: { actors: [{ k: 'funicular', a: [0.0, 0.22], b: [0.0, -0.45], speed: 0.05, h: 0.012, s: 1.3 }] },
    37: { smoke: [[0.1, -0.12, 0.42]] },
    38: { sparkle: [[-0.45, 0.3, 0.19, 1], [0.45, 0.3, 0.19, 1]] },
    39: { sparkle: [[0.41, -0.05, 0.7, 1]] },
    2: { sparkle: [[0.05, 0.15, 0.1, 1]] }, 17: { sparkle: [[-0.05, 0.15, 0.1, 1]] }, 33: { sparkle: [[0.05, 0.15, 0.1, 1]] },
    7: { sparkle: [[-0.15, 0.04, 0.26, 2]] }, 22: { sparkle: [[0.15, 0.04, 0.26, 2]] }, 36: { sparkle: [[-0.15, 0.04, 0.26, 2]] },
    // the corners (on the square itself)
    0: { sparkle: [[0.0, -0.3, 0.75, 1]] },
    10: { sparkle: [[0.52, -0.42, 0.25, 1]] },
    30: { actors: [{ k: 'police', a: [-0.5, -0.12], b: [0.5, -0.12], speed: 0.12 }], sparkle: [[0.0, -0.45, 0.06, 1]] }
  };
  const CENTER_FX = {
    smoke: [[CENTER.baths[0], CENTER.baths[1], 0.38], [CENTER.baths[0] + 0.15, CENTER.baths[1] - 0.1, 0.34]], mist: [], sheep: [],   // the baths' steam
    actors: [
      { k: 'boat', a: [-0.62, -2.5], b: [0.04, -0.2], speed: 0.04 },
      { k: 'boat', a: [0.06, 0.95], b: [-0.3, 2.95], speed: 0.035, phase: 0.4 },
      { k: 'cart', a: [0.5, -0.6], b: [1.02, 0.3], speed: 0.05 },
      { k: 'cart', a: [-0.85, 2.32], b: [-1.5, 2.15], speed: 0.04, phase: 0.6 }
    ],
    // eagles round the tower, one higher, one wider
    birds: [{ at: TOWER, h: 2.2, r: 0.8, w: 0.3 }, { at: TOWER, h: 1.75, r: 1.35, w: -0.22 }]
  };

  // ----- the moving things' own shapes (around their own origin, facing +x) -----
  function actor(k) {
    const B = new Builder();
    if (k === 'car' || k === 'car2' || k === 'police') {
      car(B, 0, 0, 0, k === 'car' ? C.red : k === 'car2' ? 0x2f62a8 : C.white, 1);
      if (k === 'police') { B.add(box(0.012, 0.008, 0.026), 0x2a5ad8, 0, 0.048, -0.007); B.add(box(0.012, 0.008, 0.012), 0xe8342a, 0, 0.048, 0.01); B.add(box(0.077, 0.006, 0.037), 0x2a5ad8, 0, 0.016, 0); }
    } else if (k === 'bus') bus(B, 0, 0, 0, 0x3f7fc2);
    else if (k === 'minibus') minibus(B, 0, 0, 0);
    else if (k === 'train') {                                 // two carriages either side of its middle (it turns round at its ends)
      for (const j of [-1, 1]) { const x = j * 0.078; B.add(box(0.15, 0.05, 0.05), C.white, x, 0.012, 0); B.add(box(0.15, 0.014, 0.052), C.red, x, 0.03, 0); B.add(box(0.13, 0.012, 0.053), C.glass, x, 0.046, 0); B.add(box(0.152, 0.006, 0.048), C.tin, x, 0.062, 0); }
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

  // ===== the districts' gardens: bushes, flower beds and a few small trees wherever their lawn is empty (nothing stands
  // there, no road runs, no car drives, no wheel turns; not in a lake or the river's bed; by a corner, in its own half) =====
  function segDist(x, z, x1, z1, x2, z2) { const dx = x2 - x1, dz = z2 - z1, l2 = dx * dx + dz * dz || 1e-9, t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / l2)); return Math.hypot(x1 + dx * t - x, z1 + dz * t - z); }
  function garnish(B, i) {
    const boxes = B.parts.map(g => { g.computeBoundingBox(); const b = g.boundingBox; return [b.min.x, b.min.z, b.max.x, b.max.z]; });
    const d = MODELS[i]; if (d) { const hw = d.s / 2 / 1.18, hd = d.s / 2 / 1.12, mx = d.x || 0, mz = d.z || 0; boxes.push([mx - hw, mz - hd, mx + hw, mz + hd]); }
    const ways = (ROADS[i] || []).slice(), fx = FX[i];
    if (fx && fx.actors) for (const a of fx.actors) { if (a.a) ways.push([a.a[0], a.a[1], a.b[0], a.b[1], 0.05]); if (a.at) ways.push([a.at[0], a.at[1], a.at[0], a.at[1], 0.2]); if (a.cable) ways.push([a.cable[0][0], a.cable[0][2], a.cable[1][0], a.cable[1][2], 0.06]); }
    const r = rng(i * 97 + 5), first = i % 10 === 1, last = i % 10 === 9, lite = typeof Gfx !== 'undefined' && Gfx && Gfx.spec && Gfx.spec.lite;   // (lighter on a phone)
    const free = (x, z, m) => boxes.every(([x0, z0, x1, z1]) => x < x0 - m || x > x1 + m || z < z0 - m || z > z1 + m) && ways.every(([x1, z1, x2, z2, w]) => segDist(x, z, x1, z1, x2, z2) > w + m * 0.6);
    for (let gx = 0; gx < 7; gx++) for (let gz = 0; gz < 7; gz++) {
      const x = -0.44 + gx * 0.147 + (r() - 0.5) * 0.08, z = -0.44 + gz * 0.147 + (r() - 0.5) * 0.08, k = r(), sc = r();
      if ((first && z < 0.2 + 1.05 * x) || (last && z < 0.2 - 1.05 * x)) continue;
      if (B.ground(x, z) < 0.012 || !free(x, z, 0.055) || k > (lite ? 0.45 : 0.62)) continue;
      if (k < 0.3) bush(B, x, z, 1.1 + sc * 0.5, [0x4f8a3c, 0x5c9840, 0x467f3b][Math.floor(sc * 3)]);
      else if (k < 0.5 || lite) flowers(B, x, z, 1 + sc * 0.4, r);
      else tree(B, x, z, 0.72 + sc * 0.25, [C.leaf, C.leaf2, 0x6a9a3a][Math.floor(sc * 3)]);
      boxes.push([x - 0.05, z - 0.05, x + 0.05, z + 0.05]);
    }
  }

  // ===== public =====
  function relief(i, R) { curLot = i; if (L[i] && L[i].r) L[i].r(R); else lawn(R); curLot = -1; }
  function lot(i, ground) { const B = new Builder(); B.ground = ground; if (L[i] && L[i].b) { L[i].b(B); garnish(B, i); } return B.parts.length ? B.build() : null; }
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
  // the ring's inside corners: two districts share each (their halves either side of a sandy path from the middle's
  // corner to the corner square)
  function ringRelief(k, R) { lawn(R); R.path(-0.55, -0.55, 0.55, 0.55, 0.03, SAND); }
  function inner() { return new Builder().build(); }
  let houseCache = null, hotelCache = null;
  return {
    world: 'city', PAL, relief, lot, corner, ringRelief, inner, centerRelief, centerWater, center, CENTER, CENTER_FX, actor,
    models: MODELS, cornerModels: CORNER_MODELS, freeModels: FREE_MODELS, clouds: 2, waterY: WATER_Y,
    fx: i => FX[i] || null,
    tower: () => houseCache || (houseCache = houseParts()),
    castle: () => hotelCache || (hotelCache = hotelParts()),
    LIFE: ['car', 'car2', 'police', 'bus', 'minibus', 'train', 'funicular', 'plane', 'carousel', 'ferris', 'cyclist', 'cart', 'boat', 'sail', 'gondola', 'eagle', 'wing'],
    BIRD: ['eagle', 'wing']
  };
})();
