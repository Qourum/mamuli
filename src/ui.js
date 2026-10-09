// ===== the game screen =====
// View.show(state) is called with every new state. The events in it play one after another (dice, the figure walking,
// cards, money), and once they are done the whole screen is drawn from the state.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ART = n => 'art/' + n + '.webp';
const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const coin = n => `<b class="amt"><i class="ci"></i>${fmt(n)}</b>`;
const por = h => ART('por_h_' + h);
const pName = (st, s) => st && st.players[s] ? st.players[s].name : '?';
const tName = i => BOARD[i].n;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const REDUCED = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();

const LEVEL_NAMES = ['ცარიელი', 'ხის კოშკი', 'ქვის კოშკი', 'სამეფო კოშკი', 'გუშაგიანი კოშკი', 'ციხე-სიმაგრე'];
const SCENES = ['g_pass', 'g_svan', 'g_elbrus', 'g_elbrus', 'g_stone', 'g_stone', 'g_svan', 'g_tbilisi'];
const SCENE_POS = ['50% 70%', '50% 35%', '30% 60%', '70% 40%', '40% 30%', '75% 55%', '20% 70%', '50% 50%'];
const ERR = {
  turn: 'ახლა ამის გაკეთება არ შეიძლება', cash: 'ფული არ გყოფნის', group: 'კოშკისთვის მთელი კუთხე უნდა გქონდეს',
  even: 'კოშკები კუთხეში თანაბრად შენდება და თანაბრად იყიდება', mort: 'ჯერ ამ კუთხის კოშკები უნდა გაყიდო', max: 'აქ უკვე ციხეა',
  own: 'ეს შენი არ არის', bad: 'ასე არ შეიძლება', empty: 'შეთავაზება ცარიელია', stale: 'შეთავაზება აღარ მოქმედებს',
  host: 'ამას მხოლოდ მასპინძელი აკეთებს', few: 'საჭიროა მინიმუმ ორი მოთამაშე', taken: 'ეს გმირი უკვე დაკავებულია',
  full: 'ოთახი სავსეა', watch: 'ამ თამაშს მხოლოდ უყურებ', started: 'თამაში უკვე დაიწყო', out: 'შენ გაკოტრდი', over: 'თამაში დასრულდა'
};

// ----- the board's geometry: square i sits on an 11 × 11 grid, start in the bottom right corner -----
function cellOf(i) {
  if (i <= 10) return { r: 11, c: 11 - i, side: i === 0 || i === 10 ? 'c' : 'b' };
  if (i <= 20) return { r: 11 - (i - 10), c: 1, side: i === 20 ? 'c' : 'l' };
  if (i <= 30) return { r: 1, c: 1 + (i - 20), side: i === 30 ? 'c' : 't' };
  return { r: 1 + (i - 30), c: 11, side: 'r' };
}
const QVEVRI = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M13 6h14l-1 4c5 3 8 9 8 14 0 7-6 12-14 12S6 31 6 24c0-5 3-11 8-14z" fill="#b86a3c" stroke="#3a2010" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 15c4 2 12 2 16 0" fill="none" stroke="#3a2010" stroke-width="1.8" stroke-linecap="round"/><ellipse cx="20" cy="6" rx="7" ry="2" fill="#7a3f1f" stroke="#3a2010" stroke-width="2"/></svg>';
const DICE_SVG = '<svg viewBox="0 0 44 40" aria-hidden="true"><g transform="rotate(-14 13 23)"><rect x="3" y="13" width="20" height="20" rx="4.5" fill="#fffaf0" stroke="#2c1b10" stroke-width="2.2"/><g fill="#2c1b10"><circle cx="8.5" cy="18.5" r="2"/><circle cx="13" cy="23" r="2"/><circle cx="17.5" cy="27.5" r="2"/></g></g><g transform="rotate(12 30 17)"><rect x="20" y="7" width="20" height="20" rx="4.5" fill="#fffaf0" stroke="#2c1b10" stroke-width="2.2"/><g fill="#2c1b10"><circle cx="25.5" cy="12.5" r="2"/><circle cx="34.5" cy="12.5" r="2"/><circle cx="30" cy="17" r="2.2" fill="#a32a1e"/><circle cx="25.5" cy="21.5" r="2"/><circle cx="34.5" cy="21.5" r="2"/></g></g></svg>';
const FLAG = '<svg class="fl" viewBox="0 0 30 44" aria-hidden="true"><path d="M5 4v38" stroke="#3a2414" stroke-width="3.2" stroke-linecap="round"/><path class="pen" d="M6.5 5h20l-5.5 7 5.5 7h-20z" stroke="#2c1b10" stroke-width="1.8" stroke-linejoin="round"/><circle cx="5" cy="3.5" r="2.6" fill="#e8b44c" stroke="#5c3c0e" stroke-width="1"/></svg>';
const MILL = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="14" fill="#8a5a32" stroke="#3a2010" stroke-width="2.2"/><circle cx="20" cy="20" r="4" fill="#d9a85c" stroke="#3a2010" stroke-width="2"/><g stroke="#3a2010" stroke-width="2.2" stroke-linecap="round"><path d="M20 6v8M20 26v8M6 20h8M26 20h8M10 10l6 6M24 24l6 6M30 10l-6 6M16 24l-6 6"/></g></svg>';

// what is painted on a square (flat), per region and per kind of square
const EMBLEM = ['n_snowpine', 'n_pine', 'n_walnut', 'n_autumn', 'n_boulder', 'n_shrub', 'n_poplar', 's_ruin'];
// what stands on a corner
const CORNER_PROP = { 0: 'ui_chest_gold_o', 10: 't_palisade', 20: 'wp_horn', 30: 'a_brother' };
function tileHTML(i) {
  const t = BOARD[i], c = cellOf(i);
  const pos = `grid-row:${c.r};grid-column:${c.c}`;
  const cls = `tile s-${c.side} k-${t.k}`;
  const name = t.k === 'scroll' || t.k === 'chest' ? '' : `<span class="tn">${esc(t.k === 'road' ? t.s : t.n)}</span>`;
  if (t.k === 'p') {
    return `<button class="${cls}" data-i="${i}" style="${pos};--g:${GROUPS[t.g].c}" aria-label="${esc(t.n.replace(/­/g, ''))}, ${t.p}">
      <span class="band"></span><span class="ico" style="background-image:url(${ART(EMBLEM[t.g])})"></span>${name}<span class="tp">${t.p}</span><span class="own"></span><span class="hatch"></span></button>`;
  }
  const icon = {
    road: `<span class="ico" style="background-image:url(${ART('s_camp')})"></span>`, util: `<span class="ico svg">${t.ic === 'mill' ? MILL : QVEVRI}</span>`,
    scroll: `<span class="ico" style="background-image:url(${ART('ui_page')})"></span>`, chest: `<span class="ico" style="background-image:url(${ART('ui_chest_wood')})"></span>`,
    tax: `<span class="ico" style="background-image:url(${ART(t.a > 150 ? 'ui_coinbag' : 'ui_coin')})"></span>`
  }[t.k] || '';
  const sub = t.k === 'road' || t.k === 'util' ? `<span class="tp">${t.p}</span>` : t.k === 'tax' ? `<span class="tp">−${t.a}</span>` : '';
  return `<button class="${cls}" data-i="${i}" style="${pos}" aria-label="${esc(t.n.replace(/­/g, ''))}">${icon}${c.side === 'c' ? `<span class="cn">${esc(t.n.replace(/­/g, ''))}</span>` : name}${sub}<span class="own"></span><span class="hatch"></span></button>`;
}

// ----- sounds: a few tiny synthesized ones, after the first touch -----
const Sound = (() => {
  let ac = null, on = store.get('sound') !== false;
  const ctx = () => { if (!on) return null; try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) { ac = null; } return ac; };
  function tone(f, d, type, vol, at) {
    const a = ctx(); if (!a) return;
    const t = a.currentTime + (at || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + 0.02);
  }
  function rattle() {
    const a = ctx(); if (!a) return;
    for (let k = 0; k < 6; k++) {
      const t = a.currentTime + k * 0.07 + Math.random() * 0.03, len = 0.03;
      const b = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
      f.type = 'bandpass'; f.frequency.value = 1800 + Math.random() * 1500; g.gain.value = 0.35;
      s.buffer = b; s.connect(f); f.connect(g); g.connect(a.destination); s.start(t);
    }
  }
  return {
    get on() { return on; },
    set on(v) { on = !!v; store.set('sound', on); },
    unlock() { ctx(); },
    dice: rattle,
    coin() { tone(1320, 0.12, 'triangle', 0.08); tone(1760, 0.18, 'triangle', 0.07, 0.07); },
    pay() { tone(520, 0.16, 'triangle', 0.08); tone(390, 0.22, 'triangle', 0.07, 0.08); },
    step() { tone(300 + Math.random() * 60, 0.05, 'square', 0.02); },
    turn() { tone(660, 0.14, 'sine', 0.09); tone(880, 0.2, 'sine', 0.09, 0.12); },
    build() { tone(220, 0.08, 'square', 0.05); tone(330, 0.12, 'square', 0.05, 0.08); },
    bad() { tone(160, 0.25, 'sawtooth', 0.05); },
    card() { tone(740, 0.08, 'sine', 0.06); tone(990, 0.12, 'sine', 0.06, 0.06); }
  };
})();

