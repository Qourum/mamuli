// What Meshy got wrong in ტფილისი's city model, put right on the model itself (tools/city_make.mjs applies them before
// the model is simplified and its picture baked). Board units: x to the right and z to the front seen from the front,
// y up; the tiles' grass at 0.03.
//   EDITS: what is taken away, moved, copied or added (city_make.mjs says how each is written)
//   PAINT: what is painted again over the baked picture (bake.mjs)
//   SWATCHES: the colours of the faces added here (a face's `color` is its index)
//   ROADS: the two embankments' roads (their middle lines; city_make.mjs writes them into city.js, where cars drive)

export const SWATCHES = [
  [150, 104, 64],     // 0 the planks' wood
  [104, 72, 46],      // 1 the posts' darker wood
  [220, 74, 58],      // 2 red
  [246, 243, 236],    // 3 white
  [58, 132, 204],     // 4 blue
  [242, 198, 74],     // 5 yellow
  [96, 160, 72]       // 6 a deckchair's green
];

// ----- the beach on Isani and Avlabari's corner (the front left): Meshy's pier came out broken, rubbish all over it -----
const BEACH = { x: [-4.56, -3.44], z: [3.44, 4.56] }, CORNER = [-4.52, 4.52];
// the shore: a bay round the board's corner (its water under the corner square too), a little wavy
const shore = (x, z) => { const dx = x - CORNER[0], dz = CORNER[1] - z, a = Math.atan2(dz, dx); return Math.hypot(dx, dz) - (0.8 + 0.045 * Math.sin(a * 5 + 0.6) + 0.025 * Math.sin(a * 11)); };
// the pier: planks from the sand out over the water, along the diagonal, on posts
function pier() {
  const out = [], dir = [-Math.SQRT1_2, Math.SQRT1_2], from = [-3.86, 3.86], len = 0.6, ry = 45, deck = 0.075;
  for (let k = 0; k * 0.034 < len; k++) {
    const d = 0.017 + k * 0.034, x = from[0] + dir[0] * d, z = from[1] + dir[1] * d;
    out.push({ op: 'box', at: [x, deck, z], size: [0.105, 0.012, 0.027], ry: ry + 90, color: 0 });
  }
  for (const d of [0.08, 0.3, 0.52]) for (const s of [-1, 1]) {
    const x = from[0] + dir[0] * d + dir[1] * s * 0.045, z = from[1] + dir[1] * d - dir[0] * s * 0.045;
    out.push({ op: 'box', at: [x, 0.0, z], size: [0.016, deck + 0.012, 0.016], ry, color: 1 });
  }
  const end = [from[0] + dir[0] * len, from[1] + dir[1] * len];      // a rail post at its end
  out.push({ op: 'box', at: [end[0] + dir[1] * 0.045, deck, end[1] - dir[0] * 0.045], size: [0.012, 0.06, 0.012], ry, color: 1 });
  out.push({ op: 'box', at: [end[0] - dir[1] * 0.045, deck, end[1] + dir[0] * 0.045], size: [0.012, 0.06, 0.012], ry, color: 1 });
  return out;
}
// umbrellas and deckchairs on the sand
function umbrella(x, z, color, h = 0.17) {
  return [
    { op: 'box', at: [x, 0.03, z], size: [0.013, h, 0.013], color: 3 },
    { op: 'cone', at: [x, 0.03 + h - 0.06, z], r: 0.08, h: 0.07, n: 10, color }
  ];
}
const chair = (x, z, ry, color) => [{ op: 'box', at: [x, 0.03, z], size: [0.05, 0.012, 0.1], ry, color }, { op: 'box', at: [x, 0.042, z], size: [0.05, 0.03, 0.012], ry, color, shift: [0, 0, -0.05] }];

