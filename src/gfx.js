// ===== the graphics: how much the 3D board draws on this device (the menu's „გრაფიკა“) =====
// Four levels, kept on the device. On a phone:
//   low       one pixel per point, no shadows: for a weak phone
//   standard  the phone models (a quarter of the triangles), their pictures at 512, 1.5 pixels per point, plain shadows
//   high      the same models and pictures, two pixels per point, smoothed edges, a finer shadow map (a phone's default)
//   ultra     what a computer draws: the full models, their full pictures, the full scenery, every pixel of the screen
//             (up to three per point), smoothed edges, soft shadows
// 8K would add nothing on a phone: its screen has some 3 million pixels, 8K has 33 million. Above the standard level the
// board watches its frames and draws fewer pixels when they keep coming late (board3d.js, guard), so it does not lag.
// A computer keeps its own drawing at the standard level (the full models, 1.75 pixels per point, soft shadows); high
// and ultra allow it more pixels where its screen has them.
// The level is read when the board is made (the models and the smoothing are chosen then), so a change takes effect
// when the page is opened again. ?lq in the address is the low level for that visit, ?gfx=ultra (or another) that one.
// A page that died, or lost its graphics, while a game was on a phone's screen at high or ultra (a phone short of memory
// closes the page) opens one level lower next time, and says so.
const Gfx = (() => {
  const KEY = 'mamuli.gfx', LEVELS = ['low', 'standard', 'high', 'ultra'];
  const NAMES = { low: 'დაბალი', standard: 'საშუალო', high: 'მაღალი', ultra: 'ულტრა' };
  const nav = typeof navigator !== 'undefined' ? navigator : {}, scr = typeof screen !== 'undefined' ? screen : { width: 1280, height: 800 };
  const phone = Math.min(scr.width, scr.height) < 700 || (nav.maxTouchPoints > 1 && /iPhone|iPad|iPod|Android|Macintosh/.test(nav.userAgent || ''));
  const PHONE = {
    low: { lite: true, phoneModels: true, cap: 512, pr: 1, aa: false, shadow: 0, soft: false, aniso: 2, net: false },
    standard: { lite: true, phoneModels: true, cap: 512, pr: 1.5, aa: false, shadow: 512, soft: false, aniso: 4, net: false },
    high: { lite: true, phoneModels: true, cap: 512, pr: 2, aa: true, shadow: 1024, soft: false, aniso: 8, net: true },
    ultra: { lite: false, phoneModels: false, cap: 0, pr: 3, aa: true, shadow: 2048, soft: true, aniso: 16, net: true }
  };
  const COMPUTER = {
    low: { lite: false, phoneModels: false, cap: 0, pr: 1, aa: false, shadow: 0, soft: false, aniso: 4, net: true },
    standard: { lite: false, phoneModels: false, cap: 0, pr: 1.75, aa: true, shadow: 2048, soft: true, aniso: 8, net: true },
    high: { lite: false, phoneModels: false, cap: 0, pr: 2, aa: true, shadow: 2048, soft: true, aniso: 8, net: true },
    ultra: { lite: false, phoneModels: false, cap: 0, pr: 3, aa: true, shadow: 2048, soft: true, aniso: 16, net: true }
  };
  const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } };
  const write = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) { } };
  const search = typeof location !== 'undefined' ? location.search || '' : '';
  const def = phone ? 'high' : 'standard';
  const lower = l => LEVELS[Math.max(0, LEVELS.indexOf(l) - 1)];
  const guarded = l => phone && LEVELS.indexOf(l) > LEVELS.indexOf('standard');
  let saved = read(), fell = '';
  let chosen = LEVELS.includes(saved.level) ? saved.level : def;
  // the last visit at this level died with a game on the screen, or lost its graphics there: one level lower
  if (guarded(chosen) && (saved.trying === chosen || saved.lost === chosen)) {
    fell = chosen; chosen = lower(chosen); saved.level = chosen;
  }
  if (saved.trying || saved.lost) { delete saved.trying; delete saved.lost; write(); }
  const asked = /[?&]lq\b/.test(search) ? 'low' : (/[?&]gfx=([a-z]+)/.exec(search) || [])[1];
  const level = LEVELS.includes(asked) ? asked : chosen;           // this visit's level (the address may ask another)
  const spec = (phone ? PHONE : COMPUTER)[level];
  let fps = phone && saved.fps === 120 ? 120 : 60, meter = saved.meter === true;

  // a game is on the screen: if the page dies now, the next visit knows it (cleared once it has run a minute with all
  // its models arrived, or when the page is put away in an orderly way)
  let clearT = 0;
  function settled() {
    clearTimeout(clearT); clearT = 0;
    if (!saved.trying) return;
    saved = read(); delete saved.trying; write();
  }
  function wait(ms) {
    clearTimeout(clearT);
    clearT = setTimeout(() => {
      const a = typeof GLB !== 'undefined' && GLB && GLB.stats ? GLB.stats() : null;
      if (a && (a.active || a.queued)) wait(15000); else settled();
    }, ms);
  }
  function playing() {
    if (!guarded(level) || level !== chosen) return;
    saved = Object.assign(read(), { trying: level }); write();
    wait(60000);
  }
  function lost() {
    if (!guarded(level) || level !== chosen || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
    saved = Object.assign(read(), { lost: level }); write();
  }
  if (typeof addEventListener === 'function') addEventListener('pagehide', settled);
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') settled(); });

  return {
    phone, level, spec, fell, def, levels: LEVELS, names: NAMES,
    get name() { return NAMES[level]; },
    get chosen() { return chosen; },               // the level kept on the device (the next visit's)
    get fps() { return fps; }, get meter() { return meter; },
    // the level for the next visit (this one keeps what it was made with)
    choose(l) { if (!LEVELS.includes(l)) return chosen; chosen = l; saved = Object.assign(read(), { level: l }); write(); return chosen; },
    setFps(f) { fps = phone && f === 120 ? 120 : 60; saved = Object.assign(read(), { fps }); write(); return fps; },
    setMeter(on) { meter = !!on; saved = Object.assign(read(), { meter }); write(); return meter; },
    playing, settled, lost,
    specOf: l => (phone ? PHONE : COMPUTER)[l]
  };
})();