// ----- the view -----
const View = (() => {
  let target = null, shown = null, lastEv = 0, q = [], playing = false, busy = false, pos = [], endsAt = 0;
  let built = false, cash = [], rolling = false;

  const controls = s => {
    const p = shown && shown.players[s];
    if (!p || !ROOM) return false;
    return ROOM.role === 'local' ? !p.bot : p.pid === ROOM.me;
  };
  // the seat this device acts for now (-1: none)
  function acting() {
    if (!shown || !ROOM) return -1;
    if (shown.trade && controls(shown.trade.to)) return shown.trade.to;
    if (controls(shown.turn)) return shown.turn;
    if (ROOM.role === 'local') return -1;
    return Engine.seatOf(shown, ROOM.me);
  }
  // whose property this device looks after (for the estate and trade sheets)
  function mySeat() {
    if (!shown || !ROOM) return -1;
    if (ROOM.role === 'local') {
      if (controls(shown.turn)) return shown.turn;
      return shown.players.findIndex(p => !p.bot && !p.out);
    }
    return Engine.seatOf(shown, ROOM.me);
  }

  function show(st) {
    busy = false;
    if (st.phase === 'lobby') { target = st; shown = clone(st); lastEv = st.evn; q = []; UI.go('lobby'); Lobby.render(shown); return; }
    UI.go('game');
    if (!built || !shown || shown.phase === 'lobby' || st.evn < lastEv || (st.ev.length && st.ev[0].n > lastEv + 1)) { reset(st); return; }
    target = clone(st);
    for (const e of target.ev) if (e.n > lastEv) q.push(e);
    lastEv = target.evn;
    if (q.length > 30 || document.visibilityState === 'hidden') { q = []; finishPlay(); return; }
    endsAt = Math.max(endsAt, Date.now()) + estimate(q);
    if (!playing) play();
  }
  function reset(st) {
    target = clone(st); shown = clone(st); lastEv = st.evn; q = []; playing = false;
    buildBoard();
    pos = shown.players.map(p => p.pos);
    cash = shown.players.map(p => p.cash);
    render();
  }
  function clear() { target = shown = null; q = []; playing = false; lastEv = 0; Sheet.close(); }
  function estimate(list) {
    let t = 0;
    for (const e of list) {
      if (e.k === 'roll') t += 900;
      else if (e.k === 'move') t += e.fly || Math.abs(e.n) > 12 ? 700 : Math.abs(e.n) * 170 + 120;
      else if (e.k === 'jail') t += 800;
      else if (e.k === 'card') t += 2600;
      else if (e.k === 'turn') t += 250;
      else t += 250;
    }
    return t;
  }
  const pending = () => Math.max(0, endsAt - Date.now());

  async function play() {
    playing = true;
    while (q.length && playing) {
      const e = q.shift();
      try { await animate(e); } catch (err) { console.warn(err); }
    }
    if (playing) finishPlay();
  }
  function finishPlay() {
    playing = false;
    shown = target;
    pos = shown.players.map(p => p.pos);
    cash = shown.players.map(p => p.cash);
    render();
  }

  // ----- one event on screen -----
  async function animate(e) {
    const st = target;
    switch (e.k) {
      case 'roll': await rollDice(e.d); break;
      case 'move': await walk(e.s, e.from, e.to, e.n, e.fly); break;
      case 'jail': await fly(e.s, JAIL); Sound.bad(); await sleep(250); break;
      case 'salary': case 'gain': money(e.s, e.a); Sound.coin(); await sleep(260); break;
      case 'pay': {
        money(e.s, -e.a); if (e.to >= 0) money(e.to, e.a);
        if (e.why === 'rent' && (controls(e.s) || controls(e.to))) toastEv(`${esc(pName(st, e.s))} → ${esc(pName(st, e.to))}: ქირა ${coin(e.a)}`, controls(e.to) ? 'good' : 'bad');
        Sound.pay(); await sleep(420); break;
      }
      case 'buy': setOwner(e.i, e.s); money(e.s, -e.a); Sound.coin(); pulse(e.i); await sleep(350); break;
      case 'build': case 'sell': setLevel(e.i, e.lv); money(e.s, e.k === 'build' ? -Engine.buildCost(e.i) : Engine.buildCost(e.i) / 2); Sound.build(); pulse(e.i); await sleep(320); break;
      case 'mort': setMort(e.i, true); money(e.s, Engine.mortValue(e.i)); await sleep(220); break;
      case 'unmort': setMort(e.i, false); money(e.s, -Engine.unmortCost(e.i)); await sleep(220); break;
      case 'card': await showCard(e); break;
      case 'turn': {
        const mine = controls(e.s) && ROOM && ROOM.role !== 'local';
        if (mine || (ROOM && ROOM.role === 'local' && controls(e.s) && st.players.filter(p => !p.bot).length > 1)) {
          banner(mine ? 'შენი სვლაა' : `${pName(st, e.s)}, შენი სვლაა`, e.s);
          Sound.turn();
          try { if (mine && navigator.vibrate) navigator.vibrate(60); } catch (err) { }
          await sleep(650);
        } else await sleep(120);
        break;
      }
      case 'decline': if (controls(e.from)) toastEv(`${esc(pName(st, e.to))}: უარი შენს შეთავაზებაზე`, 'bad'); break;
      case 'trade': {
        for (const i of e.give.p) setOwner(i, e.to);
        for (const i of e.get.p) setOwner(i, e.from);
        toastEv(`${esc(pName(st, e.from))} ⇄ ${esc(pName(st, e.to))}: გარიგება შედგა`, 'good'); Sound.coin(); await sleep(400); break;
      }
      case 'bankrupt': toastEv(`${esc(pName(st, e.s))} გაკოტრდა`, 'bad'); Sound.bad(); await sleep(700); break;
    }
  }
  // the dice fly up spinning and fall back onto the board with the numbers rolled on top
  async function rollDice(d) {
    const cubes = $$('#dice .cube');
    if (!cubes.length) return;
    rolling = true;
    Sound.dice();
    cubes.forEach((c, k) => {
      spin[k] += 2;
      c.classList.remove('dbl', 'down'); c.classList.add('up');
      c.style.transform = cubeTf(k, d[k], 3.4, (k ? 40 : -40) + Math.random() * 30 - 15, -280);
    });
    await sleep(REDUCED ? 40 : 430);
    cubes.forEach((c, k) => {
      c.classList.replace('up', 'down');
      c.style.transform = cubeTf(k, d[k], .5, (k ? 14 : -12) + Math.random() * 16 - 8, 0);
      c.dataset.shown = d[k];
    });
    await sleep(REDUCED ? 40 : 470);
    cubes.forEach(c => { c.classList.remove('down'); c.classList.toggle('dbl', d[0] === d[1]); });
    rolling = false;
    await sleep(120);
  }
  
  // ----- the figures -----
  function tokenXY(seat, at) {
    const c = tileCenter(at), corner = at % 10 === 0;
    const caught = s => at === JAIL && !!shown.players[s].jail;
    const here = shown.players.map((p, s) => s).filter(s => !shown.players[s].out && pos[s] === at && caught(s) === caught(seat));
    const k = Math.max(0, here.indexOf(seat)), n = Math.max(1, here.length);
    const cols = n <= 2 ? n : n <= 4 ? 2 : 3, rows = Math.ceil(n / cols);
    const gx = (k % cols) - (cols - 1) / 2, gy = Math.floor(k / cols) - (rows - 1) / 2;
    const sp = n > 1 ? Math.min(c.w, c.h) * (corner ? .36 : .42) : 0;
    if (corner) return { x: c.x + gx * sp, y: c.y + c.h * (caught(seat) ? -.3 : .2) + gy * sp * .5 };
    return { x: c.x + gx * sp, y: c.y + c.h * (n > 1 ? .06 : .12) + gy * sp * .5 };
  }
  function placeTokens(animate) {
    const layer = $('#tokens');
    if (!layer || !shown) return;
    shown.players.forEach((p, s) => {
      let el = layer.querySelector(`.tok[data-s="${s}"]`);
      if (!el) {
        el = document.createElement('div');
        el.className = 'bb tok'; el.dataset.s = s;
        el.innerHTML = `<span class="ped"></span><div class="up"><i><img src="${por(p.hero)}" alt=""></i></div>`;
        layer.appendChild(el);
      }
      el.style.setProperty('--c', SEAT_COLORS[s]);
      el.querySelector('img').src = por(p.hero);
      el.hidden = p.out;
      el.classList.toggle('now', shown.turn === s && shown.phase !== 'over');
      el.classList.toggle('jailed', p.jail && pos[s] === JAIL);
      el.classList.toggle('instant', !animate);
      const { x, y } = tokenXY(s, pos[s]);
      el.style.transform = `translate(${x}px,${y}px)`;
    });
  }
  async function walk(s, from, to, n, flyIt) {
    if (flyIt || Math.abs(n) > 12 || REDUCED) return fly(s, to);
    const dir = n > 0 ? 1 : -1, el = $(`#tokens .tok[data-s="${s}"]`);
    let at = from;
    for (let k = 0; k < Math.abs(n); k++) {
      at = (at + dir + 40) % 40;
      pos[s] = at;
      if (el) { el.classList.remove('hop'); void el.offsetWidth; el.classList.add('hop'); }
      placeTokens(true);
      Sound.step();
      await sleep(165);
    }
    if (el) el.classList.remove('hop');
    pos[s] = to;
    placeTokens(true);
  }
  async function fly(s, to) {
    const el = $(`#tokens .tok[data-s="${s}"]`);
    pos[s] = to;
    if (el) el.classList.add('flying');
    placeTokens(true);
    await sleep(REDUCED ? 60 : 620);
    if (el) el.classList.remove('flying');
  }

  // ----- small things that happen on the board -----
  function money(s, d) {
    if (!d || !shown || !shown.players[s]) return;
    cash[s] = (cash[s] || 0) + d;
    const chip = $(`#players .pl[data-s="${s}"]`);
    if (chip) {
      const b = chip.querySelector('.pc');
      if (b) b.innerHTML = coin(cash[s]);
      const f = document.createElement('span');
      f.className = 'float ' + (d > 0 ? 'up' : 'down');
      f.textContent = (d > 0 ? '+' : '−') + fmt(Math.abs(d));
      chip.appendChild(f);
      setTimeout(() => f.remove(), 1300);
    }
  }
  const tileEl = i => $(`#board .tile[data-i="${i}"]`);
  // what stands on an owned square: the owner's flag, or the tower built there with the flag on top
  const marks = [];
  const mark = i => marks[i] || (marks[i] = { o: -1, lv: 0, m: false });
  function setOwner(i, s) { const t = tileEl(i); if (t) { t.classList.toggle('owned', s >= 0); t.style.setProperty('--o', s >= 0 ? SEAT_COLORS[s] : 'transparent'); } mark(i).o = s; paintMark(i); }
  function setLevel(i, lv) { const t = tileEl(i); if (t) t.classList.toggle('built', !!lv); mark(i).lv = lv; paintMark(i); }
  function setMort(i, m) { const t = tileEl(i); if (t) t.classList.toggle('mort', m); mark(i).m = m; paintMark(i); }
  function paintMark(i) {
    const b = $(`#things .bld[data-i="${i}"]`); if (!b) return;
    const k = mark(i), key = `${k.o}|${k.lv}|${k.m}`;
    if (b.dataset.key === key) return;
    b.dataset.key = key;
    b.classList.toggle('mort', k.m);
    b.classList.toggle('lv', k.lv > 0);
    b.style.setProperty('--o', k.o >= 0 ? SEAT_COLORS[k.o] : 'transparent');
    b.querySelector('.up').innerHTML = k.o < 0 ? '' : (k.lv ? `<span class="tw"><img src="${ART(LEVELS[k.lv].a)}" alt="">${k.lv < 5 ? `<em>${k.lv}</em>` : ''}</span>` : '') + FLAG;
  }
  function pulse(i) { const t = tileEl(i); if (!t) return; t.classList.remove('pulse'); void t.offsetWidth; t.classList.add('pulse'); }
  function banner(text, s) {
    const b = $('#banner'); if (!b) return;
    b.innerHTML = `<img src="${por(target.players[s].hero)}" alt=""><span>${esc(text)}</span>`;
    b.style.setProperty('--c', SEAT_COLORS[s]);
    b.classList.remove('go'); void b.offsetWidth; b.classList.add('go');
  }
  function toastEv(msg, kind) { UI.toast(msg, 2200, kind); }
  async function showCard(e) {
    const c = CARDS[e.d][e.id], box = $('#cardpop');
    if (!box) return;
    const title = e.d === 's' ? 'ბედის გრაგნილი' : 'საგანძური';
    box.innerHTML = `<div class="card ${e.d}"><img src="${ART(e.d === 's' ? 'ui_page' : 'ui_chest_wood_o')}" alt=""><h3>${title}</h3><p>${esc(c.t)}</p><small>${esc(pName(target, e.s))}</small></div>`;
    box.hidden = false;
    box.classList.remove('go'); void box.offsetWidth; box.classList.add('go');
    Sound.card();
    let closed = false;
    const done = () => { closed = true; };
    box.onclick = done;
    const until = Date.now() + 2500;
    while (!closed && Date.now() < until) await sleep(80);
    box.hidden = true;
  }

  // ----- the board, built once per game screen -----
  function buildBoard() {
    const board = $('#board');
    if (!board) return;
    let html = '';
    for (let i = 0; i < 40; i++) html += tileHTML(i);
    html += `<div class="center" id="center"><div class="c-art"></div></div>
      <div class="rim rim-f"></div><div class="rim rim-l"></div><div class="rim rim-r"></div>
      <div class="cube-wrap" id="dice">${cubeHTML(0)}${cubeHTML(1)}</div>
      <div class="things" id="things"></div><div class="tokens" id="tokens"></div>`;
    board.innerHTML = html;
    board.onclick = ev => { const t = ev.target.closest('.tile'); if (t) Sheet.open('deed', +t.dataset.i); };
    built = true;
    fit();
    placeScenery();
  }
  // a billboard: something that stands up on the tilted board, its foot at (x, y) of the board
  const stand = (cls, img, x, y, w) => `<div class="bb ${cls}" style="transform:translate(${x}px,${y}px)"><div class="up" style="width:${w}px;margin-left:${-w / 2}px"><img src="${ART(img)}" alt=""></div></div>`;
  function tileCenter(i) {
    const t = $(`#board .tile[data-i="${i}"]`);
    return t ? { x: t.offsetLeft + t.offsetWidth / 2, y: t.offsetTop + t.offsetHeight / 2, w: t.offsetWidth, h: t.offsetHeight } : { x: 0, y: 0, w: 0, h: 0 };
  }
  // the corner pieces, the towers people built, and a castle and trees around the board
  function placeScenery() {
    const box = $('#things'), board = $('#board');
    if (!box || !board) return;
    const bs = board.clientWidth, tw = bs / 11.75;
    let html = '';
    for (const i in CORNER_PROP) {
      const c = tileCenter(+i);
      html += stand('prop c' + i, CORNER_PROP[i], c.x, c.y - c.h * (i == JAIL ? -.02 : .14), tw * ({ 0: 1.1, 10: 1.2, 20: 1, 30: .8 })[i]);
    }
    const deco = [['s_fort', -0.02, -0.035, 0.24], ['t_archer_3', 1.045, 0.08, 0.1], ['n_pine', -0.05, 0.3, 0.1], ['n_pine', -0.06, 0.52, 0.09],
      ['n_poplar', 1.05, 0.42, 0.07], ['t_bell_3', 1.05, 0.7, 0.1], ['n_snowpine', 0.3, -0.04, 0.08], ['n_snowpine', 0.72, -0.045, 0.085], ['s_camp', -0.06, 0.86, 0.14]];
    for (const [a, x, y, w] of deco) html += stand('deco', a, x * bs, y * bs, w * bs);
    for (let i = 0; i < 40; i++) if (OWNABLE(BOARD[i])) { const c = tileCenter(i); html += `<div class="bb bld" data-i="${i}" style="transform:translate(${c.x}px,${c.y - c.h * .2}px)"><div class="up" style="width:${tw * 1.05}px;margin-left:${-tw * .525}px"></div></div>`; }
    box.innerHTML = html;
    for (let i = 0; i < 40; i++) if (OWNABLE(BOARD[i])) paintMark(i);
  }
  function cubeHTML(k) {
    const pips = n => `<i></i>`.repeat(9);
    return `<div class="cube" data-k="${k}">${[1, 2, 3, 4, 5, 6].map(f => `<div class="fc f${f}" data-f="${f}">${pips(f)}</div>`).join('')}</div>`;
  }
  // the turn of a cube that shows face f on top (towards the board's normal); whole turns (spin) make it tumble
  const FACE_ROT = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
  const spin = [0, 0];
  function cubeTf(k, f, lift, rz, extra) {
    const [ax, ay] = FACE_ROT[f] || [0, 0];
    return `translateZ(calc(var(--d) * ${lift})) rotateZ(${rz.toFixed(1)}deg) rotateX(${ax + spin[k] * 360 + extra}deg) rotateY(${ay + spin[k] * 360 + extra}deg)`;
  }
  function setCube(el, f) { const k = +el.dataset.k; el.style.transform = cubeTf(k, f, .5, k ? 12 : -10, 0); }

  // the board as big as it can be. It is tilted back (rotateX) and seen in perspective: the near edge comes out wider
  // than the board, the whole thing flatter. The size is chosen so that the picture of the board fits the free space.
  function fit() {
    const scr = $('#scr-game'), table = $('#table'), board = $('#board'), stage = $('#stage');
    if (!table || !board || !stage || scr.hidden) return;
    const wide = matchMedia('(orientation: landscape) and (min-width: 720px)').matches;
    const r = table.getBoundingClientRect();
    const tilt = (wide ? 30 : 34) * Math.PI / 180, k = 2.6;
    const sn = Math.sin(tilt), cs = Math.cos(tilt), near = k / (k - .5 * sn), far = k / (k + .5 * sn);
    const W = near * 1.02, H = .5 * cs * (near + far) + .1;          // + room for what stands on the far edge
    const bs = Math.max(220, Math.floor(Math.min((r.width - 12) / W, (r.height - 8) / H)));
    const prev = board.style.getPropertyValue('--bs');
    board.style.setProperty('--bs', bs + 'px');
    board.style.setProperty('--tilt', (tilt * 180 / Math.PI) + 'deg');
    stage.style.setProperty('--persp', Math.round(k * bs) + 'px');
    // the projected board is not centred on the board's middle: move it so that it is, with the extra room above;
    // when there is height to spare (a phone held upright) the board sits lower, nearer the buttons, under more sky
    const spare = Math.max(0, r.height - 8 - bs * H);
    const shift = Math.round(bs * .25 * cs * (near - far) - bs * .04 - spare * .3);
    board.style.setProperty('--shift', -shift + 'px');
    board.classList.toggle('roomy', bs >= 600);
    if (prev !== bs + 'px') placeScenery();
    placeTokens(false);
  }
  window.addEventListener('resize', () => { if (built) fit(); });

  // ----- everything, from the shown state -----
  function render() {
    if (!shown || shown.phase === 'lobby') return;
    if (!built) buildBoard();
    const st = shown;
    for (let i = 0; i < 40; i++) {
      const o = st.own[i];
      if (!OWNABLE(BOARD[i])) continue;
      setOwner(i, o ? o.o : -1);
      if (BOARD[i].k === 'p') setLevel(i, o ? o.lv : 0);
      setMort(i, !!(o && o.m));
    }
    placeTokens(false);
    renderPlayers();
    renderCenter();
    $('#bTrade').disabled = !Engine.legal(st, mySeat()).trade;
    Sheet.refresh();
    if (st.trade && acting() === st.trade.to && controls(st.trade.to) && Sheet.kind() !== 'offer') Sheet.open('offer');
    if (st.phase === 'over' && Sheet.kind() !== 'over') Sheet.open('over');
  }
  function renderPlayers() {
    const st = shown, box = $('#players');
    if (!box) return;
    box.innerHTML = st.players.map((p, s) => {
      const me = controls(s) && ROOM && ROOM.role !== 'local';
      const tag = me ? '<span class="tag me">შენ</span>' : p.away && !p.bot ? '<span class="tag warn">არ არის</span>' : p.bot ? '<span class="tag">ბოტი</span>' : '';
      const icons = (p.jail ? `<img src="${ART('t_palisade')}" alt="ზინდანში" title="ზინდანში">` : '') + p.fe.map(() => `<img src="${ART('ui_feather')}" alt="ბუმბული" title="ფასკუნჯის ბუმბული">`).join('');
      return `<button class="pl${st.turn === s && st.phase !== 'over' ? ' now' : ''}${p.out ? ' out' : ''}" data-s="${s}" style="--c:${SEAT_COLORS[s]}">
        <img class="pp" src="${por(p.hero)}" alt=""><span class="pn">${esc(p.name)}</span><span class="pc">${p.out ? '<b class="amt">გაკოტრდა</b>' : coin(cash[s] != null ? cash[s] : p.cash)}${icons ? `<span class="pi">${icons}</span>` : ''}</span>${tag ? `<span class="pf">${tag}</span>` : ''}</button>`;
    }).join('');
    box.onclick = ev => { const b = ev.target.closest('.pl'); if (b) Sheet.open('player', +b.dataset.s); };
    const r = $('#round');
    if (r) r.textContent = st.cfg.mode === 'rounds' ? `რაუნდი ${st.round} / ${st.cfg.rounds}` : `რაუნდი ${st.round}`;
  }
  function renderCenter() {
    const st = shown;
    if (!rolling) $$('#dice .cube').forEach((c, k) => { if (c.dataset.shown !== String(st.dice[k])) { c.dataset.shown = st.dice[k]; setCube(c, st.dice[k]); } });
    renderPanel();
  }
  function renderPanel() {
    const st = shown, c = $('#panel');
    if (!c) return;
    const me = acting(), L = me >= 0 ? Engine.legal(st, me) : {}, cur = st.players[st.turn], p = st.players[me];
    let status = '', acts = '', extra = '';
    if (st.phase === 'over') status = 'თამაში დასრულდა';
    else if (me === st.turn && controls(st.turn)) status = ROOM.role === 'local' && st.players.filter(x => !x.bot).length > 1 ? `${esc(cur.name)}, შენი სვლაა` : 'შენი სვლაა';
    else status = `სვლა: <b>${esc(cur.name)}</b>${cur.bot ? ' <small>ბოტი</small>' : cur.away ? ' <small>არ არის, მის მაგივრად ბოტი თამაშობს</small>' : ''}`;
    if (L.roll) {
      if (p.jail) {
        extra = `<p class="hint">ზინდანში ხარ. გამოსასვლელად დუბლი გააგორე (${3 - p.jt} ცდა დარჩა), ან გადაიხადე ${JAIL_FINE}.</p>`;
        acts = `<div class="row"><button class="btn gold" data-a="roll">${DICE_SVG}გააგორე</button>${L.jailpay ? `<button class="btn" data-a="jailpay">გადაიხადე ${JAIL_FINE}</button>` : ''}${L.feather ? '<button class="btn" data-a="feather">ბუმბული</button>' : ''}</div>`;
      } else acts = `<button class="btn gold roll" data-a="roll">${DICE_SVG}გააგორე</button>`;
      if (p.dbl > 0 && !p.jail) extra += `<p class="hint">დუბლი! კიდევ ერთხელ აგორებ.</p>`;
    } else if (L.skip) {
      const t = BOARD[st.pend.i];
      extra = `<button class="mini-deed" data-deed="${t.i}" style="--g:${t.k === 'p' ? GROUPS[t.g].c : '#8a6a4f'}"><b>${esc(t.n)}</b><span>${t.k === 'p' ? esc(GROUPS[t.g].n) : t.k === 'road' ? 'ქარვასლა' : 'მეურნეობა'} · ქირა ${t.k === 'p' ? t.rent[0] : t.k === 'road' ? ROAD_RENT[1] : 'კამათელი ×4'} · ნახე ბარათი</span></button>`;
      acts = `<div class="row"><button class="btn gold" data-a="buy" ${L.buy ? '' : 'disabled'}>იყიდე ${coin(t.p)}</button><button class="btn" data-a="skip">არ ვყიდულობ</button></div>`;
      if (!L.buy) extra += `<p class="hint">ფული არ გყოფნის.</p>`;
    } else if (L.end) {
      acts = `<button class="btn gold big" data-a="end">სვლის დასრულება</button>`;
      extra = `<p class="hint">სვლის დასრულებამდე შეგიძლია ააშენო ან ივაჭრო.</p>`;
    } else if (L.bankrupt) {
      const d = st.pend, max = p.cash + Engine.raiseMax(st, me);
      extra = `<p class="debt">გადასახდელია ${coin(d.a)}${d.to >= 0 ? ` · ${esc(pName(st, d.to))}` : ''} <small>· გაქვს ${coin(p.cash)}</small></p>
        <p class="hint">${max >= d.a ? 'გაყიდე კოშკები ან დააგირავე ქალაქები მამულში.' : 'მთელი ქონებითაც ვერ ფარავ ვალს.'}</p>`;
      acts = `<div class="row"><button class="btn gold" data-a="pay" ${L.pay ? '' : 'disabled'}>გადაიხადე</button><button class="btn" data-sheet="estate">მამული</button><button class="btn danger" data-sheet="bankrupt">გაკოტრება</button></div>`;
    } else if (L.cancel) {
      extra = `<p class="hint">ელოდები პასუხს: ${esc(pName(st, st.trade.to))}</p>`;
      acts = `<button class="btn" data-a="cancel">შეთავაზების გაუქმება</button>`;
    } else if (L.accept) {
      acts = `<button class="btn gold" data-sheet="offer">შეთავაზების ნახვა</button>`;
    } else if (st.trade && st.phase !== 'over') {
      extra = `<p class="hint">${esc(pName(st, st.trade.from))} ვაჭრობას სთავაზობს: ${esc(pName(st, st.trade.to))}</p>`;
    } else if (st.phase === 'over') {
      acts = `<button class="btn gold" data-sheet="over">შედეგები</button>`;
    }
    const lines = [];
    for (let k = st.ev.length - 1; k >= 0 && lines.length < 4; k--) { const t = evText(st, st.ev[k]); if (t) lines.push(t); }
    c.innerHTML = `<div class="status">${status}</div>${extra}<div class="acts">${acts}</div>${lines.length ? `<ul class="last">${lines.map(l => `<li>${l}</li>`).join('')}</ul>` : ''}`;
    if (busy) $$('[data-a]', c).forEach(b => { b.disabled = true; });
  }

  return {
    show, reset, clear, pending, render, fit, acting, mySeat, controls,
    get st() { return shown; },
    busy(b) { busy = b; if (b) $$('#panel [data-a]').forEach(x => { x.disabled = true; }); },
    peers() { if (shown && shown.phase === 'lobby') Lobby.render(shown); else if (shown) renderPlayers(); }
  };
})();