// ----- Ortachala's gardens (the front right corner): its fruit trees came out melted, like mushrooms -----
// in their place, copies of a small cypress from by Rike Park (its box; `about` the foot of its trunk)
const TREE = { x: [-1.8, -1.56], z: [1.66, 1.88], y: [0.036, 2], about: [-1.68, 0.03, 1.77] };
const ORCHARD = [[4.12, 3.9, 0, 0.8], [4.36, 3.97, 70, 0.88], [4.16, 4.15, 140, 0.76], [4.39, 4.23, 200, 0.84], [4.2, 4.39, 260, 0.78]];

// ----- the Mtkvari's two embankments: a road of two lanes along each bank, from the back of the city to its front -----
// Their middle lines (x, z), read off the model's banks (a little way off the top of each bank's slope; across the
// branch's mouth, which becomes land, the west bank runs straight on; by the baths the east one keeps as clear of
// their domes as the bank lets it); the roads pass under both bridges. A crossing: a zebra, a stop line before it
// either way (city.js puts up a traffic light on each lane's right kerb there).
export const ROAD_Y = 0.036;   // (the roads' surface: laid just over the ground levelled to 0.035 under them)
export const ROADS = {
  y: ROAD_Y,
  half: 0.085,                 // (half a road: two lanes of 0.075, a kerb either side)
  lane: 0.0375,                // (a lane's middle from the road's: right-hand traffic)
  river: { west: -1, east: 1 }, // (which side of a road the river is on, its way running from the back to the front)
  crossings: [{ road: 'west', z: -2.05 }, { road: 'west', z: 0.34 }, { road: 'east', z: 0.34 }, { road: 'east', z: 2.0 }],
  west: [[-1.268, -3.30], [-1.281, -3.25], [-1.294, -3.20], [-1.307, -3.15], [-1.319, -3.10], [-1.329, -3.05], [-1.337, -3.00], [-1.341, -2.95], [-1.341, -2.90], [-1.337, -2.85], [-1.327, -2.80], [-1.314, -2.75], [-1.298, -2.70], [-1.282, -2.65], [-1.266, -2.60], [-1.251, -2.55], [-1.239, -2.50], [-1.230, -2.45], [-1.226, -2.40], [-1.225, -2.35], [-1.225, -2.30], [-1.225, -2.25], [-1.224, -2.20], [-1.221, -2.15], [-1.216, -2.10], [-1.209, -2.05], [-1.200, -2.00], [-1.190, -1.95], [-1.178, -1.90], [-1.165, -1.85], [-1.150, -1.80], [-1.133, -1.75], [-1.115, -1.70], [-1.096, -1.65], [-1.075, -1.60], [-1.054, -1.55], [-1.031, -1.50], [-1.008, -1.45], [-0.983, -1.40], [-0.958, -1.35], [-0.933, -1.30], [-0.907, -1.25], [-0.881, -1.20], [-0.854, -1.15], [-0.828, -1.10], [-0.801, -1.05], [-0.775, -1.00], [-0.748, -0.95], [-0.723, -0.90], [-0.697, -0.85], [-0.673, -0.80], [-0.648, -0.75], [-0.625, -0.70], [-0.603, -0.65], [-0.581, -0.60], [-0.560, -0.55], [-0.541, -0.50], [-0.522, -0.45], [-0.505, -0.40], [-0.488, -0.35], [-0.473, -0.30], [-0.459, -0.25], [-0.447, -0.20], [-0.435, -0.15], [-0.426, -0.10], [-0.417, -0.05], [-0.411, -0.00], [-0.406, 0.05], [-0.402, 0.10], [-0.401, 0.15], [-0.401, 0.20], [-0.402, 0.25], [-0.405, 0.30], [-0.410, 0.35], [-0.416, 0.40], [-0.424, 0.45], [-0.433, 0.50], [-0.444, 0.55], [-0.454, 0.60], [-0.465, 0.65], [-0.474, 0.70], [-0.483, 0.75], [-0.491, 0.80], [-0.496, 0.85], [-0.500, 0.90], [-0.502, 0.95], [-0.502, 1.00], [-0.501, 1.05], [-0.500, 1.10], [-0.499, 1.15], [-0.498, 1.20], [-0.497, 1.25], [-0.498, 1.30], [-0.500, 1.35], [-0.503, 1.40], [-0.507, 1.45], [-0.512, 1.50], [-0.518, 1.55], [-0.524, 1.60], [-0.530, 1.65], [-0.537, 1.70], [-0.545, 1.75], [-0.552, 1.80], [-0.560, 1.85], [-0.568, 1.90], [-0.575, 1.95], [-0.583, 2.00], [-0.590, 2.05], [-0.596, 2.10], [-0.602, 2.15], [-0.607, 2.20], [-0.611, 2.25], [-0.615, 2.30], [-0.617, 2.35], [-0.618, 2.40], [-0.618, 2.45], [-0.617, 2.50], [-0.614, 2.55], [-0.610, 2.60], [-0.605, 2.65], [-0.599, 2.70], [-0.591, 2.75], [-0.583, 2.80], [-0.575, 2.85], [-0.565, 2.90], [-0.555, 2.95], [-0.545, 3.00], [-0.534, 3.05], [-0.524, 3.10], [-0.513, 3.15], [-0.502, 3.20], [-0.491, 3.25], [-0.481, 3.30]],
  east: [[-0.356, -3.30], [-0.374, -3.25], [-0.389, -3.20], [-0.401, -3.15], [-0.411, -3.10], [-0.419, -3.05], [-0.424, -3.00], [-0.428, -2.95], [-0.429, -2.90], [-0.429, -2.85], [-0.427, -2.80], [-0.423, -2.75], [-0.418, -2.70], [-0.411, -2.65], [-0.403, -2.60], [-0.394, -2.55], [-0.384, -2.50], [-0.373, -2.45], [-0.361, -2.40], [-0.348, -2.35], [-0.334, -2.30], [-0.319, -2.25], [-0.304, -2.20], [-0.287, -2.15], [-0.270, -2.10], [-0.252, -2.05], [-0.233, -2.00], [-0.213, -1.95], [-0.192, -1.90], [-0.170, -1.85], [-0.147, -1.80], [-0.124, -1.75], [-0.099, -1.70], [-0.074, -1.65], [-0.048, -1.60], [-0.020, -1.55], [0.009, -1.50], [0.039, -1.45], [0.072, -1.40], [0.107, -1.35], [0.143, -1.30], [0.179, -1.25], [0.214, -1.20], [0.248, -1.15], [0.280, -1.10], [0.309, -1.05], [0.335, -1.00], [0.357, -0.95], [0.377, -0.90], [0.395, -0.85], [0.412, -0.80], [0.429, -0.75], [0.445, -0.70], [0.461, -0.65], [0.476, -0.60], [0.490, -0.55], [0.504, -0.50], [0.518, -0.45], [0.530, -0.40], [0.542, -0.35], [0.554, -0.30], [0.564, -0.25], [0.574, -0.20], [0.583, -0.15], [0.591, -0.10], [0.598, -0.05], [0.604, -0.00], [0.610, 0.05], [0.614, 0.10], [0.617, 0.15], [0.620, 0.20], [0.622, 0.25], [0.623, 0.30], [0.623, 0.35], [0.623, 0.40], [0.622, 0.45], [0.620, 0.50], [0.617, 0.55], [0.614, 0.60], [0.611, 0.65], [0.607, 0.70], [0.602, 0.75], [0.597, 0.80], [0.591, 0.85], [0.585, 0.90], [0.579, 0.95], [0.572, 1.00], [0.565, 1.05], [0.558, 1.10], [0.550, 1.15], [0.542, 1.20], [0.534, 1.25], [0.526, 1.30], [0.518, 1.35], [0.509, 1.40], [0.501, 1.45], [0.492, 1.50], [0.484, 1.55], [0.475, 1.60], [0.467, 1.65], [0.458, 1.70], [0.450, 1.75], [0.443, 1.80], [0.436, 1.85], [0.430, 1.90], [0.425, 1.95], [0.420, 2.00], [0.413, 2.05], [0.406, 2.10], [0.400, 2.15], [0.395, 2.20], [0.392, 2.25], [0.392, 2.30], [0.396, 2.35], [0.401, 2.40], [0.406, 2.45], [0.411, 2.50], [0.414, 2.55], [0.417, 2.60], [0.419, 2.65], [0.421, 2.70], [0.423, 2.75], [0.425, 2.80], [0.428, 2.85], [0.431, 2.90], [0.436, 2.95], [0.442, 3.00], [0.449, 3.05], [0.458, 3.10], [0.468, 3.15], [0.481, 3.20], [0.496, 3.25], [0.514, 3.30]]
};
// a line of points: how far a point is from it (to the right of its way: + ), and how far along it
export function pathOf(pts) {
  const cum = [0];
  for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  function near(x, z) {
    let best = Infinity, out = null;
    for (let k = 1; k < pts.length; k++) {
      const [ax, az] = pts[k - 1], [bx, bz] = pts[k], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), qx = ax + dx * t, qz = az + dz * t, d2 = (x - qx) ** 2 + (z - qz) ** 2;
      if (d2 < best) { best = d2; const l = Math.sqrt(l2), fx = dx / l, fz = dz / l; out = { d: (x - qx) * -fz + (z - qz) * fx, s: cum[k - 1] + t * l, fx, fz, end: (k === 1 && t === 0) || (k === pts.length - 1 && t === 1) }; }
    }
    return out;
  }
  return { pts, cum, len: cum[cum.length - 1], box: [x0, x1, z0, z1], near };
}
const WEST = pathOf(ROADS.west), EAST = pathOf(ROADS.east), H = ROADS.half;
const crossS = ROADS.crossings.map(c => { const P = c.road === 'west' ? WEST : EAST, k = P.pts.reduce((b, p, i) => Math.abs(p[1] - c.z) < Math.abs(P.pts[b][1] - c.z) ? i : b, 0); return { P, s: P.cum[k] }; });
// the branch round Metekhi's cliff (it ran from the Mtkvari out to the city's left edge): land again, grass
const BRANCH = { x: [-3.36, -0.47], z: [0.55, 1.95] };
// what of the bridges the roads pass under stays: the Peace Bridge above 0.2, the old stone bridge above 0.15
const KEEP = [{ x: [-0.8, 0.9], z: [-0.42, 0.22], y: [0.2, 3] }, { x: [-0.57, 0.33], z: [2.28, 2.62], y: [0.15, 3] }];

