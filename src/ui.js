// ===== the game screen =====
// View.show(state) is called with every new state. The events in it play one after another (dice, the figure walking,
// cards, money), and once they are done the whole screen is drawn from the state.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ART = n => 'art/' + n + (/\.(?:jpe?g|png|webp)$/i.test(n) ? '' : '.webp');
const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const coin = n => `<b class="amt"><i class="ci"></i>${fmt(n)}</b>`;
// a hero's portrait (a king or hero of მამული, or a pirate)
const por = h => ART((HEROES[h] && HEROES[h].t === 'archipelago' ? 'por_p_' : 'por_h_') + h);
const pName = (st, s) => st && st.players[s] ? st.players[s].name : '?';
const tName = i => BOARD[i].n.replace(/\u00ad/g, '');
// The sea's four pirate cottages upgrade to a timber inn; the land keeps its towers/fortress.
const PIRATE_INN_SVG = '<svg viewBox="0 0 34 32" aria-hidden="true"><path d="M5 30V12h24v18z" fill="#c79656" stroke="#493421" stroke-width="1.4"/><path d="M2 13 17 3l15 10z" fill="currentColor" stroke="#493421" stroke-width="1.4" stroke-linejoin="round"/><path d="M7 21h20M7 23h20M7 24v6M27 24v6" stroke="#493421" stroke-width="1.4"/><path d="M10 14h4v5h-4zM20 14h4v5h-4z" fill="#ffdf8d" stroke="#493421"/><path d="M14 30v-7h6v7" fill="#473326"/><path d="M26 9V1m0 0h6l-1.5 2L32 5h-6" stroke="#493421" fill="currentColor" stroke-width="1.2"/></svg>';
const sea = () => THEME.world === 'sea';
const towerIcon = () => sea() ? HUT_SVG : TOWER_SVG;
const lvIcons = lv => lv >= 5 ? (sea() ? `<span class="tws fort-i">${PIRATE_INN_SVG}</span>` : `<img class="fort" src="${ART('s_fort')}" alt="">`) : `<span class="tws">${towerIcon().repeat(lv)}</span>`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const REDUCED = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();

const SCENES = ['g_pass', 'g_svan', 'g_elbrus', 'g_elbrus', 'g_stone', 'g_stone', 'g_svan', 'g_tbilisi'];
const SCENE_POS = ['50% 70%', '50% 35%', '30% 60%', '70% 40%', '40% 30%', '75% 55%', '20% 70%', '50% 50%'];
// the picture behind a square's name on its card: a Georgian landscape, or in the archipelago its sea and island
function sceneBg(t, fade) {
  if (sea()) { const sc = seaScene(t); return sc ? `background-image:${fade},url(${ART(sc)});background-position:right center` : `background-image:${fade},url('${seaArt(t)}');background-position:50% 62%`; }
  const scene = t.k === 'p' ? SCENES[t.g] : t.k === 'road' ? 'g_pass' : 'g_elbrus', at = t.k === 'p' ? SCENE_POS[t.g] : '50% 50%';
  return `background-image:${fade},url(${ART(scene)});background-position:${at}`;
}
const CHART_COMPASS = '<svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="30"/><circle cx="40" cy="40" r="24"/><path d="M40 3v74M3 40h74M14 14l52 52M14 66l52-52"/><path d="m40 10 6 24 24 6-24 6-6 24-6-24-24-6 24-6z"/><path d="m40 10 6 24-6 6-6-6z" fill="currentColor"/><circle cx="40" cy="40" r="4"/></svg>';
const PIRATE_FLAG = '<svg viewBox="0 0 44 42" aria-hidden="true"><path d="M7 39V3" fill="none" stroke="#654528" stroke-width="3" stroke-linecap="round"/><path d="M9 5c8-6 16 6 30 0v23c-13 7-21-6-30 0z" fill="currentColor" stroke="#fff2bd" stroke-width="1.2"/><g fill="#fff4d6"><path d="M22 10a5 5 0 0 1 5 5c0 2-1 3-2 4v3h-6v-3c-1-1-2-2-2-4a5 5 0 0 1 5-5z"/><path d="m16 25 12-5m-12-1 12 7" stroke="#fff4d6" stroke-width="1.8" stroke-linecap="round"/></g><g fill="#394653"><circle cx="20" cy="15" r="1.2"/><circle cx="24" cy="15" r="1.2"/></g></svg>';
const seaLotType = t => t.k === 'p' ? 'კუნძული' : t.k === 'road' ? 'მეკობრის ხომალდი' : t.k === 'util' ? 'საზღვაო სადგური' : ({ start: 'ნავსადგური', jail: 'უკაცრიელი კუნძული', feast: 'ტავერნა', gojail: 'ზღვის საფრთხე', tax: 'საზღვაო ხარჯი', scroll: 'ბოთლში წერილი', chest: 'განძის სკივრი' }[t.k] || 'არქიპელაგი');
function seaCharterHead(t, label, tag = '') {
  const color = t.k === 'p' ? GROUPS[t.g].c : '#579ca9';
  const region = t.k === 'p' ? GROUPS[t.g].n : t.k === 'road' ? 'მეკობრეთა ფლოტი' : t.k === 'util' ? W.util : 'არქიპელაგი';
  const picture = typeof seaCardPicture === 'function' ? seaCardPicture(t) : seaScene(t) ? { name: seaScene(t), crop: [600, 0, 400, 400] } : null;
  const art = picture && picture.crop
    ? `<svg class="charter-photo" viewBox="${picture.crop.join(' ')}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(t.n.replace(/\u00ad/g, ''))}"><image href="${esc(ART(picture.name))}" width="1000" height="400"/></svg>`
    : `<img class="charter-photo" src="${picture ? esc(ART(picture.name)) : seaArt(t)}" alt="${esc(t.n.replace(/\u00ad/g, ''))}" decoding="async">`;
  return `<header class="charter-scene" style="--g:${color}">
    <div class="charter-register"><span>${esc(label)}</span><small>№ ${String(t.i + 1).padStart(2, '0')}</small></div>
    <div class="charter-illustration">${art}</div>
    <div class="charter-place"><span class="charter-region" style="--g:${color}">${esc(region)}</span>${tag}<h3>${esc(t.n.replace(/\u00ad/g, ''))}</h3><small>${esc(seaLotType(t))}</small></div>
    <span class="charter-compass">${CHART_COMPASS}</span></header>`;
}
function seaOwnership(st, i) {
  const o = st.own[i], p = o && st.players[o.o];
  if (!p) return `<div class="charter-owner free"><span class="charter-flag">${PIRATE_FLAG}</span><div><small>მფლობელი</small><b>თავისუფალი ${esc(seaLotType(BOARD[i]))}</b></div><span class="charter-status">იყიდება</span></div>`;
  const color = SEAT_COLORS[o.o];
  return `<div class="charter-owner" style="--owner:${color}"><span class="charter-flag">${PIRATE_FLAG}</span><img src="${por(p.hero)}" alt=""><div><small>მფლობელი · კაპიტანი</small><b>${esc(p.name)}</b></div><span class="charter-status${o.m ? ' mortgaged' : ''}">${o.m ? 'დაგირავებულია' : 'მისი დროშა'}</span></div>`;
}
function seaDevelopment(st, i) {
  if (BOARD[i].k !== 'p') return '';
  const lv = st.own[i] ? st.own[i].lv : 0;
  const cottages = [1, 2, 3, 4].map(k => `<span class="charter-building${lv > 0 && lv < 5 && k <= lv ? ' built' : ''}" aria-hidden="true">${HUT_SVG}</span>`).join('');
  return `<div class="charter-development"><div><small>კუნძულის განვითარება</small><b>${esc(lv ? LEVEL_NAMES[lv] : 'გაუშენებელი კუნძული')}</b></div><div class="charter-buildings" aria-label="${lv === 5 ? '1 მეკობრის სასტუმრო, 0 ქოხი' : `${lv} მეკობრის ქოხი, 0 სასტუმრო`}">${cottages}<span class="charter-building inn${lv === 5 ? ' built' : ''}" aria-hidden="true">${PIRATE_INN_SVG}</span></div></div>`;
}
function seaCaptain(st, seat) {
  const p = st.players[seat];
  return `<div class="charter-captain" style="--owner:${SEAT_COLORS[seat]}"><img src="${por(p.hero)}" alt=""><span><small>შენი კაპიტანი</small><b>${esc(p.name)}</b></span><span class="charter-wallet"><small>ხელთ გაქვს</small>${coin(p.cash)}</span></div>`;
}
const ERR = {
  turn: 'ახლა ამის გაკეთება არ შეიძლება', cash: 'ფული არ გყოფნის', get group() { return W.errGroup; },
  get even() { return W.errEven; }, get mort() { return W.errMort; }, get max() { return sea() ? 'აქ უკვე მეკობრის სასტუმროა' : 'აქ უკვე ციხეა'; }, answered: 'უკვე უპასუხე',
  own: 'ეს შენი არ არის', bad: 'ასე არ შეიძლება', empty: 'შეთავაზება ცარიელია', stale: 'შეთავაზება აღარ მოქმედებს',
  host: 'ამას მხოლოდ მასპინძელი აკეთებს', few: 'საჭიროა მინიმუმ ორი მოთამაშე', taken: 'ეს გმირი უკვე დაკავებულია',
  full: 'ოთახი სავსეა', watch: 'ამ თამაშს მხოლოდ უყურებ', started: 'თამაში უკვე დაიწყო', out: 'შენ გაკოტრდი', over: 'თამაში დასრულდა',
  passed: 'აუქციონიდან უკვე გამოხვედი'
};

// the roll button's picture
const DICE_SVG = '<svg viewBox="0 0 44 40" aria-hidden="true"><g transform="rotate(-14 13 23)"><rect x="3" y="13" width="20" height="20" rx="4.5" fill="#fffaf0" stroke="#2c1b10" stroke-width="2.2"/><g fill="#2c1b10"><circle cx="8.5" cy="18.5" r="2"/><circle cx="13" cy="23" r="2"/><circle cx="17.5" cy="27.5" r="2"/></g></g><g transform="rotate(12 30 17)"><rect x="20" y="7" width="20" height="20" rx="4.5" fill="#fffaf0" stroke="#2c1b10" stroke-width="2.2"/><g fill="#2c1b10"><circle cx="25.5" cy="12.5" r="2"/><circle cx="34.5" cy="12.5" r="2"/><circle cx="30" cy="17" r="2.2" fill="#a32a1e"/><circle cx="25.5" cy="21.5" r="2"/><circle cx="34.5" cy="21.5" r="2"/></g></g></svg>';
// Safari's share button, as it looks
const SHARE_SVG = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 10H5v11h14V10h-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
const TOWER_SVG = '<svg viewBox="0 0 20 28" aria-hidden="true"><path d="M4 27V9h12v18z" fill="#d9cfbc" stroke="#5a4636" stroke-width="1.5"/><path d="M3 9h14l-7-8z" fill="currentColor" stroke="#5a4636" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 27v-6h4v6" fill="#3b2c22"/></svg>';
const VIEW_SVG = { all: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="7.5" y="7.5" width="9" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  me: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' };

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
  function noise(len, freq, vol, at) {
    const a = ctx(); if (!a) return;
    const t = a.currentTime + (at || 0), b = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.6; g.gain.value = vol;
    s.buffer = b; s.connect(f); f.connect(g); g.connect(a.destination); s.start(t);
  }
  return {
    get on() { return on; },
    set on(v) { on = !!v; store.set('sound', on); },
    unlock() { ctx(); },
    dice() { for (let k = 0; k < 5; k++) noise(0.03, 1800 + Math.random() * 1500, 0.3, k * 0.06 + Math.random() * 0.02); },
    tick(v) { noise(0.03, 1300 + Math.random() * 1700, 0.12 + (v || 0.5) * 0.5); },
    coin() { tone(1320, 0.12, 'triangle', 0.08); tone(1760, 0.18, 'triangle', 0.07, 0.07); },
    pay() { tone(520, 0.16, 'triangle', 0.08); tone(390, 0.22, 'triangle', 0.07, 0.08); },
    step() { tone(300 + Math.random() * 60, 0.05, 'square', 0.02); },
    turn() { tone(660, 0.14, 'sine', 0.09); tone(880, 0.2, 'sine', 0.09, 0.12); },
    build() { tone(220, 0.08, 'square', 0.05); tone(330, 0.12, 'square', 0.05, 0.08); },
    bad() { tone(160, 0.25, 'sawtooth', 0.05); },
    bid() { tone(990, 0.07, 'triangle', 0.06); tone(1320, 0.09, 'triangle', 0.05, 0.05); },
    gavel() { noise(0.09, 420, 0.7); noise(0.09, 380, 0.6, 0.2); tone(140, 0.12, 'sine', 0.08, 0.2); },
    // the land growing out of the board: a low rumble
    rumble() { for (let k = 0; k < 7; k++) noise(0.5, 55 + k * 10, 0.55, k * 0.17); tone(46, 1.3, 'sine', 0.06); },
    thunder(strength = 1) {
      const k = Math.max(0.25, Math.min(1, strength));
      noise(1.8, 90, 0.38 * k); noise(2.4, 55, 0.28 * k, 0.32);
      tone(37, 2.5, 'sine', 0.035 * k);
    },
    card() { tone(740, 0.08, 'sine', 0.06); tone(990, 0.12, 'sine', 0.06, 0.06); }
  };
})();

// can this player put up a tower anywhere now?
const canBuild = (st, s) => s >= 0 && Engine.legal(st, s).build && BOARD.some((t, i) => !Engine.buildBlock(st, s, i));
// the town where the next tower of region g goes (towers go up evenly), and where one comes down
const nextBuild = (st, s, g) => GROUP_TILES[g].filter(i => !Engine.buildBlock(st, s, i)).sort((a, b) => st.own[a].lv - st.own[b].lv)[0];
const nextSell = (st, s, g) => GROUP_TILES[g].filter(i => Engine.canSell(st, s, i)).sort((a, b) => st.own[b].lv - st.own[a].lv)[0];

