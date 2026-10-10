// ===== the archipelago's pictures, drawn here =====
// The pirates' portraits (until their 3D portraits come), the sea and island behind a square's name on its card, and the
// small icons: a hut and a sea fort for the levels, the castaway's islet and the fisherman's boat, a ship.

// a picture written as SVG, ready for src="" or url('') (no quotes are left in it)
const svgUri = s => 'data:image/svg+xml,' + encodeURIComponent(s.replace(/\s*\n\s*/g, ' '));
const shade = (hex, k) => {          // k > 0 towards white, k < 0 towards black
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255];
  return '#' + c.map(v => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)).toString(16).padStart(2, '0')).join('');
};

// ----- the pirates: who wore what -----
const PIRATE_LOOK = {
  blackbeard: { hat: 'tricorn', hair: '#1b1612', beard: 'long', bc: '#1b1612', skin: '#c99a74', coat: '#3a2a22', smoke: true },
  bonny: { hat: 'scarf', scarf: '#c23b2a', hair: '#b4482a', long: true, skin: '#f0c9a4', coat: '#5a3324' },
  read: { hat: 'tricorn', hair: '#4a2e1a', long: true, skin: '#eac09a', coat: '#2e4a6b' },
  chingshih: { hat: 'crown', hair: '#14110f', skin: '#e9c49e', coat: '#a3262a' },
  omalley: { hat: 'hood', hood: '#3f6b4a', hair: '#9a3f1f', long: true, skin: '#f0c9a4', coat: '#2f4f39' },
  morgan: { hat: 'plume', plume: '#d23c2c', hair: '#3a2416', long: true, beard: 'moustache', bc: '#3a2416', skin: '#ddb08a', coat: '#7a2622' },
  kidd: { hat: 'tricorn', hair: '#e2dcd2', long: true, skin: '#e6b994', coat: '#283a5c' },
  roberts: { hat: 'plume', plume: '#e33b5a', hair: '#24170f', long: true, skin: '#d4a47c', coat: '#7d1f3c' },
  barbarossa: { hat: 'turban', turban: '#f1ead8', hair: '#b4421c', beard: 'long', bc: '#c04a1c', skin: '#c99068', coat: '#2f6b46' },
  bellamy: { hat: 'tricorn', hair: '#2a1d14', long: true, skin: '#e6b994', coat: '#2f3b58' },
  labuse: { hat: 'tricorn', hair: '#463224', patch: true, beard: 'short', bc: '#463224', skin: '#d8a882', coat: '#4d3f30' },
  stortebeker: { hat: 'cap', cap: '#6b4a24', hair: '#c9a25a', beard: 'short', bc: '#c9a25a', skin: '#e3b590', coat: '#5c4320' }
};
const PORTRAITS = {};
function piratePor(h) {
  if (PORTRAITS[h]) return PORTRAITS[h];
  const L = PIRATE_LOOK[h] || PIRATE_LOOK.kidd, c = (HEROES[h] && HEROES[h].c) || '#33405e', sk = L.skin, dk = shade(sk, -0.18);
  const beard = { long: `<path d="M35.5 49q0 24 14.5 28q14.5-4 14.5-28q-4 9-14.5 9t-14.5-9z" fill="${L.bc}"/>`,
    short: `<path d="M37 52q1 14 13 17q12-3 13-17q-4 6-13 6t-13-6z" fill="${L.bc}"/>`,
    moustache: `<path d="M42.5 55.5q7.5-4.5 15 0q-7.5 2.5-15 0z" fill="${L.bc}"/>` }[L.beard] || '';
  const tricorn = `<path d="M23 39c9-3 15-16 27-16s18 13 27 16c-7 4-16 6.5-27 6.5s-20-2.5-27-6.5z" fill="#1d1a1e"/>
    <path d="M26 39.5c8 3 15.5 4.5 24 4.5s16-1.5 24-4.5" fill="none" stroke="#d9a640" stroke-width="1.7"/>`;
  const hat = ({            // (each made only when it is the one worn)
    tricorn: () => tricorn,
    plume: () => tricorn + `<path d="M60 29c7-9 17-11 23-8-7 0-13 4-19 10z" fill="${L.plume}"/><path d="M61 30c6-6 13-8 18-8" stroke="${shade(L.plume, -0.3)}" stroke-width="1" fill="none"/>`,
    scarf: () => `<path d="M34.5 43c0-11 7-17.5 15.5-17.5S65.5 32 65.5 43c-5-3.5-10-4.5-15.5-4.5s-10.5 1-15.5 4.5z" fill="${L.scarf}"/>
      <path d="M63.5 40l10 3-5 8zM63.5 40l8 9-6 3z" fill="${shade(L.scarf, -0.15)}"/><g fill="#fff" opacity=".55"><circle cx="43" cy="33" r="1.3"/><circle cx="51" cy="30" r="1.3"/><circle cx="58" cy="34" r="1.3"/></g>`,
    hood: () => `<path d="M29 56c-1-21 8.5-32 21-32s22 11 21 32c-3-11-10-16.5-21-16.5S32 45 29 56z" fill="${L.hood}"/>
      <path d="M29 56q-1 11 7 19l3-13zM71 56q1 11-7 19l-3-13z" fill="${shade(L.hood, -0.2)}"/>`,
    turban: () => `<ellipse cx="50" cy="34" rx="18" ry="11.5" fill="${L.turban}"/><path d="M33 36q17-9 34 0M35 31q15-8 30 0" stroke="${shade(L.turban, -0.25)}" stroke-width="1.4" fill="none"/>
      <circle cx="50" cy="29.5" r="2.8" fill="#c0392b" stroke="#e8b44c" stroke-width="1"/><path d="M50 27q2-8 7-10" stroke="#e8b44c" stroke-width="1.4" fill="none"/>`,
    crown: () => `<path d="M34 39c3-11 9-15.5 16-15.5S63 28 66 39c-5-3-10-4-16-4s-11 1-16 4z" fill="${L.hair}"/><ellipse cx="50" cy="23" rx="8" ry="6" fill="${L.hair}"/>
      <path d="M36 31l-7-5M64 31l7-5" stroke="#e8b44c" stroke-width="2.2" stroke-linecap="round"/><circle cx="50" cy="22" r="3.2" fill="#e8b44c"/><circle cx="29" cy="26" r="2" fill="#c0392b"/><circle cx="71" cy="26" r="2" fill="#c0392b"/>`,
    cap: () => `<path d="M34 39c2-10 8-14.5 16-14.5s14 4.5 16 14.5c-5-2.5-10-3.5-16-3.5s-11 1-16 3.5z" fill="${L.cap}"/><path d="M32 39.5q18-5 36 0" stroke="${shade(L.cap, -0.3)}" stroke-width="2.4" fill="none"/>`
  }[L.hat] || (() => tricorn))();
  const eyes = L.patch
    ? `<circle cx="44.5" cy="47.5" r="1.8" fill="#24160f"/><path d="M36 40.5L64.5 44" stroke="#111" stroke-width="1.5"/><ellipse cx="55.5" cy="47.5" rx="4.2" ry="3.6" fill="#111"/>`
    : `<circle cx="44.5" cy="47.5" r="1.8" fill="#24160f"/><circle cx="55.5" cy="47.5" r="1.8" fill="#24160f"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="256" height="256">
    <defs><radialGradient id="b" cx="50%" cy="36%" r="72%"><stop offset="0" stop-color="${shade(c, 0.42)}"/><stop offset="1" stop-color="${shade(c, -0.25)}"/></radialGradient></defs>
    <rect width="100" height="100" fill="url(#b)"/>
    ${L.smoke ? '<g fill="#fff" opacity=".22"><circle cx="24" cy="30" r="7"/><circle cx="18" cy="22" r="5"/><circle cx="78" cy="28" r="6"/><circle cx="84" cy="20" r="4.5"/></g>' : ''}
    ${L.long ? `<path d="M32 46q-2 18-7 30h50q-5-12-7-30z" fill="${L.hair}"/>` : ''}
    <path d="M11 100c1-19 15-29.5 39-29.5S88 81 89 100z" fill="${L.coat}"/>
    <path d="M11 100c1-19 15-29.5 39-29.5" stroke="${shade(L.coat, 0.25)}" stroke-width="1.5" fill="none" opacity=".6"/>
    <path d="M38.5 72l11.5 15 11.5-15-5-1.5-6.5 7-6.5-7z" fill="#efe6d2"/>
    <rect x="44" y="58" width="12" height="15" rx="4" fill="${dk}"/>
    <ellipse cx="35.8" cy="48.5" rx="2.6" ry="4" fill="${dk}"/><ellipse cx="64.2" cy="48.5" rx="2.6" ry="4" fill="${dk}"/>
    <ellipse cx="50" cy="47.5" rx="14.5" ry="16.5" fill="${sk}"/>
    <path d="M36 44q1-9 14-10t14 10q-3-6-14-6.5T36 44z" fill="${L.hair}"/>
    ${eyes}
    <path d="M41 43q3.5-2 7 0M52 43q3.5-2 7 0" stroke="${shade(L.hair, -0.1)}" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <path d="M50 49q-2.6 4 0 6.2" stroke="${shade(sk, -0.35)}" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <path d="M46 58.5q4 2 8 0" stroke="#8c3b2c" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    ${beard}${hat}
  </svg>`;
  return (PORTRAITS[h] = svgUri(svg));
}