export const EDITS = [
  // the Ferris wheel (behind the funicular's square) leant back 23.6 degrees off its pole: stood upright, and turned
  // half way to its square (it faced along the side: from the square it was a line), a little higher
  { op: 'move', name: 'the Ferris wheel upright', x: [3.3, 4.55], z: [-0.25, 0.75], y: [0.08, 3],
    plane: { at: [3.897, 0.466, 0.226], n: [-0.036, -0.399, -0.916], d: 0.05, r: 0.5 },
    steps: [{ r: { axis: 'x', deg: 23.56, about: [3.897, 0.466, 0.226] } }, { r: { axis: 'y', deg: 45, about: [3.897, 0.466, 0.226] } }, { t: [0, 0.03, 0] }] },
  // the beach: its rubbish and broken pier taken away (it is painted again below), a pier of planks, two umbrellas
  { op: 'delete', name: "the beach's rubbish", x: BEACH.x, z: BEACH.z, y: [0.045, 2] },
  { op: 'flatten', name: 'the beach', x: [-4.5, -3.47], z: [3.47, 4.5], y: [0.034, 0.07], to: 0.036 },
  { op: 'fill', name: "the holes in the beach", x: BEACH.x, z: BEACH.z, y: [-0.05, 0.12] },
  ...pier(),
  ...umbrella(-3.68, 3.62, 2), ...umbrella(-3.62, 4.05, 4),
  ...chair(-3.58, 3.74, 20, 6), ...chair(-3.52, 4.16, -10, 5),
  // Ortachala: the melted trees taken away, an orchard planted
  { op: 'delete', name: "Ortachala's melted trees", x: [4.02, 4.47], z: [3.78, 4.47], y: [0.05, 2] },
  { op: 'flatten', name: "Ortachala's garden", x: [4.02, 4.47], z: [3.78, 4.47], y: [0.034, 0.07], to: 0.035 },
  { op: 'fill', name: "the holes in Ortachala's garden", x: [4.0, 4.49], z: [3.76, 4.49], y: [0.0, 0.07] },
  ...ORCHARD.map(([x, z, ry, s]) => ({ op: 'copy', name: 'a tree for Ortachala', ...TREE,
    steps: [{ r: { axis: 'y', deg: ry, about: TREE.about } }, { s: { k: s, about: TREE.about } }, { t: [x - TREE.about[0], 0, z - TREE.about[2]] }] })),
  // the branch: its channel filled up to the land's height (its water and the slopes down to it); painted grass below
  { op: 'flatten', name: 'the branch filled in', x: BRANCH.x, z: BRANCH.z, y: [-0.4, 0.024], to: 0.03 },
  // the roads: what stands where they run taken away (a small thing whole: a tree, a lamp; of a big one, the part on
  // the road pressed down to it, a wall left beside the road), the bridges' high parts kept (the roads pass under them),
  // the ground under them levelled, the holes closed; then each road's own surface laid over it
  ...[['west', ROADS.west], ['east', ROADS.east]].flatMap(([name, pts]) => [
    { op: 'clear', name: `the ${name} embankment's way`, path: { pts, half: H + 0.012 }, above: 0.052, small: 0.5, keep: KEEP, to: 0.035 },
    { op: 'flattenPath', name: `the ${name} embankment levelled`, path: { pts, half: H + 0.006 }, y: [-0.4, 0.12], to: 0.035, keep: KEEP },
    { op: 'fill', name: `the holes in the ${name} embankment`, path: { pts, half: H + 0.1 }, y: [-0.05, 0.2] },
    { op: 'fill', name: `under the bridges on the ${name} embankment`, path: { pts, half: H + 0.05 }, y: [0.12, 0.3], down: true },
    { op: 'strip', name: `the ${name} road`, path: { pts, half: H + 0.014 }, y: ROAD_Y }
  ]),
  // (where a bush by the east road was taken away, its foot left a hole no fill closes)
  { op: 'disc', name: 'the hole of a bush by the east road', at: [-0.148, 0.0355, -2.194], r: 0.066, n: 16 }
];