// one line of the log for an event ('' for events the log leaves out)
function evText(st, e) {
  const n = s => esc(pName(st, s)), t = i => esc(tName(i));
  switch (e.k) {
    case 'start': return 'თამაში დაიწყო';
    case 'roll': return `${n(e.s)}: ${e.d[0]} და ${e.d[1]}${e.d[0] === e.d[1] ? ' · დუბლი' : ''}`;
    case 'buy': return `${n(e.s)}: იყიდა ${t(e.i)} · ${fmt(e.a)}`;
    case 'skip': return `${n(e.s)}: არ იყიდა ${t(e.i)}`;
    case 'pay':
      if (e.why === 'rent') return `${n(e.s)} → ${n(e.to)}: ქირა ${fmt(e.a)} · ${t(e.i)}`;
      if (e.why === 'tax') return `${n(e.s)}: ${t(e.i)} · ${fmt(e.a)}`;
      if (e.why === 'fine') return `${n(e.s)}: ზინდანიდან გამოსასყიდი · ${fmt(e.a)}`;
      if (e.why === 'repair') return `${n(e.s)}: შეკეთება · ${fmt(e.a)}`;
      return `${n(e.s)}: გადაიხადა ${fmt(e.a)}`;
    case 'salary': return `${n(e.s)}: სტარტი · +${fmt(e.a)}`;
    case 'gain': return `${n(e.s)}: +${fmt(e.a)}`;
    case 'card': return `${n(e.s)}: ${esc(CARDS[e.d][e.id].t)}`;
    case 'jail': return `${n(e.s)}: ზინდანში!${e.why === 'dbl' ? ' (სამი დუბლი)' : ''}`;
    case 'free': return `${n(e.s)}: გამოვიდა ზინდანიდან`;
    case 'stay': return `${n(e.s)}: ზინდანში რჩება`;
    case 'build': return `${n(e.s)}: ${t(e.i)} · ${LEVEL_NAMES[e.lv]}`;
    case 'sell': return `${n(e.s)}: გაყიდა კოშკი · ${t(e.i)}`;
    case 'mort': return `${n(e.s)}: დააგირავა ${t(e.i)}`;
    case 'unmort': return `${n(e.s)}: გამოისყიდა ${t(e.i)}`;
    case 'debt': return `${n(e.s)}: ვალი ${fmt(e.a)}`;
    case 'bankrupt': return `${n(e.s)}: გაკოტრდა`;
    case 'offer': return `${n(e.from)} → ${n(e.to)}: შეთავაზება`;
    case 'decline': return `${n(e.to)}: უარი ${n(e.from)}-ის შეთავაზებაზე`;
    case 'cancel': return `${n(e.from)}: გააუქმა შეთავაზება`;
    case 'trade': return `${n(e.from)} ⇄ ${n(e.to)}: გარიგება`;
    case 'turn': return '';
    case 'over': return e.s >= 0 ? `გაიმარჯვა ${n(e.s)}` : 'თამაში დასრულდა';
  }
  return '';
}

