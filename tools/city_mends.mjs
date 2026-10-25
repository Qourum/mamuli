// What Meshy got wrong in ტფილისი's city model, put right on the model itself (tools/city_make.mjs applies them before
// the model is simplified and its picture baked). Board units: x to the right and z to the front seen from the front,
// y up; the tiles' grass at 0.03.
//   EDITS: what is taken away, moved, copied or added (city_make.mjs says how each is written)
//   PAINT: what is painted again over the baked picture (bake.mjs)
//   SWATCHES: the colours of the faces added here (a face's `color` is its index)

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
    steps: [{ r: { axis: 'y', deg: ry, about: TREE.about } }, { s: { k: s, about: TREE.about } }, { t: [x - TREE.about[0], 0, z - TREE.about[2]] }] }))
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
export const PAINT = [
  { name: 'the beach', x: BEACH.x, z: BEACH.z, y: [-0.3, 0.052], paint(p, n) {
    const d = shore(p.x, p.z), g = 0.94 + 0.1 * noise(p.x * 23, p.z * 23);
    if (n.y < 0.35) return SAND.map(v => v * 0.86 * g);                   // (the tile's sides)
    if (d < -0.035) return mix(SHALLOW, DEEP, smooth(0.0, 0.42, -d - 0.035)).map(v => v * (0.97 + 0.05 * noise(p.x * 9, p.z * 9)));
    if (d < 0.0) return FOAM;
    if (d < 0.05) return mix(WET, SAND, smooth(0, 0.05, d)).map(v => v * g);
    return SAND.map(v => v * g);
  } }
];