// ----- what is painted again -----
const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
// a soft noise (so a painted surface is not flat): values in 0..1
function noise(x, z) {
  const h = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  return h(i, j) * (1 - ux) * (1 - uz) + h(i + 1, j) * ux * (1 - uz) + h(i, j + 1) * (1 - ux) * uz + h(i + 1, j + 1) * ux * uz;
}
const SAND = [240, 210, 148], WET = [214, 180, 118], FOAM = [246, 250, 246], SHALLOW = [116, 214, 214], DEEP = [44, 168, 190];
// the roads: asphalt, a dashed line down the middle, solid lines by the kerbs, the kerbs; zebras at the crossings,
// a stop line before each
const ASPHALT = [74, 77, 84], LINE = [236, 236, 228], KERB = [178, 174, 166], GRASS = [[98, 126, 14], [140, 158, 27]];
function road(P, p) {
  const q = P.near(p.x, p.z);
  if (!q || q.end || Math.abs(q.d) > H) return null;
  const a = Math.abs(q.d), g = 0.95 + 0.08 * noise(p.x * 31, p.z * 31);
  if (a > H - 0.011) return KERB.map(v => v * g);
  for (const c of crossS) if (c.P === P) {
    const ds = q.s - c.s;
    if (Math.abs(ds) < 0.032) return (((q.d + 1) % 0.022) + 0.022) % 0.022 < 0.012 ? LINE : ASPHALT.map(v => v * g);
    if (Math.abs(Math.abs(ds) - 0.045) < 0.004 && Math.sign(ds) * Math.sign(q.d) < 0) return LINE;      // (each way's own stop line)
  }
  if (a < 0.0032 && q.s % 0.09 < 0.05) return LINE;
  if (Math.abs(a - (H - 0.019)) < 0.0024) return LINE;
  return ASPHALT.map(v => v * g);
}
// what was pressed down beside a road (a hill's foot, a building's, a raised square's) stands over it as a wall: a
// retaining wall of stone blocks, each a little lighter or darker
const STONE = [172, 150, 122];
function wall(P, p, n) {
  if (n.y > 0.5 || p.y < 0.04 || p.y > 0.5) return null;
  const q = P.near(p.x, p.z);
  if (!q || q.end) return null;
  const a = Math.abs(q.d);
  if (a < H - 0.004 || a > H + 0.03) return null;
  const row = Math.floor((p.y - 0.035) / 0.022), col = Math.floor(q.s / 0.034 + (row % 2) * 0.5);
  const h = Math.sin(row * 12.9898 + col * 78.233) * 43758.5453, g = 0.86 + 0.18 * (h - Math.floor(h));
  return STONE.map(v => v * g * (0.96 + 0.06 * noise(p.x * 60, p.y * 60 + p.z * 60)));
}
const green = c => c[1] > c[0] + 8 && c[1] > c[2] + 30 && c[0] + c[1] + c[2] < 520;       // (not the old foam's pale)
export const PAINT = [
  { name: 'the branch, grass', x: BRANCH.x, z: BRANCH.z, y: [0.0, 0.06], paint(p, n, c) {
    if (n.y < 0.55 || green(c)) return null;
    return mix(GRASS[0], GRASS[1], 0.25 + 0.6 * noise(p.x * 13, p.z * 13)).map(v => v * (0.96 + 0.08 * noise(p.x * 47, p.z * 47)));
  } },
  { name: 'the west road', x: [WEST.box[0] - H, WEST.box[1] + H], z: [WEST.box[2] - H, WEST.box[3] + H], y: [0.0, 0.07], paint: (p, n) => n.y < 0.5 ? null : road(WEST, p) },
  { name: 'the east road', x: [EAST.box[0] - H, EAST.box[1] + H], z: [EAST.box[2] - H, EAST.box[3] + H], y: [0.0, 0.07], paint: (p, n) => n.y < 0.5 ? null : road(EAST, p) },
  { name: 'the west road\'s walls', x: [WEST.box[0] - H - 0.03, WEST.box[1] + H + 0.03], z: [WEST.box[2] - H, WEST.box[3] + H], y: [0.04, 0.5], paint: (p, n) => wall(WEST, p, n) },
  { name: 'the east road\'s walls', x: [EAST.box[0] - H - 0.03, EAST.box[1] + H + 0.03], z: [EAST.box[2] - H, EAST.box[3] + H], y: [0.04, 0.5], paint: (p, n) => wall(EAST, p, n) },
  { name: 'the beach', x: BEACH.x, z: BEACH.z, y: [-0.3, 0.052], paint(p, n) {
    const d = shore(p.x, p.z), g = 0.94 + 0.1 * noise(p.x * 23, p.z * 23);
    if (n.y < 0.35) return SAND.map(v => v * 0.86 * g);                   // (the tile's sides)
    if (d < -0.035) return mix(SHALLOW, DEEP, smooth(0.0, 0.42, -d - 0.035)).map(v => v * (0.97 + 0.05 * noise(p.x * 9, p.z * 9)));
    if (d < 0.0) return FOAM;
    if (d < 0.05) return mix(WET, SAND, smooth(0, 0.05, d)).map(v => v * g);
    return SAND.map(v => v * g);
  } }
];