// ===== sheets: the deed of a square, a player's property, managing, trading, the log, the menu, the end =====
const Sheet = (() => {
  let kind = '', arg = null, draft = null;
  const box = () => $('#sheet'), body = () => $('#sheetBody');
  function open(k, a) {
    kind = k; arg = a;
    if (k === 'trade') draft = null;
    draw();
    box().hidden = false;
    requestAnimationFrame(() => box().classList.add('on'));
  }
  function close() {
    kind = ''; arg = null;
    const b = box(); if (!b) return;
    b.classList.remove('on'); b.hidden = true;
  }
  function refresh() { if (kind) draw(); }
  function draw() {
    const st = View.st;
    if (!st && kind !== 'rules') return close();
    const fn = { deed, player, estate, trade, offer, log, menu, over, bankrupt: bankruptSheet, rules }[kind];
    if (!fn) return close();
    const html = fn(st);
    if (html == null) return close();
    body().innerHTML = html;
  }

  // a square's deed
  function deed(st) {
    const i = arg, t = BOARD[i], o = st.own[i], seat = View.mySeat(), mine = o && o.o === seat;
    let head = '', rows = '', foot = '';
    if (t.k === 'p') {
      const g = GROUPS[t.g], lv = o ? o.lv : 0, full = o && Engine.groupOwner(st, t.g) === o.o;
      head = `<div class="deed-h" style="--g:${g.c};background-image:linear-gradient(180deg,rgba(13,16,22,.1),rgba(13,16,22,.85)),url(${ART(SCENES[t.g])});background-position:${SCENE_POS[t.g]}"><span class="chip" style="--g:${g.c}">${esc(g.n)}</span><h2>${esc(t.n)}</h2></div>`;
      const line = (label, v, on, img) => `<li class="${on ? 'on' : ''}">${img ? `<img src="${ART(img)}" alt="">` : '<span class="ph"></span>'}<span>${label}</span>${coin(v)}</li>`;
      rows = `<ul class="rents">${line('ცალკე', t.rent[0], o && !lv && !full)}${line('მთელი კუთხე', t.rent[1], o && !lv && full)}${[1, 2, 3, 4, 5].map(k => line(LEVEL_NAMES[k], t.rent[k + 1], lv === k, LEVELS[k].a)).join('')}</ul>
        <p class="facts"><span>ფასი ${coin(t.p)}</span><span>კოშკი ${coin(g.b)}</span><span>დაგირავება ${coin(t.p / 2)}</span></p>`;
    } else if (t.k === 'road') {
      head = `<div class="deed-h road" style="background-image:linear-gradient(180deg,rgba(13,16,22,.1),rgba(13,16,22,.85)),url(${ART('g_pass')})"><span class="chip">ქარვასლა</span><h2>${esc(t.n)}</h2></div>`;
      const n = o ? Engine.countOf(st, o.o, ROADS) : 0;
      rows = `<ul class="rents">${[1, 2, 3, 4].map(k => `<li class="${n === k ? 'on' : ''}"><img src="${ART('s_camp')}" alt=""><span>${k} ქარვასლა</span>${coin(ROAD_RENT[k])}</li>`).join('')}</ul><p class="facts"><span>ფასი ${coin(t.p)}</span><span>დაგირავება ${coin(t.p / 2)}</span></p>`;
    } else if (t.k === 'util') {
      head = `<div class="deed-h util" style="background-image:linear-gradient(180deg,rgba(13,16,22,.1),rgba(13,16,22,.85)),url(${ART('g_elbrus')})"><span class="chip">მეურნეობა</span><h2>${esc(t.n)}</h2></div>`;
      const n = o ? Engine.countOf(st, o.o, UTILS) : 0;
      rows = `<ul class="rents"><li class="${n === 1 ? 'on' : ''}"><span class="ph"></span><span>ერთი გაქვს: კამათლის ჯამი ×4</span></li><li class="${n === 2 ? 'on' : ''}"><span class="ph"></span><span>ორივე გაქვს: კამათლის ჯამი ×10</span></li></ul><p class="facts"><span>ფასი ${coin(t.p)}</span><span>დაგირავება ${coin(t.p / 2)}</span></p>`;
    } else {
      const about = {
        start: `აქედან იწყება გზა. ყოველ გავლაზე ხაზინა ${SALARY}-ს გაძლევს.`,
        jail: `ზინდანი. აქ თუ უბრალოდ მოხვედი, სტუმარი ხარ. დატყვევებული სამ ცდაში დუბლით გამოდის, ან ${JAIL_FINE}-ს იხდის, ან ფასკუნჯის ბუმბულს იყენებს.`,
        feast: 'სუფრა. აქ დასვენება და ქეიფია, არაფერი ხდება.',
        gojail: 'მცველი პირდაპირ ზინდანში გაგზავნის. სტარტს ვერ გაივლი.',
        tax: `${t.n}: ხაზინას უხდი ${t.a}-ს.`,
        scroll: 'ბედის გრაგნილი: ბარათი, რომელიც ხშირად გზაზე გაგზავნის.',
        chest: 'საგანძური: ბარათი, ძირითადად ფულზე.'
      }[t.k];
      return `<div class="sheet-h"><h2>${esc(t.n)}</h2><button class="x" data-close aria-label="დახურვა">×</button></div><p class="prose">${about}</p>`;
    }
    const owner = o ? `<p class="owner"><img src="${por(st.players[o.o].hero)}" alt="" style="--c:${SEAT_COLORS[o.o]}">${esc(st.players[o.o].name)}${o.m ? ' · <b class="bad">დაგირავებული</b>' : ''}</p>` : '<p class="owner free">ჯერ არავისია</p>';
    if (mine) foot = manageButtons(st, seat, i);
    return `<button class="x float-x" data-close aria-label="დახურვა">×</button>${head}<div class="deed-b">${owner}${rows}${foot}</div>`;
  }
  function manageButtons(st, seat, i) {
    const L = Engine.legal(st, seat);
    if (!L.manage) return '<p class="hint">კოშკებს და დაგირავებას შენს სვლაზე მართავ.</p>';
    const t = BOARD[i], o = st.own[i], b = [];
    if (t.k === 'p' && L.build) {
      const why = Engine.buildBlock(st, seat, i);
      if (o.lv < 5) b.push(`<button class="btn small gold" data-a="build" data-i="${i}" ${why ? 'disabled' : ''} title="${esc(ERR[why] || '')}">+ ${esc(LEVEL_NAMES[o.lv + 1])} ${coin(GROUPS[t.g].b)}</button>`);
    }
    if (t.k === 'p' && o.lv > 0) b.push(`<button class="btn small" data-a="sell" data-i="${i}" ${Engine.canSell(st, seat, i) ? '' : 'disabled'}>− კოშკი ${coin(GROUPS[t.g].b / 2)}</button>`);
    if (!o.m) b.push(`<button class="btn small" data-a="mort" data-i="${i}" ${Engine.canMort(st, seat, i) ? '' : 'disabled'}>დაგირავება ${coin(t.p / 2)}</button>`);
    else if (L.build) b.push(`<button class="btn small" data-a="unmort" data-i="${i}" ${st.players[seat].cash >= Engine.unmortCost(i) ? '' : 'disabled'}>გამოსყიდვა ${coin(Engine.unmortCost(i))}</button>`);
    const why = t.k === 'p' && o.lv < 5 ? Engine.buildBlock(st, seat, i) : '';
    return `<div class="manage">${b.join('')}</div>${why && why !== 'cash' && L.build ? `<p class="hint">${esc(ERR[why] || '')}</p>` : ''}`;
  }

  // a player's things
  function holdings(st, s) {
    const rows = [];
    GROUPS.forEach((g, gi) => {
      const ts = GROUP_TILES[gi].filter(i => st.own[i] && st.own[i].o === s);
      if (ts.length) rows.push({ c: g.c, n: g.n, ts, full: Engine.groupOwner(st, gi) === s });
    });
    const rs = ROADS.filter(i => st.own[i] && st.own[i].o === s), us = UTILS.filter(i => st.own[i] && st.own[i].o === s);
    if (rs.length) rows.push({ c: '#8a6a4f', n: 'ქარვასლები', ts: rs });
    if (us.length) rows.push({ c: '#7a4a2a', n: 'მეურნეობა', ts: us });
    return rows;
  }
  function player(st) {
    const s = arg, p = st.players[s];
    if (!p) return null;
    const rows = holdings(st, s);
    const list = rows.length ? rows.map(r => `<div class="hold"><h4 style="--g:${r.c}">${esc(r.n)}${r.full ? ' <span class="tag">მთელი</span>' : ''}</h4>${r.ts.map(i => tileRow(st, i)).join('')}</div>`).join('') : '<p class="prose">ჯერ არაფერი აქვს.</p>';
    return `<div class="sheet-h"><img class="sh-por" src="${por(p.hero)}" alt="" style="--c:${SEAT_COLORS[s]}"><div><h2>${esc(p.name)}</h2><small>${esc(HEROES[p.hero].n)}</small></div><button class="x" data-close aria-label="დახურვა">×</button></div>
      <p class="facts"><span>ფული ${coin(p.cash)}</span><span>ქონება ${coin(Engine.worth(st, s))}</span>${p.fe.length ? `<span>ბუმბული ${p.fe.length}</span>` : ''}</p>${list}`;
  }
  function tileRow(st, i, actions) {
    const o = st.own[i], t = BOARD[i];
    const lv = o && o.lv ? `<img class="lvi" src="${ART(LEVELS[o.lv].a)}" alt="" title="${esc(LEVEL_NAMES[o.lv])}">` : '';
    const rent = Engine.rentAt(st, i, 7);
    return `<div class="trow${o && o.m ? ' mort' : ''}"><button class="tlink" data-deed="${i}" style="--g:${t.k === 'p' ? GROUPS[t.g].c : '#8a6a4f'}">${esc(t.n)}</button>${lv}<span class="tr-r">${o && o.m ? '<b class="bad">დაგირავებული</b>' : t.k === 'util' ? '×' + UTIL_MULT[Engine.countOf(st, o.o, UTILS)] : 'ქირა ' + coin(rent)}</span>${actions || ''}</div>`;
  }

  // managing your own things: towers up and down, pawning
  function estate(st) {
    const s = View.mySeat(), p = st.players[s];
    if (!p) return null;
    const L = Engine.legal(st, s), rows = holdings(st, s);
    const debt = st.phase === 'debt' && st.turn === s ? `<div class="debtbar">ვალი ${coin(st.pend.a)} · გაქვს ${coin(p.cash)} <button class="btn small gold" data-a="pay" ${p.cash >= st.pend.a ? '' : 'disabled'}>გადაიხადე</button></div>` : '';
    const note = L.manage ? '' : '<p class="hint">კოშკების აშენება და დაგირავება შენს სვლაზეა.</p>';
    const list = rows.length ? rows.map(r => `<div class="hold"><h4 style="--g:${r.c}">${esc(r.n)}${r.full ? ' <span class="tag">მთელი</span>' : ''}</h4>${r.ts.map(i => tileRow(st, i, L.manage ? rowActions(st, s, i, L) : '')).join('')}</div>`).join('') : '<p class="prose">ჯერ არაფერი გაქვს. იყიდე ქალაქი, რომელზეც დადგები.</p>';
    return `<div class="sheet-h"><h2>მამული</h2><span class="sh-cash">${coin(p.cash)}</span><button class="x" data-close aria-label="დახურვა">×</button></div>${debt}${note}${list}`;
  }
  function rowActions(st, s, i, L) {
    const t = BOARD[i], o = st.own[i], b = [];
    if (t.k === 'p' && L.build && Engine.groupOwner(st, t.g) === s && o.lv < 5) b.push(`<button class="ib gold" data-a="build" data-i="${i}" ${Engine.buildBlock(st, s, i) ? 'disabled' : ''} aria-label="კოშკის აშენება" title="აშენება ${GROUPS[t.g].b}">+</button>`);
    if (t.k === 'p' && o.lv > 0) b.push(`<button class="ib" data-a="sell" data-i="${i}" ${Engine.canSell(st, s, i) ? '' : 'disabled'} aria-label="კოშკის გაყიდვა" title="გაყიდვა ${GROUPS[t.g].b / 2}">−</button>`);
    if (!o.m) b.push(`<button class="ib" data-a="mort" data-i="${i}" ${Engine.canMort(st, s, i) ? '' : 'disabled'} title="დაგირავება ${t.p / 2}">დაგირ.</button>`);
    else if (L.build) b.push(`<button class="ib" data-a="unmort" data-i="${i}" ${st.players[s].cash >= Engine.unmortCost(i) ? '' : 'disabled'} title="გამოსყიდვა ${Engine.unmortCost(i)}">გამოსყ.</button>`);
    return `<span class="ibs">${b.join('')}</span>`;
  }

  // making an offer
  const tradeable = (st, s) => st.own.map((o, i) => o && o.o === s && (BOARD[i].k !== 'p' || GROUP_TILES[BOARD[i].g].every(j => !st.own[j] || !st.own[j].lv)) ? i : -1).filter(i => i >= 0);
  function trade(st) {
    const s = View.mySeat(), L = Engine.legal(st, s);
    if (!L.trade) return `<div class="sheet-h"><h2>ვაჭრობა</h2><button class="x" data-close aria-label="დახურვა">×</button></div><p class="prose">შეთავაზებას შენს სვლაზე აკეთებ, სანამ ყიდვას ან ვალს ელოდება.</p>`;
    const others = Engine.activeSeats(st).filter(x => x !== s);
    if (!draft || !others.includes(draft.to)) draft = { to: others[0], give: { p: [], c: 0, f: 0 }, get: { p: [], c: 0, f: 0 } };
    const d = draft, me = st.players[s], them = st.players[d.to];
    const side = (seat, x, key) => {
      const tl = tradeable(st, seat), pl = st.players[seat];
      const items = tl.length ? tl.map(i => `<button class="pick${x.p.includes(i) ? ' on' : ''}" data-pick="${key}" data-i="${i}" style="--g:${BOARD[i].k === 'p' ? GROUPS[BOARD[i].g].c : '#8a6a4f'}">${esc(BOARD[i].n)}<small>${BOARD[i].p}${st.own[i].m ? ' · დაგირ.' : ''}</small></button>`).join('') : '<p class="hint">გასაცვლელი ქონება არ აქვს</p>';
      return `<div class="tside"><h4>${key === 'give' ? 'შენ აძლევ' : 'შენ ითხოვ'}</h4><div class="picks">${items}</div>
        <div class="money"><span>ფული</span><button class="ib" data-cash="${key}" data-d="-50">−50</button><button class="ib" data-cash="${key}" data-d="-10">−10</button><b>${fmt(x.c)}</b><button class="ib" data-cash="${key}" data-d="10">+10</button><button class="ib" data-cash="${key}" data-d="50">+50</button><small>მაქს. ${fmt(pl.cash)}</small></div>
        ${pl.fe.length ? `<div class="money"><span>ბუმბული</span><button class="ib" data-fe="${key}" data-d="-1">−</button><b>${x.f}</b><button class="ib" data-fe="${key}" data-d="1">+</button><small>აქვს ${pl.fe.length}</small></div>` : ''}</div>`;
    };
    const tabs = others.map(x => `<button class="who${x === d.to ? ' on' : ''}" data-to="${x}" style="--c:${SEAT_COLORS[x]}"><img src="${por(st.players[x].hero)}" alt="">${esc(st.players[x].name)}</button>`).join('');
    const why = Engine.tradeBlock(st, { from: s, to: d.to, give: d.give, get: d.get });
    return `<div class="sheet-h"><h2>ვაჭრობა</h2><button class="x" data-close aria-label="დახურვა">×</button></div>
      <div class="whos">${tabs}</div>
      <div class="tsides">${side(s, d.give, 'give')}${side(d.to, d.get, 'get')}</div>
      <p class="hint">კოშკებიან კუთხეს ვერ გაცვლი: ჯერ კოშკები გაყიდე. ${them.bot ? 'ბოტი მხოლოდ მომგებიან გარიგებას ეთანხმება.' : ''}</p>
      <button class="btn gold wide" data-offer ${why ? 'disabled' : ''}>შეთავაზება: ${esc(them.name)}</button>`;
  }
  function tradeClick(ev) {
    const st = View.st, s = View.mySeat();
    const to = ev.target.closest('[data-to]'), pick = ev.target.closest('[data-pick]'), cash = ev.target.closest('[data-cash]'), fe = ev.target.closest('[data-fe]');
    if (to) { draft = { to: +to.dataset.to, give: { p: [], c: 0, f: 0 }, get: { p: [], c: 0, f: 0 } }; draw(); return true; }
    if (pick) { const x = draft[pick.dataset.pick], i = +pick.dataset.i; x.p = x.p.includes(i) ? x.p.filter(j => j !== i) : x.p.concat(i); draw(); return true; }
    if (cash) { const key = cash.dataset.cash, x = draft[key], max = st.players[key === 'give' ? s : draft.to].cash; x.c = Math.max(0, Math.min(max, x.c + +cash.dataset.d)); draw(); return true; }
    if (fe) { const key = fe.dataset.fe, x = draft[key], max = st.players[key === 'give' ? s : draft.to].fe.length; x.f = Math.max(0, Math.min(max, x.f + +fe.dataset.d)); draw(); return true; }
    if (ev.target.closest('[data-offer]')) { move({ t: 'offer', to: draft.to, give: draft.give, get: draft.get, seat: s }); close(); return true; }
    return false;
  }
  // an offer to this device's player
  function offer(st) {
    const tr = st.trade;
    if (!tr || !View.controls(tr.to)) return null;
    const from = st.players[tr.from];
    const list = x => [...x.p.map(i => `<span class="pick on static" style="--g:${BOARD[i].k === 'p' ? GROUPS[BOARD[i].g].c : '#8a6a4f'}">${esc(BOARD[i].n)}<small>${BOARD[i].p}${st.own[i] && st.own[i].m ? ' · დაგირ.' : ''}</small></span>`), x.c ? `<span class="pick static money-p">${coin(x.c)}</span>` : '', x.f ? `<span class="pick static">ბუმბული ×${x.f}</span>` : ''].join('') || '<span class="hint">არაფერი</span>';
    return `<div class="sheet-h"><img class="sh-por" src="${por(from.hero)}" alt="" style="--c:${SEAT_COLORS[tr.from]}"><div><h2>${esc(from.name)} გთავაზობს</h2><small>${esc(st.players[tr.to].name)}, შენ წყვეტ</small></div></div>
      <div class="tsides"><div class="tside"><h4>შენ მიიღებ</h4><div class="picks">${list(tr.give)}</div></div><div class="tside"><h4>შენ მისცემ</h4><div class="picks">${list(tr.get)}</div></div></div>
      <div class="row"><button class="btn gold" data-a="accept" data-seat="${tr.to}">თანხმობა</button><button class="btn" data-a="decline" data-seat="${tr.to}">უარი</button></div>`;
  }
  function log(st) {
    const lines = st.ev.map(e => evText(st, e)).filter(Boolean).reverse().slice(0, 70);
    return `<div class="sheet-h"><h2>ჟურნალი</h2><button class="x" data-close aria-label="დახურვა">×</button></div><ol class="log">${lines.map(l => `<li>${l}</li>`).join('')}</ol>`;
  }
  function menu(st) {
    const host = ROOM && (ROOM.role === 'local' || (st && st.host === ROOM.me));
    const code = ROOM && ROOM.mode === 'online' ? `<p class="facts"><span>ოთახი <b class="code">${esc(ROOM.code)}</b></span><span>${ROOM.up ? 'კავშირი წესრიგშია' : '<b class="bad">კავშირი გაწყდა, ვცდილობ აღდგენას</b>'}</span></p>` : '';
    return `<div class="sheet-h"><h2>მენიუ</h2><button class="x" data-close aria-label="დახურვა">×</button></div>${code}
      <div class="menu-list">
        <button class="btn wide" data-sheet="rules">წესები</button>
        <button class="btn wide" data-sound>ხმა: ${Sound.on ? 'ჩართული' : 'გამორთული'}</button>
        ${host && st && st.phase !== 'over' ? '<button class="btn wide" data-confirm="stop">თამაშის დასრულება ახლავე</button>' : ''}
        <button class="btn wide danger" data-confirm="leave">${ROOM && ROOM.mode === 'online' ? 'ოთახიდან გასვლა' : 'მთავარ მენიუში გასვლა'}</button>
      </div><div id="confirm"></div>`;
  }
  function bankruptSheet(st) {
    const s = st.turn;
    if (st.phase !== 'debt' || !View.controls(s)) return null;
    return `<div class="sheet-h"><h2>გაკოტრება</h2><button class="x" data-close aria-label="დახურვა">×</button></div>
      <p class="prose">${st.pend.to >= 0 ? `მთელ შენს ქონებას და ფულს მიიღებს ${esc(pName(st, st.pend.to))}.` : 'შენი ქალაქები ისევ თავისუფალი გახდება.'} თამაშს ვეღარ გააგრძელებ, მაგრამ ყურებას შეძლებ.</p>
      <div class="row"><button class="btn danger" data-a="bankrupt">გავკოტრდი</button><button class="btn" data-close>ჯერ ვიფიქრებ</button></div>`;
  }
  function over(st) {
    if (st.phase !== 'over') return null;
    const order = Engine.ranking(st), w = st.players[st.winner];
    const host = ROOM && (ROOM.role === 'local' || st.host === ROOM.me);
    return `<div class="over-h">${w ? `<img src="${por(w.hero)}" alt="" style="--c:${SEAT_COLORS[st.winner]}"><h2>${esc(w.name)} გაიმარჯვა</h2>` : '<h2>თამაში დასრულდა</h2>'}</div>
      <ol class="rank">${order.map((s, k) => { const p = st.players[s]; return `<li><span class="rk">${k + 1}</span><img src="${por(p.hero)}" alt="" style="--c:${SEAT_COLORS[s]}"><span class="rn">${esc(p.name)}</span><span class="rv">${p.out ? 'გაკოტრდა' : coin(Engine.worth(st, s))}</span></li>`; }).join('')}</ol>
      <div class="row">${host ? '<button class="btn gold" data-again>ახალი თამაში</button>' : ''}<button class="btn" data-confirm-now="leave">მენიუ</button></div>`;
  }
  function rules() {
    return `<div class="sheet-h"><h2>წესები</h2><button class="x" data-close aria-label="დახურვა">×</button></div><div class="prose rules">
      <p>ყველა იწყებს ${fmt(START_CASH)}-ით სტარტზე. სვლაზე ორ კამათელს აგორებ და იმდენ უჯრას გადიხარ. სტარტის გავლისას ${SALARY} გეძლევა.</p>
      <p><b>ქალაქები.</b> თავისუფალ ქალაქზე, ქარვასლაზე, წისქვილზე ან მარანზე თუ დადექი, შეგიძლია იყიდო. სხვისაზე თუ დადექი, მფლობელს ქირას უხდი. მთელი კუთხე თუ შენია, ქირა ორმაგდება.</p>
      <p><b>კოშკები.</b> მთელ კუთხეზე შენს სვლაზე აშენებ: ხის კოშკი, ქვის კოშკი, სამეფო, გუშაგიანი, ბოლოს ციხე-სიმაგრე. კოშკები კუთხის ქალაქებში თანაბრად შენდება, ყოველი მომდევნო ქირას ძლიერ ზრდის.</p>
      <p><b>ქარვასლები</b> ქირას იღებენ იმის მიხედვით, რამდენი გაქვს: 25, 50, 100, 200. <b>წისქვილი და მარანი</b>: კამათლის ჯამი ×4, ორივე თუ გაქვს, ×10.</p>
      <p><b>ბარათები.</b> ბედის გრაგნილი და საგანძური ფულს გაძლევს ან გართმევს, გზაზე გაგზავნის. ფასკუნჯის ბუმბული ზინდანიდან ერთხელ გამოგიყვანს.</p>
      <p><b>ზინდანი.</b> იქ ხვდები „ზინდანში!" უჯრით, ბარათით ან სამი დუბლით ზედიზედ. გამოსვლა: დუბლი სამ ცდაში, ${JAIL_FINE}-ის გადახდა ან ბუმბული. ზინდანშიც იღებ ქირას.</p>
      <p><b>ფული თუ არ გყოფნის,</b> კოშკებს ნახევარ ფასად ყიდი და ქალაქებს აგირავებ (ნახევარი ფასი; გამოსყიდვა 10%-ით მეტი ჯდება). თუ მაინც ვერ იხდი, კოტრდები.</p>
      <p><b>ვაჭრობა.</b> შენს სვლაზე ნებისმიერ მოთამაშეს შესთავაზე ქალაქების, ფულის და ბუმბულის გაცვლა. კოშკებიანი კუთხე ვაჭრობაში არ შედის.</p>
      <p><b>დასასრული.</b> ან სანამ ერთი არ დარჩება, ან რაუნდების ლიმიტამდე. ლიმიტზე იგებს ის, ვისი ფულიც და ქონებაც ერთად ყველაზე მეტია.</p></div>`;
  }

  function onClick(ev) {
    const st = View.st;
    if (ev.target === box()) return close();
    if (ev.target.closest('[data-close]')) return close();
    if (kind === 'trade' && tradeClick(ev)) return;
    const a = ev.target.closest('[data-a]');
    if (a && !a.disabled) {
      const m = { t: a.dataset.a };
      if (a.dataset.i != null) m.i = +a.dataset.i;
      if (a.dataset.seat != null) m.seat = +a.dataset.seat;
      if (m.t === 'bankrupt' || m.t === 'accept' || m.t === 'decline') close();
      move(m);
      return;
    }
    const d = ev.target.closest('[data-deed]');
    if (d) return open('deed', +d.dataset.deed);
    const sh = ev.target.closest('[data-sheet]');
    if (sh) return open(sh.dataset.sheet);
    if (ev.target.closest('[data-sound]')) { Sound.on = !Sound.on; Sound.unlock(); return draw(); }
    const c = ev.target.closest('[data-confirm]');
    if (c) {
      const what = c.dataset.confirm;
      $('#confirm').innerHTML = `<p class="prose">${what === 'stop' ? 'თამაში ახლავე დასრულდება და გაიმარჯვებს ის, ვისი ქონებაც ყველაზე მეტია.' : ROOM && ROOM.mode === 'online' ? 'ოთახიდან გახვალ. თამაში შენს გარეშე გაგრძელდება.' : 'თამაში შეინახება და მენიუდან გააგრძელებ.'}</p><div class="row"><button class="btn danger" data-confirm-now="${what}">დიახ</button><button class="btn" data-close>არა</button></div>`;
      return;
    }
    const cn = ev.target.closest('[data-confirm-now]');
    if (cn) {
      close();
      if (cn.dataset.confirmNow === 'stop') return move({ t: 'stop' });
      leaveRoom(false); setHash(''); UI.go('menu'); return;
    }
    if (ev.target.closest('[data-again]')) { close(); return rematch(); }
  }

  return { open, close, refresh, kind: () => kind, onClick };
})();