// ----- the picture behind a square's name: its sea, as it looks there -----
const SEA_LOOK = [
  { sky: ['#8299ad', '#d3dbe0'], sea: ['#456a82', '#22405a'], sun: '#f4f1df', land: 'cliff' },      // the north: Heligoland's red cliffs
  { sky: ['#3f8fd6', '#c6e7f8'], sea: ['#1f7ec0', '#0d4b82'], sun: '#fff3c4', land: 'rock' },       // the Mediterranean: white rock, a fort
  { sky: ['#6aa3c9', '#d7e9f0'], sea: ['#2c7393', '#174864'], sun: '#fdf6dc', land: 'green' },      // the Atlantic: green hills, a tower house
  { sky: ['#48a9e2', '#cdeffa'], sea: ['#17aabb', '#0a6c8c'], sun: '#fff2b8', land: 'palms' },      // the Antilles
  { sky: ['#52b6ea', '#d8f5fb'], sea: ['#12b9c2', '#09738e'], sun: '#fff2b8', land: 'palms2' },     // the Caribbean
  { sky: ['#f19a5c', '#fde4b4'], sea: ['#2b88a8', '#154c70'], sun: '#ffd27a', land: 'palms' },      // the Indian Ocean, at sunset
  { sky: ['#5e8fc6', '#d2e3f1'], sea: ['#1f6c9c', '#0d3e64'], sun: '#fdf3cf', land: 'peaks' },      // the Pacific: volcanic peaks
  { sky: ['#41728f', '#b3d1dc'], sea: ['#1a6079', '#0a3850'], sun: '#eef4f0', land: 'jungle' }      // the great treasures: misty jungle
];
const SEA_ART = {};
function palm(x, y, h, lean) {
  const tx = x + lean, ty = y - h;
  return `<path d="M${x} ${y}q${lean * 0.2} ${-h * 0.6} ${lean} ${-h}" stroke="#7a4f2a" stroke-width="3.2" fill="none" stroke-linecap="round"/>
    <g fill="#3f8a3c"><path d="M${tx} ${ty}q-14-6-26 3q12-4 26-3z"/><path d="M${tx} ${ty}q14-7 27 2q-13-4-27-2z"/><path d="M${tx} ${ty}q-6-12-19-12q12 3 19 12z"/><path d="M${tx} ${ty}q8-12 21-10q-13 2-21 10z"/><path d="M${tx} ${ty}q-2 9-12 15q8-7 12-15z"/></g>`;
}
function seaArt(t) {
  const key = t.k === 'p' ? 'g' + t.g + ':' + t.i : t.k + t.i;
  if (SEA_ART[key]) return SEA_ART[key];
  const L = t.k === 'p' ? SEA_LOOK[t.g] : t.k === 'road' ? SEA_LOOK[[3, 2, 5, 4][ROADS.indexOf(t.i)] || 3] : SEA_LOOK[t.i === 12 ? 2 : 4];
  const k = t.k === 'p' ? GROUP_TILES[t.g].indexOf(t.i) : 0, dx = [0, -46, 40][k] || 0;    // each island of a sea a little apart
  let land = '';
  switch (t.k === 'p' ? L.land : t.k) {
    case 'cliff': land = `<path d="M${200 + dx} 132V90l14-7h78l14 9 12 40z" fill="#a8553a"/><path d="M${200 + dx} 90l14-7h78l14 9z" fill="#77a34f"/>
      <path d="M${206 + dx} 104h96M${204 + dx} 116h104" stroke="#7d3a26" stroke-width="2" opacity=".5"/><path d="M${334 + dx} 132l4-32h11l4 32z" fill="#9a4a32"/>`; break;
    case 'rock': land = `<path d="M${176 + dx} 132q24-44 58-48q22-2 42 14q32 8 54 34z" fill="#dacfb6"/><path d="M${206 + dx} 120q22-26 50-24" stroke="#b9ab8a" stroke-width="3" fill="none"/>
      <path d="M${246 + dx} 96V78h4v3h4v-3h4v3h4v-3h4v3h4v-3h4v18z" fill="#c4b38c"/>`; break;
    case 'green': land = `<path d="M${156 + dx} 132q32-50 86-52q42 0 72 28q22 10 44 24z" fill="#5f9a4a"/><path d="M${196 + dx} 132q30-30 70-32q30 2 50 18" fill="#4e8a3c"/>
      <path d="M${236 + dx} 82V60h16v22z" fill="#8f8a7e"/><path d="M${234 + dx} 60l10-8 10 8z" fill="#5d574c"/>`; break;
    case 'palms': case 'palms2': land = `<ellipse cx="${262 + dx}" cy="133" rx="96" ry="13" fill="#ecdba3"/><ellipse cx="${262 + dx}" cy="126" rx="62" ry="10" fill="#4e9b45"/>
      ${palm(236 + dx, 126, 46, -8)}${palm(276 + dx, 127, 56, 10)}${L.land === 'palms2' ? palm(306 + dx, 128, 36, 12) : ''}`; break;
    case 'peaks': land = `<path d="M${150 + dx} 132l42-58 22 20 30-44 42 56 34 26z" fill="#4c7a3e"/><path d="M${244 + dx} 50l42 56-26-14-16 10z" fill="#3a6430"/>
      <path d="M${236 + dx} 62l8-12 8 12q-8-3-16 0z" fill="#f2f2ea"/>`; break;
    case 'jungle': land = `<path d="M${172 + dx} 132q22-54 74-58q52 4 84 58z" fill="#2f6b3a"/><path d="M${212 + dx} 132q14-30 40-34" stroke="#255a2f" stroke-width="5" fill="none"/>
      ${palm(214 + dx, 112, 34, -10)}${palm(292 + dx, 114, 38, 9)}<path d="M${270 + dx} 92l3 26h-7z" fill="#cfe9f1" opacity=".8"/><rect y="96" width="400" height="22" fill="#fff" opacity=".16"/>`; break;
    case 'road': land = `<path d="M196 130h128l-15 19h-98z" fill="#4a2f1c"/><path d="M200 130h120" stroke="#e8b44c" stroke-width="2"/>
      <path d="M236 130V58M268 130V48M296 130V66" stroke="#3b2414" stroke-width="3"/>
      <path d="M222 64q14 14 0 30h28q6-15 0-30zM252 54q16 16 0 34h32q6-17 0-34zM284 72q12 12 0 26h24q5-13 0-26z" fill="#f3e8d0" stroke="#b9a37c" stroke-width="1.2"/>
      <path d="M268 48h-14l3 4-3 4h14z" fill="#1d1a1e"/>`; break;
    case 'util': land = t.i === 12
      ? `<path d="M196 132q24-30 64-30t62 30z" fill="#6d6a62"/><path d="M248 106l4-56h16l4 56z" fill="#f4efe4"/><path d="M250.5 84h19M251.5 68h17" stroke="#c0392b" stroke-width="7"/>
        <rect x="249" y="40" width="22" height="12" fill="#3b3a38"/><circle cx="260" cy="46" r="4" fill="#ffd27a"/><path d="M264 44l70-18v24z" fill="#ffe9a8" opacity=".5"/>`
      : `<ellipse cx="270" cy="134" rx="104" ry="12" fill="#ecdba3"/><g transform="rotate(-24 262 118)"><path d="M206 120h112l-14 18h-84z" fill="#5a3a22"/><path d="M234 120V74M266 120V66" stroke="#3b2414" stroke-width="3"/></g>
        <path d="M318 132V92M340 132V92M314 100h30M314 114h30" stroke="#8a6a3c" stroke-width="2.4"/>`; break;
  }
  const waves = [140, 152, 166, 182].map((y, n) => `<path d="M${-20 + n * 13} ${y}${Array.from({ length: 12 }, () => 'q9-3.5 18 0t18 0').join('')}" stroke="#fff" stroke-opacity="${0.28 - n * 0.04}" stroke-width="1.6" fill="none"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${L.sky[0]}"/><stop offset="1" stop-color="${L.sky[1]}"/></linearGradient>
    <linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${L.sea[0]}"/><stop offset="1" stop-color="${L.sea[1]}"/></linearGradient></defs>
    <rect width="400" height="200" fill="url(#s)"/><circle cx="${t.k === 'p' && t.g === 5 ? 120 : 92}" cy="${t.k === 'p' && t.g === 5 ? 104 : 54}" r="19" fill="${L.sun}" opacity=".92"/>
    <g fill="#fff" opacity=".6"><ellipse cx="140" cy="44" rx="34" ry="6.5"/><ellipse cx="160" cy="38" rx="18" ry="6.5"/><ellipse cx="338" cy="30" rx="26" ry="5"/></g>
    ${land}<rect y="130" width="400" height="70" fill="url(#w)"/>${waves}
  </svg>`;
  return (SEA_ART[key] = svgUri(svg));
}

// ----- small icons -----
const HUT_SVG = '<svg viewBox="0 0 20 28" aria-hidden="true"><path d="M4 27V14h12v13z" fill="#d9b07a" stroke="#5a3a1e" stroke-width="1.4"/><path d="M1 15.5L10 4l9 11.5z" fill="currentColor" stroke="#5a3a1e" stroke-width="1.4" stroke-linejoin="round"/><path d="M3.5 12.5l13 0" stroke="#5a3a1e" stroke-width=".8" opacity=".6"/><path d="M8 27v-7h4v7" fill="#3b2412"/></svg>';
const SEAFORT_SVG = '<svg viewBox="0 0 30 28" aria-hidden="true"><path d="M3 27V12h24v15z" fill="#cfc4ad" stroke="#5a4636" stroke-width="1.4"/><path d="M3 12V8h4v3h3V8h4v3h2V8h4v3h3V8h4v4" fill="#cfc4ad" stroke="#5a4636" stroke-width="1.4" stroke-linejoin="round"/><path d="M15 8V1" stroke="#5a4636" stroke-width="1.4"/><path d="M15 1.2h8l-2.2 2.4 2.2 2.4h-8z" fill="currentColor"/><path d="M12 27v-6a3 3 0 0 1 6 0v6" fill="#3b2c22"/></svg>';
const ISLE_SVG = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M1 17q9-6.5 18 0z" fill="#e8d59a"/><path d="M9.5 15.5q-.5-6 2.5-10" stroke="#7a4a22" stroke-width="1.6" fill="none"/><g fill="#4f9a46"><path d="M12 5.5q-5-1.5-8.5 2q4-2.5 8.5-2z"/><path d="M12 5.5q5-2 7.5 1.2q-4-2.2-7.5-1.2z"/><path d="M12 5.5q1-4.3 5-4.3q-3 1.2-5 4.3z"/><path d="M12 5.5q-2-4-6-3q4 .2 6 3z"/></g><path d="M0 18.5h20" stroke="#4ea4f0" stroke-width="2"/></svg>';
const BOAT_SVG = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 11.5h16l-3.2 5H5.2z" fill="#a8743f" stroke="#5a3a1e" stroke-width="1.2" stroke-linejoin="round"/><path d="M10 11.5V2" stroke="#5a3a1e" stroke-width="1.2"/><path d="M10.7 2.6l6 7.4h-6z" fill="#f3e8d0" stroke="#5a3a1e" stroke-width=".8"/><path d="M1 18.5q2.5-1.5 5 0t5 0 5 0 4 0" stroke="#4ea4f0" stroke-width="1.4" fill="none"/></svg>';
const SHIP_SVG = '<svg viewBox="0 0 30 30" aria-hidden="true"><path d="M3 19h24l-4 6H7z" fill="#5a3a22" stroke="#2c1b10" stroke-width="1.2" stroke-linejoin="round"/><path d="M11 19V5M19 19V3" stroke="#2c1b10" stroke-width="1.4"/><path d="M5.5 7q4 4 0 9h10q2-4.5 0-9zM13.5 5q5 5 0 11h11q2-5.5 0-11z" fill="#f3e8d0" stroke="#8a7350" stroke-width=".9"/><path d="M19 3h5l-1.4 1.6L24 6.2h-5z" fill="#1d1a1e"/><path d="M1 27.5q3-1.6 6 0t6 0 6 0 6 0 4 0" stroke="#4ea4f0" stroke-width="1.5" fill="none"/></svg>';