// the room's world: its names and words everywhere, the board's look, the buttons below the board
function applyTheme(st) {
  if (!useTheme(Engine.themeKey(st))) return;
  const app = $('#app');
  if (app) app.dataset.world = THEME.key;
  const est = $('#dockEstate');
  if (est) { est.querySelector('img').src = ART(sea() ? 'ui_chest_wood' : 's_fort'); est.querySelector('span:last-child').textContent = W.estate; }
  if (typeof Board3D !== 'undefined' && Board3D.retheme) Board3D.retheme();
  Diag.note('theme', THEME.key);
}

// ----- the view -----
const View = (() => {
  let target = null, shown = null, lastEv = 0, q = [], playing = false, busy = false, pos = [], endsAt = 0;
  let built = false, cash = [], autoT = 0, gl = true, current = null, idleAt = 0, rate = 1, gen = 0, batch = 0;
  // a move's steps (games saved before the field had its own name kept them in 'n')
  const stepsOf = e => e.steps != null ? e.steps : ((e.to - e.from) % 40 + 40) % 40;
  const wait = ms => sleep(ms / rate);

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
    applyTheme(st);
    if (st.phase === 'lobby') { target = st; shown = clone(st); lastEv = st.evn; q = []; leaveBoard(); UI.go('lobby'); Lobby.render(shown); return; }
    UI.go('game');
    // the log holds the last events, numbered one by one: what this screen has not shown yet is at its end
    const first = st.evn - st.ev.length + 1;
    if (!built || !shown || shown.phase === 'lobby' || st.evn < lastEv || first > lastEv + 1) { reset(st); return; }
    target = clone(st);
    expectThrow(target);
    const fresh = target.ev.slice(Math.max(0, lastEv + 1 - first));
    if (fresh.length) batch++;
    for (const e of fresh) { e._b = batch; q.push(e); }     // which change of the state it came with
    lastEv = target.evn;
    // far behind (a slow phone, a lost connection): jump to the present instead of playing it all
    if (q.length > 60 || document.visibilityState === 'hidden') { q = []; if (gl && Board3D.ok) Board3D.halt(); finishPlay(); return; }
    endsAt = Math.max(endsAt, Date.now()) + estimate(fresh);
    if (!playing) play();
  }
  // the next throw of the dice is known already: it is worked out while there is time
  function expectThrow(st) { if (st && st.phase !== 'lobby' && st.phase !== 'over') Dice3D.expect(Engine.throwSeed(st, st.rolls + 1)); }
  function reset(st) {
    applyTheme(st);
    if (shown && shown.evn !== st.evn) Diag.note('screen', `jumped from event ${shown.evn} to ${st.evn}`);
    target = clone(st); shown = clone(st); lastEv = st.evn; q = []; playing = false; idleAt = Date.now(); speed(1);
    expectThrow(target);
    caughtUp(shown.evn);
    gen++;
    hideEventCard();
    if (gl && Board3D.ok) Board3D.halt();
    if (Dice3D.busy) Dice3D.skip();
    pos = shown.players.map(p => p.pos);
    cash = shown.players.map(p => p.cash);
    board();
    const fresh = !built;
    built = true;
    if (gl) Board3D.show(shown, pos, fresh);
    render();
  }
  // the 3D board, made once per page (usually ready by now: it is made while the menu is on screen)
  let boarded = false;
  function board() {
    const stage = $('#stage');
    if (!stage || boarded) return;
    boarded = true;
    gl = Board3D.init(stage);
    if (!gl) { stage.innerHTML = '<p class="nogl">ამ ბრაუზერში 3D დაფა ვერ ჩაირთო. სცადე სხვა ბრაუზერი (Chrome, Safari) ან განაახლე ეს.</p>'; return; }
    Board3D.onPick(i => Sheet.open('deed', i));
  }
  function leaveBoard() { hideEventCard(); hideCard(); built = false; if (Board3D.ok) { Board3D.pins([]); Board3D.leave(); } if (Dice3D.busy) Dice3D.skip(); const pb = $('#pins'); if (pb) pb.innerHTML = ''; pinsKey = ''; }
  function clear() { target = shown = null; q = []; playing = false; lastEv = 0; gen++; leaveBoard(); Sheet.close(); hideBuy(); }
  // roughly how long events take on screen (only a hint for tests and the like: the computer players wait for the screen itself)
  function estimate(list) {
    let t = 0;
    for (const e of list) {
      if (e.k === 'roll') t += REDUCED ? 300 : 2300;
      else if (e.k === 'move') t += e.fly || stepsOf(e) > 12 ? 1000 : stepsOf(e) * 190 + 300;
      else if (e.k === 'jail') t += 1000;
      else if (e.k === 'card') t += 4500;
      else if (e.k === 'turn') t += 300;
      else t += 450;
    }
    return t;
  }
  const pending = () => playing ? Math.max(1, endsAt - Date.now()) : 0;
  // how long the screen has had nothing left to show (0 while it is showing something)
  const idleFor = () => playing || !built ? 0 : Date.now() - idleAt;
  // a long queue (this phone is slower than the others, or the connection stalled) plays faster until it has caught up
  function speed(k) { rate = k; if (gl && Board3D.ok) Board3D.speed(k); }

  // one player of the queue at a time: a newer one (after a jump to the present) makes an older one stop
  async function play() {
    const my = ++gen;
    playing = true;
    renderPins();
    clearTimeout(autoT);
    // the auction's card stays while bids come in, the chest's question while answers do
    if (!(target && shown && target.phase === shown.phase && (shown.phase === 'auction' || shown.phase === 'quiz'))) hideBuy();
    while (q.length && gen === my) {
      const e = q.shift();
      current = e;
      // several moves behind the present (this phone is slower than the host's, or the connection stalled): faster
      const behind = q.length ? q[q.length - 1]._b - e._b : 0;
      const k = behind >= 4 ? 2.4 : behind >= 2 ? 1.6 : 1;
      if (k > 1 && rate === 1) Diag.note('screen', `${behind} moves behind: faster`);
      speed(k);
      // an animation that never ends must not hold up the game: none takes 9 seconds, and none goes on without frames
      // (the 3D board lost its graphics, or stopped drawing): then everything jumps to its end and the game goes on
      let late = 0;
      const t0 = Date.now();
      const guard = new Promise(r => {
        late = setInterval(() => {
          const starved = gl && Board3D.ok && document.visibilityState === 'visible' && Board3D.drawnAgo > 1500;
          if (starved || Date.now() - t0 > 9000) r(starved ? 'no frames' : 'too long');
        }, 250);
      });
      try {
        const stuck = await Promise.race([animate(e), guard]);
        if (stuck && gen === my) { Diag.note('stall', `${e.k}: ${stuck} after ${Date.now() - t0} ms`); if (gl && Board3D.ok) Board3D.halt(); }
      } catch (err) { console.warn(err); Diag.note('error', `${e.k}: ${(err && err.message) || err}`); }
      clearInterval(late);
      if (gen === my) current = null;
    }
    if (gen === my) finishPlay();
  }
  function finishPlay() {
    gen++;
    hideEventCard();
    current = null;
    playing = false;
    idleAt = Date.now();
    speed(1);
    shown = target;
    pos = shown.players.map(p => p.pos);
    cash = shown.players.map(p => p.cash);
    render();
    caughtUp(shown.evn);                 // the host waits for the slowest screen before the computer players move on
  }

  // ----- one event on screen -----
  async function animate(e) {
    const st = target;
    switch (e.k) {
      case 'roll': {
        if (!gl) break;
        Board3D.focus(e.s); Sound.dice();
        const t = performance.now();
        await Dice3D.roll(e.d, e.w);
        if (performance.now() - t > 4000) Diag.note('dice', `the throw took ${Math.round(performance.now() - t)} ms`);
        break;
      }
      case 'move': {
        const n = stepsOf(e), g0 = gen;
        Board3D.focus(e.s);
        if (e.fly || Math.abs(n) > 12 || REDUCED) await Board3D.fly(e.s, e.to); else await Board3D.walk(e.s, e.from, e.to, n);
        if (gen === g0) pos[e.s] = e.to;
        break;
      }
      case 'jail': { const g0 = gen; Board3D.focus(e.s); bubble(e.s, esc(W.toJail), 'bad'); await Board3D.fly(e.s, JAIL); if (gen === g0) pos[e.s] = JAIL; Sound.bad(); await wait(200); break; }
      case 'free': bubble(e.s, esc(W.freed), 'good'); break;
      case 'stay': bubble(e.s, esc(W.stays), ''); break;
      case 'debt': bubble(e.s, `ვალი ${coin(e.a)}`, 'bad'); break;
      case 'salary': case 'gain': {
        money(e.s, e.a); Sound.coin();
        await Promise.all([wait(260), gl ? Board3D.coins(-1, e.s, e.a) : Promise.resolve()]); break;
      }
      case 'pay': {
        money(e.s, -e.a); if (e.to >= 0) money(e.to, e.a);
        const flight = gl ? Board3D.coins(e.s, e.to, e.a) : Promise.resolve();
        if (e.why === 'rent') {                    // the notes by the two chips tell everyone; the toast only those who paid or got it
          if (controls(e.s) || controls(e.to)) toastEv(`${esc(pName(st, e.s))} → ${esc(pName(st, e.to))}: ქირა ${coin(e.a)}`, controls(e.to) ? 'good' : 'bad');
          bubble(e.s, `ქირა → ${esc(pName(st, e.to))}`, 'bad'); bubble(e.to, 'მიიღო ქირა', 'good');
        }
        else if (e.why === 'tax') { if (controls(e.s)) toastEv(`${esc(tName(e.i))}: ${coin(e.a)}`, 'bad'); bubble(e.s, esc(tName(e.i)), 'bad'); }
        else bubble(e.s, e.why === 'fine' ? esc(W.fine) : e.why === 'repair' ? 'შეკეთება' : 'გადაიხადა', 'bad');
        Sound.pay(); await Promise.all([wait(450), flight]); break;
      }
      case 'buy': {
        Board3D.setOwner(e.i, e.s, true); money(e.s, -e.a); bubble(e.s, `იყიდა: ${esc(tName(e.i))}`, 'good'); Sound.coin();
        await Promise.all([wait(450), gl ? Board3D.coins(e.s, -1, e.a) : Promise.resolve()]); whole(st, e.s, [e.i]); break;
      }
      case 'skip': bubble(e.s, `აუქციონზე: ${esc(tName(e.i))}`, ''); break;
      // the auction: its card is drawn from the state; the events only add sound, the notes and the town's owner
      case 'auction': Sheet.close(true); Board3D.focus(e.s); Board3D.pop(e.i, 0.08); Sound.gavel(); await wait(250); break;
      case 'bid': bubble(e.s, coin(e.a), 'bid'); Sound.bid(); await wait(120); break;
      case 'pass': bubble(e.s, 'გავიდა', ''); break;
      case 'won': {
        Board3D.setOwner(e.i, e.s, true); money(e.s, -e.a); Sound.gavel(); bubble(e.s, `იყიდა: ${esc(tName(e.i))}`, 'good');
        toastEv(`${esc(pName(st, e.s))}: ${esc(tName(e.i))} აუქციონზე · ${coin(e.a)}`, controls(e.s) ? 'good' : '');
        await Promise.all([wait(600), gl ? Board3D.coins(e.s, -1, e.a) : Promise.resolve()]); whole(st, e.s, [e.i]); break;
      }
      case 'unsold': toastEv(`${esc(tName(e.i))}: აუქციონზე არავინ იყიდა`); await wait(300); break;
      case 'build': case 'sell': {
        const payout = e.k === 'sell', amount = Engine.buildCost(e.i) * (payout ? 0.5 : 1);
        Board3D.setLevel(e.i, e.lv, true); money(e.s, payout ? amount : -amount);
        bubble(e.s, e.k === 'build' ? `${LEVEL_NAMES[e.lv]}: ${esc(tName(e.i))}` : `${esc(W.soldTower)}: ${esc(tName(e.i))}`, e.k === 'build' ? 'good' : ''); Sound.build();
        await Promise.all([wait(380), gl ? Board3D.coins(payout ? -1 : e.s, payout ? e.s : -1, amount) : Promise.resolve()]); break;
      }
      case 'mort': {
        const amount = Engine.mortValue(e.i);
        Board3D.setMort(e.i, true, true); money(e.s, amount); bubble(e.s, `დააგირავა: ${esc(tName(e.i))}`, 'bad');
        await Promise.all([wait(240), gl ? Board3D.coins(-1, e.s, amount) : Promise.resolve()]); break;
      }
      case 'unmort': {
        const amount = Engine.unmortCost(e.i);
        Board3D.setMort(e.i, false, true); money(e.s, -amount); bubble(e.s, `გამოისყიდა: ${esc(tName(e.i))}`, 'good');
        await Promise.all([wait(240), gl ? Board3D.coins(e.s, -1, amount) : Promise.resolve()]); break;
      }
      case 'card': bubble(e.s, esc(e.d === 's' ? W.scroll : W.chest), ''); await showCard(e); break;
      // the chest's question: its card is drawn from the state; the answers come in as notes; then the answer
      case 'quiz': bubble(e.s, esc(W.chest), ''); Board3D.focus(e.s); Sound.card(); await wait(350); break;
      case 'answer': bubble(e.s, 'უპასუხა', ''); Sound.tick(0.6); break;
      case 'quizEnd': await quizReveal(e); break;
      case 'turn': {
        Board3D.focus(e.s); Board3D.setTurn(e.s);
        const mine = controls(e.s) && ROOM && ROOM.role !== 'local';
        if (mine || (ROOM && ROOM.role === 'local' && controls(e.s) && st.players.filter(p => !p.bot).length > 1)) {
          banner(mine ? 'შენი სვლაა' : `${pName(st, e.s)}, შენი სვლაა`, e.s);
          Sound.turn();
          try { if (mine && navigator.vibrate) navigator.vibrate(60); } catch (err) { }
          await wait(700);
        } else await wait(250);
        break;
      }
      case 'decline': if (controls(e.from)) toastEv(`${esc(pName(st, e.to))}: უარი შენს შეთავაზებაზე`, 'bad'); break;
      case 'trade': {
        for (const i of e.give.p) Board3D.setOwner(i, e.to, true);
        for (const i of e.get.p) Board3D.setOwner(i, e.from, true);
        const difference = e.get.c - e.give.c, flights = [];
        money(e.from, difference); money(e.to, -difference);
        if (gl && e.give.c > 0) flights.push(Board3D.coins(e.from, e.to, e.give.c));
        if (gl && e.get.c > 0) flights.push(Board3D.coins(e.to, e.from, e.get.c));
        whole(st, e.to, e.give.p); whole(st, e.from, e.get.p);
        toastEv(`${esc(pName(st, e.from))} ⇄ ${esc(pName(st, e.to))}: გარიგება შედგა`, 'good'); Sound.coin(); await Promise.all([wait(500), ...flights]); break;
      }
      case 'bankrupt': toastEv(`${esc(pName(st, e.s))} გაკოტრდა`, 'bad'); bubble(e.s, 'გაკოტრდა', 'bad'); Sound.bad(); await wait(700); break;
    }
  }

  // a region that has just become one player's
  function whole(st, s, got) {
    for (const g of new Set(got.filter(i => BOARD[i].k === 'p').map(i => BOARD[i].g))) {
      if (!GROUP_TILES[g].every(i => st.own[i] && st.own[i].o === s)) continue;
      if (gl) Board3D.celebrate(g, s);
      Sound.turn();
      toastEv(controls(s) && ROOM && ROOM.role !== 'local' ? W.wholeYou(esc(GROUPS[g].n)) : `მთელი ${esc(GROUPS[g].n)}: ${esc(pName(st, s))}`, controls(s) ? 'good' : '');
    }
  }
  // ----- small things that happen around the board -----
  const cashTicks = [];
  function cashStep(s, chip, amount, from, to) {
    if (cashTicks[s]) cancelAnimationFrame(cashTicks[s]);
    const text = [...amount.childNodes].find(n => n.nodeType === 3);
    if (!text) return;
    const generation = gen, started = performance.now(), duration = REDUCED ? 0 : 340 / rate;
    const step = now => {
      if (gen !== generation || !chip.isConnected) { cashTicks[s] = 0; return; }
      const t = duration ? Math.min(1, (now - started) / duration) : 1;
      text.nodeValue = fmt(from + (to - from) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) cashTicks[s] = requestAnimationFrame(step);
      else { cashTicks[s] = 0; amount.setAttribute('aria-label', fmt(to)); }
    };
    step(started);
  }
  function money(s, d) {
    if (!d || !shown || !shown.players[s]) return;
    const before = cash[s] != null ? cash[s] : shown.players[s].cash;
    cash[s] = before + d;
    const chip = $(`#players .pl[data-s="${s}"]`);
    if (chip) {
      const b = chip.querySelector('.pc .amt');
      if (b) { cashStep(s, chip, b, before, cash[s]); playersHTML = ''; }
      chip.classList.remove('cash-in', 'cash-out'); void chip.offsetWidth;
      chip.classList.add(d > 0 ? 'cash-in' : 'cash-out');
      const f = document.createElement('span');
      f.className = 'float cash-delta ' + (d > 0 ? 'up' : 'down');
      f.textContent = (d > 0 ? '+' : '−') + fmt(Math.abs(d));
      f.setAttribute('role', 'status'); f.setAttribute('aria-live', 'polite');
      chip.querySelectorAll('.cash-delta').forEach(old => old.remove());
      chip.appendChild(f);
      setTimeout(() => {
        const current = chip.querySelector('.cash-delta') === f;
        f.remove(); if (current) chip.classList.remove('cash-in', 'cash-out');
      }, REDUCED ? 700 : 1100);
    }
  }
  // a short note by a player's picture at the top of the screen: what just happened to them (everyone sees it)
  const notes = [];
  function bubble(s, html, kind) {
    const chip = $(`#players .pl[data-s="${s}"]`), box = $('#bubbles'), list = $('#players');
    if (!chip || !box || document.visibilityState === 'hidden') return;
    const r = chip.getBoundingClientRect(), b = document.createElement('div'), pl = (target || shown).players[s];
    b.className = 'bub ' + (kind || '');
    // whose note it is, with their face: a note may lie over someone else's chip
    b.innerHTML = (pl ? `<img src="${por(pl.hero)}" alt="">` : '') + `<span>${html}</span>`;
    b.style.setProperty('--c', SEAT_COLORS[s]);
    if (notes[s]) notes[s].remove();                                                    // one note per player: a newer one replaces it
    notes[s] = b;
    box.appendChild(b);
    if (matchMedia('(orientation: landscape) and (min-width: 640px)').matches) {
      // the players are listed at the side: the note goes to the left of the list, level with the chip (in two columns
      // the left one's a little higher, the right one's lower, so that two notes of one row can both be read)
      const L = (list || chip).getBoundingClientRect(), dy = L.width > r.width * 1.5 ? (r.left - L.left > 10 ? 11 : -11) : 0;
      b.classList.add('side'); b.style.right = (innerWidth - L.left + 8) + 'px'; b.style.top = (r.top + r.height / 2 + dy) + 'px';
    } else {                                                                            // hanging from its chip, whole on the screen
      const cx = r.left + r.width / 2, h = b.offsetWidth / 2 + 6, x = Math.max(h, Math.min(innerWidth - h, cx));
      b.style.left = x + 'px'; b.style.top = (r.bottom + 3) + 'px'; b.style.setProperty('--tx', (cx - x).toFixed(1) + 'px');
    }
    setTimeout(() => { b.classList.add('bye'); setTimeout(() => { b.remove(); if (notes[s] === b) notes[s] = null; }, 350); }, 4500);
  }
  function banner(text, s) {
    const b = $('#banner'); if (!b) return;
    b.innerHTML = `<img src="${por(target.players[s].hero)}" alt=""><span>${esc(text)}</span>`;
    b.style.setProperty('--c', SEAT_COLORS[s]);
    b.classList.remove('go'); void b.offsetWidth; b.classList.add('go');
  }
  function toastEv(msg, kind) { UI.toast(msg, 4200, kind); }
  let cardSession = null;
  const cardGlyph = kind => {
    const paths = {
      travel: '<circle cx="12" cy="12" r="8"/><path d="m15 9-2 4-4 2 2-4z"/>',
      reward: '<circle cx="10" cy="10" r="6"/><path d="M15 8a6 6 0 1 1-7 9M10 7v6M8 9h4"/>',
      payment: '<path d="M4 7h16v12H4zM4 7l12-3v3M16 11h4v4h-4z"/>',
      danger: '<path d="M5 4v16M12 4v16M19 4v16M3 7h18M3 17h18"/>',
      fortune: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths[kind] || paths.fortune}</svg>`;
  };
  function hideEventCard() {
    const session = cardSession; cardSession = null;
    if (session && session.visual) session.visual.dispose();
    const box = $('#cardpop');
    if (box) { box.hidden = true; box.onclick = box.onkeydown = null; }
    if (session && session.focus && session.focus.isConnected && document.activeElement && box && box.contains(document.activeElement)) session.focus.focus({ preventScroll: true });
  }
  async function showCard(e) {
    const c = Engine.deckOf(target)[e.d][e.id], box = $('#cardpop');
    if (!box) return;
    hideEventCard();
    const g0 = gen, nautical = sea(), title = e.d === 's' ? W.scroll : W.chest;
    const category = c.k === 'cash' ? c.n > 0 ? 'reward' : 'payment' : ['move', 'back', 'near'].includes(c.k) ? 'travel' : c.k === 'repair' ? 'payment' : c.k === 'jail' ? 'danger' : c.k === 'feather' ? 'reward' : 'fortune';
    const labels = { reward: nautical ? 'ნაპოვნი განძი' : 'ჯილდო', payment: 'ხარჯი', travel: nautical ? 'ახალი კურსი' : 'მოგზაურობა', danger: 'განსაცდელი', fortune: 'ბედის ნიშანი' };
    const art = nautical && e.d === 's' ? 'sc_bottle' : e.d === 's' ? 'ui_page' : 'ui_chest_wood_o';
    const result = nautical && c.k === 'cash' ? `<div class="card-result">${c.n > 0 ? '+' : '−'} ${coin(Math.abs(c.n))}<small>${c.n > 0 ? 'შენი ნადავლი' : 'გადასახდელი'}</small></div>` : nautical && c.k === 'move' && BOARD[c.to] ? `<div class="card-destination">${cardGlyph('travel')}<span>კურსი: <b>${esc(tName(c.to))}</b></span></div>` : '';
    box.innerHTML = `<article class="card ${e.d} ${nautical ? `nautical ${e.d === 's' ? 'bottle-message' : 'treasure-discovery'}` : 'royal'} effect-${category}" role="dialog" aria-labelledby="drawnCardTitle" aria-describedby="drawnCardText" style="--owner:${SEAT_COLORS[e.s]}">
      <button class="card-close" type="button" aria-label="ბარათის დახურვა">×</button>
      ${nautical ? `<div class="card-voyage"><span>${e.d === 's' ? 'ზღვიდან ამოსული წერილი' : 'განძის აღმოჩენა'}</span><small>№ ${String(e.id + 1).padStart(2, '0')}</small></div>` : ''}
      <div class="card3d card-model" aria-hidden="true"><img class="card3d-fallback" src="${ART(art)}" alt=""></div>
      <div class="card-insignia">${cardGlyph(category)}<span>${esc(labels[category])}</span></div>
      <div class="card-letter">${nautical ? `<span class="letter-compass">${CHART_COMPASS}</span>` : ''}<h3 id="drawnCardTitle">${esc(title)}</h3><p id="drawnCardText">${esc(c.t)}</p>${result}</div>
      <div class="card-reader">${nautical ? `<span class="reader-flag">${PIRATE_FLAG}</span>` : ''}<img src="${por(target.players[e.s].hero)}" alt=""><small>${esc(pName(target, e.s))}</small><span class="card-seal" aria-hidden="true">✦</span></div>
      <span class="card-dismiss">${nautical && !REDUCED ? e.d === 's' ? 'წერილი იხსნება…' : 'სკივრი იხსნება…' : 'შეეხე გასაგრძელებლად'}</span></article>`;
    box.hidden = false;
    box.classList.remove('go'); void box.offsetWidth; box.classList.add('go');
    const session = cardSession = { closed: false, focus: document.activeElement, visual: null, readyAt: Date.now() + (nautical && !REDUCED ? 3200 : 0) };
    if (typeof Card3D !== 'undefined') session.visual = Card3D.mount($('.card-model', box), nautical && e.d === 's' ? 'bottle' : e.d === 'c' ? 'chest' : 'scroll');
    Sound.card();
    box.onclick = ev => { if (Date.now() >= session.readyAt || ev.target.closest('.card-close')) session.closed = true; };
    box.onkeydown = ev => { if (ev.key === 'Escape') { ev.preventDefault(); session.closed = true; } };
    $('.card-close', box).focus({ preventScroll: true });
    const until = Date.now() + (nautical ? Math.max(6500, 7000 / rate) : Math.max(3200, 4500 / rate));
    try {
      while (!session.closed && gen === g0 && cardSession === session && document.visibilityState !== 'hidden' && Date.now() < until) {
        if (nautical && !session.ready && Date.now() >= session.readyAt) { session.ready = true; const prompt = $('.card-dismiss', box); if (prompt) prompt.textContent = 'შეეხე გასაგრძელებლად'; }
        await sleep(80);
      }
    } finally { if (cardSession === session) hideEventCard(); }
  }
  function fit() { board(); if (gl) Board3D.resize(); }

  // ----- everything, from the shown state -----
  function render() {
    if (!shown || shown.phase === 'lobby') return;
    if (!built) { reset(shown); return; }
    const st = shown;
    if (gl) Board3D.sync(st, pos);
    renderPlayers();
    renderPanel();
    renderBuy();
    viewBtn();
    renderPins();
    $('#bTrade').disabled = !Engine.legal(st, mySeat()).trade;
    Sheet.refresh();
    if (st.trade && acting() === st.trade.to && controls(st.trade.to) && Sheet.kind() !== 'offer') Sheet.open('offer');
    if (st.phase === 'over' && Sheet.kind() !== 'over') Sheet.open('over');
    autoEnd();
  }
  // nothing left to decide after the move: the turn passes by itself
  function autoEnd() {
    clearTimeout(autoT);
    const st = shown, me = acting();
    if (!st || playing || me < 0 || me !== st.turn || !controls(me) || Sheet.kind() || st.trade) return;
    const L = Engine.legal(st, me);
    if (!L.end || canBuild(st, me)) return;
    const seq = st.seq;
    autoT = setTimeout(() => { if (shown && shown.seq === seq && !playing && !Sheet.kind()) move({ t: 'end' }); }, 1300);
  }
  // ----- where this device's player can put up a tower now: a sign over each such square, with the price (a tap builds
  // there). They go while the screen plays what happened, and while a move is on its way. -----
  let pinsKey = '';
  function renderPins() {
    const box = $('#pins');
    if (!box) return;
    const st = shown, me = acting();
    const can = gl && Board3D.ok && st && st.phase !== 'lobby' && !playing && !busy && me >= 0 && me === st.turn && controls(me) && Engine.legal(st, me).build;
    const list = can ? BOARD.map((t, i) => i).filter(i => BOARD[i].k === 'p' && !Engine.buildBlock(st, me, i)) : [];
    const key = list.map(i => i + ':' + st.own[i].lv).join(',') + '|' + THEME.key;
    if (key !== pinsKey) {
      pinsKey = key;
      box.innerHTML = list.map(i => {
        const lv = st.own[i].lv + 1, price = GROUPS[BOARD[i].g].b;
        const icon = lv >= 5 ? (sea() ? PIRATE_INN_SVG : `<img src="${ART('s_fort')}" alt="">`) : towerIcon();
        return `<div class="pin" data-pin="${i}" data-lv="${lv}" hidden><button class="pin-b${lv >= 5 ? ' fort' : ''}" data-build="${i}" aria-label="${esc(`${LEVEL_NAMES[lv]}: ${tName(i)} · ${price}`)}"><span class="pin-f"><span class="pin-m">${icon}<b aria-hidden="true">+</b></span><span class="pin-p">${coin(price)}</span></span></button></div>`;
      }).join('');
    }
    if (gl && Board3D.ok) Board3D.pins($$('.pin', box).map(el => ({ i: +el.dataset.pin, lv: +el.dataset.lv, el })));
  }
  let playersHTML = '';
  function renderPlayers() {
    const st = shown, box = $('#players');
    if (!box) return;
    const html = st.players.map((p, s) => {
      const me = controls(s) && ROOM && ROOM.role !== 'local';
      const tag = me ? '<span class="tag me">შენ</span>' : p.away && !p.bot ? '<span class="tag warn">არ არის</span>' : p.bot ? '<span class="tag">ბოტი</span>' : '';
      const icons = (p.jail ? (sea() ? `<i class="ic" title="${esc(W.inJail)}">${ISLE_SVG}</i>` : `<img src="${ART('t_palisade')}" alt="${esc(W.inJail)}" title="${esc(W.inJail)}">`) : '')
        + p.fe.map(() => sea() ? `<i class="ic" title="${esc(W.featherFull)}">${BOAT_SVG}</i>` : `<img src="${ART('ui_feather')}" alt="${esc(W.feather)}" title="${esc(W.featherFull)}">`).join('');
      return `<button class="pl${st.turn === s && st.phase !== 'over' ? ' now' : ''}${p.out ? ' out' : ''}" data-s="${s}" style="--c:${SEAT_COLORS[s]}">
        <img class="pp" src="${por(p.hero)}" alt=""><span class="pn">${esc(p.name)}</span><span class="pc">${p.out ? '<b class="amt">გაკოტრდა</b>' : coin(cash[s] != null ? cash[s] : p.cash)}${icons ? `<span class="pi">${icons}</span>` : ''}</span>${tag ? `<span class="pf">${tag}</span>` : ''}</button>`;
    }).join('');
    // drawn again only when something in it changed (the faces are not made anew with every step of a move)
    if (html !== playersHTML || !box.firstChild) { box.innerHTML = html; playersHTML = html; Voice.chips(); }
    box.onclick = ev => { const b = ev.target.closest('.pl'); if (b) Sheet.open('player', +b.dataset.s); };
    const r = $('#round');
    if (r) r.textContent = st.cfg.mode === 'rounds' ? `რაუნდი ${st.round} / ${st.cfg.rounds}` : `რაუნდი ${st.round}`;
  }
  function renderPanel() {
    const st = shown, c = $('#panel');
    if (!c) return;
    const me = acting(), L = me >= 0 ? Engine.legal(st, me) : {}, cur = st.players[st.turn], p = st.players[me];
    const many = ROOM && ROOM.role === 'local' && st.players.filter(x => !x.bot).length > 1;
    let status = '', acts = '', extra = '';
    if (st.phase === 'over') status = 'თამაში დასრულდა';
    else if (me === st.turn && controls(st.turn)) status = many ? `${esc(cur.name)}, შენი სვლაა` : 'შენი სვლაა';
    else status = `სვლა: <b>${esc(cur.name)}</b>${cur.bot ? ' <small>ბოტი</small>' : cur.away ? ' <small>არ არის, მის მაგივრად ბოტი თამაშობს</small>' : ''}`;
    const build = canBuild(st, me) ? `<button class="btn" data-sheet="build"><span class="tw-i">${towerIcon()}</span>ააშენე</button>` : '';
    if (L.roll) {
      if (p.jail) {
        extra = `<p class="hint">${W.jailHint(3 - p.jt)}</p>`;
        acts = `<div class="row"><button class="btn gold" data-a="roll">${DICE_SVG}გააგორე</button>${L.jailpay ? `<button class="btn${L.feather ? ' small' : ''}" data-a="jailpay">გადაიხადე ${JAIL_FINE}</button>` : ''}${L.feather ? `<button class="btn small" data-a="feather">${esc(W.featherUse)}</button>` : ''}</div>`;
      } else {
        acts = `<button class="btn gold roll" data-a="roll">${DICE_SVG}გააგორე</button>${build ? `<div class="row">${build}</div>` : ''}`;
        if (p.dbl > 0) extra = `<p class="hint">დუბლი! კიდევ ერთხელ აგორებ.</p>`;
      }
    } else if (L.skip) {
      status = 'იყიდი?';
    } else if (L.end) {
      if (build) {
        acts = `<div class="row">${build.replace('class="btn"', 'class="btn gold"')}<button class="btn" data-a="end">სვლის დასრულება</button></div>`;
        extra = `<p class="hint">${W.canBuild}</p>`;
      } else {
        acts = `<button class="btn ghost" data-a="end">სვლის დასრულება</button>`;
        extra = `<p class="hint">სვლა გადადის…</p>`;
      }
    } else if (L.cover) {
      const d = st.pend, can = p.cash + Engine.raiseMax(st, me) >= d.a;
      status = 'ვალი გაქვს';
      extra = `<p class="debt">გადასახდელია ${coin(d.a)}${d.to >= 0 ? ` · ${esc(pName(st, d.to))}` : ''} <small>· გაქვს ${coin(p.cash)}</small></p>
        <p class="hint">${can ? W.debtHint : 'მთელი ქონებითაც ვერ ფარავ ვალს.'}</p>`;
      acts = `<div class="row">${can ? `<button class="btn gold" data-a="${L.pay ? 'pay' : 'cover'}">${L.pay ? 'გადაიხადე' : 'ვალის დაფარვა'}</button><button class="btn" data-sheet="estate">მე ავირჩევ</button>` : '<button class="btn danger" data-sheet="bankrupt">გაკოტრება</button>'}</div>`;
    } else if (L.cancel) {
      extra = `<p class="hint">ელოდები პასუხს: ${esc(pName(st, st.trade.to))}</p>`;
      acts = `<button class="btn" data-a="cancel">შეთავაზების გაუქმება</button>`;
    } else if (L.accept) {
      acts = `<button class="btn gold" data-sheet="offer">შეთავაზების ნახვა</button>`;
    } else if (st.trade && st.phase !== 'over') {
      extra = `<p class="hint">${esc(pName(st, st.trade.from))} ვაჭრობას სთავაზობს: ${esc(pName(st, st.trade.to))}</p>`;
    } else if (st.phase === 'auction' && st.auc) {
      status = `აუქციონი: <b>${esc(tName(st.auc.i))}</b>`;
      extra = `<p class="hint">ფასს ყველა ასახელებს. ბოლო ფასის შემდეგ რამდენიმე წამში იყიდება.</p>`;
    } else if (st.phase === 'quiz' && st.quiz) {
      status = `${esc(W.chest)}: <b>${esc(pName(st, st.quiz.s))}</b>`;
      extra = `<p class="hint">კითხვას ყველა პასუხობს. სწორ პასუხზე ${esc(pName(st, st.quiz.s))} იღებს ${QUIZ_WIN}-ს, სხვები ${QUIZ_SHARE}-ს.</p>`;
    } else if (st.phase === 'buy') {
      extra = `<p class="hint">ფიქრობს, იყიდოს თუ არა: ${esc(tName(st.pend.i))}</p>`;
    } else if (st.phase === 'over') {
      acts = `<button class="btn gold" data-sheet="over">შედეგები</button>`;
    }
    const lines = [];
    for (let k = st.ev.length - 1; k >= 0 && lines.length < 3; k--) { const t = evText(st, st.ev[k]); if (t) lines.push(t); }
    c.innerHTML = `<div class="status">${status}</div>${extra}<div class="acts">${acts}</div>${lines.length ? `<ul class="last">${lines.map(l => `<li>${l}</li>`).join('')}</ul>` : ''}`;
    // the panel does not grow (the board would shrink): the oldest lines of the log give way when there is more to say
    const ul = c.querySelector('.last');
    while (ul && ul.children.length && c.scrollHeight > c.clientHeight + 1) ul.lastElementChild.remove();
    if (ul && !ul.children.length) ul.remove();
    if (busy) $$('[data-a]', c).forEach(b => { b.disabled = true; });
  }
  // what a square is, in the card's head: its region's colour and picture
  function cardHead(t, extra) {
    const col = t.k === 'p' ? GROUPS[t.g].c : '#7b5532';
    const head = `<span class="chip" style="--g:${col}">${esc(t.k === 'p' ? GROUPS[t.g].n : t.k === 'road' ? W.road : W.util)}</span>${extra || ''}`;
    return `<div class="bc-h" style="--g:${col};${sceneBg(t, 'linear-gradient(180deg,rgba(13,16,22,0),rgba(13,16,22,.8))')}">${head}<h3>${esc(t.n.replace(/­/g, ''))}</h3></div>`;
  }
  // someone else is deciding whether to buy: everyone sees who, which town and its price
  function renderWatch() {
    const st = shown, box = $('#watch');
    if (!box) return;
    if (!st || st.phase !== 'buy' || !st.pend || controls(st.turn) || playing) { box.hidden = true; box.dataset.k = ''; return; }
    const t = BOARD[st.pend.i], p = st.players[st.turn], col = t.k === 'p' ? GROUPS[t.g].c : '#7b5532', k = st.tn + ':' + st.pend.i;
    if (box.dataset.k === k && !box.hidden) return;
    box.dataset.k = k;
    box.innerHTML = `<div class="wc" style="--c:${SEAT_COLORS[st.turn]};--g:${col}"><img src="${por(p.hero)}" alt=""><div class="wc-w"><b>${esc(p.name)}</b><span>ყიდვაზე ფიქრობს<i class="dots"><i></i><i></i><i></i></i></span></div>
      <div class="wc-t"><small>${esc(t.k === 'p' ? GROUPS[t.g].n : t.k === 'road' ? W.road : W.util)}</small><b>${esc(tName(st.pend.i))}</b>${coin(t.p)}</div></div>`;
    box.hidden = false; box.classList.remove('go'); void box.offsetWidth; box.classList.add('go');
  }
  // the auction, the same card on every screen: the town, the highest bid and who made it, the clock until the
  // hammer falls, who is still in; and the buttons for whoever bids from this device
  const AUC_SHOW = { first: 8.5, after: 6.5 };          // seconds the clock shows (the host's hammer falls a little later)
  let aucKey = '', aucAt = 0;
  function renderAuction() {
    const st = shown, box = $('#buycard'), A = st && st.auc;
    if (!box || !A || st.phase !== 'auction') return false;
    const t = BOARD[A.i], key = st.tn + ':' + A.i + ':' + A.n;
    if (key !== aucKey) { aucKey = key; aucAt = performance.now(); }
    const dur = A.n ? AUC_SHOW.after : AUC_SHOW.first, gone = Math.min(dur, (performance.now() - aucAt) / 1000);
    const lead = A.by >= 0 ? st.players[A.by] : null;
    const top = lead ? `<div class="au-bid"><img src="${por(lead.hero)}" alt="" style="--c:${SEAT_COLORS[A.by]}"><span><small>${esc(lead.name)}</small>${coin(A.hi)}</span></div>`
      : `<div class="au-bid none"><span><small>ჯერ არავის დაუსახელებია ფასი</small><b>დაიწყე ${coin(Engine.BID_STEP)}-დან</b></span></div>`;
    const who = Engine.activeSeats(st).map(s => sea()
      ? `<span class="auction-captain${s === A.by ? ' lead' : A.out.includes(s) ? ' out' : ''}" style="--owner:${SEAT_COLORS[s]}"><img src="${por(st.players[s].hero)}" alt=""><span>${esc(st.players[s].name)}<small>${s === A.by ? 'მაღალი ფასი' : A.out.includes(s) ? 'გავიდა' : 'მონაწილე'}</small></span></span>`
      : `<img src="${por(st.players[s].hero)}" alt="${esc(st.players[s].name)}" title="${esc(st.players[s].name)}" class="${s === A.by ? 'lead' : A.out.includes(s) ? 'out' : ''}" style="--c:${SEAT_COLORS[s]}">`).join('');
    // this device's bidders: one person online, everyone at this screen in a game of several on one phone
    const mine = Engine.activeSeats(st).filter(s => controls(s));
    const many = mine.length > 1;
    const rows = mine.map(s => {
      const p = st.players[s], L = Engine.legal(st, s);
      if (L.lead) return `<p class="hint good">${many ? esc(p.name) + ': ' : ''}შენი ფასია ყველაზე მაღალი</p>`;
      if (!L.pass) return `<p class="hint">${many ? esc(p.name) + ': ' : ''}აუქციონიდან გამოხვედი</p>`;
      const btn = inc => `<button class="btn gold" data-a="bid" data-inc="${inc}" data-seat="${s}" ${A.hi + inc <= p.cash ? '' : 'disabled'}>+${inc}</button>`;
      return `<div class="row au-acts">${many ? `<img class="au-me" src="${por(p.hero)}" alt="${esc(p.name)}" style="--c:${SEAT_COLORS[s]}">` : ''}${btn(10)}${btn(50)}${btn(100)}<button class="btn" data-a="pass" data-seat="${s}">გავდივარ</button></div>`;
    }).join('');
    box.innerHTML = sea() ? `<article class="bc auc sea-charter" style="--owner:${A.by >= 0 ? SEAT_COLORS[A.by] : '#a9874c'}">${seaCharterHead(t, 'მეკობრეთა აუქციონი')}
      <div class="charter-content"><div class="auction-hammer"><span>${CHART_COMPASS}</span><div><small>უმაღლესი შეთავაზება</small>${coin(A.hi)}<b>${lead ? esc(lead.name) : 'პირველი ფასი ჯერ არ არის'}</b></div><small class="auction-market">საწყისი ფასი${coin(t.p)}</small></div>
      <div class="au-clock" aria-label="აუქციონის დარჩენილი დრო"><i style="animation-duration:${dur}s;animation-delay:-${gone.toFixed(2)}s"></i></div>
      <div class="auction-crews">${who}</div><div class="charter-actions">${rows || '<p class="hint">უყურებ, რომელი კაპიტანი აღმართავს თავის დროშას</p>'}</div></div></article>` : `<div class="bc auc">${cardHead(t, '<span class="chip au-tag">აუქციონი</span>')}
      <div class="bc-b"><div class="au-top">${top}<small class="au-price">ფასი ${coin(t.p)}</small></div>
      <div class="au-clock"><i style="animation-duration:${dur}s;animation-delay:-${gone.toFixed(2)}s"></i></div>
      <div class="au-who">${who}</div>${rows || '<p class="hint">უყურებ, ვინ იყიდის</p>'}</div></div>`;
    if (box.hidden || box.dataset.k !== 'auc') { box.hidden = false; box.dataset.k = 'auc'; box.classList.remove('go'); void box.offsetWidth; box.classList.add('go'); }
    if (busy) $$('[data-a]', box).forEach(b => { b.disabled = true; });
    return true;
  }
  // the town one may buy, as a card over the board
  function renderBuy() {
    const st = shown, box = $('#buycard');
    if (!box) return;
    renderWatch();
    if (st && st.phase === 'auction' && !playing) { renderAuction(); return; }
    if (st && st.phase === 'quiz' && !playing) { renderQuiz(); return; }
    if (st && (st.phase === 'auction' || st.phase === 'quiz')) return;
    const me = acting();
    if (!st || st.phase !== 'buy' || me !== st.turn || !controls(me) || playing) { hideCard(); return; }   // (the watching card stays as renderWatch left it)
    const t = BOARD[st.pend.i], p = st.players[me], L = Engine.legal(st, me);
    let rows = '', hint = '';
    if (t.k === 'p') {
      const mine = GROUP_TILES[t.g].filter(i => st.own[i] && st.own[i].o === me).length, all = GROUP_TILES[t.g].length;
      rows = `<li><span>ქირა</span>${coin(t.rent[0])}</li><li><span>მთელი ${esc(GROUPS[t.g].n)}</span>${coin(t.rent[1])}</li><li><span>${esc(W.towersWith)}</span><b class="amt">${coin(t.rent[2])} – ${fmt(t.rent[6])}</b></li>`;
      hint = mine + 1 === all ? W.buyLast(esc(GROUPS[t.g].n)) : W.buyMore(esc(GROUPS[t.g].n), all);
    } else if (t.k === 'road') {
      rows = [1, 2, 3, 4].map(k => `<li><span>${k} ${esc(W.road)}</span>${coin(ROAD_RENT[k])}</li>`).join('');
      hint = W.roadHint;
    } else {
      rows = `<li><span>ერთი გაქვს</span><b>კამათელი ×4</b></li><li><span>ორივე გაქვს</span><b>კამათელი ×10</b></li>`;
      hint = 'ქირა კამათლის ჯამზეა დამოკიდებული.';
    }
    const story = THEME.stories[t.i];       // the archipelago's true story of the place
    box.innerHTML = sea() ? `<article class="bc sea-charter" style="--owner:${SEAT_COLORS[me]}">${seaCharterHead(t, t.k === 'p' ? 'კუნძულის სიგელი' : t.k === 'road' ? 'ხომალდის სიგელი' : 'სანაპიროს სიგელი')}
      <div class="charter-content"><div class="charter-price"><span><small>შესაძენი ფასი</small>${coin(t.p)}</span><b>ქირა ${t.k === 'p' ? coin(t.rent[0]) : t.k === 'road' ? coin(ROAD_RENT[1]) : 'კამათელი ×4'}<small>${t.k === 'p' ? 'ქოხების აშენებამდე' : t.k === 'road' ? 'ერთი ხომალდით' : 'ერთი სადგურით'}</small></b></div>
      ${seaOwnership(st, t.i)}${seaDevelopment(st, t.i)}<div class="charter-rent"><h4>რას მოგიტანს</h4><ul class="bc-rent">${rows}</ul></div>
      <p class="hint charter-collection">${hint}</p>${seaCaptain(st, me)}
      <div class="row charter-actions"><button class="btn gold big" data-a="buy" ${L.buy ? '' : 'disabled'}>შეიძინე ${coin(t.p)}</button><button class="btn" data-a="skip">აუქციონზე</button></div>
      ${L.buy ? '' : `<p class="hint bad">ფული არ გყოფნის. აუქციონზე სხვა ფასის დასახელება შეგიძლია.</p>`}
      ${story ? `<details class="charter-story"><summary>ამ ადგილის ნამდვილი ამბავი</summary><p>${esc(story)}</p></details>` : ''}</div></article>` : `<div class="bc">${cardHead(t)}
      <div class="bc-b">${story ? `<p class="story">${esc(story)}</p>` : ''}<ul class="bc-rent">${rows}</ul><p class="hint">${hint}</p>
      <div class="row"><button class="btn gold big" data-a="buy" ${L.buy ? '' : 'disabled'}>იყიდე ${coin(t.p)}</button><button class="btn" data-a="skip">აუქციონზე</button></div>
      ${L.buy ? '' : `<p class="hint bad">ფული არ გყოფნის: გაქვს ${coin(p.cash)}. აუქციონზე იაფადაც შეიძლება წავიდეს.</p>`}</div></div>`;
    if (box.hidden || box.dataset.k !== 'buy') { box.hidden = false; box.dataset.k = 'buy'; box.classList.remove('go'); void box.offsetWidth; box.classList.add('go'); }
    if (busy) $$('[data-a]', box).forEach(b => { b.disabled = true; });
  }
  // ----- the treasure chest's question: the same card on every screen, its clock, who has answered; the answers for
  // whoever answers from this device (on a phone shared by several people, one after another) -----
  let quizKey = '', quizAt = 0, quizVisual = null, quizVisualKey = '';
  const LETTERS = ['ა', 'ბ', 'გ'];
  const quizItem = (st, q) => { const Q = themeOf(st).quiz; return Q && Q[q]; };
  function quizHead(st, s) {
    return `<div class="qz-h${sea() ? ' treasure-head' : ''}" style="background-image:linear-gradient(90deg,rgba(44,27,16,.96) 30%,rgba(44,27,16,.55) 62%,rgba(44,27,16,.15)),url(${ART('sc_chest')})">${sea() ? `<div class="card3d quiz-model" aria-hidden="true"><img class="card3d-fallback" src="${ART('ui_chest_wood_o')}" alt=""></div>` : `<img src="${ART('ui_chest_wood_o')}" alt="">`}<div class="quiz-heading"><b>${esc(W.chest)}</b><small>გახსნა ${esc(pName(st, s))} · სწორ პასუხზე მას ${coin(QUIZ_WIN)}, სხვებს ${coin(QUIZ_SHARE)}</small></div></div>`;
  }
  function keepQuizModel(box, key) {
    const old = box.querySelector('.quiz-model');
    if (old && quizVisual && quizVisualKey === key) { old.remove(); return old; }
    if (quizVisual) quizVisual.dispose();
    quizVisual = null; quizVisualKey = key;
    return null;
  }
  function showQuizModel(box, old) {
    const slot = box.querySelector('.quiz-model');
    if (!slot) return;
    if (old) slot.replaceWith(old);
    else if (typeof Card3D !== 'undefined') quizVisual = Card3D.mount(slot, 'chest');
  }
  function renderQuiz() {
    const st = shown, box = $('#buycard'), Q = st && st.quiz, item = Q && quizItem(st, Q.q);
    if (!box || !item || st.phase !== 'quiz') return false;
    const key = st.tn + ':' + st.rolls + ':' + Q.q;
    if (key !== quizKey) { quizKey = key; quizAt = performance.now(); }
    const dur = quizTime(st) / 1000, gone = Math.min(dur, (performance.now() - quizAt) / 1000);
    const seats = Engine.activeSeats(st), here = seats.filter(s => controls(s));
    const left = here.filter(s => Q.ans[s] == null), now = left.includes(Q.s) ? Q.s : left.length ? left[0] : -1;
    const mine = here.find(s => Q.ans[s] != null);                  // this device's answer, already in
    const answers = item.a.map((a, k) => now >= 0
      ? `<button class="qz-b" data-a="answer" data-c="${k}" data-seat="${now}"><i>${LETTERS[k]}</i><span>${esc(a)}</span></button>`
      : `<div class="qz-b${here.length === 1 && mine != null && Q.ans[mine] === k ? ' picked' : ''}"><i>${LETTERS[k]}</i><span>${esc(a)}</span></div>`).join('');
    const who = seats.map(s => `<span class="qz-p${Q.ans[s] != null ? ' in' : ''}" style="--c:${SEAT_COLORS[s]}" title="${esc(st.players[s].name)}"><img src="${por(st.players[s].hero)}" alt="${esc(st.players[s].name)}"></span>`).join('');
    const lead = now >= 0 && here.length > 1 ? `<p class="qz-now"><img src="${por(st.players[now].hero)}" alt="" style="--c:${SEAT_COLORS[now]}">${esc(st.players[now].name)}, შენი პასუხი</p>` : '';
    const foot = now >= 0 ? '' : mine != null ? '<p class="hint">პასუხი მიღებულია. ველოდებით სხვებს…</p>' : '<p class="hint">უყურებ: პასუხობენ</p>';
    const model = keepQuizModel(box, key);
    box.innerHTML = `<div class="bc qz${sea() ? ' treasure-quiz' : ''}">${quizHead(st, Q.s)}
      <div class="bc-b"><p class="qz-q">${esc(item.q)}</p>
      <div class="au-clock"><i style="animation-duration:${dur}s;animation-delay:-${gone.toFixed(2)}s"></i></div>
      ${lead}<div class="qz-as">${answers}</div><div class="au-who">${who}</div>${foot}</div></div>`;
    showQuizModel(box, model);
    if (box.hidden || box.dataset.k !== 'quiz') { box.hidden = false; box.dataset.k = 'quiz'; box.classList.remove('go'); void box.offsetWidth; box.classList.add('go'); }
    if (busy) $$('[data-a]', box).forEach(b => { b.disabled = true; });
    return true;
  }
  // the answer: the right one lights up, each player's face by what they chose, and who got what; then why
  async function quizReveal(e) {
    const st = target, item = quizItem(st, e.q), box = $('#buycard');
    if (!item || !box) return;
    const ans = e.ans || {}, seats = Engine.activeSeats(st);
    const faces = k => seats.filter(s => ans[s] === k).map(s => `<img src="${por(st.players[s].hero)}" alt="${esc(st.players[s].name)}" style="--c:${SEAT_COLORS[s]}">`).join('');
    const rows = item.a.map((a, k) => `<div class="qz-b${k === e.c ? ' right' : seats.some(s => ans[s] === k) ? ' wrong' : ''}"><i>${LETTERS[k]}</i><span>${esc(a)}</span><em>${faces(k)}</em></div>`).join('');
    const won = seats.filter(s => ans[s] === e.c);
    const gains = won.length ? won.map(s => `<span class="qz-g" style="--c:${SEAT_COLORS[s]}"><img src="${por(st.players[s].hero)}" alt="">${esc(st.players[s].name)} <b>+${s === e.s ? QUIZ_WIN : QUIZ_SHARE}</b></span>`).join('')
      : '<p class="hint">ამჯერად ვერავინ გამოიცნო</p>';
    const model = keepQuizModel(box, st.tn + ':' + st.rolls + ':' + e.q);
    box.innerHTML = `<div class="bc qz reveal${sea() ? ' treasure-quiz' : ''}">${quizHead(st, e.s)}<div class="bc-b"><p class="qz-q">${esc(item.q)}</p><div class="qz-as">${rows}</div>
      <p class="qz-x">${esc(item.x)}</p><div class="qz-gs">${gains}</div></div></div>`;
    showQuizModel(box, model);
    box.hidden = false; box.dataset.k = 'reveal'; box.classList.remove('go'); void box.offsetWidth; box.classList.add('go');
    if (won.some(s => controls(s))) Sound.coin(); else Sound.card();
    const g0 = gen;
    let closed = false;
    box.onclick = () => { closed = true; };
    const until = Date.now() + Math.max(4500, 6500 / rate);
    while (!closed && gen === g0 && Date.now() < until && document.visibilityState !== 'hidden') await sleep(80);
    if (gen !== g0) return;
    box.onclick = null;
    hideCard();
  }
  function hideCard() { if (quizVisual) quizVisual.dispose(); quizVisual = null; quizVisualKey = ''; const b = $('#buycard'); if (b) { b.hidden = true; b.dataset.k = ''; b.onclick = null; } }
  function hideBuy() { hideCard(); const w = $('#watch'); if (w) { w.hidden = true; w.dataset.k = ''; } }
  // the button over the board: the whole board, or back to the figure
  function viewBtn() {
    const b = $('#bView');
    if (!b) return;
    b.hidden = !gl;
    const m = gl ? Board3D.mode : 'follow';
    if (b.dataset.m === m) return;
    b.dataset.m = m;
    b.innerHTML = m === 'follow' ? VIEW_SVG.all : VIEW_SVG.me;
    b.title = m === 'follow' ? 'მთელი დაფა' : 'ფიგურასთან';
    b.setAttribute('aria-label', b.title);
  }

  // the page went to the background: what is left to show is skipped (the game goes on without waiting for this screen)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden' || !playing) return;
    q = [];
    if (gl && Board3D.ok) Board3D.halt();
    finishPlay();
  });

  return {
    show, reset, clear, pending, idleFor, render, fit, acting, mySeat, controls,
    get st() { return shown; },
    get playing() { return current ? current.k : playing ? 'queue' : ''; },
    busy(b) { busy = b; if (b) { $$('#panel [data-a], #buycard [data-a], #sheet [data-a]').forEach(x => { x.disabled = true; }); renderPins(); } },
    peers() { if (shown && shown.phase === 'lobby') Lobby.render(shown); else if (shown) renderPlayers(); },
    idle() { if (shown && !playing) autoEnd(); },
    view() { if (!gl) return; Board3D.setMode(Board3D.mode === 'follow' ? 'overview' : 'follow'); viewBtn(); }
  };
})();

// one line of the log for an event ('' for events the log leaves out)
function evText(st, e) {
  const n = s => esc(pName(st, s)), t = i => esc(tName(i));
  switch (e.k) {
    case 'start': return 'თამაში დაიწყო';
    case 'roll': return `${n(e.s)}: ${e.d[0]} და ${e.d[1]}${e.d[0] === e.d[1] ? ' · დუბლი' : ''}`;
    case 'buy': return `${n(e.s)}: იყიდა ${t(e.i)} · ${fmt(e.a)}`;
    case 'skip': return `${n(e.s)}: აუქციონზე გაიტანა ${t(e.i)}`;
    case 'auction': return `აუქციონი: ${t(e.i)}`;
    case 'bid': return `${n(e.s)}: ფასი ${fmt(e.a)} · ${t(e.i)}`;
    case 'pass': return '';
    case 'won': return `${n(e.s)}: იყიდა აუქციონზე ${t(e.i)} · ${fmt(e.a)}`;
    case 'unsold': return `${t(e.i)}: აუქციონზე არავინ იყიდა`;
    case 'pay':
      if (e.why === 'rent') return `${n(e.s)} → ${n(e.to)}: ქირა ${fmt(e.a)} · ${t(e.i)}`;
      if (e.why === 'tax') return `${n(e.s)}: ${t(e.i)} · ${fmt(e.a)}`;
      if (e.why === 'fine') return `${n(e.s)}: ${esc(W.fineLog)} · ${fmt(e.a)}`;
      if (e.why === 'repair') return `${n(e.s)}: შეკეთება · ${fmt(e.a)}`;
      return `${n(e.s)}: გადაიხადა ${fmt(e.a)}`;
    case 'salary': return `${n(e.s)}: ${esc(W.start)} · +${fmt(e.a)}`;
    case 'gain': return `${n(e.s)}: ${e.why === 'quiz' ? 'სწორი პასუხი · ' : ''}+${fmt(e.a)}`;
    case 'card': return `${n(e.s)}: ${esc(Engine.deckOf(st)[e.d][e.id].t)}`;
    case 'quiz': { const q = (themeOf(st).quiz || [])[e.q]; return `${n(e.s)}: ${esc(W.chest)}${q ? ' · ' + esc(q.q) : ''}`; }
    case 'quizEnd': { const q = (themeOf(st).quiz || [])[e.q]; return q ? `პასუხი: ${esc(q.a[e.c])}` : ''; }
    case 'answer': return '';
    case 'jail': return `${n(e.s)}: ${esc(W.toJail)}${e.why === 'dbl' ? ' (სამი დუბლი)' : ''}`;
    case 'free': return `${n(e.s)}: ${esc(W.freed)}`;
    case 'stay': return `${n(e.s)}: ${esc(W.stays)}`;
    case 'build': return `${n(e.s)}: ${t(e.i)} · ${LEVEL_NAMES[e.lv]}`;
    case 'sell': return `${n(e.s)}: ${esc(W.soldTower)} · ${t(e.i)}`;
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
    const was = kind;
    kind = ''; arg = null;
    const b = box(); if (!b) return;
    b.classList.remove('on'); b.hidden = true;
    if (was) View.idle();
  }
  function refresh() { if (kind) draw(); }
  function draw() {
    const st = View.st;
    if (!st && kind !== 'rules' && kind !== 'install' && kind !== 'diag') return close();
    const fn = { deed, player, estate, build, trade, offer, log, menu, over, bankrupt: bankruptSheet, rules, install, diag }[kind];
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
      head = `<div class="deed-h" style="--g:${g.c};${sceneBg(t, 'linear-gradient(180deg,rgba(13,16,22,.1),rgba(13,16,22,.85))')}"><span class="chip" style="--g:${g.c}">${esc(g.n)}</span><h2>${esc(t.n)}</h2></div>`;
      const line = (label, v, on, icon) => `<li class="${on ? 'on' : ''}">${icon || '<span class="ph"></span>'}<span>${label}</span>${coin(v)}</li>`;
      rows = `<ul class="rents">${line('ცალკე', t.rent[0], o && !lv && !full)}${line('მთელი ' + esc(g.n), t.rent[1], o && !lv && full)}${[1, 2, 3, 4, 5].map(k => line(LEVEL_NAMES[k], t.rent[k + 1], lv === k, lvIcons(k))).join('')}</ul>
        <p class="facts"><span>ფასი ${coin(t.p)}</span><span>${esc(W.tower)} ${coin(g.b)}</span><span>დაგირავება ${coin(t.p / 2)}</span></p>`;
    } else if (t.k === 'road') {
      head = `<div class="deed-h road" style="${sceneBg(t, 'linear-gradient(180deg,rgba(13,16,22,.1),rgba(13,16,22,.85))')}"><span class="chip">${esc(W.road)}</span><h2>${esc(t.n)}</h2></div>`;
      const n = o ? Engine.countOf(st, o.o, ROADS) : 0, icon = sea() ? `<span class="ph ship-i">${SHIP_SVG}</span>` : `<img src="${ART('s_camp')}" alt="">`;
      rows = `<ul class="rents">${[1, 2, 3, 4].map(k => `<li class="${n === k ? 'on' : ''}">${icon}<span>${k} ${esc(W.road)}</span>${coin(ROAD_RENT[k])}</li>`).join('')}</ul><p class="facts"><span>ფასი ${coin(t.p)}</span><span>დაგირავება ${coin(t.p / 2)}</span></p>`;
    } else if (t.k === 'util') {
      head = `<div class="deed-h util" style="${sceneBg(t, 'linear-gradient(180deg,rgba(13,16,22,.1),rgba(13,16,22,.85))')}"><span class="chip">${esc(W.util)}</span><h2>${esc(t.n)}</h2></div>`;
      const n = o ? Engine.countOf(st, o.o, UTILS) : 0;
      rows = `<ul class="rents"><li class="${n === 1 ? 'on' : ''}"><span class="ph"></span><span>ერთი გაქვს: კამათლის ჯამი ×4</span></li><li class="${n === 2 ? 'on' : ''}"><span class="ph"></span><span>ორივე გაქვს: კამათლის ჯამი ×10</span></li></ul><p class="facts"><span>ფასი ${coin(t.p)}</span><span>დაგირავება ${coin(t.p / 2)}</span></p>`;
    } else {
      const a = W.about[t.k], about = typeof a === 'function' ? a(t) : a;
      if (sea() && seaScene(t)) return `<article class="sea-titledeed"><button class="x float-x charter-close" data-close aria-label="დახურვა">×</button>${seaCharterHead(t, 'მეკობრეთა გზამკვლევი')}<div class="charter-content"><p class="prose charter-about">${about}</p>${THEME.stories[i] ? `<details class="charter-story"><summary>ამ ადგილის ნამდვილი ამბავი</summary><p>${esc(THEME.stories[i])}</p></details>` : ''}</div></article>`;
      return `<div class="sheet-h"><h2>${esc(t.n)}</h2><button class="x" data-close aria-label="დახურვა">×</button></div><p class="prose">${about}</p>${story(i)}`;
    }
    const owner = o ? `<p class="owner"><img src="${por(st.players[o.o].hero)}" alt="" style="--c:${SEAT_COLORS[o.o]}">${esc(st.players[o.o].name)}${o.m ? ' · <b class="bad">დაგირავებული</b>' : ''}</p>` : '<p class="owner free">ჯერ არავისია</p>';
    if (mine) foot = manageButtons(st, seat, i);
    if (sea()) {
      const sum = st.dice[0] + st.dice[1], rent = o ? Engine.rentAt(st, i, sum) : 0;
      const collected = o && t.k === 'p' ? GROUP_TILES[t.g].filter(j => st.own[j] && st.own[j].o === o.o).length : 0;
      const portfolio = o && t.k === 'p' ? `<p class="charter-collection">${esc(st.players[o.o].name)}: ${collected} / ${GROUP_TILES[t.g].length} კუნძული ამ ზღვაში</p>` : o && t.k === 'road' ? `<p class="charter-collection">კაპიტნის ფლოტში: ${Engine.countOf(st, o.o, ROADS)} ხომალდი</p>` : '';
      if (o && o.m) rows = rows.replace(/ class="on"/g, '');
      return `<article class="sea-titledeed" style="--owner:${o ? SEAT_COLORS[o.o] : '#a9874c'}"><button class="x float-x charter-close" data-close aria-label="დახურვა">×</button>
        ${seaCharterHead(t, t.k === 'p' ? 'კუნძულის სიგელი' : t.k === 'road' ? 'ხომალდის სიგელი' : 'სანაპიროს სიგელი')}
        <div class="charter-content">${seaOwnership(st, i)}${seaDevelopment(st, i)}${portfolio}
        <div class="charter-current-rent"><span>${o && o.m ? 'ქირა შეჩერებულია' : t.k === 'util' ? `ქირა ამ კამათელზე (${sum})` : 'ქირა ახლა'}<small>${o ? 'ამ ადგილის მიმდინარე შემოსავალი' : 'შეძენის შემდეგ ქირას მიიღებ'}</small></span>${coin(rent)}</div>
        <div class="charter-rent"><h4>ქირის სიგელი</h4>${rows}</div>${foot}
        ${THEME.stories[i] ? `<details class="charter-story"><summary>ამ ადგილის ნამდვილი ამბავი</summary><p>${esc(THEME.stories[i])}</p></details>` : ''}</div></article>`;
    }
    return `<button class="x float-x" data-close aria-label="დახურვა">×</button>${head}<div class="deed-b">${owner}${story(i)}${rows}${foot}</div>`;
  }
  // the archipelago's true story of a place
  function story(i) { const s = THEME.stories[i]; return s ? `<div class="story-b"><h4>ამბავი</h4><p>${esc(s)}</p></div>` : ''; }
  function manageButtons(st, seat, i) {
    const L = Engine.legal(st, seat);
    if (!L.manage) return `<p class="hint">${W.manageLater}</p>`;
    const t = BOARD[i], o = st.own[i], b = [];
    if (t.k === 'p' && L.build) {
      const why = Engine.buildBlock(st, seat, i);
      if (o.lv < 5) b.push(`<button class="btn small gold" data-a="build" data-i="${i}" ${why ? 'disabled' : ''} title="${esc(ERR[why] || '')}">+ ${esc(LEVEL_NAMES[o.lv + 1])} ${coin(GROUPS[t.g].b)}</button>`);
    }
    if (t.k === 'p' && o.lv > 0) b.push(`<button class="btn small" data-a="sell" data-i="${i}" ${Engine.canSell(st, seat, i) ? '' : 'disabled'}>${sea() && o.lv === 5 ? 'სასტუმრო → 4 ქოხი' : '− ' + esc(W.tower)} ${coin(GROUPS[t.g].b / 2)}</button>`);
    if (!o.m) b.push(`<button class="btn small" data-a="mort" data-i="${i}" ${Engine.canMort(st, seat, i) ? '' : 'disabled'}>დაგირავება ${coin(t.p / 2)}</button>`);
    else if (L.build) b.push(`<button class="btn small" data-a="unmort" data-i="${i}" ${st.players[seat].cash >= Engine.unmortCost(i) ? '' : 'disabled'}>გამოსყიდვა ${coin(Engine.unmortCost(i))}</button>`);
    const why = t.k === 'p' && o.lv < 5 ? Engine.buildBlock(st, seat, i) : '';
    return `<div class="manage">${b.join('')}</div>${why && why !== 'cash' && L.build ? `<p class="hint">${esc(ERR[why] || '')}</p>` : ''}`;
  }

  // Illustrated property cards share the same sharp reference art as the deed.
  function assetPicture(t) {
    if (sea()) {
      const picture = seaCardPicture(t);
      if (picture && picture.crop) return `<svg class="asset-picture" viewBox="${picture.crop.join(' ')}" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><image href="${esc(ART(picture.name))}" width="1000" height="400"/></svg>`;
      return `<img class="asset-picture" src="${picture ? esc(ART(picture.name)) : seaArt(t)}" alt="" decoding="async" loading="lazy">`;
    }
    return `<img class="asset-picture" src="${ART(t.k === 'p' ? SCENES[t.g] : t.k === 'road' ? 'g_pass' : 'g_elbrus')}" alt="" decoding="async" loading="lazy">`;
  }
  function assetCard(st, i, options = {}) {
    const t = BOARD[i], o = st.own[i], owner = o && st.players[o.o], lv = o ? o.lv : 0;
    const color = t.k === 'p' ? GROUPS[t.g].c : t.k === 'road' ? '#a57843' : '#4b929b';
    const type = sea() ? seaLotType(t) : t.k === 'p' ? W.town : t.k === 'road' ? W.road : W.util;
    const state = t.k === 'p' ? lv === 5 ? `1 ${W.fort}` : lv ? `${lv} ${W.tower}` : sea() ? 'გაუშენებელი კუნძული' : 'გაუშენებელი მიწა' : t.k === 'road' ? W.roads : W.util;
    const rent = t.k === 'util' && o && !o.m ? `<b>კამათელი ×${UTIL_MULT[Engine.countOf(st, o.o, UTILS)]}</b>` : coin(Engine.rentAt(st, i, 7));
    const pick = options.pick, button = pick ? `data-pick="${pick}" data-i="${i}" aria-pressed="${!!options.selected}"` : `data-deed="${i}"`;
    return `<article class="asset-card${options.selected ? ' is-selected' : ''}${o && o.m ? ' is-mortgaged' : ''}" data-property="${i}" style="--g:${color};--owner:${o ? SEAT_COLORS[o.o] : '#a9874c'}">
      <button class="asset-open${pick ? ' asset-choice' : ''}" ${button}>
        <span class="asset-art">${assetPicture(t)}<span class="asset-kind">${esc(type)}</span>${owner ? `<span class="asset-flag" title="${esc(owner.name)}" aria-hidden="true">${PIRATE_FLAG}</span>` : ''}${pick ? `<span class="asset-check" aria-hidden="true">${options.selected ? '✓' : '+'}</span>` : ''}</span>
        <span class="asset-copy"><strong class="asset-name">${esc(tName(i))}</strong>
        <span class="asset-state">${lv ? `<span class="asset-buildings" aria-hidden="true">${lvIcons(lv)}</span>` : ''}<span>${esc(state)}</span></span>
        <span class="asset-rent"><span>${o && o.m ? 'ქირა შეჩერებულია' : 'ქირა'}</span>${rent}</span>
        ${options.price ? `<span class="asset-price">ბანკის ფასი ${coin(t.p)}</span>` : ''}
        ${o && o.m ? `<span class="asset-mortgage">დაგირავებულია · გამოსყიდვა ${fmt(Engine.unmortCost(i))}</span>` : ''}</span>
      </button>${options.actions ? `<div class="asset-actions">${options.actions}</div>` : ''}</article>`;
  }
  function holdings(st, seat) {
    const rows = [];
    GROUPS.forEach((g, gi) => {
      const ts = GROUP_TILES[gi].filter(i => st.own[i] && st.own[i].o === seat);
      if (ts.length) rows.push({ c: g.c, n: g.n, ts, all: GROUP_TILES[gi], gi, full: Engine.groupOwner(st, gi) === seat });
    });
    const rs = ROADS.filter(i => st.own[i] && st.own[i].o === seat), us = UTILS.filter(i => st.own[i] && st.own[i].o === seat);
    if (rs.length) rows.push({ c: '#a57843', n: W.roads, ts: rs, all: ROADS });
    if (us.length) rows.push({ c: '#4b929b', n: W.util, ts: us, all: UTILS });
    return rows;
  }
  function portfolioSummary(st, seat, rows) {
    return `<div class="portfolio-summary"><span class="portfolio-stat"><small>ხელთ აქვს</small>${coin(st.players[seat].cash)}</span><span class="portfolio-stat"><small>ქონების ქარდი</small><b>${rows.reduce((n,r)=>n+r.ts.length,0)}</b></span><span class="portfolio-stat"><small>სრული ჯგუფი</small><b>${rows.filter(r=>r.full).length}</b></span></div>`;
  }
  function portfolio(st, seat, rows, legal) {
    if (!rows.length) return `<p class="portfolio-empty">${esc(seat === View.mySeat() ? W.nothingYet : 'ჯერ ქონება არ აქვს.')}</p>`;
    return rows.map(r => {
      const missing = r.all.filter(i => !r.ts.includes(i)), mort = r.ts.some(i => st.own[i].m);
      const developed = r.gi != null && r.ts.every(i => st.own[i].lv === 5);
      const note = r.gi != null ? missing.length ? `აკლია: ${missing.map(tName).join(', ')}` : developed ? 'სრული ჯგუფი · ყველა ადგილი ბოლომდეა აშენებული.' : mort ? 'სრული ჯგუფია. მშენებლობამდე საჭიროა დაგირავებული ქონების გამოსყიდვა.' : 'სრული ჯგუფი · მფლობელს თავის სვლაზე შეუძლია თანაბრად აშენება, საჭირო თანხით.' : r.ts.length === r.all.length ? 'კოლექცია სრულია' : 'კოლექციის დამატება ქირას ზრდის';
      return `<section class="portfolio-group" style="--g:${r.c}"><div class="portfolio-heading"><h3>${esc(r.n)}</h3><span class="portfolio-count${r.full ? ' full' : ''}">${r.ts.length} / ${r.all.length}${r.full ? ' · სრული' : ''}</span></div>
        <div class="portfolio-progress" aria-hidden="true">${r.all.map(i=>`<span class="collection-pip ${r.ts.includes(i)?'owned':'missing'}" title="${esc(tName(i))}"></span>`).join('')}</div>
        <div class="asset-grid">${r.ts.map(i=>assetCard(st,i,{actions:legal && legal.manage ? rowActions(st,seat,i,legal):''})).join('')}</div><p class="portfolio-note">${esc(note)}</p></section>`;
    }).join('');
  }
  function player(st) {
    const seat = arg, p = st.players[seat];
    if (!p) return null;
    const rows = holdings(st, seat), hero = HEROES[p.hero] || {};
    const bio = hero.b ? `<details class="portfolio-bio"><summary>${esc(hero.n || 'გმირის ამბავი')}</summary><p class="prose bio">${esc(hero.b)}</p></details>` : '';
    return `<div class="sheet-h"><img class="sh-por" src="${por(p.hero)}" alt="" style="--c:${SEAT_COLORS[seat]}"><div><h2>${esc(p.name)}</h2><small>${esc(W.estate)} · ${esc(hero.n || '')}</small></div><button class="x" data-close aria-label="დახურვა">×</button></div>
      ${portfolioSummary(st,seat,rows)}${portfolio(st,seat,rows)}<p class="facts"><span>მთლიანი ქონება ${coin(Engine.worth(st,seat))}</span>${p.fe.length ? `<span>${esc(W.feather)} ×${p.fe.length}</span>` : ''}</p>${bio}`;
  }
  // Managing keeps its actions on each card; property art and rent stay visible.
  function estate(st) {
    const seat = View.mySeat(), p = st.players[seat];
    if (!p) return null;
    const legal = Engine.legal(st,seat), rows = holdings(st,seat);
    const debt = st.phase === 'debt' && st.turn === seat ? `<div class="debtbar">ვალი ${coin(st.pend.a)} · გაქვს ${coin(p.cash)} <button class="btn small gold" data-a="pay" ${p.cash >= st.pend.a ? '' : 'disabled'}>გადაიხადე</button></div>` : '';
    return `<div class="sheet-h"><h2>${esc(W.estate)}</h2><button class="x" data-close aria-label="დახურვა">×</button></div>${portfolioSummary(st,seat,rows)}${debt}${portfolio(st,seat,rows,legal)}${legal.manage ? '' : `<p class="hint">${esc(W.buildLater)}</p>`}${p.fe.length ? `<p class="facts">${esc(W.feather)} ×${p.fe.length}</p>` : ''}`;
  }
  function rowActions(st, s, i, L) {
    const t = BOARD[i], o = st.own[i], b = [];
    if (t.k === 'p' && L.build && Engine.groupOwner(st, t.g) === s && o.lv < 5) b.push(`<button class="ib gold" data-a="build" data-i="${i}" ${Engine.buildBlock(st, s, i) ? 'disabled' : ''} aria-label="${esc(W.buildOne)}" title="აშენება ${GROUPS[t.g].b}">+</button>`);
    if (t.k === 'p' && o.lv > 0) b.push(`<button class="ib" data-a="sell" data-i="${i}" ${Engine.canSell(st, s, i) ? '' : 'disabled'} aria-label="${esc(W.sellOne)}" title="გაყიდვა ${GROUPS[t.g].b / 2}">−</button>`);
    if (!o.m) b.push(`<button class="ib" data-a="mort" data-i="${i}" ${Engine.canMort(st, s, i) ? '' : 'disabled'} title="დაგირავება ${t.p / 2}">დაგირ.</button>`);
    else if (L.build) b.push(`<button class="ib" data-a="unmort" data-i="${i}" ${st.players[s].cash >= Engine.unmortCost(i) ? '' : 'disabled'} title="გამოსყიდვა ${Engine.unmortCost(i)}">გამოსყ.</button>`);
    return `<span class="ibs">${b.join('')}</span>`;
  }

  // putting up towers, region by region (they go up evenly; the game picks the town)
  function build(st) {
    const s = View.mySeat(), p = st.players[s];
    if (!p) return null;
    const L = Engine.legal(st, s);
    const full = GROUPS.map((g, gi) => gi).filter(gi => Engine.groupOwner(st, gi) === s);
    const head = `<div class="sheet-h"><h2>${esc(W.towers)}</h2><span class="sh-cash">${coin(p.cash)}</span><button class="x" data-close aria-label="დახურვა">×</button></div>`;
    if (!full.length) {
      const near = GROUPS.map((g, gi) => ({ g, gi, have: GROUP_TILES[gi].filter(i => st.own[i] && st.own[i].o === s) })).filter(x => x.have.length).sort((a, b) => (b.have.length / GROUP_TILES[b.gi].length) - (a.have.length / GROUP_TILES[a.gi].length));
      return `${head}<p class="prose">${W.needRegion}</p>${near.map(x => `<div class="breg" style="--g:${x.g.c}"><h4>${esc(x.g.n)} <small>${x.have.length} / ${GROUP_TILES[x.gi].length}</small></h4><p class="hint">აკლია: ${GROUP_TILES[x.gi].filter(i => !x.have.includes(i)).map(i => esc(tName(i))).join(', ')}</p></div>`).join('') || `<p class="hint">${W.noTownYet}</p>`}`;
    }
    const rows = full.map(gi => {
      const g = GROUPS[gi], up = nextBuild(st, s, gi), down = nextSell(st, s, gi), mort = GROUP_TILES[gi].some(i => st.own[i].m);
      const towns = GROUP_TILES[gi].map(i => `<span class="btown"><b>${esc(tName(i))}</b><span class="lvi">${st.own[i].lv ? lvIcons(st.own[i].lv) : '<small>ცარიელი</small>'}</span><small>ქირა ${coin(Engine.rentAt(st, i, 7))}</small></span>`).join('');
      const why = mort ? W.unmortFirst : up == null && GROUP_TILES[gi].every(i => st.own[i].lv >= 5) ? W.allForts : up == null ? 'ფული არ გყოფნის' : '';
      return `<div class="breg" style="--g:${g.c}"><h4>${esc(g.n)}</h4><div class="btowns">${towns}</div>
        <div class="row">${L.build ? `<button class="btn gold" data-a="build" data-g="${gi}" ${up != null ? '' : 'disabled'}>+ ${esc(W.tower)} ${coin(g.b)}</button>${down != null ? `<button class="btn" data-a="sell" data-g="${gi}">− გაყიდვა ${coin(g.b / 2)}</button>` : ''}` : '<p class="hint">აშენება შენს სვლაზეა.</p>'}</div>
        ${why && L.build ? `<p class="hint">${why}</p>` : ''}</div>`;
    }).join('');
    return `${head}<p class="hint">${W.evenHint}</p>${rows}`;
  }

  function tradeSummary(st, tr, seat) {
    const result = TradeInsights.preview(st,tr,seat);
    if (!result.valid) return `<section class="trade-summary"><p class="hint">${result.reason === 'empty' ? 'აირჩიე ქარდები: აქ გამოჩნდება, რას მოგცემს გაცვლა.' : 'შეთავაზება შეიცვალა ან აღარ მოქმედებს. გადაამოწმე ქონება და თანხა.'}</p></section>`;
    const impacts = result.groups.map(g => {
      const group = GROUPS[g.gi];
      const title = g.completed ? 'ასრულებ ჯგუფს' : g.broken ? 'კარგავ სრულ ჯგუფს' : g.after > g.before ? 'უახლოვდები სრულ ჯგუფს' : g.after < g.before ? 'ჯგუფში ნაკლები ქონება გრჩება' : 'ჯგუფის რაოდენობა უცვლელია';
      let detail = '';
      if (g.after === g.total) {
        detail = `ჯგუფი შენია. ${sea() ? 'ქოხები' : 'კოშკები'} უნდა აშენდეს თანაბრად; თითო მშენებლობა ${fmt(g.buildCost)} ღირს.`;
        if (g.mortgaged.length) detail += ` ჯერ გამოისყიდე დაგირავებული ქონება: ${fmt(g.redemptionCost)}.`;
        if (!g.firstBuildAffordable) detail += ' გარიგების შემდეგ დარჩენილი თანხა გამოსყიდვასა და პირველ მშენებლობას ერთად არ ჰყოფნის.';
        else detail += g.buildTurnReady ? ' თანხა პირველ მშენებლობასაც ჰყოფნის.' : ' მშენებლობას შენს სვლაზე შეძლებ.';
      } else if (g.broken) detail = 'ამ ჯგუფში ვეღარ ააშენებ, სანამ სრულად არ დაიბრუნებ. გაუშენებელი ქონების ქირაც მცირდება.';
      else detail = g.after ? `მშენებლობისთვის საჭიროა ${g.total}-ვე ${W.town}.` : 'ამ ჯგუფში ქონება აღარ გრჩება.';
      return `<article class="trade-impact ${g.completed ? 'positive' : g.broken || g.after < g.before ? 'caution' : 'neutral'}" style="--g:${group.c}"><h4>${esc(title)} · ${esc(group.n)}</h4><div class="trade-count">${g.before} / ${g.total} <span aria-label="გაცვლის შემდეგ">→</span> <b>${g.after} / ${g.total}</b></div><p class="trade-detail">${esc(detail)}</p>${g.missing.length && g.after ? `<p class="trade-missing">კიდევ აკლია: ${g.missing.map(i=>esc(tName(i))).join(', ')}</p>` : ''}${g.after === g.total ? `<p class="trade-steps">${sea() ? '4 ქოხი თითო კუნძულზე → შემდეგ სასტუმრო' : '4 კოშკი თითო ქალაქში → შემდეგ ციხე-სიმაგრე'}. ყოველი საფეხური ცალკე ფასიანია.</p>` : ''}</article>`;
    });
    for (const [key,label] of [['roads',W.roads],['utilities',W.util]]) {
      const value = result[key];
      if (!value.received.length && !value.given.length) continue;
      const before = key === 'roads' ? fmt(value.rentBefore) : 'კამათელი ×'+value.multiplierBefore, after = key === 'roads' ? fmt(value.rentAfter) : 'კამათელი ×'+value.multiplierAfter;
      impacts.push(`<article class="trade-impact ${value.after > value.before ? 'positive' : value.after < value.before ? 'caution' : 'neutral'}"><h4>${esc(label)} · ${value.before} → ${value.after}</h4><p class="trade-detail">ქირა: ${before} → <b>${after}</b>. დაგირავებულ ქონებაზე ქირას ვერ იღებ.</p></article>`);
    }
    if (result.redemptionCost) impacts.push(`<p class="trade-missing">მიღებული დაგირავებული ქონების გამოსყიდვა დამატებით ${coin(result.redemptionCost)} დაგიჯდება.</p>`);
    if (result.feathersAfter !== result.feathersBefore) impacts.push(`<p class="trade-detail">${esc(W.feather)}: ${result.feathersBefore} → ${result.feathersAfter}</p>`);
    return `<section class="trade-summary" aria-label="გარიგების შედეგი"><h3>რას ცვლის ეს გარიგება შენთვის</h3><div class="trade-wallet"><span>ფული ახლა ${coin(result.cashBefore)}</span><span>შემდეგ ${coin(result.cashAfter)}</span></div>${impacts.join('') || '<p class="trade-detail">ქონების ჯგუფები უცვლელია.</p>'}</section>`;
  }
  function tradeGlance(st, tr, seat) {
    const r = TradeInsights.preview(st,tr,seat);
    const complete = r.groups.filter(g=>g.completed), broken = r.groups.filter(g=>g.broken);
    const label = !r.valid ? r.reason === 'empty' ? 'აირჩიე გასაცვლელი ქარდები' : 'გადაამოწმე შეთავაზება' : [
      complete.length ? `სრულდება ${complete.length} ჯგუფი` : '',
      broken.length ? `იშლება ${broken.length} ჯგუფი` : '',
      !complete.length && !broken.length ? `იღებ ${r.incoming.length} ქარდს · გასცემ ${r.outgoing.length}` : '',
      `გრჩება ${fmt(r.cashAfter)}`
    ].filter(Boolean).join(' · ');
    return `<div class="trade-glance"><span role="status" aria-live="polite">${esc(label)}</span><button class="ib" data-trade-result>შედეგი ↑</button></div>`;
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
      const items = tl.length ? tl.map(i => assetCard(st,i,{pick:key,selected:x.p.includes(i),price:true})).join('') : '<p class="hint">გასაცვლელი ქონება არ აქვს</p>';
      return `<div class="tside"><h4>${key === 'give' ? 'შენ აძლევ' : 'შენ ითხოვ'}</h4><div class="asset-grid trade-assets">${items}</div>
        <div class="money"><span>ფული</span><button class="ib" data-cash="${key}" data-d="-50">−50</button><button class="ib" data-cash="${key}" data-d="-10">−10</button><b>${fmt(x.c)}</b><button class="ib" data-cash="${key}" data-d="10">+10</button><button class="ib" data-cash="${key}" data-d="50">+50</button><small>მაქს. ${fmt(pl.cash)}</small></div>
        ${pl.fe.length ? `<div class="money"><span>${esc(W.feather)}</span><button class="ib" data-fe="${key}" data-d="-1">−</button><b>${x.f}</b><button class="ib" data-fe="${key}" data-d="1">+</button><small>აქვს ${pl.fe.length}</small></div>` : ''}</div>`;
    };
    const tabs = others.map(x => `<button class="who${x === d.to ? ' on' : ''}" data-to="${x}" style="--c:${SEAT_COLORS[x]}"><img src="${por(st.players[x].hero)}" alt="">${esc(st.players[x].name)}</button>`).join('');
    const why = Engine.tradeBlock(st, { from: s, to: d.to, give: d.give, get: d.get });
    return `<div class="trade-sheet"><div class="sheet-h"><h2>ვაჭრობა</h2><button class="x" data-close aria-label="დახურვა">×</button></div>
      <div class="whos">${tabs}</div>${tradeGlance(st,{from:s,to:d.to,give:d.give,get:d.get},s)}${tradeSummary(st,{from:s,to:d.to,give:d.give,get:d.get},s)}
      <div class="tsides">${side(s, d.give, 'give')}${side(d.to, d.get, 'get')}</div>
      <p class="hint">${W.tradeTowers} ${them.bot ? 'ბოტი მხოლოდ მომგებიან გარიგებას ეთანხმება.' : ''}</p>
      <button class="btn gold wide" data-offer ${why ? 'disabled' : ''}>შეთავაზება: ${esc(them.name)}</button></div>`;
  }
  function tradeClick(ev) {
    const st = View.st, s = View.mySeat();
    if (ev.target.closest('[data-trade-result]')) { body().querySelector('.trade-summary').scrollIntoView({block:'start'}); return true; }
    const to = ev.target.closest('[data-to]'), pick = ev.target.closest('[data-pick]'), cash = ev.target.closest('[data-cash]'), fe = ev.target.closest('[data-fe]');
    const redraw = () => {
      const top = body().scrollTop, clicked = pick || cash || fe || to;
      const attrs = clicked ? [...clicked.attributes].filter(a=>a.name.startsWith('data-')).map(a=>`[${a.name}="${a.value}"]`).join('') : '';
      draw(); body().scrollTop = top; const next = attrs && body().querySelector(attrs); if(next) next.focus({preventScroll:true});
    };
    if (to) { draft = { to: +to.dataset.to, give: { p: [], c: 0, f: 0 }, get: { p: [], c: 0, f: 0 } }; redraw(); return true; }
    if (pick) { const x = draft[pick.dataset.pick], i = +pick.dataset.i; x.p = x.p.includes(i) ? x.p.filter(j => j !== i) : x.p.concat(i); redraw(); return true; }
    if (cash) { const key = cash.dataset.cash, x = draft[key], max = st.players[key === 'give' ? s : draft.to].cash; x.c = Math.max(0, Math.min(max, x.c + +cash.dataset.d)); redraw(); return true; }
    if (fe) { const key = fe.dataset.fe, x = draft[key], max = st.players[key === 'give' ? s : draft.to].fe.length; x.f = Math.max(0, Math.min(max, x.f + +fe.dataset.d)); redraw(); return true; }
    if (ev.target.closest('[data-offer]')) { move({ t: 'offer', to: draft.to, give: draft.give, get: draft.get, seat: s }); close(); return true; }
    return false;
  }
  // an offer to this device's player
  function offer(st) {
    const tr = st.trade;
    if (!tr || !View.controls(tr.to)) return null;
    const from = st.players[tr.from];
    const list = x => `${x.p.length ? `<div class="asset-grid trade-assets">${x.p.map(i=>assetCard(st,i,{price:true})).join('')}</div>` : ''}${x.c ? `<p class="trade-detail">ფული ${coin(x.c)}</p>` : ''}${x.f ? `<p class="trade-detail">${esc(W.feather)} ×${x.f}</p>` : ''}${!x.p.length && !x.c && !x.f ? '<p class="hint">არაფერი</p>' : ''}`;
    const blocked = !!Engine.tradeBlock(st,tr);
    return `<div class="trade-sheet"><div class="sheet-h"><img class="sh-por" src="${por(from.hero)}" alt="" style="--c:${SEAT_COLORS[tr.from]}"><div><h2>${esc(from.name)} გთავაზობს</h2><small>${esc(st.players[tr.to].name)}, შენ წყვეტ</small></div><button class="x" data-close aria-label="დახურვა">×</button></div>
      ${tradeSummary(st,tr,tr.to)}<div class="tsides"><div class="tside"><h4>შენ მიიღებ</h4>${list(tr.give)}</div><div class="tside"><h4>შენ მისცემ</h4>${list(tr.get)}</div></div>
      <div class="row trade-submit"><button class="btn gold" data-a="accept" data-seat="${tr.to}" ${blocked ? 'disabled' : ''}>თანხმობა</button><button class="btn" data-a="decline" data-seat="${tr.to}">უარი</button></div></div>`;
  }
  function log(st) {
    const lines = st.ev.map(e => evText(st, e)).filter(Boolean).reverse().slice(0, 70);
    return `<div class="sheet-h"><h2>ჟურნალი</h2><button class="x" data-close aria-label="დახურვა">×</button></div><ol class="log">${lines.map(l => `<li>${l}</li>`).join('')}</ol>`;
  }
  function menu(st) {
    const host = ROOM && (ROOM.role === 'local' || (st && st.host === ROOM.me));
    const code = ROOM && ROOM.mode === 'online' ? `<p class="facts"><span>ოთახი <b class="code">${esc(ROOM.code)}</b></span><span>${ROOM.up ? 'კავშირი წესრიგშია' : '<b class="bad">კავშირი გაწყდა, ვცდილობ აღდგენას</b>'}</span><button class="btn small" data-invite>მოწვევა</button></p>
      <p class="hint">ვინც თამაშიდან გავარდა, ამ ბმულით იმავე ტელეფონიდან თავის ადგილს დაუბრუნდება.</p>` : '';
    return `<div class="sheet-h"><h2>მენიუ</h2><button class="x" data-close aria-label="დახურვა">×</button></div>${code}
      <div class="menu-list">
        <button class="btn wide" data-sheet="rules">წესები</button>
        <button class="btn wide" data-sound>ხმა: ${Sound.on ? 'ჩართული' : 'გამორთული'}</button>
        ${host && st && st.phase !== 'over' ? '<button class="btn wide" data-confirm="stop">თამაშის დასრულება ახლავე</button>' : ''}
        <button class="btn wide danger" data-confirm="leave">${ROOM && ROOM.mode === 'online' ? 'ოთახიდან გასვლა' : 'მთავარ მენიუში გასვლა'}</button>
        <button class="btn wide ghost small" data-sheet="diag">ტექნიკური ჟურნალი</button>
      </div><div id="confirm"></div>`;
  }
  // what this phone went through, to send to whoever makes the game when something went wrong
  function diag() {
    return `<div class="sheet-h"><h2>ტექნიკური ჟურნალი</h2><button class="x" data-close aria-label="დახურვა">×</button></div>
      <p class="hint">თუ თამაში გაიჭედა ან რამე უცნაურად მოხდა, დააკოპირე და გაუგზავნე თამაშის ავტორს: აქ წერია, რა ხდებოდა ამ ტელეფონზე.</p>
      <div class="row"><button class="btn gold" data-copylog>კოპირება</button></div>
      <pre class="diag" id="diagText">${esc(Diag.report())}</pre>`;
  }
  function bankruptSheet(st) {
    const s = st.turn;
    if (st.phase !== 'debt' || !View.controls(s)) return null;
    return `<div class="sheet-h"><h2>გაკოტრება</h2><button class="x" data-close aria-label="დახურვა">×</button></div>
      <p class="prose">${st.pend.to >= 0 ? `მთელ შენს ქონებას და ფულს მიიღებს ${esc(pName(st, st.pend.to))}.` : W.freeAgain} თამაშს ვეღარ გააგრძელებ, მაგრამ ყურებას შეძლებ.</p>
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
    return `<div class="sheet-h"><h2>წესები${THEME.key !== 'mamuli' ? ` · ${esc(THEME.name)}` : ''}</h2><button class="x" data-close aria-label="დახურვა">×</button></div><div class="prose rules">${W.rules()}</div>`;
  }

  // how to put the game on the home screen where the browser does not ask by itself
  function install() {
    const ua = navigator.userAgent, where = /CriOS|FxiOS|EdgiOS/.test(ua) ? 'მისამართის ზოლშია, მარჯვნივ' : /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'ზედა ზოლშია' : 'ქვედა ზოლშია';
    const steps = {
      ios: [`დააჭირე <b>„გაზიარება"</b> ღილაკს ${SHARE_SVG} (${where})`,
        'ჩამოსქროლე და აირჩიე <b class="en">Add to Home Screen</b> („მთავარ ეკრანზე დამატება")',
        'გახსენი „შენი ჯერი" მთავარი ეკრანიდან: აპივით გაიხსნება, ბრაუზერის ზოლების გარეშე.'],
      mac: ['Safari-ს ზედა მენიუში აირჩიე <b class="en">File → Add to Dock…</b>',
        '„შენი ჯერი" Dock-ში გამოჩნდება და ცალკე ფანჯარაში გაიხსნება.'],
      firefox: ['გახსენი ბრაუზერის მენიუ <b>⋮</b>', 'აირჩიე <b class="en">Install</b> ან <b class="en">Add to Home screen</b>', 'გახსენი „შენი ჯერი" მთავარი ეკრანიდან.']
    }[arg] || [];
    return `<div class="sheet-h"><h2>დაინსტალირება</h2><button class="x" data-close aria-label="დახურვა">×</button></div>
      <div class="prose"><ol class="steps">${steps.map(t => `<li>${t}</li>`).join('')}</ol>
      <p>ცალკე ჩამოტვირთვა არ სჭირდება: ახალი ვერსია თავისით მოვა, ბოტებთან კი ინტერნეტის გარეშეც ითამაშებ.</p></div>
      <button class="btn gold wide" data-close>გასაგებია</button>`;
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
      if (a.dataset.g != null) {
        const now = (ROOM && ROOM.st) || View.st, s = View.mySeat(), g = +a.dataset.g;
        m.i = m.t === 'build' ? nextBuild(now, s, g) : nextSell(now, s, g);
        if (m.i == null) return;
      }
      if (m.t === 'bankrupt' || m.t === 'accept' || m.t === 'decline') close();
      move(m);
      return;
    }
    const d = ev.target.closest('[data-deed]');
    if (d) return open('deed', +d.dataset.deed);
    const sh = ev.target.closest('[data-sheet]');
    if (sh) return open(sh.dataset.sheet);
    if (ev.target.closest('[data-sound]')) { Sound.on = !Sound.on; Sound.unlock(); return draw(); }
    if (ev.target.closest('[data-invite]')) return Lobby.invite();
    if (ev.target.closest('[data-copylog]')) {
      const text = Diag.report(), pre = $('#diagText');
      const select = () => { if (!pre) return; const r = document.createRange(); r.selectNodeContents(pre); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); UI.toast('მონიშნულია: დააკოპირე'); };
      try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(() => UI.toast('დაკოპირდა'), select); return; } } catch (e) { }
      return select();
    }
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
  st.term = old.term; st.seq = old.seq; st.cfg = old.cfg; st.theme = old.theme || 'mamuli';
  st.players = old.players.filter(p => p.bot || !p.away || ROOM.role === 'local').map(p => ({ pid: p.pid, name: p.name, hero: p.hero, pref: p.pref || {}, bot: p.bot, cash: START_CASH, pos: 0, jail: false, jt: 0, fe: [], out: false, outAt: 0, dbl: 0, away: false }));
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
    if (s === 'menu') { Menu.render(); if (typeof prepareCardVisuals === 'function') prepareCardVisuals(); }
    if (s === 'game') { requestAnimationFrame(() => View.fit()); }
    Voice.render();
  }
  function toast(msg, ms, kind) {
    const box = $('#toasts');
    if (!box) return;
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.innerHTML = msg;
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { t.classList.add('bye'); setTimeout(() => t.remove(), 400); }, ms || 4000);
  }
  function moveRefused(code) {
    Diag.note('move', 'refused: ' + code);
    View.busy(false);
    if (View.st) View.render();
    if (code && code !== 'turn' && ERR[code]) { toast(ERR[code], 3600, 'bad'); Sound.bad(); }    // 'turn': a button pressed twice
  }
  return { go, toast, moveRefused, get screen() { return screen; } };
})();