// the host starts a new game with the same people
function rematch() {
  if (!isHost()) return;
  const old = ROOM.st, st = Engine.newLobby(old.host);
  st.term = old.term; st.seq = old.seq; st.cfg = old.cfg;
  st.players = old.players.filter(p => p.bot || !p.away || ROOM.role === 'local').map(p => ({ pid: p.pid, name: p.name, hero: p.hero, bot: p.bot, cash: START_CASH, pos: 0, jail: false, jt: 0, fe: [], out: false, outAt: 0, dbl: 0, away: false }));
  ROOM.st = st;
  UI.go('lobby');
  commit();
}

// ===== screens and small messages =====
const UI = (() => {
  let screen = '';
  function go(s) {
    if (s === screen) return;
    screen = s;
    $$('.screen').forEach(el => { el.hidden = el.id !== 'scr-' + s; });
    if (s !== 'game') Sheet.close();
    if (s === 'menu') Menu.render();
    if (s === 'game') { requestAnimationFrame(() => View.fit()); }
  }
  function toast(msg, ms, kind) {
    const box = $('#toasts');
    if (!box) return;
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.innerHTML = msg;
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { t.classList.add('bye'); setTimeout(() => t.remove(), 400); }, ms || 2600);
  }
  function moveRefused(code) {
    View.busy(false);
    if (View.st) View.render();
    if (code && code !== 'turn' && ERR[code]) { toast(ERR[code], 2600, 'bad'); Sound.bad(); }    // 'turn': a button pressed twice
  }
  return { go, toast, moveRefused, get screen() { return screen; } };
})();
