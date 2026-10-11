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
  const toks = [], cornerTitles = [];
  let st = null, pos = [], turnSeat = -1, pickCb = null, built = false, mats = null, ownerMats = [], wheel = null;
  let landG = null, landTop = 4, fallFoot = null;
  const lotF = [], ringF = [];
  // the world on the board: the land (models.js) or the archipelago's sea (sea.js), as the room's theme says; made again
  // when the theme changes (see retheme)
  let MOD = Models, worldBuilt = null, hemi = null, seaMesh = null;
  let marineLife = null, lagoonLife = null, reefLife = null, weatherLife = null;
  let placeModelsLife = null, mapPropsLife = null, placeEffects = null;
  const animatedModels = [];
  let modelDelta = 0;
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
    if (wantWorld() === 'sea') return drawSeaLabel(i, cv, x);
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
  // Illustrated nautical deeds on the board: the place, its price, and its owner are distinct.
  function drawSeaLabel(i, cv, x) {
    const t = BOARD[i], w = cv.width, h = cv.height, mid = w / 2, k = mark[i], owned = k && k.o >= 0;
    const wash = x.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, '#f6eacb'); wash.addColorStop(1, '#d7bb7c');
    x.fillStyle = wash; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#664823'; x.lineWidth = 7; rr(x, 6, 6, w-12, h-12, 12); x.stroke();
    x.strokeStyle = '#b08a49'; x.lineWidth = 2; rr(x, 15, 15, w-30, h-30, 8); x.stroke();
    x.textAlign = 'center'; x.textBaseline = 'middle';
    if (!(i % 10)) {
      // The full square belongs to its diorama; its name floats above the model.
      x.fillStyle = '#406f70'; rr(x, 18, 18, w-36, h-36, 12); x.fill();
      x.strokeStyle = '#addcd0'; x.lineWidth = 3;
      for (let n = 0; n < 5; n++) { x.beginPath(); x.arc(mid, h/2, 52+n*25, 0, TAU); x.stroke(); }
      x.fillStyle = '#d9be7e';
      for (let n=0;n<8;n++) { x.save(); x.translate(mid,h/2); x.rotate(n*Math.PI/4); x.beginPath(); x.moveTo(-10,0); x.lineTo(0,-132); x.lineTo(10,0); x.closePath(); x.fill(); x.restore(); }
      return cv;
    }
    const band = t.k === 'p' ? GROUPS[t.g].c : t.k === 'road' ? '#315762' : t.k === 'tax' ? '#814937' : '#277477';
    const type = t.k === 'p' ? 'კუნძული' : t.k === 'road' ? 'ხომალდი' : t.k === 'util' ? (i === 12 ? 'საზღვაო შუქურა' : 'გემთსაშენი') : t.k === 'tax' ? 'საფრთხე' : t.k === 'scroll' ? 'ზღვის გზავნილი' : 'დამალული განძი';
    x.fillStyle = band; rr(x, 18, 18, w-36, 47, 6); x.fill();
    x.fillStyle = '#fff5d6'; fit(x, type, 800, FONT.sans, 23, w-50); x.fillText(type, mid, 42);
    const picture = typeof seaCardPicture === 'function' ? seaCardPicture(t) : null;
    const im = picture ? pic(picture.name) : null;
    x.save(); rr(x, 20, 70, w-40, 151, 6); x.clip();
    if (im) {
      const [sx,sy,sw,sh] = picture.crop || [0,0,im.naturalWidth,im.naturalHeight];
      // Contain the subject: the ship's mast and the whole island remain visible.
      const scale = Math.min((w-40)/sw,151/sh), dw = sw*scale, dh = sh*scale;
      x.fillStyle = '#2d7182'; x.fillRect(20,70,w-40,151);
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      x.drawImage(im,sx,sy,sw,sh,mid-dw/2,145.5-dh/2,dw,dh);
    } else {
      x.fillStyle = '#31838a'; x.fillRect(20,70,w-40,151);
      iconAt(x,t.k==='chest'?'ui_chest_wood':t.k==='scroll'?'ui_page':'ui_coin',mid,146,104);
    }
    x.restore();
    const title = t.k === 'road' ? t.s : t.n;
    const ls = lines(x, title, 900, FONT.serif, 32, w-40, 21), lh = fontPx(x)*1.08;
    x.fillStyle = '#2e271a'; ls.forEach((l,n)=>x.fillText(l,mid,245+(n-(ls.length-1)/2)*lh));
    if (OWNABLE(t)) priceLine(x,mid,294,String(t.p),'#3b2918',37);
    else if (t.k === 'tax') priceLine(x,mid,294,String(t.a),'#902f20',35);
    else { x.fillStyle='#625337'; fit(x,t.k==='scroll'?'გახსენი წერილი':'აღმოაჩინე განძი',700,FONT.sans,21,w-42); x.fillText(t.k==='scroll'?'გახსენი წერილი':'აღმოაჩინე განძი',mid,292); }
    x.fillStyle = owned ? SEAT_COLORS[k.o] : '#e7d6a5'; rr(x,19,322,w-38,43,6); x.fill();
    if(owned) {
      const owner = st && st.players[k.o] ? st.players[k.o].name : 'მეკობრე '+(k.o+1);
      x.fillStyle='#172d35'; fit(x,owner,900,FONT.sans,21,w-36); x.fillText(owner,mid,335);
      const development = k.m ? 'დაგირავებულია' : t.k === 'p' ? k.lv>=5?'სასტუმრო · 1':k.lv?'ქოხი · '+k.lv:'თავისუფალი მიწა' : t.k==='road'?'მფლობელის ხომალდი':'მფლობელის ნაგებობა';
      x.fillStyle='#172d35'; fit(x,development,800,FONT.sans,16,w-38); x.fillText(development,mid,353);
    } else { x.fillStyle='#635335'; fit(x,OWNABLE(t)?'შეძენა შესაძლებელია':'ბედის გამოცდა',700,FONT.sans,18,w-42); x.fillText(OWNABLE(t)?'შეძენა შესაძლებელია':'ბედის გამოცდა',mid,344); }
    return cv;
  }
  function updateTileLabel(i) {
    if(wantWorld() !== 'sea' || !labelTex[i]) return;
    drawLabel(i); labelTex[i].needsUpdate = true;
  }
  function cornerTitle(i, tile, top) {
    if(wantWorld() !== 'sea') return;
    const existing=cornerTitles.find(c=>c.i===i);
    const cv=existing?existing.sprite.material.map.image:document.createElement('canvas'); cv.width=512; cv.height=192;
    const x=cv.getContext('2d');
    x.save();x.translate(256,96);x.scale(2.7,1);
    const fog=x.createRadialGradient(0,0,20,0,0,94);
    fog.addColorStop(0,'rgba(212,255,247,.98)'); fog.addColorStop(.55,'rgba(163,242,234,.91)'); fog.addColorStop(1,'rgba(107,234,236,0)');
    x.fillStyle=fog;x.fillRect(-96,-96,192,192);x.restore();
    x.strokeStyle='rgba(209,255,245,.74)'; x.lineWidth=2;
    x.beginPath();x.moveTo(72,152);x.quadraticCurveTo(256,172,440,152);x.stroke();
    x.textAlign='center';x.textBaseline='middle';
    const ls=lines(x,BOARD[i].n,900,FONT.serif,48,414,32), lh=fontPx(x)*1.08;
    x.fillStyle='#133d49';ls.forEach((l,n)=>x.fillText(l,256,81+(n-(ls.length-1)/2)*lh));
    const words=THEME.w, sub=i===0?'+'+SALARY+' · '+words.startTile:i===10?words.jailTile:i===20?words.feastTile:words.gojailTile;
    x.fillStyle='#245e65';fit(x,sub,800,FONT.sans,22,398);x.fillText(sub,256,136);
    if(existing){existing.sprite.material.map.needsUpdate=true;return;}
    const map=new T.CanvasTexture(cv);map.encoding=T.sRGBEncoding;map.anisotropy=maxAniso;
    const sprite=new T.Sprite(new T.SpriteMaterial({map,transparent:true,depthWrite:false,opacity:.96}));
    sprite.name='Corner_Hologram_'+i;sprite.renderOrder=4;sprite.scale.set(1.82,.68,1);sprite.position.set(0,top+.37,0);sprite.userData.i=i;
    prepareMaterials(sprite);tile.add(sprite);cornerTitles.push({sprite,y:sprite.position.y,i});
  }
  const PERF = { relabel: 0, relabelMs: 0, build: 0, frames: 0, shadows: 0 };    // counted for tests
  function relabelAll() {
    if (!ok) return;
    const t0 = performance.now();
    drawnWithFonts = fontsReady();
    for (let i = 0; i < 40; i++) { if (!labelTex[i]) continue; drawLabel(i); labelTex[i].needsUpdate = true; }
    for(const c of cornerTitles) cornerTitle(c.i,c.sprite.parent,c.y-.37);
    PERF.relabel++; PERF.relabelMs += performance.now() - t0;
  }

  // ===== the board's own material: leaves and vines sway, water shimmers and falls, the land has its grain =====
  // Every piece of the land and of what stands on it says in its 'anim' attribute what it is: x how much it sways (more
  // the higher it is above its ground), y what kind of surface it is (1 water lying still, 2 falling water, 3 the land
  // itself, which gets the fine grain of soil, grass and rock from a small noise picture). One clock for all of it.
  const U = { time: { value: 0 }, fade: { value: 1 }, scale: { value: 800 }, detail: { value: null }, caustic: { value: null }, vortex: { value: new T.Vector3(3.45, 3, 0.55) } };
  U.storm = typeof Weather3D !== 'undefined' && Weather3D && Weather3D.waterUniforms ? Weather3D.waterUniforms.zone : { value: new T.Vector4(0, 0, 1, 0) };
  U.stormWind = typeof Weather3D !== 'undefined' && Weather3D && Weather3D.waterUniforms ? Weather3D.waterUniforms.wind : { value: new T.Vector2(1, 0) };
  // Shared weather envelope: waves, foam and floating craft respond to the same cell.
  function seaStormAt(x, z) {
    const v = U.storm.value;
    return clamp(v.w / .4, 0, 1) * (1 - smooth(.18, 1, Math.hypot(x - v.x, z - v.y) / Math.max(.01, v.z)));
  }
  // Two gentle swells move the actual mesh. Broad normals and world-space colour stay stable when the camera moves;
  // no undersampled tiny waves or delayed camera captures are mixed into the water. Length / height / speed are board units.
  const SEA_WAVES = [[0.8, 0.6, 3.7, 0.042, 0.62], [0.31, 0.95074, 2.15, 0.018, 0.44]];
  const STORM_WAVE = { length: .95, amplitude: .09, speed: 1.15 };
  function seaHeight(x,z,t,outer = Math.max(Math.abs(x),Math.abs(z)) > 6.2) {
    const radius=Math.hypot(x,z), extent=Math.max(Math.abs(x),Math.abs(z));
    const coast=smooth(3.2,3.7,radius), shore=outer ? 1-smooth(0,.45,extent-6.45) : Terrain.seaShore(x,z);
    const storm=seaStormAt(x,z), baseSwell=(.48+.52*smooth(6.2,7.2,extent))*(1-shore)*coast*(1-smooth(18,38,radius)), swell=baseSwell*(1+2.6*storm);
    let height=(outer?Terrain.OCEAN_Y:Terrain.SEA_Y)-.055*(1-coast);
    for(const w of SEA_WAVES)height+=swell*w[3]*Math.sin(TAU/w[2]*(w[0]*x+w[1]*z-w[4]*t));
    if(storm>.001){const wind=U.stormWind.value; height+=baseSwell*(1-smooth(6.1,6.2,extent))*storm*STORM_WAVE.amplitude*Math.sin(TAU/STORM_WAVE.length*(wind.x*x+wind.y*z-STORM_WAVE.speed*t));}
    return height;
  }
  const gf = v => (Math.round(v * 1e5) / 1e5).toFixed(5);
  const seaMove = SEA_WAVES.slice(0, 2).map(([x, z, len, a, c], k) => `float ph${k} = ${gf(Math.PI * 2 / len)} * ( dot( vec2( ${gf(x)}, ${gf(z)} ), wp4.xz ) - ${gf(c)} * uTime );
        transformed.y += swell * ${gf(a)} * sin( ph${k} );
        transformed.xz += swell * ${gf(a * 0.32)} * vec2( ${gf(x)}, ${gf(z)} ) * cos( ph${k} );`).join('\n        ');
  const seaTilt = SEA_WAVES.map(([x, z, len, a, c], k) => `seaWave( p, vec2( ${gf(x)}, ${gf(z)} ), ${gf(len)}, ${gf(a)} * calm, ${gf(c)}, h, g );`).join('\n        ');
  const LIVING = {
    vp: `#include <common>
attribute vec2 anim;
uniform float uTime;
varying vec3 vWP;
varying float vWater;
varying float vShore;
#ifdef SEA
uniform vec4 uSeaStorm;
uniform vec2 uSeaWind;
varying float vSeaStorm;
#endif
`,
    v: `#include <begin_vertex>
      vec4 wp4 = vec4( position, 1.0 );
      #ifdef USE_INSTANCING
        wp4 = instanceMatrix * wp4;
      #endif
      wp4 = modelMatrix * wp4;
      vWP = wp4.xyz;
      vWater = anim.y;
      vShore = anim.x;
      #ifdef SEA
        // The shore stays attached to land; sparse distant rings do not need displaced waves.
        float open = smoothstep( 6.2, 7.2, max( abs( wp4.x ), abs( wp4.z ) ) );
        float nativeCoast = smoothstep( 3.2, 3.7, length( wp4.xz ) );
        // The island already owns its textured turquoise coast at about y=-0.013. Keep this mesh below that coast,
        // including every wave trough/crest, so the baked colours and foam stay visible without coplanar surfaces.
        transformed.y -= 0.055 * ( 1.0 - nativeCoast );
        vSeaStorm = clamp( uSeaStorm.w / 0.4, 0.0, 1.0 ) * ( 1.0 - smoothstep( 0.18, 1.0, distance( wp4.xz, uSeaStorm.xy ) / max( 0.01, uSeaStorm.z ) ) );
        float baseSwell = mix( 0.48, 1.0, open ) * ( 1.0 - anim.x ) * nativeCoast * ( 1.0 - smoothstep( 18.0, 38.0, length( wp4.xz ) ) );
        float swell = baseSwell * ( 1.0 + 2.6 * vSeaStorm );
        ${seaMove}
        // Short wind-driven crests use the dense lagoon grid; outer water keeps its broad swells.
        if ( vSeaStorm > 0.001 ) {
          float chopPhase = ${gf(TAU / STORM_WAVE.length)} * ( dot( uSeaWind, wp4.xz ) - ${gf(STORM_WAVE.speed)} * uTime );
          transformed.y += baseSwell * ( 1.0 - smoothstep( 6.1, 6.2, max( abs( wp4.x ), abs( wp4.z ) ) ) ) * vSeaStorm * ${gf(STORM_WAVE.amplitude)} * sin( chopPhase );
        }
        vec4 seaWorld = modelMatrix * vec4( transformed, 1.0 );
        vWP = seaWorld.xyz;
      #else
        if ( anim.x > 0.0 ) {
          float ph = wp4.x * 1.9 + wp4.z * 1.3;
          float gust = 0.65 + 0.35 * sin( uTime * 0.41 + wp4.x * 0.25 - wp4.z * 0.2 );
          transformed.x += anim.x * gust * ( 0.009 * sin( uTime * 1.7 + ph ) + 0.0035 * sin( uTime * 3.3 + ph * 2.1 ) );
          transformed.z += anim.x * gust * 0.0055 * sin( uTime * 1.25 + ph * 1.3 + 1.2 );
        }
      #endif`,
    fp: `#include <common>
uniform float uTime;
uniform sampler2D uDetail;
varying vec3 vWP;
varying float vWater;
varying float vShore;
#ifdef SEA
uniform vec3 uVortex;
uniform sampler2D uCaustic;
uniform vec2 uSeaWind;
varying float vSeaStorm;
#endif
// one train of the sea's waves: its height and its slope here, added to h and g
void seaWave( vec2 p, vec2 d, float len, float amp, float speed, inout float h, inout vec2 g ) {
  float k = 6.28318 / len, ph = k * ( dot( d, p ) - speed * uTime );
  h += amp * sin( ph );
  g += amp * k * cos( ph ) * d;
}`,
    f: `#include <emissivemap_fragment>
      #ifdef SEA
      {
        // The native island paints its water as pale turquoise pools and soft foam. The surrounding mesh uses the
        // same colours in world space, with broad, irregular patches instead of camera-dependent colour/depth samples.
        vec2 p = vWP.xz;
        if ( distance( p, uVortex.xy ) < uVortex.z ) discard;
        float depth = max( 0.0, vWater - 4.0 );
        float open = smoothstep( 6.2, 7.2, max( abs( p.x ), abs( p.y ) ) );
        float calm = mix( 0.48, 1.0, open ) * ( 1.0 - 0.9 * vShore ) * smoothstep( 3.2, 3.7, length( p ) )
          * ( 1.0 - smoothstep( 18.0, 38.0, length( p ) ) ) * ( 1.0 + 2.6 * vSeaStorm );
        float h = 0.0;
        vec2 g = vec2( 0.0 );
        ${seaTilt}
        if ( vSeaStorm > 0.001 ) {
          seaWave( p, uSeaWind, ${gf(STORM_WAVE.length)}, ${gf(STORM_WAVE.amplitude)} * calm * ( 1.0 - smoothstep( 6.1, 6.2, max( abs( p.x ), abs( p.y ) ) ) ) * vSeaStorm / ( 1.0 + 2.6 * vSeaStorm ), ${gf(STORM_WAVE.speed)}, h, g );
        }
        normal = normalize( mat3( viewMatrix ) * vec3( -g.x, 1.0, -g.y ) );
        // Clear turquoise water like the reference: the shallow bed and actual reef models remain visible through
        // its alpha. Mip-filtered curved light networks move slowly in world space, with no screen-space sampling.
        // RGB packs caustic light, broad colour and broken foam. Two mip-filtered reads
        // supply all three instead of five independent reads across the water surface.
        vec3 waterA = texture2D( uCaustic, p * 0.17 + uTime * vec2( 0.0042, -0.0028 ) ).rgb;
        vec3 waterB = texture2D( uCaustic, p * 0.137 + vec2( 0.39, 0.71 ) + uTime * vec2( -0.0027, 0.0031 ) ).rgb;
        float n1 = waterA.g, n2 = waterB.g;
        float shallow = 1.0 - smoothstep( 0.02, 0.24, depth );
        // Deeper teal pools give the pale shore and submerged reef a readable depth gradient.
        vec3 turquoise = mix( vec3( 0.029, 0.385, 0.430 ), vec3( 0.340, 0.740, 0.655 ), shallow );
        turquoise *= 0.97 + 0.06 * n1;
        turquoise = mix( turquoise, vec3( 0.028, 0.190, 0.240 ), 0.36 * vSeaStorm );
        float caustic = max( waterA.r * 0.85, waterB.r * 0.67 );
        diffuseColor.rgb = mix( turquoise, vec3( 0.80, 0.94, 0.90 ), caustic * ( 0.055 + 0.14 * shallow ) * ( 1.0 - 0.62 * open ) );
        // A broad sky sheen strengthens at grazing angles without a second scene render.
        // Its low contrast and smooth normal avoid the old sparkling at map scale.
        float facing = clamp( dot( normal, normalize( vViewPosition ) ), 0.0, 1.0 );
        float grazing = pow( 1.0 - facing, 4.0 );
        diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.43, 0.67, 0.72 ), 0.11 * grazing );
        diffuseColor.a *= mix( mix( 0.54, 0.86, 1.0 - shallow ), 0.93, open );
        // Shore foam breaks into unequal scallops and small gaps; it never lays long repeating strips across the sea.
        float shoreNoise = waterA.b * 0.72 + waterB.b * 0.28;
        float edge = smoothstep( 0.72 + 0.19 * shoreNoise, 0.995, vShore ) * ( 1.0 - smoothstep( 0.035, 0.075, depth ) );
        float broken = smoothstep( 0.32, 0.64, shoreNoise * 0.72 + n2 * 0.28 );
        float lap = 0.76 + 0.24 * sin( uTime * 0.48 + shoreNoise * 13.0 + n1 * 5.0 );
        float whitecaps = vSeaStorm * smoothstep( 0.008, 0.042, h ) * smoothstep( 0.20, 0.60, waterA.b ) * 0.72;
        float foam = max( edge * ( 0.16 + 0.55 * broken ) * lap, whitecaps );
        diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.70110, 0.72306, 0.70838 ), foam );
        diffuseColor.a = min( 0.94, diffuseColor.a + foam * 0.20 );
        specularStrength *= 0.24 * ( 1.0 - foam );
      }
      #else
      if ( vWater > 4.5 ) {
        // lava: glowing, its dark crust drifting over it
        float c = sin( vWP.x * 23.0 + uTime * 0.7 + sin( vWP.z * 17.0 - uTime * 0.5 ) * 2.0 ) * sin( vWP.z * 19.0 - uTime * 0.6 + vWP.x * 3.0 );
        diffuseColor.rgb = mix( vec3( 0.32, 0.05, 0.02 ), vec3( 1.0, 0.56, 0.14 ), 0.5 + 0.5 * c );
        totalEmissiveRadiance += vec3( 0.95, 0.34, 0.06 ) * ( 0.6 + 0.4 * c );
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
      }
      #endif`
  };
  // The two water meshes use independent materials, but one stable world-space shader and clock.
  // Geometry and materials are disposed with the board; there are no camera capture targets to retain or refresh.
  function seaSurface(mesh) {
    if (!U.caustic.value) U.caustic.value = causticTexture();
    mesh.material = living(mats.sea.clone(), true);
    mesh.geometry.computeBoundingSphere();
    mesh.geometry.boundingSphere.radius += .4; // include displaced storm crests in culling

  }
  // (the sea has a shader of its own: the land's and the scenery's carries none of its work, nor the sea's theirs)
  function living(m, sea) {
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = U.time; sh.uniforms.uDetail = U.detail;
      if (sea) { sh.uniforms.uVortex = U.vortex; sh.uniforms.uCaustic = U.caustic; sh.uniforms.uSeaStorm = U.storm; sh.uniforms.uSeaWind = U.stormWind; }
      sh.vertexShader = sh.vertexShader.replace('#include <common>', LIVING.vp).replace('#include <begin_vertex>', LIVING.v);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', LIVING.fp).replace('#include <emissivemap_fragment>', LIVING.f);
    };
    m.customProgramCacheKey = sea ? () => 'livingsea-packed-depth-v3' : () => 'living';
    if (sea) m.defines = Object.assign({}, m.defines, { SEA: '' });
    return m;
  }
  // a model from a file (glb.js) has no 'anim' numbers: its water is found by its colour (bluer than it is red, and not
  // greener than blue, as the pictures paint the sea, the pools and the falls), falling where its surface is steep, lying
  // still where it is flat; the same clock as the board's
  const MODEL_WATER = {
    vp: '#include <common>\nattribute float aLeaf;\nuniform float uTime;\nvarying vec3 vWP;\nvarying vec3 vWN;',
    v: `#include <begin_vertex>
      if ( aLeaf > 0.0 ) {
        // its leaves sway in the board's own wind (the same gusts as the scenery's), as far in the board's units
        // whatever the model's size (glb.js says where the leaves are)
        vec3 w0 = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
        float ph = w0.x * 1.9 + w0.z * 1.3, gust = 0.65 + 0.35 * sin( uTime * 0.41 + w0.x * 0.25 - w0.z * 0.2 );
        vec3 wo = 1.6 * aLeaf * gust * vec3( 0.009 * sin( uTime * 1.7 + ph ) + 0.0035 * sin( uTime * 3.3 + ph * 2.1 ), 0.0, 0.0055 * sin( uTime * 1.25 + ph * 1.3 + 1.2 ) );
        transformed += vec3( dot( modelMatrix[ 0 ].xyz, wo ), dot( modelMatrix[ 1 ].xyz, wo ), dot( modelMatrix[ 2 ].xyz, wo ) ) / dot( modelMatrix[ 0 ].xyz, modelMatrix[ 0 ].xyz );
      }
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

  // One small seamless data texture supplies curved, broken caustic light. A warped periodic Voronoi field makes
  // uneven cells and softly rounded edges; mipmaps filter those edges before they become sub-pixel at map scale.
  // It is created once, shared across the two water materials and world remakes, and never downloaded or regenerated.
  function causticTexture() {
    const N = 256, cells = 7, cv = document.createElement('canvas'), x = cv.getContext('2d');
    cv.width = cv.height = N;
    const im = x.createImageData(N, N), r = Models.rng(731104), seeds = new Float32Array(cells * cells * 2);
    for (let i = 0; i < seeds.length; i++) seeds[i] = 0.16 + r() * 0.68;
    const wrap = n => ((n % cells) + cells) % cells;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N, v = (j + 0.5) / N, a = TAU * u, b = TAU * v;
      const wx = u * cells + 0.34 * Math.sin(b * 2 + 0.65 * Math.sin(a)) + 0.15 * Math.sin(a * 2 - b);
      const wz = v * cells + 0.31 * Math.sin(a * 2 - 0.62 * Math.sin(b)) + 0.14 * Math.sin(b * 2 + a);
      const cx = Math.floor(wx), cz = Math.floor(wz);
      let first = Infinity, second = Infinity;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const key = (wrap(cz + dz) * cells + wrap(cx + dx)) * 2;
        const px = cx + dx + seeds[key] - wx, pz = cz + dz + seeds[key + 1] - wz, d = px * px + pz * pz;
        if (d < first) { second = first; first = d; } else if (d < second) second = d;
      }
      const gap = Math.sqrt(second) - Math.sqrt(first);
      const core = 1 - smooth(0.015, 0.095, gap), halo = 1 - smooth(0.025, 0.19, gap);
      const pulse = 0.5 + 0.25 * Math.sin(a * 3 + b * 2 + 0.7 * Math.sin(b)) + 0.25 * Math.sin(b * 3 - a * 2);
      const broken = 0.36 + 0.64 * smooth(0.14, 0.72, pulse);
      const value = Math.round(clamp((core * 0.74 + halo * 0.26) * broken, 0, 1) * 255), k = (j * N + i) * 4;
      const colour = 0.5 + 0.19 * Math.sin(a + b) + 0.15 * Math.cos(a * 2 - b + 0.5 * Math.sin(b));
      const foam = 0.5 + 0.23 * Math.sin(a * 3 + b * 2 + 0.8 * Math.sin(b * 2)) + 0.19 * Math.cos(a * 2 - b * 3);
      im.data[k] = value; im.data[k + 1] = Math.round(clamp(colour, 0, 1) * 255);
      im.data[k + 2] = Math.round(clamp(foam, 0, 1) * 255); im.data[k + 3] = 255;
    }
    x.putImageData(im, 0, 0);
    const texture = new T.CanvasTexture(cv);
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.minFilter = T.LinearMipmapLinearFilter; texture.magFilter = T.LinearFilter;
    texture.generateMipmaps = true; texture.anisotropy = Math.min(4, maxAniso);
    texture.userData.keep = true;
    return texture;
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
      sea: living(new T.MeshPhongMaterial({ vertexColors: true, shininess: 28, specular: 0x31565a, transparent: true, depthWrite: false }), true),
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
        else if (MOD.cornerModels && MOD.cornerModels[i] && typeof GLB !== 'undefined' && GLB) placeCorner(i, m, MOD.cornerModels[i]);
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
    const lg = yield* Terrain.board(mobile ? MOD.world === 'sea' ? 112 : 136 : 160);
    const land = new T.Mesh(lg, mats.scenery);
    land.castShadow = true; land.receiveShadow = true; land.userData.ground = true;
    landG.add(land); lotGround.push(land);
    lg.computeBoundingBox(); landTop = lg.boundingBox.max.y;
    const wg = Terrain.waterGeo();
    if (wg) { const wm = new T.Mesh(wg, mats.scenery); wm.receiveShadow = true; landG.add(wm); }
    yield;
    // the archipelago's lagoon: not part of the land that grows (the islands rise out of it)
    if (MOD.world === 'sea') { seaMesh = new T.Mesh(yield* Terrain.seaGeo(mobile ? 72 : 96), mats.sea); seaSurface(seaMesh); seaMesh.receiveShadow = true; root.add(seaMesh); yield; }
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
    const om = new T.Mesh(Terrain.outer(mobile ? MOD.world === 'sea' ? 26 : 34 : 42, mobile ? MOD.world === 'sea' ? 72 : 80 : 104), MOD.world === 'sea' ? mats.sea : mats.scenery);
    if (MOD.world === 'sea') seaSurface(om);
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
    if (MOD.world === 'sea' && typeof Marine3D !== 'undefined' && Marine3D) {
      marineLife = Marine3D.create({
        parent: root, oceanY: Terrain.OCEAN_Y, reducedMotion: REDUCED, mobile,
        focus: () => {
          const seat = turnSeat >= 0 ? turnSeat : st && st.turn;
          const at = seat != null && pos[seat] != null ? pos[seat] : 0;
          const p = centerOf(at), out = OUT[sideOf(at)];
          return { x: p.x + out[0] * 1.7, z: p.z + out[1] * 1.7 };
        },
        waterHeight: (x,z,t) => seaHeight(x,z,t,true)
      });
    }
    if (MOD.world === 'sea' && typeof Lagoon3D !== 'undefined' && Lagoon3D) {
      const vortex = Terrain.VORTEX;
      lagoonLife = Lagoon3D.create({
        parent: root, center: { x: vortex.x, z: vortex.z }, radius: vortex.radius + 0.01,
        waterY: Terrain.SEA_Y, reducedMotion: REDUCED, mobile,
        waterHeight: (x,z,t) => seaHeight(x,z,t,false)
      });
      U.vortex.value.set(vortex.x, vortex.z, lagoonLife.mask.radius);
    }
    if (MOD.world === 'sea' && typeof Reef3D !== 'undefined' && Reef3D) {
      reefLife = Reef3D.create({ parent: root, waterY: Terrain.SEA_Y, outerWaterY: Terrain.OCEAN_Y, reducedMotion: REDUCED });
    }
    if (MOD.world === 'sea') {
      if (typeof PlaceModels3D !== 'undefined') {
        placeModelsLife = PlaceModels3D.create({ parent: landG, places: PlaceModels3D.indices.map(i => ({ i, name: BOARD[i].n, frame: lotF[i] })), reducedMotion: REDUCED });
        if (placeModelsLife.getObject) for (const i of PlaceModels3D.indices) lotMesh[i] = placeModelsLife.getObject(i);
      }
      if (typeof MapProps3D !== 'undefined') mapPropsLife = MapProps3D.create({ parent: landG, places: [2,7,17,22,33,36].map(i => ({ i, frame: lotF[i] })), waterY: Terrain.SEA_Y, reducedMotion: REDUCED, mobile });
      if (typeof PlaceFX3D !== 'undefined') placeEffects = PlaceFX3D.create({ parent: root, reducedMotion: REDUCED,
        places: BOARD.map((tile, i) => ({ i, corner: !(i % 10), at: i % 10 ? lotF[i].at(0, -.10, .035) : toWorld(i, 0, 0, TH + .025) })) });
    }
    if (MOD.world === 'sea' && typeof Weather3D !== 'undefined' && Weather3D) {
      weatherLife = Weather3D.create({
        parent: root, waterY: Terrain.SEA_Y, outerWaterY: Terrain.OCEAN_Y, reducedMotion: REDUCED, mobile,
        viewFocus: () => ({ x: camS.x, z: camS.z, distance: camS.d, close: mode === 'follow' }),
        focus: () => {
          const seat = turnSeat >= 0 ? turnSeat : st && st.turn, at = seat != null && pos[seat] != null ? pos[seat] : 0;
          const p = centerOf(at), out = OUT[sideOf(at)];
          return { x: p.x - out[0] * 1.6, z: p.z - out[1] * 1.6 };
        },
        waterHeight: seaHeight,
        onThunder: event => { if (typeof Sound !== 'undefined' && Sound.thunder) Sound.thunder(event.strength); }
      });
    }
  }
  // a place's model from its file, set in the lot's frame with its water line on the sea's (if the board is made again
  // before the file is read, the new board asks for its own)
  let materialWarm = null;
  function prepareMaterials(object) {
    if (weatherLife && weatherLife.patchObject) weatherLife.patchObject(object);
    // Async arrivals need the completed scene's lights and weather shader.
    // Never start compilation or texture uploads during a running game.
    if (built || !R || !done || prep || remake || lostAt) return;
    if (!materialWarm || materialWarm.root !== root) materialWarm = { root, queued: false, uploading: false, pending: new Set(), uploaded: new WeakMap() };
    const job = materialWarm;
    const valid = () => job === materialWarm && job.root === root && !built && ok && !lostAt && !prep && !remake && document.visibilityState !== 'hidden';
    if (job.queued) return;
    job.queued = true;
    idle(() => {
      job.queued = false;
      if (!valid()) return;
      if (weatherLife) weatherLife.flush();
      R.compile(scene, cam);
      scene.traverse(o => { for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : [])
        for (const value of Object.values(m)) if (value && value.isTexture && value.image && value.version > 0 && value.image.complete !== false && job.uploaded.get(value) !== value.version) job.pending.add(value); });
      if (job.uploading || !job.pending.size) return;
      job.uploading = true;
      const upload = () => {
        if (!valid()) { job.uploading = false; job.pending.clear(); return; }
        const texture = job.pending.values().next().value;
        job.pending.delete(texture);
        if (texture && job.uploaded.get(texture) !== texture.version) {
          R.initTexture(texture); job.uploaded.set(texture, texture.version);
        }
        if (job.pending.size) idle(upload); else job.uploading = false;
      };
      idle(upload);
    });
  }
  function nativeModel({ scene: model, animations }, i) {
    model.userData.nativeScene = true;
    model.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = !/Mist|Glint|Waterfall_Moving/.test(o.name); o.receiveShadow = true;
      if (i != null) o.userData.i = i;
      for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
        if (mat && mat.map) mat.map.anisotropy = maxAniso;
      }
    });
    prepareMaterials(model);
    const mixer = new T.AnimationMixer(model);
    for (const clip of animations) mixer.clipAction(clip).setLoop(T.LoopRepeat, Infinity).play();
    mixer.update(0);
    animatedModels.push({ model, mixer });
    return model;
  }
  function clearAnimatedModels() {
    for (const { model, mixer } of animatedModels) {
      mixer.stopAllAction(); mixer.uncacheRoot(model);
      model.traverse(o => {
        if (!o.userData.nativeGrey) return;
        for (const m of o.userData.nativeGrey) m.dispose();
        o.material = o.userData.nativeBase;
      });
    }
    animatedModels.length = 0; modelDelta = 0;
  }
  function placeModel(i, d) {
    const F = lotF[i], land = landG;
    if (d.animated) {
      GLB.loadScene(d.url).then(pack => {
        if (landG !== land || !F) return;
        const g = new T.Group(), p = F.at(d.x || 0, d.z || 0, 0);
        g.position.set(p.x, Terrain.SEA_Y + (d.y || 0), p.z); g.rotation.y = F.yaw + (d.ry || 0); g.scale.setScalar((d.s || 1) * TW);
        if (d.own) g.position.y = Math.max(g.position.y, p.y);
        const model = nativeModel(pack, i);
        g.add(model); land.add(g);
        if (!lotMesh[i]) lotMesh[i] = model;
        if (mark[i] && mark[i].m) setMort(i, true, false);
        shadowDirty = true;
      }).catch(e => Diag.note('3d', `animated model ${d.url} not read: ${e && e.message}`));
      return;
    }
    GLB.load(d.url).then(({ geometry, material }) => {
      if (landG !== land || !F) return;
      geometry.userData.keep = material.userData.keep = true;           // (kept for a board made again)
      modelWater(material);
      const g = new T.Group(), p = F.at(d.x || 0, d.z || 0, 0);
      g.position.set(p.x, Terrain.SEA_Y + (d.y || 0), p.z); g.rotation.y = F.yaw + (d.ry || 0); g.scale.setScalar((d.s || 1) * TW);
      if (d.own) g.position.y = Math.max(g.position.y, p.y);                  // (on the island made here)
      const m = new T.Mesh(geometry, material);
      m.castShadow = true; m.receiveShadow = true; m.userData.i = i; m.userData.model = true;
      g.add(m); prepareMaterials(g); landG.add(g);
      if (!lotMesh[i]) lotMesh[i] = m;
      if (mark[i] && mark[i].m) setMort(i, true, false);
      shadowDirty = true;
      Diag.note('3d', `model ${d.url}: ${geometry.index ? geometry.index.count / 3 : 0} triangles`);
    }).catch(e => Diag.note('3d', `model ${d.url} not read: ${e && e.message}`));
  }
  // a corner square's model, standing on the square
  function placeCorner(i, tile, d) {
    const land = landG;
    if (d.animated) {
      GLB.loadScene(d.url).then(pack => {
        if (landG !== land) return;
        const g = new T.Group(), model = nativeModel(pack, i);
        const fit = new T.Group(); fit.add(model); fit.rotation.y = d.ry || 0; fit.updateMatrixWorld(true);
        const box = new T.Box3().setFromObject(fit), size=box.getSize(new T.Vector3()), middle=box.getCenter(new T.Vector3());
        const scale = Math.min(C-.16,d.fitWidth || C-.16)/Math.max(size.x,size.z,.001);
        // Fit after rotation, with a safety margin for native foliage motion. No geometry reaches the adjoining deeds.
        fit.position.set(-middle.x,-box.min.y,-middle.z);g.add(fit);g.scale.setScalar(scale);g.position.set(0,TH+.012,0);
        g.name='Corner_Diorama_'+i;g.userData.footprint=Math.max(size.x,size.z)*scale;
        tile.add(g);lotMesh[i]=model;cornerTitle(i,tile,TH+.012+size.y*scale);shadowDirty=true;
      }).catch(e => Diag.note('3d', `animated model ${d.url} not read: ${e && e.message}`));
      return;
    }
    GLB.load(d.url).then(({ geometry, material }) => {
      if (landG !== land) return;
      geometry.userData.keep = material.userData.keep = true;
      modelWater(material);
      const g = new T.Group(), m = new T.Mesh(geometry, material);
      m.rotation.y=d.ry||0;m.updateMatrixWorld(true);
      const box=new T.Box3().setFromObject(m),size=box.getSize(new T.Vector3()),middle=box.getCenter(new T.Vector3());
      m.position.set(-middle.x,-box.min.y,-middle.z);const scale=Math.min(C-.16,d.fitWidth||C-.16)/Math.max(size.x,size.z,.001);
      g.position.set(0,TH+.012,0);g.scale.setScalar(scale);
      m.castShadow = true; m.receiveShadow = true; m.userData.i = i; m.userData.model = true;
      g.add(m); prepareMaterials(g); tile.add(g);cornerTitle(i,tile,TH+.012+size.y*scale);
      lotMesh[i] = m;
      shadowDirty = true;
    }).catch(e => Diag.note('3d', `model ${d.url} not read: ${e && e.message}`));
  }
  // the middle's model: in the board's middle, its water line on the sea's, made lower by sy
  function placeCenter(d) {
    const land = landG;
    if (d.animated) {
      GLB.loadScene(d.url, 10).then(pack => {
        if (landG !== land) return;
        // The board already owns the sea. Its surface continues around the native island and its ship.
        const ocean = pack.scene.getObjectByName('Ocean_Surface');
        if (ocean && ocean.parent) ocean.parent.remove(ocean);
        pack.scene.updateMatrixWorld(true);
        const base = pack.scene.getObjectByName(d.fitNode || 'Island_High_Detail_PBR') || pack.scene;
        const box = new T.Box3().setFromObject(base), size = box.getSize(new T.Vector3()), middle = box.getCenter(new T.Vector3());
        const scale = d.width ? d.width / Math.max(size.x, size.z) : (d.s || 1);
        const waterline = d.waterline || 0;
        const g = new T.Group(), model = nativeModel(pack);
        // A wrapper keeps fitting transforms separate from all animated node transforms, including the ship and birds.
        g.position.set(0, Terrain.SEA_Y + (d.y || 0), 0); g.rotation.y = d.ry || 0; g.scale.setScalar(scale);
        model.position.set(-middle.x, -waterline, -middle.z);
        g.add(model); land.add(g);
        landTop = Math.max(landTop, g.position.y + (box.max.y - waterline) * scale);
        if (cam) distances();
        shadowDirty = true;
        let triangles = 0;
        model.traverse(o => { if (o.isMesh) triangles += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
        Diag.note('3d', `animated model ${d.url}: ${Math.round(triangles)} triangles, ${pack.animations.length} clips, width ${(Math.max(size.x, size.z) * scale).toFixed(2)}`);
      }).catch(e => Diag.note('3d', `animated model ${d.url} not read: ${e && e.message}`));
      return;
    }
    GLB.load(d.url).then(({ geometry, material }) => {
      if (landG !== land) return;
      geometry.userData.keep = material.userData.keep = true;
      modelWater(material, d.lava);
      const m = new T.Mesh(geometry, material);
      m.position.set(0, Terrain.SEA_Y, 0); m.rotation.y = d.ry || 0; m.scale.set(d.s, d.s * (d.sy || 1), d.s);
      m.castShadow = true; m.receiveShadow = true;
      prepareMaterials(m); landG.add(m);
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
  const life = { ready: false, groups: [], pts: null, models: [] };
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
      for (const a of fx.actors || []) {
        const act = actorOf(a, at, F, tile, rnd() * 20);
        if (a.model && typeof GLB !== 'undefined' && GLB) modelActor(act, a.model, i); else add(act);
      }
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
    for (let k = 0; k < (isl && MOD.centerModel && MOD.centerModel.animated ? 0 : isl ? 3 : 4); k++) {
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
  // an actor that is a model from a file (a ship at anchor, the whirlpool's swirl): its own mesh, moved like the others
  function modelActor(act, d, i) {
    const rec = { act, d, mesh: null }, land = landG;
    life.models.push(rec);
    if (d.animated) {
      GLB.loadScene(d.url).then(pack => {
        if (landG !== land) return;
        const g = new T.Group(); g.rotation.order = 'YXZ';
        const model = nativeModel(pack, i);
        g.add(model); root.add(g); rec.mesh = g;
        if (i != null && OWNABLE(BOARD[i])) { lotMesh[i] = model; if (mark[i] && mark[i].m) setMort(i, true, false); }
        lifeStep(U.time.value); shadowDirty = true;
      }).catch(e => Diag.note('3d', `animated model ${d.url} not read: ${e && e.message}`));
      return;
    }
    GLB.load(d.url).then(({ geometry, material }) => {
      if (landG !== land) return;
      geometry.userData.keep = material.userData.keep = true;
      modelWater(material);
      const m = new T.Mesh(geometry, material);
      m.castShadow = true; m.receiveShadow = true; m.rotation.order = 'YXZ';
      prepareMaterials(m); root.add(m); rec.mesh = m;
      lifeStep(U.time.value);
    }).catch(e => Diag.note('3d', `model ${d.url} not read: ${e && e.message}`));
  }
  // everything alive put in its place for time t
  function lifeStep(t) {
    if (!life.ready) return;
    const f = U.fade.value, on = f > 0.003;
    for (const r of life.models) {
      if (!r.mesh) continue;
      r.mesh.visible = on;
      if (!on) continue;
      POSE.yaw = POSE.roll = POSE.pitch = 0; POSE.s = 1;
      r.act.up(t, POSE);
      const k = POSE.s * (r.d.s || 1) * f;
      r.mesh.position.copy(POSE.p); r.mesh.position.y += (r.d.y || 0) * k;
      r.mesh.rotation.set(POSE.roll, POSE.yaw + (r.d.ry || 0), POSE.pitch);
      r.mesh.scale.set(k, k * (r.d.sy || 1), k);
    }
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
    const g = new T.Group(), nautical=wantWorld()==='sea';
    if (!mats.poleGeo) { const B = new Models.Builder(); B.add(Models.shapes.cyl(0.011, 0.014, 0.62, 6), 0x4a3020); B.add(new T.SphereGeometry(0.022, 8, 6), 0xe0ad45, 0, 0.63, 0); mats.poleGeo = B.build(); }
    const pole = new T.Mesh(mats.poleGeo, mats.scenery);pole.scale.y=nautical?1.45:1;
    pole.castShadow = true; g.add(pole);
    const width=nautical?.43:.26,height=nautical?.28:.16;
    const cg = new T.PlaneGeometry(width, height, 16, 6);
    cg.translate(width/2, 0, 0);
    if(nautical) { // Swallowtail pennant: a real cut edge, not a rectangular decal.
      const p=cg.attributes.position;
      for(let j=0;j<p.count;j++) if(p.getX(j)>width*.85) p.setX(j,p.getX(j)-.075*(1-Math.abs(p.getY(j))/(height/2)));
    }
    const cloth = new T.Mesh(cg, new T.MeshLambertMaterial({ color: 0xffffff, side: T.DoubleSide, emissive:nautical?0x3c3016:0x000000,emissiveIntensity:.18 }));
    cloth.position.set(0.012, nautical?.78:.52, 0);
    cloth.userData.base = Float32Array.from(cg.attributes.position.array);
    g.add(cloth);
    const p = toWorld(i, nautical?-.39:.38, -(D / 2) + (nautical?.07:.03), nautical?TH+.025:.03);
    g.position.copy(p); g.rotation.y = yawOf(sideOf(i));
    let glow=null,canvas=null;
    if(nautical) {
      canvas=document.createElement('canvas');canvas.width=384;canvas.height=256;
      const map=new T.CanvasTexture(canvas);map.encoding=T.sRGBEncoding;map.anisotropy=maxAniso;cloth.material.map=map;
      glow=new T.Mesh(new T.RingGeometry(.045,.085,24),new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.42,depthWrite:false}));
      glow.rotation.x=-Math.PI/2;glow.position.y=.006;g.add(glow);
    }
    g.visible = false;
    prepareMaterials(g); root.add(g);
    flags[i] = { g, cloth, glow, canvas, width, nautical, h: 1 };
    return flags[i];
  }
  function colorFlag(f,seat,mort=false) {
    const color=SEAT_COLORS[seat]||'#888';
    if(!f.nautical) {f.cloth.material.color.set(color);if(mort)f.cloth.material.color.lerp(new T.Color(0x777777),.55);return;}
    const x=f.canvas.getContext('2d');x.clearRect(0,0,384,256);x.fillStyle=color;x.fillRect(0,0,384,256);
    x.fillStyle='rgba(10,30,36,.18)';x.fillRect(0,178,384,78);
    x.strokeStyle='#ffdf96';x.lineWidth=11;x.strokeRect(7,7,370,242);
    // Ivory skull, crossed cutlasses and brass eyelets remain recognizable at game scale.
    x.strokeStyle='#102c36';x.lineWidth=17;x.lineCap='round';
    x.beginPath();x.moveTo(97,179);x.lineTo(257,83);x.moveTo(101,80);x.lineTo(258,180);x.stroke();
    x.strokeStyle='#fff1c5';x.lineWidth=10;x.stroke();
    x.fillStyle='#fff1c5';x.beginPath();x.ellipse(180,102,55,51,0,0,TAU);x.fill();x.fillRect(150,127,60,35);
    x.fillStyle='#14313a';for(const ex of [160,199]){x.beginPath();x.ellipse(ex,104,12,16,0,0,TAU);x.fill();}
    x.beginPath();x.moveTo(180,121);x.lineTo(171,136);x.lineTo(188,136);x.closePath();x.fill();
    x.strokeStyle='#14313a';x.lineWidth=4;for(let n=0;n<3;n++){x.beginPath();x.moveTo(165+n*15,148);x.lineTo(165+n*15,163);x.stroke();}
    x.fillStyle='#fff1c5';x.font=`900 28px ${FONT.num}`;x.textAlign='center';x.textBaseline='middle';x.fillText(String(seat+1).padStart(2,'0'),180,214);
    f.cloth.material.map.needsUpdate=true;f.cloth.material.color.set(mort?0x858585:0xffffff);f.glow.material.color.set(color);f.glow.visible=!mort;
  }
  const towerSlots = [[], [0], [-0.17, 0.17], [-0.28, 0, 0.28], [-0.33, -0.11, 0.11, 0.33]];
  // all the towers of the board are drawn as one instanced mesh (and the fortresses as another), roofs coloured per copy
  const BLD = { ready: false, grow: {}, busy: 0, dirty: false };
  function buildingMeshes() {
    const tw = MOD.tower(), ca = MOD.castle();
    const roofMat = new T.MeshLambertMaterial({ color: 0xffffff });
    BLD.tb = new T.InstancedMesh(tw.body, mats.stone, 96); BLD.tr = new T.InstancedMesh(tw.roof, roofMat, 96);
    BLD.cb = new T.InstancedMesh(ca.body, mats.stone, 24); BLD.cr = new T.InstancedMesh(ca.roof, roofMat, 24);
    BLD.tr.setColorAt(0, new T.Color(0xffffff)); BLD.cr.setColorAt(0, new T.Color(0xffffff));      // so the shader is made with colours per copy
    for (const m of [BLD.tb, BLD.tr, BLD.cb, BLD.cr]) { m.count = 0; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; root.add(m); }
    // where a tower can go up now (see the signs below): a gold ring on the square, pulsing
    const ring = new T.RingGeometry(0.105, 0.155, 32);
    ring.rotateX(-Math.PI / 2);
    BLD.ring = new T.InstancedMesh(ring, new T.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.85, depthWrite: false }), 24);
    BLD.ring.count = 0; BLD.ring.frustumCulled = false; BLD.ring.renderOrder = 3;
    root.add(BLD.ring);
    BLD.ready = true;
    pinCam.fill(NaN);
  }
  const _m = new T.Matrix4(), _q = new T.Quaternion(), _s = new T.Vector3(), _c = new T.Color(), _up = new T.Vector3(0, 1, 0);
  function layoutBuildings(now) {
    if (!BLD.ready) return;
    BLD.dirty = false;
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
  function updateBuildings(now) {
    if (BLD.busy || BLD.dirty) layoutBuildings(now);
  }
  function placeBuildings(i, lv, seat, anim, prev) {
    if (anim && lv > (prev || 0)) {
      const now = performance.now();
      if (lv >= 5) BLD.grow[i + ':c'] = now; else for (let j = Math.min(prev || 0, 4); j < lv; j++) BLD.grow[i + ':' + j] = now;
      if (lv < 5) dust(toWorld(i, towerSlots[lv][lv - 1], -D / 2 + 0.2, TH)); else dust(toWorld(i, 0, -D / 2 + 0.2, TH));
    }
    layoutBuildings(performance.now());
  }
  // ----- the signs over the squares where this device's player can build now -----
  // The page makes them (ui.js: a hut and its price, a tap builds there); here each is kept over its square as the camera
  // moves: over the spot where the next tower would rise, as big as a square is on the screen (never too small to tap),
  // one raised over another where they would cover each other. A gold ring pulses on the spot itself.
  let pinEls = [];
  const pinCam = new Float32Array(18).fill(NaN), _pa = new T.Vector3(), _pb = new T.Vector3();
  function pinSpot(i, lv) {
    const n = clamp(lv, 1, 5), x = n >= 5 ? 0 : towerSlots[n][n - 1];
    return toWorld(i, x, -D / 2 + 0.2, (tiles[i] ? tiles[i].position.y : 0) + TH + 0.006);
  }
  function pins(list) {
    for (const p of pinEls) if (!list.some(q => q.el === p.el)) p.el.hidden = true;
    pinEls = (list || []).filter(p => p && p.el && BOARD[p.i] && BOARD[p.i].k === 'p');
    pinCam.fill(NaN);                                      // placed again at the next frame
    if (BLD.ring) BLD.ring.count = 0;
    if (running && cam) pinFrame(performance.now() / 1000);
  }
  const sx = v => (v.x + 1) / 2 * W, sy = v => (1 - v.y) / 2 * H;
  function placePins() {
    const out = [];
    _pb.set(0, 0, 0).project(cam);
    const midX = sx(_pb);
    for (const p of pinEls) {
      const a = pinSpot(p.i, p.lv), el = p.el;
      _pa.copy(a).project(cam);
      if (_pa.z > 1 || Math.abs(_pa.x) > 1.02 || Math.abs(_pa.y) > 1.02) { if (!el.hidden) el.hidden = true; continue; }
      const x = sx(_pa), y = sy(_pa), [ax, az] = ALONG[sideOf(p.i)];
      _pb.set(a.x + ax, a.y, a.z + az).project(cam);
      const ex = sx(_pb) - x, ey = sy(_pb) - y, k = clamp(Math.hypot(ex, ey) / 84, 0.7, 1.1);
      _pb.set(a.x, a.y + 0.55, a.z).project(cam);
      if (el.hidden) el.hidden = false;
      const b = el.firstElementChild;
      if (!el._w && b) { el._w = b.offsetWidth; el._h = b.offsetHeight; }
      // its side of the board runs across the screen (the signs go up, one over another) or along it (they go aside,
      // towards the middle of the board)
      out.push({ el, x, y, k, w: (el._w || 56) * k, h: (el._h || 80) * k, lift: Math.max(16, y - sy(_pb)), across: Math.abs(ex) >= Math.abs(ey), inward: midX >= x ? 1 : -1, dx: 0 });
    }
    // nearer the camera first; a sign that would cover one already placed goes to the first free place next to it
    out.sort((a, b) => b.y - a.y);
    const hits = (q, n, dx, up) => {
      const cx = q.x + dx, bot = q.y - q.lift - up;
      for (let j = 0; j < n; j++) {
        const o = out[j], ox = o.x + o.dx, ob = o.y - o.lift;
        if (Math.abs(ox - cx) < (o.w + q.w) / 2 * 0.96 && bot > ob - o.h * 0.96 && bot - q.h * 0.96 < ob) return true;
      }
      return false;
    };
    out.forEach((q, n) => {
      const side = q.inward * q.w * 1.02;
      const tries = q.across ? [[0, 0], [0, 1], [side, 0], [-side, 0], [0, 2], [side, 1]] : [[0, 0], [side, 0], [0, 1], [-side, 0], [side, 1], [0, 2]];
      const [dx, up] = tries.find(([dx, up]) => !hits(q, n, dx, up * q.h)) || [0, 0];
      q.lift += up * q.h;
      // kept on the screen: the sign moves aside (its stem leans to reach it), or down from the top edge
      q.dx = clamp(q.x + dx, q.w / 2 + 4, W - q.w / 2 - 4) - q.x;
      q.lift = Math.min(q.lift, q.y - q.h - 2);
      if (q.lift < -q.h * 0.35) { q.el.hidden = true; return; }
      const st = q.el.style, len = Math.hypot(q.dx, Math.max(0, q.lift));
      st.transform = `translate3d(${q.x.toFixed(1)}px,${q.y.toFixed(1)}px,0)`;
      st.setProperty('--lift', q.lift.toFixed(1) + 'px');
      st.setProperty('--dx', q.dx.toFixed(1) + 'px');
      st.setProperty('--len', len.toFixed(1) + 'px');
      st.setProperty('--ang', Math.atan2(q.dx, q.lift).toFixed(3) + 'rad');
      st.setProperty('--k', q.k.toFixed(3));
    });
  }
  // every frame while there are signs: placed again when the camera (or the screen) changed, the rings pulse
  function pinFrame(t) {
    if (!pinEls.length) { if (BLD.ring && BLD.ring.count) BLD.ring.count = 0; return; }
    const e = cam.matrixWorld.elements;
    let moved = pinCam[16] !== W || pinCam[17] !== H;
    for (let k = 0; k < 16 && !moved; k++) moved = pinCam[k] !== e[k];
    if (moved) { pinCam.set(e); pinCam[16] = W; pinCam[17] = H; placePins(); }
    if (!BLD.ring) return;
    const n = Math.min(pinEls.length, 24), beat = REDUCED ? 0 : Math.sin(t * 3.4);
    for (let j = 0; j < n; j++) {
      const p = pinEls[j], s = (p.lv >= 5 ? 2.4 : 1) * (1 + 0.13 * beat);
      _m.compose(pinSpot(p.i, p.lv), _q.identity(), _s.set(s, 1, s));
      BLD.ring.setMatrixAt(j, _m);
    }
    BLD.ring.count = n; BLD.ring.instanceMatrix.needsUpdate = true;
    BLD.ring.material.opacity = 0.62 + 0.28 * beat;
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
    updateTileLabel(i);
    sideMat[i].color.copy(CREAM);
    if (seat >= 0) sideMat[i].color.lerp(new T.Color(SEAT_COLORS[seat]), 0.6);
    const f = flagFor(i);
    if (seat < 0) { f.g.visible = false; layoutBuildings(performance.now()); return; }
    colorFlag(f,seat,k.m);
    f.g.visible = true;
    layoutBuildings(performance.now());
    if (anim && was !== seat) {
      f.cloth.position.y = 0.12;
      tween(0.7, e => { f.cloth.position.y = 0.12 + (topOf(k) - 0.12) * e; }, ease.out);
      if (wantWorld() === 'sea') placeEvent(i, 'purchase', seat); else pop(i);
    } else f.cloth.position.y = topOf(k);
  }
  const topOf = k => wantWorld()==='sea' ? k.m?.4:.78 : k.m?.3:.52;
  function setLevel(i, lv, anim) {
    if (!ok || BOARD[i].k !== 'p') return;
    const k = mark[i] || (mark[i] = { o: -1, lv: 0, m: false });
    const prev = k.lv;
    k.lv = lv;
    updateTileLabel(i);
    placeBuildings(i, lv, k.o, anim, prev);
    if (anim) { if (wantWorld() === 'sea') placeEvent(i, 'build', k.o); else pop(i, 0.06); }
  }
  function setMort(i, m, anim) {
    if (!ok || !OWNABLE(BOARD[i])) return;
    const k = mark[i] || (mark[i] = { o: -1, lv: 0, m: false });
    k.m = m;
    updateTileLabel(i);
    layoutBuildings(performance.now());
    labelMat[i].color.set(m ? 0x9b8f7a : 0xffffff);
    const lm = lotMesh[i];
    if (placeModelsLife && typeof PlaceModels3D !== 'undefined' && PlaceModels3D.indices.includes(i)) {
      if (placeModelsLife.setMort) placeModelsLife.setMort(i, m);
    } else if (lm && lm.userData.nativeScene) {
      lm.traverse(o => {
        if (!o.isMesh) return;
        const u = o.userData;
        if (!u.nativeBase) {
          u.nativeBase = o.material;
          u.nativeGrey = (Array.isArray(o.material) ? o.material : [o.material]).map(mat => {
            const grey = mat.clone(); delete grey.userData.keep;
            if (grey.color) grey.color.multiplyScalar(0.55);
            return grey;
          });
        }
        o.material = m ? (Array.isArray(u.nativeBase) ? u.nativeGrey : u.nativeGrey[0]) : u.nativeBase;
      });
    } else if (lm && lm.userData.model) {                   // a model from a file: its own material, greyed
      const u = lm.userData;
      if (!u.base) { u.base = lm.material; u.grey = modelWater(u.base.clone()); u.grey.color.multiplyScalar(0.55); u.grey.userData.keep = true; }
      lm.material = m ? u.grey : u.base;
    } else if (lm) lm.material = m ? (mats.mortScenery || (mats.mortScenery = living(new T.MeshLambertMaterial({ vertexColors: true, color: 0x8a8a8a })))) : mats.scenery;
    if (lm) prepareMaterials(lm);
    const f = flags[i];
    if (f && f.g.visible) {
      const to = topOf(k), from = f.cloth.position.y;
      if (anim) tween(0.5, e => { f.cloth.position.y = from + (to - from) * e; }); else f.cloth.position.y = to;
      colorFlag(f,k.o,m);
    }
  }
  function placeEvent(i, kind = 'arrival', seat = turnSeat) {
    if (wantWorld() !== 'sea' || !Number.isInteger(i) || i < 0 || i >= 40) return;
    const color = SEAT_COLORS[seat] || '#f4cb75';
    if (placeEffects) placeEffects.trigger(i, kind, color);
    if (placeModelsLife) placeModelsLife.trigger(i, kind, color);
    if (mapPropsLife) mapPropsLife.trigger(i, kind, color);
    shadowDirty = true;
  }
  // Sea landmarks react with their moving parts and 3D spray; the land keeps its pop.
  function pop(i, amt = 0.14) {
    if (wantWorld() === 'sea') { placeEvent(i, 'inspect'); return; }
    const m = lotMesh[i];
    if (!m) return;
    if (!(i % 10)) tween(0.5, e => { m.scale.set(1, 1 + Math.sin(e * Math.PI) * amt, 1); }, ease.lin);
    else tween(0.5, e => { m.position.y = Math.sin(e * Math.PI) * amt * 0.8; }, ease.lin);
  }
  // a whole region has one owner: its lots jump one after another and confetti flies
  function celebrate(g, seat) {
    if (!ok) return;
    const my = epoch;
    GROUP_TILES[g].forEach((i, k) => later(k * 0.18).then(() => { if (epoch !== my) return; if (wantWorld() === 'sea') placeEvent(i, 'celebrate', seat); else { pop(i, 0.28); confetti(lotF[i] ? lotF[i].at(0, 0, 0.4) : toWorld(i, 0, -(D / 2 + LOT / 2), 0.6), seat); } }));
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
  // Minted coins and ingots travel between the actual figures and the bank. The archipelago's bank is its central
  // treasure cave; the land's is the start square. Every transfer uses the same small geometry/material cache.
  let coinGeo = null, coinMat = null, currencyAssets = null;
  const currencyFlights = new Set();
  function currencyCache() {
    if (currencyAssets) return currencyAssets;
    coinGeo = new T.CylinderGeometry(0.105, 0.105, 0.026, 24);
    coinMat = new T.MeshStandardMaterial({ color: 0xffd367, metalness: 0.64, roughness: 0.24, emissive: 0x6c3a04, emissiveIntensity: 0.14 });
    const edge = new T.MeshStandardMaterial({ color: 0xd99b24, metalness: 0.72, roughness: 0.28 });
    const glow = new T.MeshBasicMaterial({ color: 0xffe4a2, transparent: true, opacity: 0.64, depthWrite: false });
    const shape = new T.Shape();
    shape.moveTo(-0.13, -0.05); shape.lineTo(0.13, -0.05); shape.lineTo(0.105, 0.045); shape.lineTo(-0.105, 0.045); shape.closePath();
    const bar = new T.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.009, bevelSize: 0.009, bevelSegments: 1, steps: 1 });
    bar.translate(0, 0, -0.06);
    currencyAssets = { body: coinGeo, rim: new T.TorusGeometry(0.084, 0.006, 4, 20), stamp: new T.CylinderGeometry(0.025, 0.025, 0.004, 6), bar,
      bead: new T.OctahedronGeometry(0.037), ring: new T.TorusGeometry(0.25, 0.014, 4, 28), gold: coinMat, edge, glow };
    for (const asset of Object.values(currencyAssets)) asset.userData.keep = true;
    return currencyAssets;
  }
  function currencyAnchor(seat) {
    if (seat >= 0) return toks[seat] && toks[seat].g.visible ? toks[seat].g.position.clone().add(new T.Vector3(0, MOD.world === 'sea' ? 0.75 : 0.57, 0)) : null;
    if (MOD.world === 'sea') {
      for (const { model } of animatedModels) {
        const treasure = model.getObjectByName('Treasure_Glint_00');
        if (treasure) return treasure.getWorldPosition(new T.Vector3()).add(new T.Vector3(0, 0.18, 0));
      }
      return new T.Vector3(0.7, Math.max(0.65, Terrain.SEA_Y + 0.8), 1.15);
    }
    return toWorld(0, 0.18, -0.2, TH + 0.65);
  }
  function currencyLabel(p, to, amount) {
    const label = document.createElement('div');
    label.className = 'currency-world-label' + (to < 0 ? ' bank' : '') + (REDUCED ? ' reduced' : '');
    label.textContent = (to < 0 ? 'ბანკი · ' : '+') + String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    label.style.opacity = REDUCED ? 1 : 0;
    host.appendChild(label);
    const projected = new T.Vector3();
    const place = (lift = 0) => {
      projected.copy(p); projected.y += 0.34 + lift; projected.project(cam);
      label.hidden = projected.z > 1 || projected.z < -1;
      label.style.left = ((projected.x + 1) * 0.5 * W) + 'px';
      label.style.top = ((1 - projected.y) * 0.5 * H) + 'px';
    };
    place();
    return { label, place };
  }
  function coins(from, to, amount) {
    if (!ok || !root || !Number.isFinite(amount) || amount <= 0 || from === to) return Promise.resolve();
    const a = currencyAnchor(from), b = currencyAnchor(to);
    if (!a || !b) return Promise.resolve();
    const board = root, generation = epoch, fx = new T.Group(), tag = currencyLabel(b, to, amount);
    fx.name = 'Currency_Transfer'; fx.userData = { from, to, amount };
    let finished = false;
    const remove = () => {
      if (finished) return;
      finished = true; board.remove(fx); tag.label.remove(); currencyFlights.delete(remove);
    };
    // A burst of simultaneous payments still has a fixed ceiling. No delayed callback can add coins to a new world.
    if (currencyFlights.size >= 4) currencyFlights.values().next().value();
    currencyFlights.add(remove);
    if (REDUCED) return tween(0.18, () => { if (epoch !== generation || root !== board) remove(); else tag.place(); }, ease.lin).then(remove);
    const cache = currencyCache(), n = Math.min(20, 10 + Math.round(Math.sqrt(amount) * 0.45));
    const distance = a.distanceTo(b), lift = Math.min(2.4, 0.75 + distance * 0.14), list = [];
    for (let k = 0; k < n; k++) {
      const g = new T.Group(), ingot = amount >= 250 && k % 7 === 6;
      g.name = ingot ? 'Gold_Ingot' : 'Gold_Coin';
      if (ingot) g.add(new T.Mesh(cache.bar, cache.gold));
      else {
        g.add(new T.Mesh(cache.body, [cache.edge, cache.gold, cache.gold]));
        const rim = new T.Mesh(cache.rim, cache.gold); rim.rotation.x = Math.PI / 2; rim.position.y = 0.017;
        const stamp = new T.Mesh(cache.stamp, cache.edge); stamp.position.y = 0.016;
        g.add(rim, stamp);
      }
      const trails = [];
      if (k % 5 === 0) for (let j = 0; j < 3; j++) { const bead = new T.Mesh(cache.bead, cache.glow); fx.add(bead); trails.push(bead); }
      g.position.copy(a); g.visible = false; fx.add(g);
      list.push({ g, trails, delay: k / (n - 1) * 0.22, phase: k * 2.39996 });
    }
    const halo = new T.Mesh(cache.ring, cache.glow); halo.rotation.x = Math.PI / 2; halo.position.copy(b); halo.visible = false; fx.add(halo);
    const sparks = [];
    for (let k = 0; k < 8; k++) { const m = new T.Mesh(cache.bead, cache.gold); fx.add(m); sparks.push(m); }
    prepareMaterials(fx); board.add(fx);
    const point = (p, u, phase) => {
      const arc = Math.sin(Math.PI * u), spread = Math.sin(phase) * 0.22;
      p.set(a.x + (b.x - a.x) * u + Math.cos(phase) * 0.22 * arc,
        a.y + (b.y - a.y) * u + (lift + spread) * arc, a.z + (b.z - a.z) * u + spread * arc);
    };
    return tween(0.94, e => {
      if (finished || epoch !== generation || root !== board || e === 1) { remove(); return; }
      for (const item of list) {
        const raw = (e * 0.94 - item.delay) / 0.61, u = clamp(raw, 0, 1);
        item.g.visible = raw >= 0 && raw < 1;
        point(item.g.position, u, item.phase);
        item.g.rotation.set(item.phase + u * 10, item.phase * 0.3 + u * 7, u * 4);
        item.g.scale.setScalar(u > 0.9 ? Math.max(0.001, (1 - u) / 0.1) : 0.88 + Math.sin(Math.PI * u) * 0.2);
        item.trails.forEach((trail, j) => {
          const follow = clamp(u - (j + 1) * 0.065, 0, 1);
          trail.visible = raw > 0.05 && raw < 1;
          point(trail.position, follow, item.phase); trail.scale.setScalar((1 - j * 0.24) * Math.sin(Math.PI * u));
        });
      }
      const arrival = clamp((e - 0.62) / 0.38, 0, 1), burst = Math.sin(Math.PI * arrival);
      halo.visible = arrival > 0; halo.scale.setScalar(0.4 + arrival * 2.1);
      sparks.forEach((spark, k) => {
        const angle = k / sparks.length * TAU;
        spark.visible = arrival > 0; spark.scale.setScalar(burst);
        spark.position.set(b.x + Math.cos(angle) * arrival * 0.5, b.y + burst * 0.3, b.z + Math.sin(angle) * arrival * 0.5);
      });
      tag.label.style.opacity = e < 0.5 ? 0 : e > 0.86 ? (1 - e) / 0.14 : Math.min(1, (e - 0.5) / 0.1);
      tag.place(arrival * 0.17);
    }, ease.lin).then(remove);
  }
  function bounceTile(i) {
    const m = tiles[i];
    if (!m) return;
    tween(0.28, e => { m.position.y = -Math.sin(e * Math.PI) * 0.06; BLD.dirty = true; }, ease.lin);
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
    prepareMaterials(g); root.add(g);
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
    const caught = jailedNow(seat), seaCorner = wantWorld()==='sea' && at%10===0;
    const here = st.players.map((p, s) => s).filter(s => !st.players[s].out && pos[s] === at && (seaCorner || jailedNow(s) === caught));
    const k = Math.max(0, here.indexOf(seat)), n = Math.max(1, here.length);
    const cols = n <= 2 ? n : n <= 4 ? 2 : 3, rows = Math.ceil(n / cols);
    const gx = (k % cols) - (cols - 1) / 2, gz = Math.floor(k / cols) - (rows - 1) / 2;
    if(seaCorner) {
      // A mooring lane along the two outer edges leaves the entire corner diorama free.
      // Captured and visiting pirates share distinct slots, even when all six arrive together.
      const berth=[[.33,.98],[-.1,.98],[-.5,.98],[1.10,.4],[1.10,-.02],[1.10,-.44]][k%6];
      return toWorld(at,berth[0],berth[1],TH);
    }
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
    if (wantWorld() === 'sea') placeEvent(to, 'arrival', seat); else if (to % 10) pop(to, 0.05);
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
    if (wantWorld() === 'sea') placeEvent(to, 'arrival', seat); else if (to % 10) pop(to, 0.05);
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
    const across = clamp(W / (MOD.world === 'sea' ? 95 : 80), MOD.world === 'sea' ? 4.2 : 4.6, 12);
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
    const objs = [...tiles, ...lotGround, ...lotMesh.filter(Boolean), ...(mapPropsLife ? [mapPropsLife.group] : [])];
    const hit = ray.intersectObjects(objs, true)[0];
    if (!hit) return;
    let o = hit.object;
    if (o.userData.ground) {
      // Neighbouring lot rectangles can overlap beside corners; choose the nearest centre.
      let nearest = -1, best = Infinity;
      for (let i = 0; i < 40; i++) {
        if (!(i % 10)) continue;
        const c = toWorld(i, 0, -(D / 2 + LOT / 2)), r = yawOf(sideOf(i)), dx = hit.point.x - c.x, dz = hit.point.z - c.z;
        const lx = dx * Math.cos(r) - dz * Math.sin(r), lz = dx * Math.sin(r) + dz * Math.cos(r);
        const distance = dx * dx + dz * dz;
        if (Math.abs(lx) <= TW / 2 && Math.abs(lz) <= LOT / 2 && distance < best) { nearest = i; best = distance; }
      }
      if (nearest >= 0) { placeEvent(nearest, 'inspect'); pickCb(nearest); }
      return;
    }
    while (o && o.userData.i == null) o = o.parent;
    if (o && o.userData.i != null && o.userData.i < 40) { placeEvent(o.userData.i, 'inspect'); pickCb(o.userData.i); }
  }

  // ===== the frame loop =====
  // Phone geometry/effects have a fixed budget. Keep its canvas sharp: reducing
  // pixels did not help the measured vertex bottleneck, but blurred the board.
  // Desktop can still lower resolution when sustained frame cadence is slow.
  let last = 0, running = false, frame = 0, quality = 2, basePR = 1, shadowDirty = true, shadowLate = false, shadowAt = 0;
  let pacer = RenderPacer.create(false), busyAvg = 1 / 60, busyN = 0, prStep = 0, prNext = 0, shadowTime = 0;
  let drewAt = 0, lostAt = 0, progN = 0;          // when a frame was last drawn; when the graphics were lost; shaders made
  const PR_STEPS = [1, 0.85, 0.72, 0.6];
  function adapt(real, target = 1 / 60) {
    if (real > 1 || real <= 0) return;
    real = Math.min(real, .25);                // bound isolated stalls without ignoring a consistently slow phone
    busyAvg = busyAvg * 0.95 + real * 0.05;
    if (mobile || ++busyN < 45 || busyAvg < Math.max(target * 1.25, 1 / 36) || prNext || prStep >= PR_STEPS.length - 1) return;
    const pr = Math.max(1, basePR * PR_STEPS[prStep + 1]);
    prStep++; busyN = 0;
    if (pr < R.getPixelRatio() - 0.01) prNext = pr;
  }
  function coarser() { Diag.note('3d', `resolution ${R.getPixelRatio().toFixed(2)} -> ${prNext.toFixed(2)} (frames ${Math.round(busyAvg * 1000)} ms)`); R.setPixelRatio(prNext); prNext = 0; busyAvg = 1 / 60; busyN = 0; PERF.coarser = (PERF.coarser || 0) + 1; resize(); }
  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);
    const real = last ? (now - last) / 1000 : 0.016, dt = Math.min(0.25, real);
    if (!REDUCED && animatedModels.length) modelDelta += dt;
    if (real > 0.35 && document.visibilityState === 'visible') Diag.slow(real * 1000);
    last = now;
    frame++;
    if (riseAt && frame >= riseAt) riseGo();
    stepTweens(dt * speedK);
    moveCamera(dt * speedK);
    const moving = tweens.length > 0 || BLD.busy > 0;
    const camStill = Math.abs(camT.yaw - camS.yaw) < 0.002 && Math.abs(camT.d - camS.d) < 0.01 && Math.abs(camT.x - camS.x) < 0.005 && Math.abs(camT.z - camS.z) < 0.005;
    const still = !moving && camStill && !Dice3D.busy;
    if (still && prNext) coarser();
    // Do not deform meshes, update animals or upload instances for an unpainted frame.
    if (!pacer.step(now, !still)) return;
    const cpuStart = performance.now();
    const visualDt = Math.min(.25, pacer.delta), t = now / 1000;
    // Set this frame's storm before water-following craft sample its wave height.
    if (weatherLife) weatherLife.update(REDUCED ? 3 : t, visualDt);
    if (marineLife) marineLife.update(REDUCED ? 3 : t, visualDt);
    if (lagoonLife) lagoonLife.update(REDUCED ? 3 : t, visualDt);
    if (reefLife) reefLife.update(REDUCED ? 3 : t, visualDt);
    if (placeModelsLife) placeModelsLife.update(REDUCED ? 3 : t, visualDt);
    if (mapPropsLife) mapPropsLife.update(REDUCED ? 3 : t, visualDt);
    if (placeEffects) placeEffects.update(REDUCED ? 3 : t, visualDt);
    pinFrame(t);
    // the figures face the camera; the one whose turn it is glows
    for (const tk of toks) {
      if (!tk || !tk.g.visible) continue;
      tk.face.rotation.y = Math.atan2(cam.position.x - tk.g.position.x, cam.position.z - tk.g.position.z);
      tk.face.rotation.x = -camS.el * 0.6;
      if (tk.glow.visible) { const s = 1 + Math.sin(t * 4) * 0.08; tk.glow.scale.set(s, s, s); tk.glow.material.opacity = 0.6 + Math.sin(t * 4) * 0.25; }
      if (tk.hull) {        // the ship turns to sail along its side of the board, and rolls
        const want = yawOf(sideOf(pos[tk.seat] || 0)) + Math.PI + 0.45, d = Math.atan2(Math.sin(want - tk.hull.rotation.y), Math.cos(want - tk.hull.rotation.y));
        tk.hull.rotation.y += d * Math.min(1, visualDt * 5);
        tk.hull.rotation.x = REDUCED ? 0 : 0.06 * Math.sin(t * 1.6 + tk.seat * 1.7); tk.hull.rotation.z = REDUCED ? 0 : 0.03 * Math.sin(t * 1.1 + tk.seat);
      }
    }
    for (const c of cornerTitles) c.sprite.position.y=c.y+(REDUCED?0:Math.sin(t*.8+c.i)*.025);
    // flags wave, the wheel turns
    for (const f of flags) {
      if (!f || !f.g.visible) continue;
      const p = f.cloth.geometry.attributes.position, b = f.cloth.userData.base;
      for (let k = 0; k < p.count; k++) { const x = b[k * 3]; p.array[k * 3 + 2] = REDUCED ? 0 : Math.sin(t * 3.4 + x * 15 + f.g.position.x) * (f.nautical ? .044 : .025) * (x / f.width); }
      p.needsUpdate = true;
      if(f.glow) f.glow.material.opacity=REDUCED?.35:.33+.09*Math.sin(t*1.8+f.g.position.x);
    }
    if (wheel) wheel.children[0].rotation.z = (REDUCED ? 0 : t) * 1.4;
    // Coins, flags and token travel do not change any building instance.
    updateBuildings(now);
    // A phone retains its contact-shadow map through ambient animation. Repainting
    // all native morph meshes periodically causes stalls even with a small map.
    // Refresh after camera/game-piece motion settles or a model/building changes.
    const need = moving || !camStill;
    if (need) shadowLate = true;
    const every = Dice3D.busy ? 4 : 1;
    const nativeShadow = !mobile && !REDUCED && animatedModels.length && now - shadowTime >= 130;
    if (shadowDirty || nativeShadow || (shadowLate && (!need || (!mobile && frame - shadowAt >= every)))) { R.shadowMap.needsUpdate = true; shadowDirty = false; shadowLate = false; shadowAt = frame; shadowTime = now; PERF.shadows++; }
    PERF.frames++;
    const lt = REDUCED ? 3 : t;              // with less motion asked for, the board's life stands still
    U.time.value = lt;
    lifeStep(lt);
    PERF.effectsMs = PERF.effectsMs == null ? performance.now() - cpuStart : PERF.effectsMs * .95 + (performance.now() - cpuStart) * .05;
    draw(visualDt * speedK);
    const cpuMs = performance.now() - cpuStart;
    PERF.cpuMs = PERF.cpuMs == null ? cpuMs : PERF.cpuMs * .95 + cpuMs * .05;
    adapt(pacer.delta, pacer.interval);
  }
  function draw(diceDt) {
    const clipsStart = performance.now();
    // Render throttling saves power, but native clips still advance by all elapsed time between drawn frames.
    if (modelDelta) { for (const { mixer } of animatedModels) mixer.update(modelDelta); modelDelta = 0; }
    const renderStart = performance.now();
    PERF.clipsMs = PERF.clipsMs == null ? renderStart - clipsStart : PERF.clipsMs * .95 + (renderStart - clipsStart) * .05;
    R.setViewport(0, 0, W, H); R.setScissorTest(false);
    R.clear();
    R.render(scene, cam);
    PERF.calls = R.info.render.calls; PERF.tris = R.info.render.triangles;
    Dice3D.frame(R, diceDt);
    drewAt = performance.now();
    PERF.drawMs = PERF.drawMs == null ? drewAt - renderStart : PERF.drawMs * .95 + (drewAt - renderStart) * .05;
    const pn = R.info.programs.length;                  // a shader made now, in the middle of a game, stalls a phone
    if (pn !== progN) { if (progN && built) Diag.note('3d', `new shader (${progN} -> ${pn}) while showing ${Diag.doing()}`); progN = pn; }
  }
  function start() {
    if (running || !ok) return;
    running = true; last = 0; pacer.reset(); drewAt = performance.now();
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
    BLD.dirty = true;
    landG.scale.y = 0.001;
    U.fade.value = 0;
    riseAt = frame + 3;
  }
  function riseGo() {
    riseAt = 0;
    for (let i = 0; i < 40; i++) {
      const m = tiles[i], d = (i / 40) * 0.9;
      later(d).then(() => tween(0.45, e => { m.position.y = -0.6 + 0.6 * e; BLD.dirty = true; }, ease.back));
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
    mobile = Math.min(screen.width, screen.height) < 700 || (navigator.maxTouchPoints > 1 && /iPhone|iPad|iPod|Android|Macintosh/.test(navigator.userAgent));
    pacer = RenderPacer.create(mobile);
    if (typeof GLB !== 'undefined' && GLB && GLB.configure) GLB.configure({ mobile, concurrency: mobile ? 2 : 4 });
    try {
      R = new T.WebGLRenderer({ antialias: !mobile, alpha: true, powerPreference: mobile ? 'default' : 'high-performance' });
    } catch (e) { console.warn('no WebGL', e); failed = true; return; }
    basePR = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75);
    quality = mobile ? 1 : 2;
    if (/[?&]lq\b/.test(location.search)) { basePR = 1; quality = 0; }
    R.setPixelRatio(basePR);
    R.outputEncoding = T.sRGBEncoding;
    // a phone gets the plainer shadow filter (a quarter of the work per pixel) and a smaller shadow map
    R.shadowMap.enabled = quality > 0; R.shadowMap.type = mobile ? T.PCFShadowMap : T.PCFSoftShadowMap;
    R.shadowMap.autoUpdate = false;                // drawn again only when something moved (see the frame loop)
    R.setClearColor(0x000000, 0);
    R.autoClear = false;
    maxAniso = Math.min(mobile ? 4 : 8, R.capabilities.getMaxAnisotropy());
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
    sun.shadow.mapSize.set(mobile ? 512 : 2048, mobile ? 512 : 2048);
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
      materialWarm = null; if (!built) prepareMaterials(root);
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
    if (marineLife) { marineLife.dispose(); marineLife = null; }
    if (lagoonLife) { lagoonLife.dispose(); lagoonLife = null; }
    if (reefLife) { reefLife.dispose(); reefLife = null; }
    if (weatherLife) { weatherLife.dispose(); weatherLife = null; }
    if (placeModelsLife) { placeModelsLife.dispose(); placeModelsLife = null; }
    if (mapPropsLife) { mapPropsLife.dispose(); mapPropsLife = null; }
    if (placeEffects) { placeEffects.dispose(); placeEffects = null; }
    clearAnimatedModels();
    if (root) { disposeAll(root); scene.remove(root); }
    root = landG = seaMesh = wheel = fallFoot = null;
    tiles.length = lotMesh.length = lotGround.length = flags.length = mark.length = toks.length = 0;
    labelTex.length = labelMat.length = sideMat.length = cornerTitles.length = 0;
    life.ready = false; life.groups.length = 0; life.models.length = 0; life.pts = null;
    BLD.ready = false; BLD.grow = {}; BLD.busy = 0; BLD.dirty = false;
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
      // Currency shaders used to be first compiled when money moved mid-game.
      const money = currencyCache(), sample = new T.Group(); sample.visible = false;
      sample.add(new T.Mesh(money.body, money.gold), new T.Mesh(money.stamp, money.edge), new T.Mesh(money.bead, money.glow));
      root.add(sample);
      try {
        if (weatherLife) weatherLife.flush();
        R.compile(scene, cam);
      } finally { root.remove(sample); }
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
    init, prepare, show, sync, walk, fly, setOwner, setLevel, setMort, pop, celebrate, coins, focus, snap, setMode, setTurn, leave, resize, halt, retheme, pins,
    reveal: placeEvent,
    placeStats: () => ({ landmarks: placeModelsLife && placeModelsLife.stats(), props: mapPropsLife && mapPropsLife.stats(), effects: placeEffects && placeEffects.stats() }),
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
      const m = R.info.memory, assets = typeof GLB !== 'undefined' && GLB && GLB.stats ? GLB.stats() : null;
      const models = assets ? ` · models ${assets.completed} ready/${assets.queued + assets.active} loading/${assets.failed} failed · mobile LOD ${assets.lodModels || 0} · model textures ~${Math.round(assets.textureBytes / 1048576)} MiB` : '';
      return `gpu ${name} · webgl${R.capabilities.isWebGL2 ? 2 : 1} · pixel ratio ${R.getPixelRatio().toFixed(2)} (${prStep} steps down) · quality ${quality} · frame ${Math.round(busyAvg * 1000)} ms (~${Math.round(1 / busyAvg)} fps / ${Math.round(1 / pacer.interval)} target) · CPU submit ${(PERF.cpuMs || 0).toFixed(1)} ms (effects ${(PERF.effectsMs || 0).toFixed(1)}, clips ${(PERF.clipsMs || 0).toFixed(1)}, draw ${(PERF.drawMs || 0).toFixed(1)}) · draw ${PERF.calls || 0}/${Math.round((PERF.tris || 0) / 1000)}k triangles · ${mobile ? 'phone' : 'computer'} · shaders ${R.info.programs.length} · textures ${m.textures} · geometries ${m.geometries}${models}${lostAt ? ' · GRAPHICS LOST' : ''}`;
    },
    onPick(cb) { pickCb = cb; },
    setPos(seat, at) { pos[seat] = at; },
    tween, ease, toWorld,
    _screen(i) { const c = centerOf(i).setY(TH); c.project(cam); const r = host.getBoundingClientRect(); return [r.left + (c.x + 1) / 2 * r.width, r.top + (1 - c.y) / 2 * r.height]; },
    // where a point of the board is on the screen (for tests)
    _project(x, y, z) { const c = new T.Vector3(x, y, z).project(cam), r = host.getBoundingClientRect(); return [r.left + (c.x + 1) / 2 * r.width, r.top + (1 - c.y) / 2 * r.height]; },
    _dbg: () => ({ y: tiles.slice(0, 6).map(t => +t.position.y.toFixed(2)), tw: tweens.length, built, running, frame, quality, land: landG ? +landG.scale.y.toFixed(3) : 0, fade: +U.fade.value.toFixed(3), top: +landTop.toFixed(2) }),
    _scene: () => scene, _gl: () => ({ R, cam, scene, U }),
    _label: i => labelCv[i] ? labelCv[i].toDataURL() : '',
    _life: () => ({ ready: life.ready, groups: life.groups.map(g => [g.k, g.list.length]), points: life.pts ? life.pts.geometry.attributes.position.count : 0, fall: fallFoot }),
    _perf: () => R ? Object.assign({ calls: R.info.render.calls, tris: R.info.render.triangles, programs: R.info.programs.length, textures: R.info.memory.textures, geometries: R.info.memory.geometries, frame, quality, pr: R.getPixelRatio() }, PERF) : PERF
  };
})();
