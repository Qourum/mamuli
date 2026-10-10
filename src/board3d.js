// ===== the board in 3D: raised squares with their writing, the land behind them, figures, flags, towers, the camera =====
// Board coordinates: y up, the board's middle at (0, 0, 0). Side 0 (start .. jail) is nearest +z, then the board goes on
// clockwise seen from above: side 1 at -x, side 2 at -z, side 3 at +x. Each square has its own frame: x along its writing,
// +z towards its outer edge; its writing is upright for someone sitting at that side, where the camera goes.
// Inside the ring of squares lies one relief (terrain.js): every place shapes its own piece of it, and the great mountain
// stands in the middle; around the board the country goes on into the haze. And it all lives: leaves sway, water
// shimmers and falls, smoke rises from the chimneys, camels walk, sheep graze, boats sail, the cable car goes up and down,
// a guard keeps watch, clouds and eagles circle the summit.

const Board3D = (() => {
  const T = window.THREE;
  const S = 12, C = 1.5, D = 1.5, TW = 1, TH = 0.2, LOT = 1.25;
  const LS = [1.18, 1.25, 1.12], RS = [1.2, 1.3, 1.2];     // a lot's scenery, a corner of the ring's: their models' units on the board
  const HAZE = 0xc4cfd0, SEA_HAZE = 0xbcdbe6;            // the far country (or the far ocean) fades into it
  const OUT = [[0, 1], [-1, 0], [0, -1], [1, 0]], ALONG = [[-1, 0], [0, -1], [1, 0], [0, 1]];
  const sideOf = i => Math.floor(i / 10) % 4;
  const yawOf = s => -s * Math.PI / 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const TAU = Math.PI * 2;
  const ease = {
    out: t => 1 - Math.pow(1 - t, 3), inOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    back: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    lin: t => t
  };

  let ok = false, R = null, scene = null, cam = null, host = null, W = 1, H = 1, root = null, sun = null, ray = null, maxAniso = 4, mobile = false;
  const tiles = [], labelCv = [], labelTex = [], labelMat = [], sideMat = [], lotMesh = [], lotGround = [], flags = [], mark = [];
  const toks = [];
  let st = null, pos = [], turnSeat = -1, pickCb = null, built = false, mats = null, ownerMats = [], wheel = null;
  let landG = null, landTop = 4, fallFoot = null;
  const lotF = [], ringF = [];
  // the world on the board: the land (models.js) or the archipelago's sea (sea.js), as the room's theme says; made again
  // when the theme changes (see retheme)
  let MOD = Models, worldBuilt = null, hemi = null, seaMesh = null;
  const wantWorld = () => (typeof THEME !== 'undefined' && THEME.world === 'sea' && typeof SeaModels !== 'undefined' && SeaModels) ? 'sea' : 'land';
  const O = new T.Object3D();                              // for putting matrices together

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
  const IMG = {}, LABEL_PICS = ['ui_coin', 'ui_page', 'ui_chest_wood', 'ui_coinbag'], missed = new Set();
  let relabelT = 0;
  const relabelSoon = () => { clearTimeout(relabelT); relabelT = setTimeout(relabelAll, 60); };
  function pic(name) {
    if (!IMG[name]) {
      const im = new Image();
      im.onload = () => { if (missed.delete(name)) relabelSoon(); };      // drawn without it: once more, now with it
      im.src = ART(name);
      IMG[name] = im;
    }
    const ready = IMG[name].complete && IMG[name].naturalWidth;
    if (!ready) missed.add(name);
    return ready ? IMG[name] : null;
  }
  // the writing's fonts: when one of them was not there yet, the squares are written again once it is
  const LABEL_FONTS = [['800 40px "Noto Sans Georgian"', 'ქალაქი'], ['900 50px "Noto Serif Georgian"', 'სტარტი'], ['400 50px "Lilita One"', '120']];
  const fontsReady = () => { try { return !document.fonts || LABEL_FONTS.every(([f, t]) => document.fonts.check(f, t)); } catch (e) { return true; } };
  let drawnWithFonts = false;
  function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
  function fit(x, text, weight, family, size, maxW, min = 12) {
    let s = size;
    for (; s > min; s--) { x.font = `${weight} ${s}px ${family}`; if (x.measureText(text).width <= maxW) break; }
    x.font = `${weight} ${s}px ${family}`;
    return s;
  }
  // a name on one line, or on two (split at a space or a soft hyphen), as large as fits: one line is liked best, then a
  // break at a space, a word broken with a hyphen least (it has to be much larger to win)
  function lines(x, name, weight, family, size, maxW, min = 18) {
    const plain = name.replace(/\u00ad/g, ''), cand = [{ l: [plain], k: 1 }];
    for (let k = 1; k < name.length - 1; k++) {
      const ch = name[k], soft = ch === '\u00ad';
      if (ch !== ' ' && ch !== '-' && !soft) continue;
      // after a space nothing is added, a hyphen stays on the first line, a soft one is written there
      cand.push({ l: [name.slice(0, k).replace(/\u00ad/g, '') + (ch === ' ' ? '' : '-'), name.slice(k + 1).replace(/\u00ad/g, '')], k: ch === ' ' ? 0.9 : soft ? 0.72 : 0.86 });
    }
    x.font = `${weight} 100px ${family}`;                // the widths measured once, at 100px
    let best = null;
    for (const c of cand) {
      const w = Math.max(...c.l.map(l => x.measureText(l).width)) / 100, s = Math.min(size, Math.floor(maxW / w)), score = s * c.k;
      if (!best || score > best.score) best = { score, s, l: c.l };
    }
    x.font = `${weight} ${Math.max(min, best.s)}px ${family}`;
    return best.l;
  }
  // the size of the canvas's font now (its weight comes first in the font: '800 40px …')
  const fontPx = x => +(/(\d+(?:\.\d+)?)px/.exec(x.font) || [0, 30])[1];
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
    const ink = '#2c1b10', soft = '#7a5a3a', words = THEME.w;     // the theme's words (W is this board's width here)
    const name = (n, top, bottom, size = 40) => {
      const ls = lines(x, n, 800, FONT.sans, size, cw - 40);
      const lh = fontPx(x) * 1.12, y0 = (top + bottom) / 2 - (ls.length - 1) * lh / 2;
      x.fillStyle = ink;
      ls.forEach((l, k) => x.fillText(l, mid, y0 + k * lh));
    };
    if (t.k === 'p' || t.k === 'road' || t.k === 'util') {
      const band = t.k === 'p' ? GROUPS[t.g].c : '#7b5532', bandText = t.k === 'p' ? GROUPS[t.g].n : t.k === 'road' ? words.road : words.util;
      x.fillStyle = band; rr(x, 18, 18, cw - 36, 80, 10); x.fill();
      x.fillStyle = 'rgba(255, 255, 255, .2)'; rr(x, 18, 18, cw - 36, 14, 7); x.fill();
      x.fillStyle = '#fff'; fit(x, bandText, 800, FONT.sans, 27, cw - 60);
      x.shadowColor = 'rgba(0, 0, 0, .35)'; x.shadowBlur = 4; x.fillText(bandText, mid, 60); x.shadowBlur = 0;
      name(t.k === 'road' ? t.s : t.n, 110, 240);
      x.fillStyle = soft; x.font = `700 21px ${FONT.sans}`; x.fillText('ფასი', mid, 280);
      priceLine(x, mid, 326, String(t.p));
    } else if (t.k === 'scroll' || t.k === 'chest') {
      const sub = t.k === 'scroll' ? words.scrollTile : words.chestTile;
      name(t.k === 'scroll' ? words.scroll : words.chest, 46, 130, 38);
      iconAt(x, t.k === 'scroll' ? 'ui_page' : 'ui_chest_wood', mid, 222, 128);
      x.fillStyle = soft; fit(x, sub, 700, FONT.sans, 25, cw - 50); x.fillText(sub, mid, 330);
    } else if (t.k === 'tax') {
      name(t.n, 50, 120, 42);
      iconAt(x, t.a > 150 ? 'ui_coinbag' : 'ui_coin', mid, 200, 110);
      x.fillStyle = soft; x.font = `700 22px ${FONT.sans}`; x.fillText('გადაიხადე', mid, 280);
      priceLine(x, mid, 326, String(t.a), '#a3261c');
    } else if (corner) {
      // the corner's name, large: on two lines when it is long (the line above moves up)
      const big = (text, y, color, size = 58) => {
        x.fillStyle = color;
        const ls = lines(x, text, 900, FONT.serif, size, cw - 50, 36), lh = fontPx(x) * 1.05;
        ls.forEach((l, k) => x.fillText(l, mid, y - (ls.length - 1 - k) * lh));
      };
      const small = (text, y) => { x.fillStyle = soft; fit(x, text, 700, FONT.sans, 26, cw - 50); x.fillText(text, mid, y); };
      if (t.k === 'start') {
        // the big arrow along the way
        x.fillStyle = '#c8372d'; x.strokeStyle = '#7a1d14'; x.lineWidth = 5;
        x.beginPath(); x.moveTo(60, 196); x.lineTo(140, 146); x.lineTo(140, 176); x.lineTo(320, 176); x.lineTo(320, 216); x.lineTo(140, 216); x.lineTo(140, 246); x.closePath(); x.fill(); x.stroke();
        big(words.start, 282, '#8d2a1f');
        x.fillStyle = '#2f7a2a'; x.font = `400 40px ${FONT.num}`;
        priceLine(x, mid - 40, 336, '+' + SALARY, '#2f7a2a', 40);
        x.fillStyle = soft; x.font = `700 21px ${FONT.sans}`; x.textAlign = 'left'; x.fillText(words.startTile, mid + 34, 338); x.textAlign = 'center';
      } else if (t.k === 'jail') { big(words.jail, 290, '#3b2c22'); small(words.jailTile, 340); }
      else if (t.k === 'feast') { big(words.feast, 290, '#8d2a1f'); small(words.feastTile, 340); }
      else if (t.k === 'gojail') { big(words.gojail, 290, '#8d2a1f', 54); small(words.gojailTile, 340); }
    }
    return cv;
  }
  const PERF = { relabel: 0, relabelMs: 0, build: 0, frames: 0, shadows: 0 };    // counted for tests
  function relabelAll() {
    if (!ok) return;
    const t0 = performance.now();
    drawnWithFonts = fontsReady();
    for (let i = 0; i < 40; i++) { if (!labelTex[i]) continue; drawLabel(i); labelTex[i].needsUpdate = true; }
    PERF.relabel++; PERF.relabelMs += performance.now() - t0;
  }

  // ===== the board's own material: leaves and vines sway, water shimmers and falls, the land has its grain =====
  // Every piece of the land and of what stands on it says in its 'anim' attribute what it is: x how much it sways (more
  // the higher it is above its ground), y what kind of surface it is (1 water lying still, 2 falling water, 3 the land
  // itself, which gets the fine grain of soil, grass and rock from a small noise picture). One clock for all of it.
  const U = { time: { value: 0 }, fade: { value: 1 }, scale: { value: 800 }, detail: { value: null } };
  const LIVING = {
    vp: '#include <common>\nattribute vec2 anim;\nuniform float uTime;\nvarying vec3 vWP;\nvarying float vWater;\nvarying float vShore;',
    v: `#include <begin_vertex>
      vec4 wp4 = vec4( position, 1.0 );
      #ifdef USE_INSTANCING
        wp4 = instanceMatrix * wp4;
      #endif
      wp4 = modelMatrix * wp4;
      vWP = wp4.xyz;
      vWater = anim.y;
      vShore = anim.x;
      if ( anim.y > 3.5 && anim.y < 4.5 ) {
        // the sea's swell (anim.x is how near the shore: no sway)
        transformed.y += 0.006 * sin( uTime * 1.3 + wp4.x * 2.3 + wp4.z * 1.1 ) + 0.004 * sin( uTime * 1.9 - wp4.z * 3.1 + wp4.x * 0.7 );
      } else if ( anim.x > 0.0 ) {
        float ph = wp4.x * 1.9 + wp4.z * 1.3;
        float gust = 0.65 + 0.35 * sin( uTime * 0.41 + wp4.x * 0.25 - wp4.z * 0.2 );
        transformed.x += anim.x * gust * ( 0.009 * sin( uTime * 1.7 + ph ) + 0.0035 * sin( uTime * 3.3 + ph * 2.1 ) );
        transformed.z += anim.x * gust * 0.0055 * sin( uTime * 1.25 + ph * 1.3 + 1.2 );
      }`,
    fp: '#include <common>\nuniform float uTime;\nuniform sampler2D uDetail;\nvarying vec3 vWP;\nvarying float vWater;\nvarying float vShore;',
    f: `#include <emissivemap_fragment>
      if ( vWater > 4.5 ) {
        // lava: glowing, its dark crust drifting over it
        float c = sin( vWP.x * 23.0 + uTime * 0.7 + sin( vWP.z * 17.0 - uTime * 0.5 ) * 2.0 ) * sin( vWP.z * 19.0 - uTime * 0.6 + vWP.x * 3.0 );
        diffuseColor.rgb = mix( vec3( 0.32, 0.05, 0.02 ), vec3( 1.0, 0.56, 0.14 ), 0.5 + 0.5 * c );
        totalEmissiveRadiance += vec3( 0.95, 0.34, 0.06 ) * ( 0.6 + 0.4 * c );
      } else if ( vWater > 3.5 ) {
        // the sea: small waves glitter in the sun; foam laps each shore, coming and going
        float w1 = sin( vWP.x * 6.3 + uTime * 1.1 + sin( vWP.z * 2.9 + uTime * 0.5 ) * 1.9 + sin( vWP.x * 1.7 - vWP.z * 2.3 ) * 1.2 );
        float w2 = sin( vWP.z * 5.7 - uTime * 0.85 + sin( vWP.x * 2.4 - uTime * 0.4 ) * 1.6 + sin( vWP.z * 1.3 + vWP.x * 2.1 ) * 1.1 );
        float near = 1.0 - smoothstep( 9.0, 30.0, length( vWP.xz ) );            // the glitter fades out over the far ocean
        diffuseColor.rgb *= 0.94 + 0.08 * ( w1 * 0.5 + 0.5 ) * ( 0.4 + 0.6 * near );
        totalEmissiveRadiance += vec3( 0.11, 0.13, 0.14 ) * smoothstep( 0.82, 0.995, w1 * w2 ) * near;
        float lap = 0.5 + 0.5 * sin( vShore * 14.0 - uTime * 1.8 + ( vWP.x + vWP.z ) * 2.5 );
        float foam = smoothstep( 0.74, 0.97, vShore ) + smoothstep( 0.4, 0.76, vShore ) * smoothstep( 0.78, 0.97, lap ) * 0.75;
        diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.95, 0.98, 0.97 ), clamp( foam, 0.0, 1.0 ) * 0.85 );
      } else if ( vWater > 2.5 ) {
        // the land's grain: the same noise at two sizes; bright snow gets less of it
        float g1 = texture2D( uDetail, vWP.xz * 1.7 ).r, g2 = texture2D( uDetail, vWP.xz * 6.1 + 0.37 ).r;
        float k = 1.0 - 0.6 * smoothstep( 0.55, 0.85, diffuseColor.g );
        diffuseColor.rgb *= 1.0 + k * ( 0.42 * ( g1 - 0.5 ) + 0.3 * ( g2 - 0.5 ) );
      } else if ( vWater > 0.5 ) {
        if ( vWater < 1.5 ) {
          float w1 = sin( vWP.x * 21.0 + uTime * 1.2 + sin( vWP.z * 8.0 + uTime * 0.6 ) * 1.7 );
          float w2 = sin( vWP.z * 17.0 - uTime * 0.95 + sin( vWP.x * 6.5 - uTime * 0.4 ) * 1.4 );
          diffuseColor.rgb *= 0.9 + 0.12 * ( w1 * 0.5 + 0.5 );
          totalEmissiveRadiance += vec3( 0.16, 0.19, 0.2 ) * smoothstep( 0.55, 0.95, w1 * w2 );
        } else {
          float s = fract( vWP.y * 6.5 + uTime * 1.7 + sin( vWP.x * 37.0 + vWP.z * 31.0 ) * 0.35 );
          diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.8, 0.88, 0.93 ), 0.3 );
          totalEmissiveRadiance += vec3( 0.35 ) * smoothstep( 0.55, 1.0, s );
        }
      }`
  };
  function living(m) {
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = U.time; sh.uniforms.uDetail = U.detail;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', LIVING.vp).replace('#include <begin_vertex>', LIVING.v);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', LIVING.fp).replace('#include <emissivemap_fragment>', LIVING.f);
    };
    m.customProgramCacheKey = () => 'living';
    return m;
  }
  // a model from a file (glb.js) has no 'anim' numbers: its water is found by its colour (bluer than it is red, and not
  // greener than blue, as the pictures paint the sea, the pools and the falls), falling where its surface is steep, lying
  // still where it is flat; the same clock as the board's
  const MODEL_WATER = {
    vp: '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;',
    v: `#include <begin_vertex>
      vWP = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
      vWN = normalize( mat3( modelMatrix ) * objectNormal );`,
    fp: '#include <common>\nuniform float uTime;\nvarying vec3 vWP;\nvarying vec3 vWN;',
    f: `#include <map_fragment>
      {
        vec3 c = diffuseColor.rgb;
        float wet = smoothstep( 0.1, 0.24, c.b - c.r ) * smoothstep( -0.06, 0.04, c.b - c.g );
        float steep = 1.0 - smoothstep( 0.5, 0.8, abs( normalize( vWN ).y ) );
        float fall = wet * steep, pool = wet * ( 1.0 - steep );
        // falling water: bright streaks run down it, two sets at their own speeds
        float s1 = fract( vWP.y * 10.0 + uTime * 2.4 + sin( vWP.x * 41.0 + vWP.z * 37.0 ) * 0.45 );
        float s2 = fract( vWP.y * 6.0 + uTime * 1.7 + sin( vWP.x * 23.0 - vWP.z * 29.0 ) * 0.6 );
        float streak = max( smoothstep( 0.62, 1.0, s1 ), 0.7 * smoothstep( 0.7, 1.0, s2 ) );
        diffuseColor.rgb = mix( c, vec3( 0.88, 0.96, 1.0 ), fall * 0.6 * streak );
        totalEmissiveRadiance += vec3( 0.12, 0.14, 0.15 ) * fall * streak;
        // still water: little waves glitter in the sun
        float w1 = sin( vWP.x * 21.0 + uTime * 1.2 + sin( vWP.z * 8.0 + uTime * 0.6 ) * 1.7 );
        float w2 = sin( vWP.z * 17.0 - uTime * 0.95 + sin( vWP.x * 6.5 - uTime * 0.4 ) * 1.4 );
        diffuseColor.rgb *= 1.0 + pool * 0.12 * ( w1 * 0.5 - 0.25 );
        totalEmissiveRadiance += vec3( 0.16, 0.19, 0.2 ) * smoothstep( 0.55, 0.95, w1 * w2 ) * pool;
        #ifdef LAVA
          // a volcano's lava (orange, as no gold or sand is): it glows, and the glow wanders along its cracks
          float hot = smoothstep( 0.35, 0.6, c.r - c.b ) * smoothstep( 0.06, 0.16, c.g ) * ( 1.0 - smoothstep( 0.42, 0.55, c.g ) );
          float flick = 0.6 + 0.4 * sin( uTime * 2.3 + vWP.y * 9.0 + sin( vWP.x * 13.0 + uTime * 0.7 ) * 1.5 );
          totalEmissiveRadiance += vec3( 1.0, 0.42, 0.08 ) * hot * flick * 0.9;
        #endif
      }`
  };
  const modelWaterPatch = sh => {
    sh.uniforms.uTime = U.time;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', MODEL_WATER.vp).replace('#include <begin_vertex>', MODEL_WATER.v);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', MODEL_WATER.fp).replace('#include <map_fragment>', MODEL_WATER.f);
  };
  const modelWaterKey = () => 'modelwater', modelLavaKey = () => 'modellava';
  // (lava only where the model says it has some: elsewhere an orange sail would glow)
  function modelWater(m, lava) {
    m.onBeforeCompile = modelWaterPatch;
    m.customProgramCacheKey = lava ? modelLavaKey : modelWaterKey;
    if (lava) m.defines = Object.assign({}, m.defines, { LAVA: '' });
    return m;
  }

  // the land's grain: a small noise picture that tiles (its lattice wraps round), at a few sizes summed
  function detailTexture() {
    const N = 128, cv = document.createElement('canvas'), x = cv.getContext('2d');
    cv.width = cv.height = N;
    const im = x.createImageData(N, N), oct = [[8, 0.42], [16, 0.28], [32, 0.18], [64, 0.12]];
    const lat = oct.map(([f], o) => { const r = Models.rng(f * 13 + o); return Float32Array.from({ length: f * f }, () => r()); });
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      let v = 0;
      oct.forEach(([f, a], o) => {
        const L = lat[o], u = i / N * f, w = j / N * f, i0 = Math.floor(u), j0 = Math.floor(w), su = smooth(0, 1, u - i0), sw = smooth(0, 1, w - j0);
        const g = (a2, b2) => L[(b2 % f) * f + (a2 % f)];
        v += a * (g(i0, j0) * (1 - su) * (1 - sw) + g(i0 + 1, j0) * su * (1 - sw) + g(i0, j0 + 1) * (1 - su) * sw + g(i0 + 1, j0 + 1) * su * sw);
      });
      const c = Math.round(clamp(v, 0, 1) * 255), k = (j * N + i) * 4;
      im.data[k] = im.data[k + 1] = im.data[k + 2] = c; im.data[k + 3] = 255;
    }
    x.putImageData(im, 0, 0);
    const t = new T.CanvasTexture(cv);
    t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = maxAniso;
    return t;
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
    U.detail.value = detailTexture();
    mats = {
      scenery: living(new T.MeshLambertMaterial({ vertexColors: true })),
      cloud: new T.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.86 }),
      wing: new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide }),
      plinthTop: new T.MeshLambertMaterial({ color: 0x4a2e1a }),
      plinthSide: new T.MeshLambertMaterial({ color: 0x6b4528 }),
      gold: new T.MeshLambertMaterial({ color: 0xe0ad45 }),
      stone: new T.MeshLambertMaterial({ vertexColors: true }),
      pole: new T.MeshLambertMaterial({ color: 0x4a3020 })
    };
    ownerMats = SEAT_COLORS.map(c => new T.MeshLambertMaterial({ color: c }));
  }
  // a place's frame: its model's (x, z) are turned and scaled onto the board, its shapes go into the relief there, and
  // its ground (in its model's units of height) is the relief's
  function frameOf(cx, cz, yaw, [sx, sy, sz]) {
    const cs = Math.cos(yaw), sn = Math.sin(yaw), sr = (sx + sz) / 2;
    const W = (x, z) => [cx + x * sx * cs + z * sz * sn, cz - x * sx * sn + z * sz * cs];
    return {
      cx, cz, yaw, sy,
      peak(x, z, r, h, seed) { const [a, b] = W(x, z); Terrain.peak(a, b, r * sr * 1.15, h * sy, seed); },
      hill(x, z, rx, rz, h, rot = 0) { const [a, b] = W(x, z); Terrain.hill(a, b, rx * sx, rz * sz, h * sy, yaw + rot); },
      mesa(x, z, rx, rz, h, edge = 0.3, rot = 0) { const [a, b] = W(x, z); Terrain.mesa(a, b, rx * sx, rz * sz, h * sy, edge, yaw + rot); },
      ridge(x1, z1, x2, z2, w, h) { const [a, b] = W(x1, z1), [c, d] = W(x2, z2); Terrain.ridge(a, b, c, d, w * sr, h * sy); },
      dig(x1, z1, x2, z2, w, d, water) { const [a, b] = W(x1, z1), [c, e] = W(x2, z2); Terrain.dig(a, b, c, e, w * sr, d * sy, water); },
      lake(x, z, rx, rz, d, rot = 0, sea = false) { const [a, b] = W(x, z); Terrain.lake(a, b, rx * sx, rz * sz, d * sy, yaw + rot, sea); },
      pad(x, z, r) { const [a, b] = W(x, z); Terrain.pad(a, b, r * sr); },
      path(x1, z1, x2, z2, w, color) { const [a, b] = W(x1, z1), [c, d] = W(x2, z2); Terrain.path(a, b, c, d, w * sr, color); },
      tint(color, snow = 9, spread) { Terrain.tint(cx, cz, color, snow, spread); },
      ground(x, z) { const [a, b] = W(x, z); return Terrain.height(a, b) / sy; },
      // a point of the place, h (its units) above its land, on the board
      at(x, z, h = 0) { const [a, b] = W(x, z); return new T.Vector3(a, Terrain.height(a, b) + h * sy, b); }
    };
  }
  // made in steps (each yield is a pause where the page may do other things): see prepare()
  function* buildStatic() {
    worldBuilt = wantWorld();
    MOD = worldBuilt === 'sea' ? SeaModels : Models;
    Terrain.setWorld(MOD.world);
    scene.fog.color.set(MOD.world === 'sea' ? SEA_HAZE : HAZE);
    hemi.groundColor.set(MOD.world === 'sea' ? 0x4f8aa0 : 0x8a6a48);
    root = new T.Group();
    scene.add(root);
    landG = new T.Group();                                  // all that grows out of the board when a game starts
    root.add(landG);
    // the plinth with a gold rim, standing in the meadow; open in the middle, where the land lies (its lakes and river
    // beds go deeper than the plinth's top)
    const pl = new T.Mesh(slabGeo(S + 0.9, S + 0.9, 0.5, 0.35, 0.06, 2 * Terrain.RIM + 0.1), [mats.plinthTop, mats.plinthSide]);
    pl.position.y = -0.5; pl.receiveShadow = true; pl.castShadow = true; root.add(pl);
    const rim = new T.Mesh(slabGeo(S + 0.98, S + 0.98, 0.07, 0.38, 0.02, S + 0.62), mats.gold);
    rim.position.y = -0.02; root.add(rim);
    yield;
    // the squares
    const geoP = slabGeo(TW - 0.06, D - 0.06, TH, 0.07, 0.03), geoC = slabGeo(C - 0.06, C - 0.06, TH, 0.1, 0.03);
    drawnWithFonts = fontsReady();
    for (let i = 0; i < 40; i++) {
      yield;
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
      if (!(i % 10)) {
        const cg = MOD.corner(i);
        if (cg) { const cm = new T.Mesh(cg, mats.scenery); cm.position.set(0, TH, 0); m.add(cm); cm.castShadow = true; cm.receiveShadow = true; cm.userData.i = i; lotMesh[i] = cm; }
      }
    }
    // the land's shape: every place makes its own piece of the relief, the ring's inside corners theirs, the great
    // mountain the middle; the waterfall comes last, when the cliff it falls from is there
    for (let i = 0; i < 40; i++) {
      if (!(i % 10)) continue;
      const c = toWorld(i, 0, -(D / 2 + LOT / 2));
      lotF[i] = frameOf(c.x, c.z, yawOf(sideOf(i)), LS);
      MOD.relief(i, lotF[i]);
    }
    for (let k = 0; k < 4; k++) {
      const [ox, oz] = OUT[k], [ax, az] = ALONG[k], a = S / 2 - D - LOT / 2;
      ringF[k] = frameOf(ox * a - ax * a, oz * a - az * a, yawOf(k), RS);
      MOD.ringRelief(k, ringF[k]);
    }
    MOD.centerRelief(Terrain);
    fallFoot = MOD.centerWater(Terrain);
    yield;
    const lg = yield* Terrain.board(mobile ? 136 : 160);
    const land = new T.Mesh(lg, mats.scenery);
    land.castShadow = true; land.receiveShadow = true; land.userData.ground = true;
    landG.add(land); lotGround.push(land);
    lg.computeBoundingBox(); landTop = lg.boundingBox.max.y;
    const wg = Terrain.waterGeo();
    if (wg) { const wm = new T.Mesh(wg, mats.scenery); wm.receiveShadow = true; landG.add(wm); }
    yield;
    // the archipelago's lagoon: not part of the land that grows (the islands rise out of it)
    if (MOD.world === 'sea') { seaMesh = new T.Mesh(yield* Terrain.seaGeo(mobile ? 72 : 96), mats.scenery); seaMesh.receiveShadow = true; root.add(seaMesh); yield; }
    // what stands on the land: each lot's scenery, set on its own ground
    for (let i = 0; i < 40; i++) {
      if (!(i % 10)) continue;
      yield;
      const F = lotF[i], g = MOD.lot(i, F.ground);
      if (!g) continue;
      g.scale(LS[0], LS[1], LS[2]);
      const m = new T.Mesh(g, mats.scenery);
      m.position.set(F.cx, 0, F.cz); m.rotation.y = F.yaw;
      m.castShadow = true; m.receiveShadow = true; m.userData.i = i;
      landG.add(m); lotMesh[i] = m;
    }
    // the places with a model of their own (from a file): each stands in its water when it has been read
    if (MOD.models && typeof GLB !== 'undefined' && GLB) for (const i of Object.keys(MOD.models)) placeModel(+i, MOD.models[i]);
    // the inside corners of the ring
    for (let k = 0; k < 4; k++) {
      yield;
      const F = ringF[k], g = MOD.inner(k, F.ground);
      g.scale(RS[0], RS[1], RS[2]);
      const m = new T.Mesh(g, mats.scenery);
      m.position.set(F.cx, 0, F.cz); m.rotation.y = F.yaw; m.castShadow = true; m.receiveShadow = true;
      landG.add(m); lotMesh[100 + k] = m;
    }
    // the middle's own model, when there is one (then nothing is made for it here)
    if (MOD.centerModel && typeof GLB !== 'undefined' && GLB) { placeCenter(MOD.centerModel); landTop = Math.max(landTop, MOD.centerModel.top); }
    // the great mountain's church, village, forest and lake shore
    const ctr = MOD.center(Terrain.height);
    for (const step of ctr.steps) { yield; step(); }
    yield;
    const cm = new T.Mesh(ctr.B.build(), mats.scenery);
    cm.castShadow = true; cm.receiveShadow = true;
    landG.add(cm);
    yield;
    // the country around the board: meadows, groves, hills, and the far mountains in the haze
    const om = new T.Mesh(Terrain.outer(mobile ? 34 : 42, mobile ? 80 : 104), mats.scenery);
    om.receiveShadow = true;
    root.add(om);
    if (MOD.far) { const fm = new T.Mesh(MOD.far(), mats.scenery); root.add(fm); }       // the islands far off in the ocean
    yield;
    const spots = Terrain.groves(mobile ? 320 : 520);
    for (const pine of [true, false]) {
      const list = spots.filter(s => s.pine === pine);
      if (!list.length) continue;
      const im = new T.InstancedMesh(Models.grove(pine), mats.scenery, list.length);       // (the land's only)
      list.forEach((s, k) => { O.position.set(s.x, s.y, s.z); O.rotation.set(0, s.ry, 0); O.scale.setScalar(s.s); O.updateMatrix(); im.setMatrixAt(k, O.matrix); });
      im.frustumCulled = false;                             // its copies are all around the board, not where its shape is
      root.add(im);
      yield;
    }
    buildingMeshes();
    yield;
    if (MOD.world === 'land') millWheel();
    yield;
    yield* buildLife();
  }
  // a place's model from its file, set in the lot's frame with its water line on the sea's (if the board is made again
  // before the file is read, the new board asks for its own)
  function placeModel(i, d) {
    const F = lotF[i], land = landG;
    GLB.load(d.url).then(({ geometry, material }) => {
      if (landG !== land || !F) return;
      geometry.userData.keep = material.userData.keep = true;           // (kept for a board made again)
      modelWater(material);
      const g = new T.Group(), p = F.at(d.x || 0, d.z || 0, 0);
      g.position.set(p.x, Terrain.SEA_Y + (d.y || 0), p.z); g.rotation.y = F.yaw + (d.ry || 0); g.scale.setScalar((d.s || 1) * TW);
      const m = new T.Mesh(geometry, material);
      m.castShadow = true; m.receiveShadow = true; m.userData.i = i; m.userData.model = true;
      g.add(m); landG.add(g);
      if (!lotMesh[i]) lotMesh[i] = m;
      if (mark[i] && mark[i].m) setMort(i, true, false);
      shadowDirty = true;
      Diag.note('3d', `model ${d.url}: ${geometry.index ? geometry.index.count / 3 : 0} triangles`);
    }).catch(e => Diag.note('3d', `model ${d.url} not read: ${e && e.message}`));
  }
  // the middle's model: in the board's middle, its water line on the sea's, made lower by sy
  function placeCenter(d) {
    const land = landG;
    GLB.load(d.url).then(({ geometry, material }) => {
      if (landG !== land) return;
      geometry.userData.keep = material.userData.keep = true;
      modelWater(material, d.lava);
      const m = new T.Mesh(geometry, material);
      m.position.set(0, Terrain.SEA_Y, 0); m.rotation.y = d.ry || 0; m.scale.set(d.s, d.s * (d.sy || 1), d.s);
      m.castShadow = true; m.receiveShadow = true;
      landG.add(m);
      shadowDirty = true;
      Diag.note('3d', `model ${d.url}: ${geometry.index ? geometry.index.count / 3 : 0} triangles`);
    }).catch(e => Diag.note('3d', `model ${d.url} not read: ${e && e.message}`));
  }
  // the mill's wheel turns, between the mill and its stream
  function millWheel() {
    const WB = new Models.Builder();
    WB.add(new T.TorusGeometry(0.1, 0.014, 5, 14), 0x4a3020);
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; WB.add(new T.BoxGeometry(0.02, 0.09, 0.05), 0x7a5232, Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0, { rz: a }); }
    const wm = new T.Mesh(WB.build(), mats.scenery);
    wm.rotation.y = Math.PI / 2; wm.castShadow = true;
    wheel = new T.Group(); wheel.add(wm);
    wheel.position.copy(lotF[12].at(0.17, -0.11, 0)); wheel.position.y += 0.1; wheel.rotation.y = yawOf(1);
    landG.add(wheel);
  }

  // ===== life on the board =====
  // Smoke, sparkles and spray are points that the shader moves by itself (one draw for all of them). The rest are actors:
  // camels, sheep, guards, boats, the cable car, the customs bar, clouds and eagles, a few copies of a few shapes, put in
  // place every frame that is drawn. While a game rises out of the board they are not there yet; then they fade in.
  const life = { ready: false, groups: [], pts: null };
  const POSE = { p: new T.Vector3(), yaw: 0, roll: 0, pitch: 0, s: 1 }, FLIPZ = new T.Matrix4().makeScale(1, 1, -1), _w = new T.Matrix4(), _lm = new T.Matrix4();
  const PTS = {
    v: `attribute float kind;
      attribute float seed;
      uniform float uTime;
      uniform float uFade;
      uniform float uScale;
      varying float vA;
      varying float vK;
      varying float vR;
      void main() {
        vec3 p = position;
        vR = uTime * 2.3 + seed * 20.0;
        float a = 1.0, size = 0.05;
        if ( kind < 0.5 ) {
          // smoke: puffs rise, drift with the wind, grow and thin out
          float t = fract( uTime * 0.15 + seed );
          p += vec3( 0.2 * t + 0.025 * sin( uTime * 1.3 + seed * 30.0 ), 0.6 * t, 0.07 * t + 0.025 * cos( uTime * 1.1 + seed * 20.0 ) );
          size = 0.05 + 0.15 * t;
          a = smoothstep( 0.0, 0.1, t ) * ( 1.0 - t ) * 0.5;
        } else if ( kind < 2.5 ) {
          // sparkles: gold over treasure, white over the cards, twinkling
          float an = seed * 6.2832;
          p += vec3( cos( an ) * 0.13, 0.03 * sin( uTime * 0.8 + an ) + 0.08 * fract( seed * 7.3 ), sin( an ) * 0.11 );
          a = pow( max( sin( uTime * 2.2 + seed * 41.0 ), 0.0 ), 6.0 );
          size = 0.05 + 0.06 * a;
        } else if ( kind < 3.5 ) {
          // spray where the waterfall lands
          float t = fract( uTime * 0.33 + seed ), an = seed * 37.0;
          p += vec3( cos( an ) * 0.22 * t, 0.22 * t, sin( an ) * 0.18 * t );
          size = 0.07 + 0.2 * t;
          a = ( 1.0 - t ) * smoothstep( 0.0, 0.1, t ) * 0.42;
        } else {
          // leaves drifting down from the trees, turning over
          float t = fract( uTime * 0.11 + seed ), an = seed * 43.0;
          p += vec3( cos( an ) * 0.09 + 0.14 * t + 0.03 * sin( uTime * 1.7 + seed * 9.0 ), -0.3 * t, sin( an ) * 0.09 + 0.03 * cos( uTime * 1.3 + seed * 7.0 ) );
          size = 0.04;
          a = smoothstep( 0.0, 0.08, t ) * ( 1.0 - smoothstep( 0.82, 1.0, t ) );
        }
        vA = a * uFade;
        vK = kind;
        vec4 mv = modelViewMatrix * vec4( p, 1.0 );
        gl_Position = projectionMatrix * mv;
        gl_PointSize = size * uScale / max( 0.1, -mv.z );
      }`,
    f: `varying float vA;
      varying float vK;
      varying float vR;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length( c ), a;
        vec3 col;
        if ( vK < 0.5 ) { a = 1.0 - smoothstep( 0.12, 0.5, d ); col = vec3( 0.92, 0.92, 0.9 ); }
        else if ( vK < 2.5 ) {
          float star = max( ( 1.0 - smoothstep( 0.0, 0.09, abs( c.x ) ) ) * ( 1.0 - smoothstep( 0.0, 0.5, abs( c.y ) ) ),
                            ( 1.0 - smoothstep( 0.0, 0.09, abs( c.y ) ) ) * ( 1.0 - smoothstep( 0.0, 0.5, abs( c.x ) ) ) );
          a = max( star, 1.0 - smoothstep( 0.0, 0.25, d ) );
          col = vK < 1.5 ? vec3( 1.0, 0.85, 0.42 ) : vec3( 1.0 );
        } else if ( vK < 3.5 ) { a = ( 1.0 - smoothstep( 0.0, 0.5, d ) ) * 0.8; col = vec3( 0.88, 0.94, 1.0 ); }
        else {
          float ca = cos( vR ), sa = sin( vR );
          vec2 q = vec2( c.x * ca - c.y * sa, c.x * sa + c.y * ca ) * vec2( 1.0, 2.0 + 1.2 * sin( vR * 0.7 ) );
          a = 1.0 - smoothstep( 0.3, 0.4, length( q ) );
          col = mix( vec3( 0.85, 0.42, 0.12 ), vec3( 0.95, 0.76, 0.22 ), fract( vR * 0.37 ) );
        }
        a *= vA;
        if ( a < 0.01 ) discard;
        gl_FragColor = vec4( col, a );
      }`
  };
  // a way between two points of a place (its units), sampled on the land once
  function wayOf(P, a, b, n = 16) {
    const pts = [];
    for (let j = 0; j <= n; j++) { const t = j / n; pts.push(P(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)); }
    return { pts, n, yaw: Math.atan2(-(pts[n].z - pts[0].z), pts[n].x - pts[0].x), len: Math.hypot(b[0] - a[0], b[1] - a[1]) };
  }
  function onWay(w, u, out) { const f = clamp(u, 0, 1) * w.n, j = Math.min(w.n - 1, Math.floor(f)); return out.lerpVectors(w.pts[j], w.pts[j + 1], f - j); }
  const thereAndBack = u => { const c = u % 2; return c < 1 ? c : 2 - c; };
  // one actor: where it is at time t (its shape faces +x)
  function actorOf(a, at, F, tile, ph) {
    const s = a.s != null ? a.s : tile >= 0 ? 1 : 1.18, onTile = () => (tile >= 0 && tiles[tile] ? tiles[tile].position.y : 0);
    const yaw0 = (F ? F.yaw : tile >= 0 ? yawOf(sideOf(tile)) : 0) + (a.ry || 0);
    // a point on the water there (the sea's, a lake's or a river's level)
    const water = (x, z) => { const p = at(x, z), w = Terrain.waterAt(p.x, p.z); if (w != null) p.y = w; return p; };
    if (a.moor) {                                            // a ship at anchor: it rides the swell, swinging on its cable
      const p = water(a.at[0], a.at[1]);
      return { k: a.k, up(t, o) {
        o.p.copy(p); o.p.y += 0.006 * Math.sin(t * 1.4 + ph);
        o.yaw = yaw0 + 0.12 * Math.sin(t * 0.13 + ph); o.roll = 0.05 * Math.sin(t * 1.1 + ph); o.pitch = 0.03 * Math.sin(t * 0.9 + ph * 1.3); o.s = s;
      } };
    }
    if (a.orbit) {                                           // sailing round and round (a ship), or drawn round (the whirlpool's barrels)
      const n = 72, ring = [], w = a.w || 0.1;
      for (let j = 0; j <= n; j++) { const th = j / n * TAU; ring.push(water(a.at[0] + Math.cos(th) * a.r, a.at[1] + Math.sin(th) * a.r)); }
      return { k: a.k, up(t, o) {
        const th = ((t * w + (a.phase || 0)) % TAU + TAU) % TAU, f = th / TAU * n, j = Math.min(n - 1, Math.floor(f));
        o.p.lerpVectors(ring[j], ring[j + 1], f - j);
        o.yaw = Math.atan2(-(ring[j + 1].z - ring[j].z), ring[j + 1].x - ring[j].x) + (w < 0 ? Math.PI : 0);
        o.p.y += 0.005 * Math.sin(t * 1.5 + ph); o.roll = 0.05 * Math.sin(t * 1.2 + ph); o.s = s;
      } };
    }
    if (a.bob) {                                             // floating: it bobs and drifts a little
      const p = water(a.at[0], a.at[1]);
      return { k: a.k, up(t, o) {
        o.p.copy(p); o.p.x += 0.03 * Math.sin(t * 0.3 + ph); o.p.z += 0.02 * Math.cos(t * 0.37 + ph); o.p.y += 0.008 * Math.sin(t * 2.1 + ph);
        o.yaw = yaw0 + 0.4 * Math.sin(t * 0.2 + ph); o.roll = 0.25 * Math.sin(t * 1.7 + ph); o.s = s;
      } };
    }
    if (a.spin) {                                            // turning where it is: a windmill's sails (about x), a whirlpool (about y)
      const p = a.axis === 'x' ? at(a.at[0], a.at[1], a.h || 0) : water(a.at[0], a.at[1]);
      return { k: a.k, up(t, o) {
        o.p.copy(p); o.p.y += onTile();
        if (a.axis === 'x') { o.yaw = yaw0; o.roll = t * a.spin; } else o.yaw = yaw0 + t * a.spin;
        o.s = s;
      } };
    }
    if (a.sway) {                                            // rising and curling: the kraken's arms
      const p = at(a.at[0], a.at[1], 0), q0 = a.phase || 0;
      return { k: a.k, up(t, o) {
        const q = t * 0.9 + q0;
        o.p.copy(p); o.p.y += onTile();
        o.yaw = yaw0 + 0.35 * Math.sin(q * 0.5); o.pitch = 0.25 * Math.sin(q); o.roll = 0.15 * Math.sin(q * 0.7 + 1);
        o.s = s * (0.85 + 0.15 * Math.sin(q * 0.6 + 2));
      } };
    }
    if (a.jump) {                                            // a dolphin: three leaps on its way, then under the water back again
      const A = water(a.at[0], a.at[1]), B2 = water(a.b[0], a.b[1]), yaw = Math.atan2(-(B2.z - A.z), B2.x - A.x), per = 9;
      return { k: a.k, up(t, o) {
        const q = ((t / per + (a.phase || 0)) % 1 + 1) % 1, lq = (q * 3) % 1;
        o.p.lerpVectors(A, B2, q);
        if (lq < 0.4) { const j = lq / 0.4; o.p.y = A.y - 0.04 + 0.22 * s * Math.sin(Math.PI * j); o.pitch = 1.1 * Math.cos(Math.PI * j); }
        else { o.p.y = A.y - 0.25; o.pitch = 0; }
        o.yaw = yaw; o.s = s;
      } };
    }
    if (a.k === 'sheep') {                                   // grazing round and round, stopping now and then
      const n = 24, ring = [];
      for (let j = 0; j <= n; j++) { const t = j / n * TAU; ring.push(at(a.at[0] + Math.cos(t) * a.r, a.at[1] + Math.sin(t) * a.r)); }
      return { k: 'sheep', up(t, o) {
        const th = ((t * 0.2 + ph + 0.7 * Math.sin(t * 0.27 + ph)) % TAU + TAU) % TAU, f = th / TAU * n, j = Math.min(n - 1, Math.floor(f));
        o.p.lerpVectors(ring[j], ring[j + 1], f - j);
        o.yaw = Math.atan2(-(ring[j + 1].z - ring[j].z), ring[j + 1].x - ring[j].x); o.s = s;
      } };
    }
    if (a.k === 'bar') {                                     // the customs barrier: up, a while, down again
      const p = at(a.at[0], a.at[1], a.h);
      return { k: 'bar', up(t, o) {
        const c = (t * 0.12 + ph) % 1, up = c < 0.1 ? smooth(0, 0.1, c) : c < 0.42 ? 1 : c < 0.52 ? 1 - smooth(0.42, 0.52, c) : 0;
        o.p.copy(p); o.yaw = F.yaw; o.pitch = up * 1.2; o.s = 1.18;
      } };
    }
    if (a.k === 'gondola') {                                 // up the cable to the fortress and down again
      const [A, B] = a.cable.map(([x, h, z]) => at(x, z, h)), yaw = Math.atan2(-(B.z - A.z), B.x - A.x);
      return { k: 'gondola', up(t, o) {
        const e = 0.08 + 0.84 * smooth(0, 1, thereAndBack(t * 0.05 + ph));
        o.p.lerpVectors(A, B, e); o.yaw = yaw; o.roll = 0.05 * Math.sin(t * 1.6 + ph); o.s = 1.18;
      } };
    }
    // walking, patrolling, sailing: there and back (into the tunnel: one way, again and again)
    const boat = a.k === 'boat';
    const P = boat ? (x, z) => { const p = at(x, z), w = Terrain.waterAt(p.x, p.z); p.y = w != null ? w - 0.004 : p.y + 0.008; return p; }   // a lake's level, or a river's
      : a.tunnel ? (x, z) => { const p = at(x, z); if (z < -0.06) p.y = at(x, -0.06).y; return p; }
      : (x, z) => at(x, z, a.h || 0);
    const way = wayOf(P, a.a, a.b), per = Math.max(1, way.len / (a.speed || 0.05)), k = boat && a.sail ? 'sail' : a.k, start = a.phase != null ? a.phase : ph;
    return { k, up(t, o) {
      const q = t / per + start;
      if (a.tunnel) {
        const u = q % 1;
        onWay(way, u, o.p); o.yaw = way.yaw; o.s = s * clamp(Math.min(u / 0.05, (1 - u) / 0.03), 0, 1);
      } else {
        const c = q % 2, fwd = c < 1;
        onWay(way, smooth(0, 1, fwd ? c : 2 - c), o.p); o.yaw = way.yaw + (fwd ? 0 : Math.PI); o.s = s;
      }
      if (boat) { o.p.y += 0.004 * Math.sin(t * 1.9 + ph); o.roll = 0.07 * Math.sin(t * 1.3 + ph); }
      else o.p.y += Math.abs(Math.sin(t * 7 + ph)) * 0.005 * s;
      o.p.y += onTile();
    } };
  }
  function* buildLife() {
    const P = [], K = [], Sd = [], groups = {}, rnd = Models.rng(4242);
    const emit = (p, kind, n) => { const o = rnd(); for (let j = 0; j < n; j++) { P.push(p.x, p.y, p.z); K.push(kind); Sd.push(kind ? rnd() : ((j + o) / n) % 1); } };
    const add = a => (groups[a.k] || (groups[a.k] = [])).push(a);
    // a bird circling a point (an eagle round the summit, gulls round the volcano and the lighthouse): its wings flap, then
    // it glides; the wing on the inside dips as it banks
    const circler = (cx, cy, cz, r, w, a0, ph, sc) => {
      const dir = Math.sign(w) || 1, [body, wing] = MOD.BIRD || ['eagle', 'wing'];
      const e = { k: body, M: new T.Matrix4(), flap: 0, mat(t, m4, f) {
        const a = a0 + w * t, vx = -Math.sin(a) * dir, vz = Math.cos(a) * dir, yaw = Math.atan2(-vz, vx);
        const inward = Math.sin(yaw) * -Math.cos(a) + Math.cos(yaw) * -Math.sin(a);
        O.position.set(cx + Math.cos(a) * r, cy + 0.12 * Math.sin(t * 0.37 + ph), cz + Math.sin(a) * r);
        O.rotation.set(0.3 * Math.sign(inward), yaw, 0, 'YXZ'); O.scale.setScalar(Math.max(1e-4, sc * f)); O.updateMatrix();
        e.M.copy(O.matrix); m4.copy(e.M);
        const beat = smooth(-0.3, 0.5, Math.sin(t * 0.55 + ph));
        e.flap = 0.1 + beat * 0.55 * Math.sin(t * 6.5 + ph);
      } };
      add(e);
      for (const side of [1, -1]) add({ k: wing, mat(t, m4) { _w.makeRotationX(-e.flap); if (side < 0) _w.premultiply(FLIPZ); m4.multiplyMatrices(e.M, _w); } });
    };
    for (let i = 0; i < 40; i++) {
      const fx = MOD.fx(i);
      if (!fx) continue;
      const F = lotF[i] || null, tile = i % 10 ? -1 : i;
      const at = tile >= 0 ? (x, z, h = 0) => toWorld(i, x, z, TH + h) : (x, z, h = 0) => F.at(x, z, h);
      for (const [x, z, h] of fx.smoke || []) emit(at(x, z, h), 0, 7);
      for (const [x, z, h, kind] of fx.sparkle || []) emit(at(x, z, h), kind, 4);
      for (const [x, z, h] of fx.leaves || []) emit(at(x, z, h), 4, 5);
      for (const a of fx.actors || []) add(actorOf(a, at, F, tile, rnd() * 20));
      for (const b of fx.birds || []) { const c = at(b.at[0], b.at[1], b.h); circler(c.x, c.y, c.z, b.r, b.w, rnd() * 6, rnd() * 9, 0.9); }
    }
    yield;
    // the great mountain: smoke over the village, spray where the waterfall lands, sheep on the church's hill,
    // clouds round the summit and two eagles circling it
    const CF = MOD.CENTER_FX, ground = (x, z, h = 0) => new T.Vector3(x, Terrain.height(x, z) + h, z);
    for (const [x, z, h] of CF.smoke) emit(ground(x, z, h), 0, 7);
    if (fallFoot) emit(new T.Vector3(fallFoot[0], fallFoot[1] + 0.02, fallFoot[2]), 3, 16);
    else for (const [x, z, h] of CF.mist) emit(ground(x, z, h), 3, 16);
    for (const [x, z] of CF.sheep) add(actorOf({ k: 'sheep', at: [x, z], r: 0.09, s: 1.35 }, (xx, zz) => ground(xx, zz), null, -1, rnd() * 20));
    for (const a of CF.actors || []) add(actorOf(a, ground, null, -1, rnd() * 20));
    const [px, pz] = MOD.CENTER.peak, isl = MOD.world === 'sea';       // the volcano's clouds: fewer, smaller and higher
    for (let k = 0; k < (isl ? 3 : 4); k++) {
      const r = (isl ? 1.45 : 1.0) + 0.3 * (k % 2) + 0.08 * k, h = landTop * (isl ? 0.86 + 0.08 * k : 0.56 + 0.06 * k), w = 0.045 + 0.012 * k, a0 = k * 1.7, cs = (isl ? 0.4 : 0.6) + 0.12 * (k % 3), ph = k * 2.1;
      add({ k: 'cloud', up(t, o) { const a = a0 + w * t; o.p.set(px + Math.cos(a) * r, h + 0.05 * Math.sin(t * 0.3 + ph), pz + Math.sin(a) * r); o.yaw = -a - Math.PI / 2; o.s = cs; } });
    }
    if (CF.birds) for (const [k, b] of CF.birds.entries()) circler(b.at[0], b.h, b.at[1], b.r, b.w, k * 2.6, k * 3.7, 1.2);
    else for (let k = 0; k < 2; k++) circler(px, landTop * [0.8, 0.64][k], pz, [1.7, 2.35][k], [0.24, -0.18][k], k * 2.6, k * 3.7, 1.3);   // two eagles round the summit
    yield;
    for (const k of MOD.LIFE) {
      const list = groups[k];
      if (!list) continue;
      const im = new T.InstancedMesh(MOD.actor(k), k === 'cloud' ? mats.cloud : k === 'wing' || k === 'gwing' ? mats.wing : mats.scenery, list.length);
      im.frustumCulled = false; im.receiveShadow = k !== 'cloud';
      root.add(im);
      life.groups.push({ k, mesh: im, list });
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(P, 3));
    g.setAttribute('kind', new T.Float32BufferAttribute(K, 1));
    g.setAttribute('seed', new T.Float32BufferAttribute(Sd, 1));
    const pm = new T.ShaderMaterial({ uniforms: { uTime: U.time, uFade: U.fade, uScale: U.scale }, vertexShader: PTS.v, fragmentShader: PTS.f, transparent: true, depthWrite: false });
    life.pts = new T.Points(g, pm);
    life.pts.frustumCulled = false; life.pts.renderOrder = 2;
    root.add(life.pts);
    life.ready = true;
    lifeStep(0);
  }
  // everything alive put in its place for time t
  function lifeStep(t) {
    if (!life.ready) return;
    const f = U.fade.value, on = f > 0.003;
    for (const g of life.groups) {
      g.mesh.visible = on;
      if (!on) continue;
      for (let k = 0; k < g.list.length; k++) {
        const a = g.list[k];
        if (a.mat) a.mat(t, _lm, f);
        else {
          POSE.yaw = POSE.roll = POSE.pitch = 0; POSE.s = 1;
          a.up(t, POSE);
          O.position.copy(POSE.p); O.rotation.set(POSE.roll, POSE.yaw, POSE.pitch, 'YXZ'); O.scale.setScalar(Math.max(1e-4, POSE.s * f)); O.updateMatrix();
          _lm.copy(O.matrix);
        }
        g.mesh.setMatrixAt(k, _lm);
      }
      g.mesh.instanceMatrix.needsUpdate = true;
    }
    if (life.pts) life.pts.visible = on;
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
    cloth.position.set(0.012, 0.52, 0);
    cloth.userData.base = Float32Array.from(cg.attributes.position.array);
    g.add(cloth);
    const p = toWorld(i, 0.38, -(D / 2) + 0.03, 0.03);
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
    const tw = MOD.tower(), ca = MOD.castle();
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
    shadowLate = true;
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
  let dustGeo = null;
  function dust(p) {
    if (!ok) return;
    dustGeo = dustGeo || new T.IcosahedronGeometry(0.05, 0);
    for (let k = 0; k < 6; k++) {
      const m = new T.Mesh(dustGeo, new T.MeshBasicMaterial({ color: 0xe8dcc4, transparent: true, opacity: 0.8 }));
      const a = k * Math.PI / 3;
      m.position.set(p.x, TH + 0.04, p.z); root.add(m);
      tween(0.55, e => { m.position.set(p.x + Math.cos(a) * 0.25 * e, TH + 0.04 + 0.1 * e, p.z + Math.sin(a) * 0.25 * e); m.material.opacity = 0.8 * (1 - e); m.scale.setScalar(1 + e); }, ease.out).then(() => { root.remove(m); m.material.dispose(); });
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
    const lm = lotMesh[i];
    if (lm && lm.userData.model) {                         // a model from a file: its own material, greyed
      const u = lm.userData;
      if (!u.base) { u.base = lm.material; u.grey = modelWater(u.base.clone()); u.grey.color.multiplyScalar(0.55); u.grey.userData.keep = true; }
      lm.material = m ? u.grey : u.base;
    } else if (lm) lm.material = m ? (mats.mortScenery || (mats.mortScenery = living(new T.MeshLambertMaterial({ vertexColors: true, color: 0x8a8a8a })))) : mats.scenery;
    const f = flags[i];
    if (f && f.g.visible) {
      const to = topOf(k), from = f.cloth.position.y;
      if (anim) tween(0.5, e => { f.cloth.position.y = from + (to - from) * e; }); else f.cloth.position.y = to;
      f.cloth.material.color.set(SEAT_COLORS[k.o] || '#888');
      if (m) f.cloth.material.color.lerp(new T.Color(0x777777), 0.55);
    }
  }
  // a square's scenery jumps (bought, built on, landed on): a lot's leaves its land for a moment, a corner's stretches
  function pop(i, amt = 0.14) {
    const m = lotMesh[i];
    if (!m) return;
    if (!(i % 10)) tween(0.5, e => { m.scale.set(1, 1 + Math.sin(e * Math.PI) * amt, 1); }, ease.lin);
    else tween(0.5, e => { m.position.y = Math.sin(e * Math.PI) * amt * 0.8; }, ease.lin);
  }
  // a whole region has one owner: its lots jump one after another and confetti flies
  function celebrate(g, seat) {
    if (!ok) return;
    GROUP_TILES[g].forEach((i, k) => later(k * 0.18).then(() => { pop(i, 0.28); confetti(lotF[i] ? lotF[i].at(0, 0, 0.4) : toWorld(i, 0, -(D / 2 + LOT / 2), 0.6), seat); }));
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
  // In the archipelago a player is a little ship with sails of their colour, sailing along the board, their face at its
  // masthead.
  function makeToken(seat, hero) {
    const color = new T.Color(SEAT_COLORS[seat]), sea = MOD.world === 'sea', R0 = sea ? 0.13 : 0.24;
    const g = new T.Group();
    const ped = new T.Mesh(new T.CylinderGeometry(0.16, 0.19, sea ? 0.05 : 0.07, 24), new T.MeshLambertMaterial({ color }));
    ped.position.y = sea ? 0.025 : 0.035; ped.castShadow = true; ped.receiveShadow = true;
    g.add(ped);
    let hull = null;
    if (sea) {
      hull = new T.Group(); hull.rotation.order = 'YXZ'; hull.position.y = 0.05;
      const sm = new T.Mesh(MOD.tokenShip(SEAT_COLORS[seat]), mats.scenery);
      sm.castShadow = true; sm.scale.setScalar(1.15);
      hull.add(sm); g.add(hull);
    } else {
      const stem = new T.Mesh(new T.CylinderGeometry(0.03, 0.045, 0.14, 10), mats.gold);
      stem.position.y = 0.13; stem.castShadow = true;
      g.add(stem);
    }
    const face = new T.Group();
    face.rotation.order = 'YXZ';
    face.position.y = sea ? 0.8 : 0.43;
    goldRim = goldRim || new T.MeshLambertMaterial({ color: 0xd9a443 });
    const tx = texLoader().load(por(hero));
    tx.encoding = T.sRGBEncoding;
    const pm = new T.MeshLambertMaterial({ map: tx });
    const coinG = new T.CylinderGeometry(R0, R0, sea ? 0.04 : 0.06, 40);
    const coin = new T.Mesh(coinG, [goldRim, pm, goldRim]);
    coin.rotation.x = Math.PI / 2;
    coin.rotation.y = Math.PI / 2;           // the face upright
    coin.castShadow = true;
    const ring = new T.Mesh(new T.TorusGeometry(R0 + 0.005, sea ? 0.022 : 0.03, 8, 40), new T.MeshLambertMaterial({ color }));
    ring.position.z = 0.012;
    face.add(coin, ring);
    // the glow under whoever's turn it is
    const glow = new T.Mesh(new T.TorusGeometry(0.27, 0.035, 8, 40), new T.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.85 }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.02; glow.visible = false;
    g.add(face, glow);
    root.add(g);
    return { g, face, coin, pm, glow, hero, seat, hop: 0, hull };
  }
  function ensureTokens() {
    for (let s = 0; s < st.players.length; s++) {
      const p = st.players[s];
      if (!toks[s]) toks[s] = makeToken(s, p.hero);
      else if (toks[s].hero !== p.hero) {
        const tx = texLoader().load(por(p.hero)); tx.encoding = T.sRGBEncoding;
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
    shadowDirty = true;
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
    if (to % 10) pop(to, 0.05);                   // the place it came to stirs
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
    if (to % 10) pop(to, 0.05);
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
    // the haze begins beyond the board, wherever the camera is
    scene.fog.near = camS.d + 15; scene.fog.far = camS.d * 1.6 + 60;
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
    // overview: the whole board fits, and the mountain's top with it
    elOver = W > H ? 0.95 : 1.08; elFollow = W > H ? 0.74 : 0.8;
    const pts = [new T.Vector3(MOD.CENTER.peak[0], landTop + 0.2, MOD.CENTER.peak[1])];
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
    U.scale.value = H * R.getPixelRatio() / (2 * Math.tan(cam.fov * Math.PI / 360));      // points sized in the board's units
    distances();
    Dice3D.layout(W, H);
    shadowDirty = true;
    if (running) { R.shadowMap.needsUpdate = true; draw(0); }   // a resized canvas is blank until drawn: now, not a frame later
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
  // Quality follows the device. Frames drawn one after another (while something moves) that come too slowly make the
  // picture a step coarser, with fewer pixels. The step is taken in a quiet moment, when nothing moves, so that the
  // change itself is not seen as a jolt; and the shaders never change mid-game (rebuilding them stalls a phone).
  let last = 0, running = false, frame = 0, quality = 2, basePR = 1, shadowDirty = true, shadowLate = false, shadowAt = 0;
  let drewLast = false, busyAvg = 1 / 60, busyN = 0, prStep = 0, prNext = 0;
  let drewAt = 0, lostAt = 0, progN = 0;          // when a frame was last drawn; when the graphics were lost; shaders made
  const PR_STEPS = [1, 0.85, 0.72, 0.6];
  function adapt(real) {
    if (real > 0.25 || real <= 0) return;                // a hiccup (a tab switch), not the device
    busyAvg = busyAvg * 0.95 + real * 0.05;
    if (++busyN < 50 || busyAvg < 1 / 36 || prNext || prStep >= PR_STEPS.length - 1) return;
    const pr = Math.max(1, basePR * PR_STEPS[prStep + 1]);
    prStep++; busyN = 0;
    if (pr < R.getPixelRatio() - 0.01) prNext = pr;
  }
  function coarser() { Diag.note('3d', `resolution ${R.getPixelRatio().toFixed(2)} -> ${prNext.toFixed(2)} (frames ${Math.round(busyAvg * 1000)} ms)`); R.setPixelRatio(prNext); prNext = 0; busyAvg = 1 / 60; busyN = 0; PERF.coarser = (PERF.coarser || 0) + 1; resize(); }
  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);
    const real = last ? (now - last) / 1000 : 0.016, dt = Math.min(0.25, real);
    if (real > 0.35 && document.visibilityState === 'visible') Diag.slow(real * 1000);
    last = now;
    frame++;
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
      if (tk.hull) {        // the ship turns to sail along its side of the board, and rolls
        const want = yawOf(sideOf(pos[tk.seat] || 0)) + Math.PI + 0.45, d = Math.atan2(Math.sin(want - tk.hull.rotation.y), Math.cos(want - tk.hull.rotation.y));
        tk.hull.rotation.y += d * Math.min(1, dt * 5);
        tk.hull.rotation.x = REDUCED ? 0 : 0.06 * Math.sin(t * 1.6 + tk.seat * 1.7); tk.hull.rotation.z = REDUCED ? 0 : 0.03 * Math.sin(t * 1.1 + tk.seat);
      }
    }
    // flags wave, the wheel turns
    for (const f of flags) {
      if (!f || !f.g.visible) continue;
      const p = f.cloth.geometry.attributes.position, b = f.cloth.userData.base;
      for (let k = 0; k < p.count; k++) { const x = b[k * 3]; p.array[k * 3 + 2] = Math.sin(t * 5 + x * 22 + f.g.position.x) * 0.025 * (x / 0.26); }
      p.needsUpdate = true;
    }
    if (wheel) wheel.children[0].rotation.z = (REDUCED ? 0 : t) * 1.4;
    if (BLD.busy || tweens.length) layoutBuildings(now);
    const moving = tweens.length > 0 || BLD.busy > 0;
    const camStill = Math.abs(camT.yaw - camS.yaw) < 0.002 && Math.abs(camT.d - camS.d) < 0.01 && Math.abs(camT.x - camS.x) < 0.005 && Math.abs(camT.z - camS.z) < 0.005;
    const still = !moving && camStill && !Dice3D.busy;
    if (still && prNext) coarser();
    if (still && frame % (mobile ? 3 : 2)) { drewLast = false; return; }   // only the board's own life moving: fewer frames are enough (a phone stays cool)
    if (drewLast) adapt(real);
    drewLast = !still;
    // the shadows are drawn again only when what casts them has moved, or the sun has (it turns with the camera):
    // not while the dice roll over a board that stands still, nor while only the life of the board goes on. While
    // things move they are drawn on every other frame on a phone (every fourth while the dice fly), and once more at
    // the end, when all has come to rest
    const need = moving || !camStill;
    if (need) shadowLate = true;
    const every = Dice3D.busy ? 4 : mobile ? 2 : 1;
    if (shadowDirty || (shadowLate && (!need || frame - shadowAt >= every))) { R.shadowMap.needsUpdate = true; shadowDirty = false; shadowLate = false; shadowAt = frame; PERF.shadows++; }
    PERF.frames++;
    const lt = REDUCED ? 3 : t;              // with less motion asked for, the board's life stands still
    U.time.value = lt;
    lifeStep(lt);
    draw(dt * speedK);
  }
  function draw(diceDt) {
    R.setViewport(0, 0, W, H); R.setScissorTest(false);
    R.clear();
    R.render(scene, cam);
    Dice3D.frame(R, diceDt);
    drewAt = performance.now();
    const pn = R.info.programs.length;                  // a shader made now, in the middle of a game, stalls a phone
    if (pn !== progN) { if (progN && built) Diag.note('3d', `new shader (${progN} -> ${pn}) while showing ${Diag.doing()}`); progN = pn; }
  }
  function start() {
    if (running || !ok) return;
    running = true; last = 0; drewAt = performance.now();
    requestAnimationFrame(loop);
  }
  function stop() { running = false; }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') stop(); else if (built) start(); });

  // ===== the rise: when a game appears the squares come up, the land grows out of the board, then it comes to life =====
  // everything goes down at once; it comes up a few frames later, when the first (slow) frame has been drawn
  let riseAt = 0;
  function rise() {
    if (!ok || REDUCED) return;
    shadowDirty = true;
    for (let i = 0; i < 40; i++) tiles[i].position.y = -0.6;
    landG.scale.y = 0.001;
    U.fade.value = 0;
    riseAt = frame + 3;
  }
  function riseGo() {
    riseAt = 0;
    for (let i = 0; i < 40; i++) {
      const m = tiles[i], d = (i / 40) * 0.9;
      later(d).then(() => tween(0.45, e => { m.position.y = -0.6 + 0.6 * e; }, ease.back));
    }
    later(0.5)
      .then(() => { Sound.rumble(); return tween(1.6, e => { landG.scale.y = Math.max(0.001, e); }, ease.back); })
      .then(() => tween(1.1, e => { U.fade.value = e; }, ease.lin));
  }

  // ===== public =====
  // Making the board takes a while on a phone (the land is shaped, the scenery is built piece by piece, the shaders are
  // compiled). So it is made in small steps while the menu is on screen (prepare), and starting a game finds it ready;
  // init() finishes at once whatever is still left.
  let prep = null, failed = false, done = false;
  const idle = fn => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 300 }) : setTimeout(fn, 20));
  function* making(el) {
    host = el;
    if (!T || !Models || !Terrain || /[?&]nogl\b/.test(location.search)) { failed = true; return; }
    for (const n of LABEL_PICS) pic(n);            // the squares' pictures start loading now
    try {
      R = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (e) { console.warn('no WebGL', e); failed = true; return; }
    mobile = Math.min(screen.width, screen.height) < 700;
    basePR = Math.min(window.devicePixelRatio || 1, mobile ? 2 : 1.75);
    if (/[?&]lq\b/.test(location.search)) { basePR = 1; quality = 0; }
    R.setPixelRatio(basePR);
    R.outputEncoding = T.sRGBEncoding;
    // a phone gets the plainer shadow filter (a quarter of the work per pixel) and a smaller shadow map
    R.shadowMap.enabled = quality > 0; R.shadowMap.type = mobile ? T.PCFShadowMap : T.PCFSoftShadowMap;
    R.shadowMap.autoUpdate = false;                // drawn again only when something moved (see the frame loop)
    R.setClearColor(0x000000, 0);
    R.autoClear = false;
    maxAniso = Math.min(8, R.capabilities.getMaxAnisotropy());
    const cv = R.domElement;
    cv.className = 'board3d';
    el.appendChild(cv);
    scene = new T.Scene();
    scene.fog = new T.Fog(HAZE, 28, 80);
    cam = new T.PerspectiveCamera(32, 1, 0.5, 200);
    hemi = new T.HemisphereLight(0xe6f2ff, 0x8a6a48, 0.62);
    scene.add(hemi);
    sun = new T.DirectionalLight(0xfff0d6, 1.0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    const sc = sun.shadow.camera; sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 2; sc.far = 40;
    sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02;
    scene.add(sun); scene.add(sun.target);
    ray = new T.Raycaster();
    ok = true;
    yield;
    makeMaterials();
    const tb = performance.now();
    yield* buildStatic();
    PERF.build = performance.now() - tb;
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointerup', onUp);
    // the phone took the graphics away (short of memory, or the page was in the background): the loop goes on, so the
    // figures still arrive and the dice still land (unseen), and three.js makes everything again once they are back
    cv.addEventListener('webglcontextlost', e => {
      e.preventDefault(); lostAt = performance.now(); Diag.note('3d', 'graphics lost');
      setTimeout(() => { if (lostAt && performance.now() - lostAt > 4500 && built) UI.toast('3D დაფამ გრაფიკა დაკარგა. თამაში გრძელდება; გვერდის განახლება დაფას დააბრუნებს.', 5200); }, 5000);
    });
    cv.addEventListener('webglcontextrestored', () => {
      Diag.note('3d', `graphics back after ${Math.round(performance.now() - lostAt)} ms`); lostAt = 0;
      shadowDirty = true; relabelSoon(); if (built) start();
    });
    if (document.fonts) {
      const again = () => { if (!drawnWithFonts && fontsReady()) relabelSoon(); };
      Promise.all(LABEL_FONTS.map(([f, t]) => document.fonts.load(f, t).catch(() => null))).then(again);
      document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', again);
    }
    yield;
    Dice3D.init(T, host);
    if (window.ResizeObserver) new ResizeObserver(() => resize()).observe(el);
    window.addEventListener('resize', resize);
    resize();
    yield;
    // one figure made ahead: its shaders are compiled with the rest (it is the first seat's, until a game says whose)
    if (!toks[0]) { toks[0] = makeToken(0, worldBuilt === 'sea' ? 'blackbeard' : 'david'); toks[0].g.visible = false; }
    yield;
    warm();
    done = true;
    if (worldBuilt !== wantWorld()) startRemake();      // the room's world changed while this one was being made
  }
  // ----- another world: when the room's theme changes, everything on the board is made again (in the lobby, a little
  // at a time; at once if a game wants the board before it is done) -----
  let remake = null;
  function disposeAll(o) {
    const keep = new Set([mats.poleGeo, dustGeo, confGeo, coinGeo].filter(Boolean));
    const shared = new Set(Object.values(mats).concat(ownerMats, [goldRim, coinMat]).filter(Boolean));
    o.traverse(m => {
      if (m.geometry && !keep.has(m.geometry) && !m.geometry.userData.keep) m.geometry.dispose();
      for (const x of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) if (!shared.has(x) && !x.userData.keep) { if (x.map) x.map.dispose(); x.dispose(); }
    });
  }
  function* remaking() {
    const t0 = performance.now();
    stop(); halt();
    if (root) { disposeAll(root); scene.remove(root); }
    root = landG = seaMesh = wheel = fallFoot = null;
    tiles.length = lotMesh.length = lotGround.length = flags.length = mark.length = toks.length = 0;
    labelTex.length = labelMat.length = sideMat.length = 0;
    life.ready = false; life.groups.length = 0; life.pts = null;
    BLD.ready = false; BLD.grow = {}; BLD.busy = 0;
    built = false; camInit = false;
    yield;
    yield* buildStatic();
    toks[0] = makeToken(0, worldBuilt === 'sea' ? 'blackbeard' : 'david'); toks[0].g.visible = false;
    yield;
    warm();
    resize();
    Diag.note('3d', `board made again: ${worldBuilt} (${Math.round(performance.now() - t0)} ms)`);
  }
  function startRemake() {
    if (remake || !done) return;
    remake = remaking();
    const slice = () => {
      if (!remake) return;
      const until = performance.now() + 8;
      do { if (remake.next().done) { remake = null; if (worldBuilt !== wantWorld()) startRemake(); return; } } while (performance.now() < until);
      idle(slice);
    };
    idle(slice);
  }
  // the board must be of the room's world now (a game is about to be shown)
  function ensureWorld() {
    if (!done) return;
    if (!remake && worldBuilt === wantWorld()) return;
    if (!remake) remake = remaking();
    while (remake && !remake.next().done) { }
    remake = null;
  }
  // every shader the game needs is compiled now and every picture is on the graphics card, so the first moments of a
  // game and the first throw of the dice do not stall
  function warm() {
    try {
      moveCamera(0);
      for (let i = 0; i < 40; i++) if (OWNABLE(BOARD[i])) { flagFor(i); break; }     // (its cloth's shader: else made at the first purchase)
      R.compile(scene, cam);
      for (const t of labelTex) if (t) R.initTexture(t);
      R.shadowMap.needsUpdate = true;
      R.setViewport(0, 0, W, H); R.setScissorTest(false); R.clear();
      R.render(scene, cam);                        // the shadow pass compiles its own shaders on its first run
      Dice3D.warm(R);
      R.clear();
      shadowDirty = true;
    } catch (e) { console.warn(e); }
  }
  // the menu is on screen: the board is made a little at a time, when the page has nothing else to do
  function prepare(el) {
    if (done || prep || failed || !el) return;
    prep = making(el);
    const slice = () => {
      if (!prep) return;
      const until = performance.now() + 8;
      do { if (prep.next().done) { prep = null; return; } } while (performance.now() < until);
      idle(slice);
    };
    idle(slice);
  }
  function init(el) {
    if (!done && !failed) {
      if (!prep) prep = making(el);
      while (prep && !prep.next().done) { }
      prep = null;
    }
    if (failed || !ok) return false;
    if (host !== el || R.domElement.parentNode !== el) { host = el; el.appendChild(R.domElement); }
    resize();
    return true;
  }
  // a game appears (a new one, or after joining): everything set from the state, the board rises
  function show(state, positions, animate) {
    if (!ok) return;
    ensureWorld();
    st = state; pos = positions.slice();
    shadowDirty = true;
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
    if (!built) { built = true; camInit = false; landG.scale.y = 1; U.fade.value = 1; if (animate) rise(); }
    start();
  }
  // the state changed without animation (end of the animations, a resync): the same, without the rise
  function sync(state, positions) {
    if (!ok) return;
    ensureWorld();
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
  // the room's world changed: the board is made again in it (another world), or its squares written again
  function retheme() {
    if (!done) return;                             // still being made: making() looks again at its end
    if (worldBuilt !== wantWorld()) { startRemake(); return; }
    if (!remake && labelTex.length) relabelAll();
  }

  return {
    init, prepare, show, sync, walk, fly, setOwner, setLevel, setMort, pop, celebrate, coins, focus, snap, setMode, setTurn, leave, resize, halt, retheme,
    speed(k) { speedK = k > 0 ? k : 1; },
    get ok() { return done; }, get mode() { return mode; }, get world() { return worldBuilt; },
    // how long ago a frame was drawn (the animations wait for frames: none coming means they must not be waited for)
    get drawnAgo() { return running && !lostAt ? performance.now() - drewAt : Infinity; },
    get lost() { return !!lostAt; },
    // for the technical log
    gpu() {
      if (!R) return 'gpu: no 3D' + (failed ? ' (failed)' : '');
      let name = '';
      try { const gl = R.getContext(), x = gl.getExtension('WEBGL_debug_renderer_info'); name = x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch (e) { }
      const m = R.info.memory;
      return `gpu ${name} · webgl${R.capabilities.isWebGL2 ? 2 : 1} · pixel ratio ${R.getPixelRatio().toFixed(2)} (${prStep} steps down) · quality ${quality} · ${mobile ? 'phone' : 'computer'} · shaders ${R.info.programs.length} · textures ${m.textures} · geometries ${m.geometries}${lostAt ? ' · GRAPHICS LOST' : ''}`;
    },
    onPick(cb) { pickCb = cb; },
    setPos(seat, at) { pos[seat] = at; },
    tween, ease, toWorld,
    _screen(i) { const c = centerOf(i).setY(TH); c.project(cam); const r = host.getBoundingClientRect(); return [r.left + (c.x + 1) / 2 * r.width, r.top + (1 - c.y) / 2 * r.height]; },
    // where a point of the board is on the screen (for tests)
    _project(x, y, z) { const c = new T.Vector3(x, y, z).project(cam), r = host.getBoundingClientRect(); return [r.left + (c.x + 1) / 2 * r.width, r.top + (1 - c.y) / 2 * r.height]; },
    _dbg: () => ({ y: tiles.slice(0, 6).map(t => +t.position.y.toFixed(2)), tw: tweens.length, built, running, frame, quality, land: landG ? +landG.scale.y.toFixed(3) : 0, fade: +U.fade.value.toFixed(3), top: +landTop.toFixed(2) }),
    _scene: () => scene, _gl: () => ({ R, cam, scene }),
    _label: i => labelCv[i] ? labelCv[i].toDataURL() : '',
    _life: () => ({ ready: life.ready, groups: life.groups.map(g => [g.k, g.list.length]), points: life.pts ? life.pts.geometry.attributes.position.count : 0, fall: fallFoot }),
    _perf: () => R ? Object.assign({ calls: R.info.render.calls, tris: R.info.render.triangles, programs: R.info.programs.length, textures: R.info.memory.textures, geometries: R.info.memory.geometries, frame, quality, pr: R.getPixelRatio() }, PERF) : PERF
  };
})();
