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
    asphalt: 0x67696d, cobble: 0xb5a78f, paving: 0xcdbfa3, lawn: 0x7aa34b, dusty: 0xa8a487,
    leaf: 0x57893d, leaf2: 0x467a36, autumn: 0xc98a33, cypress: 0x2f5536,
    bronze: 0x564838, gold: 0xe2b04a, red: 0xc23a2e, white: 0xf3efe6, blue: 0x2f62a8, yellow: 0xe9c449, stone: 0xcfc1a7, stone2: 0xb3a58c, brick: 0xae5c3d
  };
  const WALLS = [C.cream, C.sand, C.ochre, C.peach, C.rose, C.sky, C.mint, C.lilac, 0xe2d2b0, 0xd7c3a5];

  // ===== pieces =====
  // a window or a band of windows: a thin dark pane just in front of a wall facing +z
  const pane = (w, h) => new T.PlaneGeometry(w, h).translate(0, h / 2, 0);
  // an old Tbilisi house: fl floors, a hipped roof, windows in rows, and (bal) a wooden balcony along the upper floor
  function oldHouse(B, x, z, w, d, fl, wallC, roofC, ry = 0, bal = true) {
    const put = B.at(x, z, ry), fh = 0.072, h = fh * fl;
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

  // ===== the places: first their land (relief R), then what stands on it (B) =====
  // (the lots by a corner share its square of land with the next side's: each keeps to its own triangle of it, z >=
  // 0.15 + 1.05 x for the first lot after a corner, z >= 0.15 - 1.05 x for the last one before it)
  const L = {};
  const city = (R, c = C.dusty) => R.tint(c, 9, undefined, 0x9c917a);      // (where it is steep: the warm stone)
  const green = (R, c = C.lawn) => R.tint(c, 9, undefined, 0x6f7c4e);       // (where it is steep: the wooded slope)
  const street = (R, x1, z1, x2, z2, w = 0.08, c = C.asphalt) => R.path(x1, z1, x2, z2, w, c);
  // ქვემო სანაპირო
  L[1] = {   // Ortachala: gardens and a riverside tavern; the Mtkvari through its left end, its little dam
    r: R => { green(R); R.pad(-0.12, 0.26, 0.12); },
    b: B => {
      oldHouse(B, -0.12, 0.26, 0.15, 0.1, 2, C.cream, C.tin, 0.2);
      const put = B.at(0.02, 0.38, 0.2); put(box(0.12, 0.008, 0.04), C.wood, 0, 0.03, 0); put(box(0.13, 0.004, 0.05), C.white, 0, 0.034, 0);      // the feast table
      for (const [x, z] of [[-0.3, 0.06], [-0.31, 0.26], [-0.22, -0.08]]) poplar(B, x, z, 1.1);
      for (let k = 0; k < 3; k++) { const px = -0.02 + k * 0.05; B.add(box(0.004, 0.06, 0.004), C.wood2, px, 0, 0.18); }
      B.add(box(0.14, 0.006, 0.05), C.leaf2, 0.03, 0.06, 0.18, { sway: 0.3 });                   // the vine over the pergola
    }
  };
  L[3] = {   // Ponichala: small houses with tin roofs and fruit gardens on the river's bend, the road out of town
    r: R => { green(R); street(R, -0.6, 0.3, 0.6, 0.26, 0.08); for (const [x, z] of [[-0.28, -0.05], [-0.02, -0.12], [0.24, -0.04]]) R.pad(x, z, 0.1); R.hill(0.1, -0.5, 0.6, 0.2, 0.12); },
    b: B => {
      oldHouse(B, -0.28, -0.05, 0.14, 0.11, 2, C.cream, C.tin, 0.1); oldHouse(B, -0.02, -0.12, 0.13, 0.1, 2, C.peach, C.rust, -0.1); oldHouse(B, 0.24, -0.04, 0.14, 0.11, 2, C.sand, C.tin2, 0.15);
      for (const [x, z] of [[-0.12, 0.08], [0.1, 0.06], [0.36, 0.1], [-0.42, 0.1]]) tree(B, x, z, 0.75, C.leaf2);
      for (const [x, z] of [[-0.45, -0.25], [0.42, -0.22]]) poplar(B, x, z, 1.1);
    }
  };
  // აღმოსავლეთი
  L[6] = {   // Varketili: panel blocks on the plateau, the metro's last station below
    r: R => { city(R); R.mesa(0, -0.2, 0.5, 0.3, 0.1, 0.5); R.pad(0, -0.2, 0.3); street(R, -0.6, 0.28, 0.6, 0.28, 0.07); },
    b: B => {
      block(B, -0.2, -0.24, 0.32, 0.1, 9, C.panel, 0); block(B, 0.22, -0.18, 0.1, 0.32, 9, C.panel2, 0.08);
      pavilion(B, -0.22, 0.2, 0.75);
      for (const [x, z] of [[0.05, 0.1], [0.38, 0.22], [-0.42, 0.08]]) tree(B, x, z, 0.7);
      bench(B, 0.08, 0.24); lamp(B, 0.2, 0.24);
    }
  };
  L[8] = {   // Samgori: the wide avenue to the airport, a fruit market, big blocks
    r: R => { city(R); street(R, -0.6, 0.12, 0.6, 0.16, 0.16); street(R, -0.6, 0.12, 0.6, 0.16, 0.012, 0xe9e4d4); R.pad(0, -0.3, 0.3); },
    b: B => {
      block(B, -0.28, -0.3, 0.26, 0.1, 6, C.panel3); block(B, 0.26, -0.32, 0.22, 0.1, 7, C.panel);
      for (let k = 0; k < 4; k++) stall(B, -0.15 + k * 0.1, -0.12, 0, [C.red, C.yellow, 0x3f7fc2, 0x55ad5f][k]);
      for (const [x, z] of [[-0.45, 0.36], [0.45, 0.38]]) tree(B, x, z, 0.7);
    }
  };
  L[9] = {   // Isani: the round metro pavilion on its square, kiosks, plane trees, five-storey blocks (away from the corner)
    r: R => { city(R); R.pad(0.1, 0.0, 0.3); street(R, -0.1, 0.32, 0.6, 0.3, 0.08); },
    b: B => {
      pavilion(B, 0.1, 0.06, 1);
      block(B, 0.25, -0.3, 0.26, 0.09, 5, C.panel3); block(B, -0.06, -0.32, 0.14, 0.09, 5, C.sand);
      for (const [x, z] of [[0.36, 0.1], [-0.08, 0.16], [0.3, -0.08]]) plane(B, x, z, 0.85);
      stall(B, -0.02, 0.0, 0.3, C.yellow); umbrella(B, 0.32, 0.26, C.red);
    }
  };
  // მარცხენა სანაპირო
  L[11] = { r: R => { green(R); R.pad(-0.14, -0.04, 0.42); }, b: () => { } };    // Avlabari: Sameba (its model)
  L[13] = { r: R => { city(R); R.pad(0, -0.02, 0.45); }, b: () => { } };                 // Chughureti: the old courtyard (its model)
  L[14] = {  // Aghmashenebeli Avenue: the pedestrian street of pastel houses, cafés, the fountain
    r: R => { city(R); street(R, -0.6, 0.04, 0.6, 0.04, 0.12, C.cobble); R.pad(0, -0.25, 0.3); R.pad(0, 0.3, 0.25); },
    b: B => {
      const cols = [C.peach, C.sky, C.cream, C.mint, C.lilac];
      [-0.36, -0.12, 0.12, 0.36].forEach((x, k) => oldHouse(B, x, -0.22, 0.2, 0.13, 3, cols[k], k % 2 ? C.tile : C.tin, 0, true));
      oldHouse(B, -0.26, 0.32, 0.22, 0.11, 2, cols[4], C.tile2, Math.PI); oldHouse(B, 0.28, 0.32, 0.2, 0.11, 2, cols[2], C.tin, Math.PI);
      for (const x of [-0.24, 0.0, 0.22]) umbrella(B, x, 0.12, [C.white, C.red, C.white][Math.round(x * 5 + 1) % 3]);
      B.add(cyl(0.03, 0.035, 0.02, 10), C.stone, 0.04, 0, -0.04); B.add(cyl(0.006, 0.006, 0.04, 6), C.stone, 0.04, 0.02, -0.04);
    }
  };
  // ჩრდილოეთი
  L[16] = {  // Gldani: tall blocks round a big courtyard, swings, a carousel
    r: R => { city(R); R.pad(0, -0.05, 0.42); street(R, -0.6, 0.36, 0.6, 0.36, 0.07); },
    b: B => {
      block(B, -0.3, -0.18, 0.1, 0.4, 14, C.panel); block(B, 0.06, -0.34, 0.36, 0.1, 12, C.panel2, 0, 4); block(B, 0.38, -0.08, 0.1, 0.3, 14, C.panel3);
      for (const x of [-0.08, 0.0]) { B.add(box(0.004, 0.06, 0.004), C.red, x - 0.02, 0, 0.08); B.add(box(0.004, 0.06, 0.004), C.red, x + 0.02, 0, 0.08); B.add(box(0.045, 0.004, 0.004), C.red, x, 0.06, 0.08); }
      B.add(box(0.004, 0.11, 0.004), C.iron, 0.2, 0, 0.12); B.add(box(0.03, 0.022, 0.003), C.white, 0.2, 0.11, 0.115);
      car(B, -0.38, 0.28, 0, C.white); car(B, -0.26, 0.28, 0, 0x3c3c3c); car(B, 0.3, 0.28, 0, C.red);
      tree(B, -0.12, -0.08, 0.6); tree(B, 0.18, 0.16, 0.6);
    }
  };
  L[18] = {  // Nadzaladevi: the railway and its old train, the covered market, the footbridge over the tracks
    r: R => { city(R); street(R, -0.6, 0.05, 0.6, 0.05, 0.14, 0x6d6255); R.pad(0, -0.3, 0.28); R.pad(0, 0.32, 0.2); },
    b: B => {
      for (const z of [0.0, 0.1]) { B.add(box(1.2, 0.006, 0.006), 0x8a8a8a, 0, 0.003, z - 0.02); B.add(box(1.2, 0.006, 0.006), 0x8a8a8a, 0, 0.003, z + 0.02); }
      const put = B.at(-0.1, -0.3); put(box(0.42, 0.07, 0.15), C.brick, 0, 0, 0, { vary: 0.06 }); put(roof(0.46, 0.06, 0.18), C.tin, 0, 0.07, 0, { vary: 0.06 });
      for (let k = 0; k < 4; k++) stall(B, -0.25 + k * 0.1, -0.16, 0, [C.red, 0x55ad5f, C.yellow, 0x3f7fc2][k]);
      const fb = B.at(0.3, 0.05, Math.PI / 2); fb(box(0.03, 0.006, 0.36), C.iron, 0, 0.12, 0); for (const z of [-0.16, 0.16]) fb(box(0.03, 0.12, 0.03), C.stone2, 0, 0, z);
      oldHouse(B, 0.34, -0.3, 0.16, 0.12, 2, C.cream, C.tin2, 0, false);
    }
  };
  L[19] = {  // Didube: the bus station full of minibuses, the market, the old church among cypresses (away from the river)
    r: R => { city(R); R.pad(0.15, 0.0, 0.34); },
    b: B => {
      for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) minibus(B, 0.0 + k * 0.11, 0.2 + j * 0.08, Math.PI / 2);
      chapel(B, 0.3, -0.24, 0.55);
      for (const [x, z] of [[0.12, -0.32], [0.45, -0.14], [0.44, -0.36]]) cypress(B, x, z, 0.9);
      stall(B, 0.36, 0.14, -0.2, C.red); stall(B, 0.42, 0.28, -0.2, C.yellow);
    }
  };
  // ჩრდილო-დასავლეთი
  L[21] = {  // Dighomi: new coloured towers by the forest park (away from the river)
    r: R => { green(R); R.pad(-0.18, -0.12, 0.32); },
    b: B => {
      tower(B, -0.3, -0.22, 0.12, 0.1, 0.48, C.panel3, C.peach); tower(B, -0.1, -0.3, 0.12, 0.1, 0.56, C.panel3, 0x8fb5d0); tower(B, -0.28, 0.02, 0.1, 0.1, 0.4, C.panel3, 0xb7d08f);
      for (let k = 0; k < 7; k++) pine(B, -0.02 + (k % 3) * 0.1, 0.06 + Math.floor(k / 3) * 0.1 - 0.12, 0.7);
      bench(B, -0.12, 0.3); lamp(B, -0.2, 0.3);
    }
  };
  L[23] = {  // Vashlijvari: towers on the green hill above Lisi Lake, its pier
    r: R => { green(R); R.hill(0, -0.35, 0.6, 0.28, 0.13); R.pad(0, -0.32, 0.25); R.lake(0.05, 0.2, 0.4, 0.18, 0.06); },
    b: B => {
      tower(B, -0.22, -0.34, 0.12, 0.1, 0.5, C.panel3, 0xd9a07a); tower(B, 0.02, -0.38, 0.12, 0.1, 0.62, C.panel3, 0xd9a07a); tower(B, 0.26, -0.32, 0.12, 0.1, 0.46, C.panel3, 0xd9a07a);
      B.add(box(0.03, 0.008, 0.2), C.wood, 0.3, 0.02, 0.18, { free: false });
      for (const [x, z] of [[-0.42, 0.0], [0.45, -0.05], [-0.4, 0.3]]) tree(B, x, z, 0.75);
    }
  };
  L[24] = {  // Saburtalo: the stacked blocks of the old ministry over the trees, the university
    r: R => { green(R); R.hill(-0.1, -0.2, 0.45, 0.35, 0.1); R.pad(-0.12, -0.18, 0.28); street(R, -0.6, 0.32, 0.6, 0.3, 0.08); },
    b: B => {
      const put = B.at(-0.12, -0.18);
      put(box(0.05, 0.36, 0.05), C.panel3, 0, 0, 0);
      put(box(0.34, 0.07, 0.08), C.panel, 0, 0.12, 0); put(box(0.08, 0.07, 0.3), C.panel, 0.02, 0.19, 0); put(box(0.3, 0.07, 0.08), C.panel, -0.02, 0.26, 0.04); put(box(0.08, 0.07, 0.26), C.panel, 0.06, 0.33, -0.02);
      for (const y of [0.12, 0.26]) put(pane(0.3, 0.03), C.win, 0, y + 0.02, 0.042, { vary: 0 });
      const u = B.at(0.3, -0.18); u(box(0.24, 0.12, 0.14), C.cream); for (let k = 0; k < 5; k++) u(cyl(0.008, 0.008, 0.12, 6), C.white, -0.09 + k * 0.045, 0, 0.075); u(roof(0.26, 0.04, 0.16), C.tin, 0, 0.12, 0);
      for (const [x, z] of [[0.08, 0.14], [-0.3, 0.12], [0.42, 0.12], [-0.42, -0.36]]) tree(B, x, z, 0.65);
    }
  };
  // ვაკე-ვერა
  L[26] = {  // Vera: the steep cobbled street, houses with iron balconies, great plane trees in autumn, the ravine
    r: R => { city(R); R.hill(0, -0.3, 0.6, 0.28, 0.14); R.dig(0.55, 0.15, 0.2, 0.55, 0.08, 0.06); street(R, -0.5, -0.1, 0.2, 0.3, 0.07, C.cobble); R.pad(-0.3, -0.25, 0.16); R.pad(0.05, -0.3, 0.14); R.pad(-0.28, 0.14, 0.12); },
    b: B => {
      oldHouse(B, -0.3, -0.25, 0.18, 0.12, 3, C.peach, C.tin, 0.2); oldHouse(B, 0.05, -0.3, 0.16, 0.12, 3, C.sky, C.tile, -0.1); oldHouse(B, -0.28, 0.14, 0.14, 0.1, 2, C.cream, C.rust, 0.5);
      for (const [x, z] of [[0.22, -0.08], [-0.05, 0.02], [0.36, -0.3], [-0.45, -0.02]]) bigTree(B, x, z, 0.6, C.autumn);
    }
  };
  L[27] = {  // Vake: the leafy avenue, the tall 1950s houses, cafés
    r: R => { city(R); street(R, -0.6, 0.12, 0.6, 0.12, 0.12); R.pad(0, -0.25, 0.32); },
    b: B => {
      [-0.3, 0.0, 0.3].forEach((x, k) => { block(B, x, -0.26, 0.24, 0.14, 5, [C.ochre, C.cream, C.sand][k], 0, 4); B.at(x, -0.26)(roof(0.26, 0.05, 0.16), C.tile, 0, 0.25, 0, { vary: 0.06 }); });
      for (let k = 0; k < 6; k++) tree(B, -0.45 + k * 0.18, 0.0, 0.65, C.leaf2);
      for (let k = 0; k < 6; k++) tree(B, -0.45 + k * 0.18, 0.26, 0.6, C.leaf2);
      umbrella(B, -0.15, -0.06, C.red); umbrella(B, 0.15, -0.06, C.white);
    }
  };
  L[29] = {  // Vake Park: the great stair with its fountains up to the memorial (away from the corner)
    r: R => { green(R); R.hill(0.12, -0.32, 0.45, 0.3, 0.15); R.pad(0.12, -0.36, 0.1); street(R, 0.12, 0.45, 0.12, -0.3, 0.1, C.paving); },
    b: B => {
      for (let k = 0; k < 6; k++) B.add(box(0.1, 0.012, 0.06), k % 2 ? C.stone : C.stone2, 0.12, -0.012 + k * 0.022, 0.24 - k * 0.09);
      B.add(box(0.05, 0.03, 0.05), C.stone2, 0.12, 0, -0.36); B.add(taperFrame2(0.03, 0.012, 0.34), C.stone, 0.12, 0.03, -0.36);
      for (const [x, z] of [[-0.05, 0.1], [0.3, 0.1], [-0.02, -0.22], [0.3, -0.2], [0.4, 0.35]]) tree(B, x, z, 0.75);
    }
  };
  function taperFrame2(rb, rt, h) { return new T.CylinderGeometry(rt, rb, h, 4).rotateY(Math.PI / 4).translate(0, h / 2, 0); }
  // მთაწმინდის კალთა
  L[31] = {  // Turtle Lake: the little lake in the forest, its piers, the ethnographic museum's wooden houses (away from the corner)
    r: R => { green(R, 0x6f9a46); R.hill(-0.1, -0.4, 0.6, 0.24, 0.12); R.lake(-0.14, -0.02, 0.24, 0.17, 0.06); R.pad(-0.38, 0.28, 0.1); },
    b: B => {
      for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; pine(B, -0.14 + Math.cos(a) * 0.36, -0.06 + Math.sin(a) * 0.27 - 0.05, 0.7 + (k % 3) * 0.1); }
      B.add(box(0.12, 0.008, 0.03), C.wood, -0.14, 0.01, 0.17);
      const h = B.at(-0.38, 0.28, 0.3); h(box(0.11, 0.06, 0.08), C.wood); h(roof(0.13, 0.04, 0.1), 0x6d5a45, 0, 0.06, 0, { vary: 0.08 });
    }
  };
  L[32] = { r: R => { city(R); R.pad(0, 0.02, 0.45); }, b: B => { for (let k = 0; k < 5; k++) tree(B, -0.4 + k * 0.2, -0.44, 0.7, C.leaf2); } };      // Rustaveli (its model)
  L[34] = {  // Mtatsminda Park (the mountain itself stands in the middle): the Ferris wheel over the city, the carousel, the kiosks
    r: R => { green(R, 0x6f9a46); R.pad(0, -0.1, 0.45); street(R, -0.5, 0.06, 0.5, 0.02, 0.3, C.paving); },
    b: B => {
      // the wheel's two A-frames either side of it (the wheel itself turns: FX), the axle between them
      const fw = B.at(FERRIS[0], FERRIS[1], FERRIS_RY);
      for (const sx of [-0.04, 0.04]) for (const sz of [-1, 1]) fw(box(0.009, 0.27, 0.009), C.white, sx, 0, sz * 0.075, { rx: -sz * 0.28 });
      fw(box(0.1, 0.012, 0.012), C.iron, 0, 0.245, 0);
      fw(box(0.12, 0.012, 0.18), C.paving, 0, 0, 0);
      // the carousel's round floor (it turns: FX), the kiosks with their awnings, lamps, benches, the trees at the back
      B.add(cyl(0.085, 0.09, 0.012, 16), C.stone, 0.24, 0, -0.14);
      stall(B, 0.3, 0.2, -0.4, C.red); stall(B, -0.36, 0.22, 0.3, 0x2f62a8);
      for (const [x, z] of [[-0.44, 0.0], [0.44, 0.02], [0.05, 0.3]]) lamp(B, x, z, 1.2);
      bench(B, -0.1, 0.24, 0); bench(B, 0.14, 0.26, 0);
      for (const [x, z, sc] of [[-0.42, -0.38, 0.75], [0.44, -0.4, 0.7], [0.02, -0.44, 0.65]]) tree(B, x, z, sc, C.leaf2);
      pine(B, -0.46, -0.16, 0.7);
    }
  };
  const FERRIS = [-0.14, -0.16], FERRIS_RY = Math.PI / 4, FERRIS_H = 0.245;
  // ძველი ქალაქი
  L[37] = {  // Sololaki: the mansions with carved balconies and painted halls, the old walls on the ridge above
    r: R => { city(R); R.ridge(-0.6, -0.42, 0.6, -0.4, 0.3, 0.16); street(R, -0.6, 0.12, 0.6, 0.1, 0.07, C.cobble); R.pad(-0.25, -0.08, 0.16); R.pad(0.12, -0.1, 0.16); R.pad(0.38, -0.05, 0.12); },
    b: B => {
      oldHouse(B, -0.25, -0.08, 0.22, 0.14, 3, C.ochre, C.tin, 0); oldHouse(B, 0.12, -0.1, 0.2, 0.14, 3, C.rose, C.tin2, 0); oldHouse(B, 0.38, -0.05, 0.14, 0.12, 2, C.cream, C.tile, 0);
      Models.parts.wall(B, 0.0, -0.4, 0.9, 0.08, 0.0, 0xb3a184);
      for (const [x, z] of [[-0.45, 0.2], [0.0, 0.26], [0.44, 0.26]]) tree(B, x, z, 0.6);
    }
  };
  L[39] = { r: R => { city(R); R.pad(0.12, 0.06, 0.38); }, b: () => { } };          // Old Tbilisi: the baths (their model)
  // the four stations
  L[5] = {   // the central station: the glass vault over the platforms, the train, the square in front with buses
    r: R => { city(R); R.pad(0, -0.2, 0.36); street(R, -0.6, 0.28, 0.6, 0.28, 0.12); for (const z of [-0.22, -0.12]) street(R, -0.6, z, 0.6, z, 0.02, 0x6d6255); },
    b: B => {
      vault(B, 0, -0.17, 0.8, 0.13);
      for (const x of [-0.4, 0.4]) B.add(box(0.03, 0.06, 0.26), C.panel3, x, 0, -0.17);
      bus(B, -0.3, 0.2, 0); bus(B, 0.0, 0.2, 0, 0xd9a03a); car(B, 0.25, 0.2, 0, C.yellow); car(B, 0.38, 0.2, 0, C.white);
      lamp(B, -0.45, 0.1); lamp(B, 0.45, 0.1);
    }
  };
  L[15] = {  // the metro: its round pavilion, the sign, the little square
    r: R => { city(R); R.pad(0, -0.05, 0.35); },
    b: B => {
      pavilion(B, 0, -0.08, 1.4);
      for (const [x, z] of [[-0.35, -0.3], [0.35, -0.3], [-0.38, 0.2], [0.38, 0.22]]) plane(B, x, z, 0.8);
      bench(B, -0.2, 0.25); bench(B, 0.2, 0.25); lamp(B, 0, 0.3);
    }
  };
  L[25] = {  // the cable car: its glass station below, the line up to the hill at the back
    r: R => { green(R); R.hill(0, -0.5, 0.65, 0.35, 0.28); R.pad(0, 0.2, 0.16); },
    b: B => {
      const put = B.at(0, 0.2); put(box(0.2, 0.08, 0.12), C.glass2); put(box(0.22, 0.01, 0.14), C.white, 0, 0.08, 0);
      for (const [x, h, z] of CAB25) { B.add(box(0.014, h, 0.014), 0x5b5f66, x, 0, z); B.add(box(0.05, 0.01, 0.02), 0x5b5f66, x, h, z); }
      const top = CAB25.map(([x, h, z]) => [x, B.ground(x, z) + h, z]), [a, b] = top, len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const up = Math.atan2(b[1] - a[1], Math.hypot(b[0] - a[0], b[2] - a[2])), ry = Math.atan2(-(b[2] - a[2]), b[0] - a[0]);
      B.add(box(len, 0.004, 0.004), 0x2b2d31, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, { ry, rz: up, free: true });
      for (const [x, z] of [[-0.35, 0.1], [0.35, 0.12], [-0.3, -0.3], [0.32, -0.32]]) tree(B, x, z, 0.75);
    }
  };
  const CAB25 = [[0.0, 0.14, 0.18], [0.0, 0.16, -0.4]];
  L[35] = {  // the funicular: its old stone station below, the track straight up the wooded slope
    r: R => { green(R, 0x6f9a46); R.hill(0, -0.5, 0.75, 0.55, 0.34); R.pad(0, 0.3, 0.12); },
    b: B => {
      const put = B.at(0, 0.3); put(box(0.22, 0.1, 0.1), C.stone); for (let k = 0; k < 3; k++) put(pane(0.04, 0.06), C.win, -0.06 + k * 0.06, 0, 0.051, { vary: 0 }); put(roof(0.24, 0.05, 0.12), C.tile, 0, 0.1, 0);
      for (let k = 0; k < 12; k++) { const z = 0.2 - k * 0.06; B.add(box(0.05, 0.008, 0.012), C.wood2, 0, 0.004, z); }
      for (const x of [-0.016, 0.016]) for (let k = 0; k < 6; k++) { const z0 = 0.22 - k * 0.12; B.add(box(0.004, 0.006, 0.12), 0x8a8a8a, x, 0.008, z0 - 0.06); }
      for (let k = 0; k < 12; k++) { const r = rng(35 + k); pine(B, (k % 2 ? 1 : -1) * (0.12 + r() * 0.3), 0.15 - Math.floor(k / 2) * 0.12, 0.6 + r() * 0.3); }
    }
  };
  // the water and the power
  L[12] = {  // the Tbilisi Sea: the reservoir, its beach and pier, the Chronicle's bronze pillars on the hill
    r: R => { R.tint(0xb5a87a, 9, undefined, 0x9c917a); R.lake(0.0, 0.12, 0.55, 0.28, 0.08); R.hill(0.0, -0.4, 0.5, 0.22, 0.14); R.pad(0, -0.4, 0.16); },
    b: B => {
      for (let k = 0; k < 7; k++) B.add(box(0.035, 0.22 + (k % 3) * 0.05, 0.05), C.bronze, -0.18 + k * 0.06, 0, -0.42, { vary: 0.1 });
      for (const x of [-0.3, -0.18, 0.2, 0.32]) umbrella(B, x, -0.16, [C.red, C.yellow, C.white, C.red][Math.round((x + 0.3) * 6) % 4]);
      B.add(box(0.03, 0.008, 0.18), C.wood, 0.38, 0.015, 0.12);
    }
  };
  L[28] = {  // ZAHES: the stone dam across the river, the classical power station, the pylons
    r: R => { green(R); R.dig(-0.65, 0.05, 0.65, 0.05, 0.14, 0.07); R.pad(0.25, -0.3, 0.15); },
    b: B => {
      const d = B.at(-0.12, 0.05, Math.PI / 2); d(box(0.3, 0.08, 0.05), C.stone2, 0, -0.03, 0, { vary: 0.06 }); for (let k = 0; k < 3; k++) d(box(0.04, 0.05, 0.052), 0x2c3a3e, -0.08 + k * 0.08, -0.02, 0);
      const p = B.at(0.25, -0.3); p(box(0.22, 0.12, 0.13), C.cream); for (let k = 0; k < 4; k++) p(cyl(0.008, 0.008, 0.12, 6), C.white, -0.075 + k * 0.05, 0, 0.07); p(roof(0.24, 0.045, 0.15), C.tile, 0, 0.12, 0); p(box(0.06, 0.02, 0.005), 0x8a2a2a, 0, 0.13, 0.075);
      pylon(B, -0.35, -0.3, 0.42); pylon(B, 0.42, 0.3, 0.38);
      for (const [x, z] of [[-0.4, 0.32], [0.05, -0.38], [0.45, -0.12]]) tree(B, x, z, 0.7);
    }
  };
  // the cards and the taxes
  const kintoLot = {   // Kinto's question: a kinto's fruit stall in the street
    r: R => { city(R); R.pad(-0.1, -0.05, 0.22); },
    b: B => {
      stall(B, -0.12, -0.06, 0, C.red); stall(B, 0.02, -0.08, -0.2, C.yellow);
      const put = B.at(-0.12, 0.14); put(cyl(0.05, 0.04, 0.012, 12), C.wood, 0, 0.05, 0); for (let k = 0; k < 6; k++) put(ball(0.012), [0xd94a2e, 0xf0a530, 0x7cae3a][k % 3], Math.cos(k) * 0.025, 0.065, Math.sin(k) * 0.025, { vary: 0 });
      put(cyl(0.006, 0.006, 0.05, 5), C.wood2, 0, 0, 0);
      plane(B, -0.36, -0.28, 0.8); lamp(B, 0.08, 0.22); bench(B, -0.3, 0.2);
    }
  };
  const storyLot = {   // the old Tiflis story: a poster column, a newspaper kiosk, a bench under a plane tree
    r: R => { city(R); R.pad(0, -0.05, 0.22); },
    b: B => {
      B.add(cyl(0.035, 0.035, 0.16, 12), (y, k) => [0xe9ddc3, 0xc23a2e, 0xe9c449, 0x3f7fc2][Math.floor(y / 0.04) % 4], -0.08, 0, -0.06);
      B.add(dome(0.04, 10), 0x3a5a46, -0.08, 0.16, -0.06, { smooth: true, vary: 0 });
      const k = B.at(0.12, -0.08); k(box(0.1, 0.08, 0.07), 0x4f7f6a); k(box(0.11, 0.008, 0.08), C.white, 0, 0.08, 0); k(pane(0.06, 0.03), C.white, 0, 0.03, 0.036, { vary: 0 });
      plane(B, -0.34, -0.3, 0.85); bench(B, -0.22, 0.2); lamp(B, 0.1, 0.22);
    }
  };
  L[2] = kintoLot; L[17] = kintoLot; L[33] = kintoLot;
  L[7] = storyLot; L[22] = storyLot; L[36] = storyLot;
  L[4] = { r: R => { city(R); R.pad(0, -0.04, 0.42); }, b: () => { } };   // the bank (its model)
  L[38] = {  // the Dry Bridge: its stone arches over a dry garden, the painters' market under them
    r: R => { city(R); R.pad(0, -0.1, 0.4); },
    b: B => {
      const put = B.at(0, -0.22); put(box(0.7, 0.03, 0.12), C.stone2, 0, 0.12, 0, { vary: 0.06 });
      for (const x of [-0.3, -0.1, 0.1, 0.3]) put(box(0.05, 0.12, 0.12), C.stone, x, 0, 0, { vary: 0.06 });
      for (let k = 0; k < 7; k++) { const x = -0.3 + k * 0.1, e = B.at(x, 0.08, 0.1 * Math.sin(k)); e(box(0.004, 0.06, 0.004), C.wood2, 0, 0, -0.01); e(box(0.05, 0.04, 0.004), [0x3f7fc2, 0xe9c449, 0xc23a2e, 0x55ad5f, 0xd99d8c][k % 5], 0, 0.035, 0, { rx: -0.2 }); }
      lamp(B, -0.42, 0.25); lamp(B, 0.42, 0.25);
    }
  };

  // ===== the inside corners of the ring: the river goes through two of them (0, 2) =====
  const RING = [
    { r: R => green(R), b: () => { } },
    { r: R => R.tint(C.dusty, 9), b: B => { tree(B, -0.3, -0.3, 0.9); bush(B, 0.2, 0.2, 0.8); car(B, 0.0, -0.1, 0.3, C.white); } },
    { r: R => green(R), b: () => { } },
    { r: R => green(R, 0x6f9a46), b: B => { pine(B, -0.3, -0.35, 1); pine(B, -0.1, -0.4, 0.9); tree(B, 0.25, 0.2, 0.8); } }
  ];

  // ===== the middle: Mtatsminda's great mountain with its tower (like the archipelago's island), the Mtkvari round its
  // foot with its bridges, Narikala on its rock in the river's bend, Kartlis Deda on the bank =====
  // (board coordinates; the river from the back left corner (the embankment) round the mountain to the front, out
  // between the squares 1 and 2 (Ortachala))
  const MT = [0.4, -0.45], MT_W = 4.6, MT_R = MT_W / 2;               // the mountain's middle and how wide it is
  const RIVER = [[-5.2, -5.2], [-3.4, -3.35], [-2.65, -2.2], [-2.5, -0.9], [-2.48, 0.55], [-2.38, 1.75], [-1.65, 2.42], [-0.2, 2.52], [1.2, 2.48], [2.35, 2.62], [3.15, 3.25], [3.45, 5.2]];
  const WATER_Y = -0.05, RIVER_W = 0.62;            // the water's level, how wide it is (the bed is dug a little narrower)
  let riverPts = RIVER;
  // which way the river flows at a point near it (a unit vector along it)
  function along(x, z) {
    let best = Infinity, dir = [1, 0];
    for (let k = 1; k < riverPts.length; k++) {
      const [ax, az] = riverPts[k - 1], [bx, bz] = riverPts[k], dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (l * l))), d = Math.hypot(ax + dx * t - x, az + dz * t - z);
      if (d < best) { best = d; dir = [dx / l, dz / l]; }
    }
    return dir;
  }
  // the tower's foot on the model (a model 1 wide: its tower stands a little behind its middle), turned with it
  const MT_RY = 0.35, TOWER = [MT[0] + Math.sin(MT_RY) * -0.09 * MT_W, MT[1] + Math.cos(MT_RY) * -0.09 * MT_W];
  const CENTER = { peak: TOWER, mountain: MT, narikala: [-1.4, 1.35], deda: [2.25, 1.72], peace: [-0.4, 2.52], metekhiBridge: [1.25, 2.48], stone: [-2.5, -1.3] };
  function centerRelief(R) {
    R.tint(0, 0, 0x7fa04e, 9, 2.8, 0x7d7a5a);                                   // the park round the mountain
    R.tint(MT[0], MT[1], 0x6f9846, 9, 1.6, 0x6f7c4e);
    R.pad(MT[0], MT[1], MT_R + 0.08);                                           // level under the mountain and the fortress
    R.pad(CENTER.narikala[0], CENTER.narikala[1], 0.62);
    R.pad(CENTER.deda[0], CENTER.deda[1], 0.3);
    riverPts = R.flow(RIVER, 0.5, 0.19, WATER_Y, RIVER_W);
    // the stone embankments: where the banks are steep, their stone shows
    for (let k = 0; k < riverPts.length; k += 5) R.tint(riverPts[k][0], riverPts[k][1], 0x9fa57e, 9, 0.42, 0xc9bfa9);
  }
  function centerWater() { return null; }
  // the cable car from the front bank over the river up to Narikala: its two masts (x, z) and their heights
  const CABLE = [[-0.75, 3.04], [-1.12, 1.78]], CABLE_H = [0.3, 0.72];
  function center(ground) {
    const B = new Builder();
    B.ground = ground;
    const steps = [
      () => { for (const [k, [x, z]] of CABLE.entries()) { const h = CABLE_H[k]; B.add(box(0.018, h, 0.018), 0x5b5f66, x, 0, z); B.add(box(0.06, 0.012, 0.024), 0x5b5f66, x, h, z); } }
    ];
    return { B, steps };
  }

  // ===== the landmarks from files (art/m_tb_*.glb; a computer's or ultra's, a phone's from art/mobile) =====
  // a lot's: s its size (a lot is 1 wide), x and z where it stands in the lot, ry how it is turned, on its own ground
  const MODELS = {
    4: { url: 'art/m_tb_bank.glb', s: 1.12, z: -0.04, ground: true, y: -0.006 },
    11: { url: 'art/m_tb_sameba.glb', s: 1.15, x: -0.06, z: -0.04, ground: true, y: -0.006 },
    13: { url: 'art/m_tb_courtyard.glb', s: 1.15, z: -0.02, ground: true, y: -0.004 },
    32: { url: 'art/m_tb_rustaveli.glb', s: 1.2, z: 0.04, ground: true, y: -0.004 },
    39: { url: 'art/m_tb_baths.glb', s: 1.12, x: 0.04, z: 0.02, ground: true, y: -0.006 }
  };
  // a corner's: at the back of its square, its name written in front of it (z: towards the square's outer edge)
  const CORNER_MODELS = {
    0: { url: 'art/m_tb_freedom.glb', fitWidth: 1.25, z: -0.22 },
    20: { url: 'art/m_tb_bench.glb', fitWidth: 1.05, z: -0.3, ry: 0 }
  };
  // the middle's: board coordinates; on: what they stand on (the ground there, or the river's water)
  const FREE_MODELS = [
    { url: 'art/m_tb_mtatsminda.glb', x: MT[0], z: MT[1], s: MT_W, ry: MT_RY, on: 'ground', y: -0.07, top: true, topY: 1.049 * MT_W - 0.07 },
    { url: 'art/m_tb_narikala.glb', x: CENTER.narikala[0], z: CENTER.narikala[1], s: 1.55, ry: 0.35, on: 'ground', y: -0.05 },
    { url: 'art/m_tb_kartlisdeda.glb', x: CENTER.deda[0], z: CENTER.deda[1], s: 1.05, ry: 0.25, on: 'ground', y: -0.02 },
    { url: 'art/m_tb_peace.glb', x: CENTER.peace[0], z: CENTER.peace[1], s: 1.3, bridge: true, on: 'water', y: 0.07 },
    { url: 'art/m_tb_metekhi.glb', x: CENTER.metekhiBridge[0], z: CENTER.metekhiBridge[1], s: 1.3, bridge: true, on: 'water', y: 0 },
    { url: 'art/m_tb_stonebridge.glb', x: CENTER.stone[0], z: CENTER.stone[1], s: 1.3, bridge: true, on: 'water', y: 0 }
  ];
  for (const d of FREE_MODELS) if (d.bridge) { const [dx, dz] = along(d.x, d.z); d.ry = Math.atan2(dx, dz); }      // its length across the river

  // ===== what moves (in the place's frame; heights above its land) =====
  const FX = {
    1: { sparkle: [[-0.45, 0.0, 0.03, 2]] },
    3: { actors: [{ k: 'minibus', a: [-0.55, 0.3], b: [0.55, 0.26], speed: 0.06 }] },
    5: { actors: [{ k: 'train', a: [-0.5, -0.17], b: [0.5, -0.17], speed: 0.07, h: 0.005 }] },
    6: { smoke: [[-0.2, -0.24, 0.48]] },
    8: { actors: [{ k: 'car', a: [-0.55, 0.1], b: [0.55, 0.12], speed: 0.09 }, { k: 'bus', a: [0.55, 0.19], b: [-0.55, 0.17], speed: 0.06 }, { k: 'plane', a: [-0.6, -0.1], b: [0.6, 0.0], h: 0.95, speed: 0.12, s: 1 }] },
    9: { actors: [{ k: 'bus', a: [0.0, 0.32], b: [0.55, 0.3], speed: 0.05 }] },
    12: { actors: [{ k: 'sail', a: [-0.35, 0.1], b: [0.3, 0.16], speed: 0.03 }], sparkle: [[0.0, 0.15, 0.02, 2]] },
    14: { sparkle: [[0.04, -0.04, 0.05, 2], [-0.2, 0.04, 0.2, 1], [0.2, 0.04, 0.2, 1]] },
    16: { actors: [{ k: 'carousel', spin: 0.9, at: [-0.08, 0.2] }] },
    18: { actors: [{ k: 'train', a: [-0.5, 0.0], b: [0.5, 0.0], speed: 0.05, h: 0.005 }] },
    19: { actors: [{ k: 'minibus', a: [0.0, 0.42], b: [0.5, 0.42], speed: 0.05 }] },
    21: { actors: [{ k: 'cyclist', a: [-0.1, 0.36], b: [0.0, 0.0], speed: 0.04 }] },
    23: { actors: [{ k: 'boat', a: [-0.25, 0.22], b: [0.3, 0.16], speed: 0.025 }] },
    25: { actors: [{ k: 'gondola', cable: CAB25 }] },
    26: { leaves: [[0.22, -0.08, 0.3], [-0.05, 0.02, 0.28]] },
    27: { actors: [{ k: 'car', a: [-0.55, 0.12], b: [0.55, 0.12], speed: 0.08 }, { k: 'car2', a: [0.55, 0.14], b: [-0.55, 0.14], speed: 0.07 }] },
    28: { sparkle: [[-0.12, 0.05, 0.02, 2], [-0.12, 0.1, 0.0, 2]] },
    29: { sparkle: [[0.12, 0.2, 0.03, 2], [0.12, 0.02, 0.06, 2]] },
    31: { actors: [{ k: 'boat', a: [-0.3, -0.05], b: [0.0, 0.02], speed: 0.02 }] },
    32: { actors: [{ k: 'car', a: [-0.55, 0.2], b: [0.55, 0.2], speed: 0.07 }, { k: 'bus', a: [0.55, 0.15], b: [-0.55, 0.15], speed: 0.05 }] },
    34: { actors: [{ k: 'ferris', spin: 0.22, axis: 'x', at: FERRIS, h: FERRIS_H, ry: FERRIS_RY }, { k: 'carousel', spin: 0.8, at: [0.24, -0.14], h: 0.012 }] },
    35: { actors: [{ k: 'funicular', a: [0.0, 0.22], b: [0.0, -0.45], speed: 0.05, h: 0.012 }] },
    37: { smoke: [[0.12, -0.1, 0.3]] },
    39: { smoke: [[0.0, 0.0, 0.3], [0.2, 0.1, 0.28]] },
    38: { sparkle: [[-0.42, 0.25, 0.14, 1], [0.42, 0.25, 0.14, 1]] },
    2: { sparkle: [[-0.12, 0.14, 0.08, 1]] }, 17: { sparkle: [[-0.12, 0.14, 0.08, 1]] }, 33: { sparkle: [[-0.12, 0.14, 0.08, 1]] },
    7: { sparkle: [[-0.08, -0.06, 0.2, 2]] }, 22: { sparkle: [[-0.08, -0.06, 0.2, 2]] }, 36: { sparkle: [[-0.08, -0.06, 0.2, 2]] },
    // the corners (on the square itself)
    0: { sparkle: [[0.0, -0.3, 0.75, 1]] },
    10: { sparkle: [[0.52, -0.42, 0.25, 1]] },
    30: { actors: [{ k: 'police', a: [-0.5, -0.12], b: [0.5, -0.12], speed: 0.12 }], sparkle: [[0.0, -0.45, 0.06, 1]] }
  };
  const CENTER_FX = {
    smoke: [], mist: [], sheep: [],
    actors: [
      { k: 'gondola', cable: [[CABLE[0][0], CABLE_H[0], CABLE[0][1]], [CABLE[1][0], CABLE_H[1], CABLE[1][1]]] },
      { k: 'boat', a: [-1.6, 2.38], b: [1.9, 2.5], speed: 0.05 },
      { k: 'boat', a: [-2.5, -2.3], b: [-2.47, 0.1], speed: 0.04, phase: 0.4 }
    ],
    // eagles round the tower, one higher, one wider
    birds: [{ at: TOWER, h: 3.05, r: 1.25, w: 0.3 }, { at: TOWER, h: 2.45, r: 2.15, w: -0.22 }]
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
  function relief(i, R) { if (L[i] && L[i].r) L[i].r(R); else city(R); }
  function lot(i, ground) { const B = new Builder(); B.ground = ground; if (L[i] && L[i].b) L[i].b(B); return B.parts.length ? B.build() : null; }
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
  function ringRelief(k, R) { RING[k].r(R); }
  function inner(k, ground) { const B = new Builder(); B.ground = ground; RING[k].b(B); return B.build(); }
  let houseCache = null, hotelCache = null;
  return {
    world: 'city', PAL, relief, lot, corner, ringRelief, inner, centerRelief, centerWater, center, CENTER, CENTER_FX, actor,
    models: MODELS, cornerModels: CORNER_MODELS, freeModels: FREE_MODELS, clouds: 2, waterY: WATER_Y,
    fx: i => FX[i] || null,
    tower: () => houseCache || (houseCache = houseParts()),
    castle: () => hotelCache || (hotelCache = hotelParts()),
    LIFE: ['car', 'car2', 'police', 'bus', 'minibus', 'train', 'funicular', 'plane', 'carousel', 'ferris', 'cyclist', 'boat', 'sail', 'gondola', 'eagle', 'wing'],
    BIRD: ['eagle', 'wing']
  };
})();
