// ===== the game screen =====
// View.show(state) is called with every new state. The events in it play one after another (dice, the figure walking,
// cards, money), and once they are done the whole screen is drawn from the state.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ART = n => 'art/' + n + '.webp';
const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const coin = n => `<b class="amt"><i class="ci"></i>${fmt(n)}</b>`;
// a hero's portrait (a king or hero of მამული, or a pirate)
const por = h => ART((HEROES[h] && HEROES[h].t === 'archipelago' ? 'por_p_' : 'por_h_') + h);
const pName = (st, s) => st && st.players[s] ? st.players[s].name : '?';
const tName = i => BOARD[i].n.replace(/\u00ad/g, '');
// a level as pictures: one to four little towers (huts in the archipelago), or the fortress
const sea = () => THEME.world === 'sea';
const towerIcon = () => sea() ? HUT_SVG : TOWER_SVG;
const lvIcons = lv => lv >= 5 ? (sea() ? `<span class="tws fort-i">${SEAFORT_SVG}</span>` : `<img class="fort" src="${ART('s_fort')}" alt="">`) : `<span class="tws">${towerIcon().repeat(lv)}</span>`;
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
const ERR = {
  turn: 'ახლა ამის გაკეთება არ შეიძლება', cash: 'ფული არ გყოფნის', get group() { return W.errGroup; },
  get even() { return W.errEven; }, get mort() { return W.errMort; }, max: 'აქ უკვე ციხეა', answered: 'უკვე უპასუხე',
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
  function leaveBoard() { built = false; if (Board3D.ok) Board3D.leave(); if (Dice3D.busy) Dice3D.skip(); }
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
      case 'salary': case 'gain': money(e.s, e.a); Sound.coin(); await wait(260); break;
      case 'pay': {
        money(e.s, -e.a); if (e.to >= 0) money(e.to, e.a);
        if (gl) Board3D.coins(e.s, e.to, e.a);
        if (e.why === 'rent') {                    // the notes by the two chips tell everyone; the toast only those who paid or got it
          if (controls(e.s) || controls(e.to)) toastEv(`${esc(pName(st, e.s))} → ${esc(pName(st, e.to))}: ქირა ${coin(e.a)}`, controls(e.to) ? 'good' : 'bad');
          bubble(e.s, `ქირა → ${esc(pName(st, e.to))}`, 'bad'); bubble(e.to, 'მიიღო ქირა', 'good');
        }
        else if (e.why === 'tax') { if (controls(e.s)) toastEv(`${esc(tName(e.i))}: ${coin(e.a)}`, 'bad'); bubble(e.s, esc(tName(e.i)), 'bad'); }
        else bubble(e.s, e.why === 'fine' ? esc(W.fine) : e.why === 'repair' ? 'შეკეთება' : 'გადაიხადა', 'bad');
        Sound.pay(); await wait(450); break;
      }
      case 'buy': Board3D.setOwner(e.i, e.s, true); money(e.s, -e.a); bubble(e.s, `იყიდა: ${esc(tName(e.i))}`, 'good'); Sound.coin(); await wait(450); whole(st, e.s, [e.i]); break;
      case 'skip': bubble(e.s, `აუქციონზე: ${esc(tName(e.i))}`, ''); break;
      // the auction: its card is drawn from the state; the events only add sound, the notes and the town's owner
      case 'auction': Sheet.close(true); Board3D.focus(e.s); Board3D.pop(e.i, 0.08); Sound.gavel(); await wait(250); break;
      case 'bid': bubble(e.s, coin(e.a), 'bid'); Sound.bid(); await wait(120); break;
      case 'pass': bubble(e.s, 'გავიდა', ''); break;
      case 'won': {
        Board3D.setOwner(e.i, e.s, true); money(e.s, -e.a); Sound.gavel(); bubble(e.s, `იყიდა: ${esc(tName(e.i))}`, 'good');
        toastEv(`${esc(pName(st, e.s))}: ${esc(tName(e.i))} აუქციონზე · ${coin(e.a)}`, controls(e.s) ? 'good' : '');
        await wait(600); whole(st, e.s, [e.i]); break;
      }
      case 'unsold': toastEv(`${esc(tName(e.i))}: აუქციონზე არავინ იყიდა`); await wait(300); break;
      case 'build': case 'sell': Board3D.setLevel(e.i, e.lv, true); money(e.s, e.k === 'build' ? -Engine.buildCost(e.i) : Engine.buildCost(e.i) / 2); bubble(e.s, e.k === 'build' ? `${LEVEL_NAMES[e.lv]}: ${esc(tName(e.i))}` : `${esc(W.soldTower)}: ${esc(tName(e.i))}`, e.k === 'build' ? 'good' : ''); Sound.build(); await wait(380); break;
      case 'mort': Board3D.setMort(e.i, true, true); money(e.s, Engine.mortValue(e.i)); bubble(e.s, `დააგირავა: ${esc(tName(e.i))}`, 'bad'); await wait(240); break;
      case 'unmort': Board3D.setMort(e.i, false, true); money(e.s, -Engine.unmortCost(e.i)); bubble(e.s, `გამოისყიდა: ${esc(tName(e.i))}`, 'good'); await wait(240); break;
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
        whole(st, e.to, e.give.p); whole(st, e.from, e.get.p);
        toastEv(`${esc(pName(st, e.from))} ⇄ ${esc(pName(st, e.to))}: გარიგება შედგა`, 'good'); Sound.coin(); await wait(500); break;
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
  function money(s, d) {
    if (!d || !shown || !shown.players[s]) return;
    cash[s] = (cash[s] || 0) + d;
    const chip = $(`#players .pl[data-s="${s}"]`);
    if (chip) {
      const b = chip.querySelector('.pc');
      if (b) { b.innerHTML = coin(cash[s]); playersHTML = ''; }       // (the strip is drawn whole again next time)
      const f = document.createElement('span');
      f.className = 'float ' + (d > 0 ? 'up' : 'down');
      f.textContent = (d > 0 ? '+' : '−') + fmt(Math.abs(d));
      chip.appendChild(f);
      setTimeout(() => f.remove(), 1300);
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
  async function showCard(e) {
    const c = Engine.deckOf(target)[e.d][e.id], box = $('#cardpop');
    if (!box) return;
    const title = e.d === 's' ? W.scroll : W.chest;
    const pic = sea() && e.d === 's' ? `<div class="card-pic" style="background-image:url(${ART('sc_bottle')})"></div>` : `<img src="${ART(e.d === 's' ? 'ui_page' : 'ui_chest_wood_o')}" alt="">`;
    box.innerHTML = `<div class="card ${e.d}${pic.startsWith('<div') ? ' pic' : ''}">${pic}<h3>${title}</h3><p>${esc(c.t)}</p><small>${esc(pName(target, e.s))}</small></div>`;
    box.hidden = false;
    box.classList.remove('go'); void box.offsetWidth; box.classList.add('go');
    Sound.card();
    let closed = false;
    box.onclick = () => { closed = true; };
    const until = Date.now() + Math.max(3200, 4500 / rate);       // (long enough to read, even when the screen hurries)
    while (!closed && Date.now() < until) await sleep(80);
    box.hidden = true;
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
    if (html !== playersHTML || !box.firstChild) { box.innerHTML = html; playersHTML = html; }
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
    const who = Engine.activeSeats(st).map(s => `<img src="${por(st.players[s].hero)}" alt="${esc(st.players[s].name)}" title="${esc(st.players[s].name)}" class="${s === A.by ? 'lead' : A.out.includes(s) ? 'out' : ''}" style="--c:${SEAT_COLORS[s]}">`).join('');
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
    box.innerHTML = `<div class="bc auc">${cardHead(t, '<span class="chip au-tag">აუქციონი</span>')}
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
    box.innerHTML = `<div class="bc">${cardHead(t)}
      <div class="bc-b">${story ? `<p class="story">${esc(story)}</p>` : ''}<ul class="bc-rent">${rows}</ul><p class="hint">${hint}</p>
      <div class="row"><button class="btn gold big" data-a="buy" ${L.buy ? '' : 'disabled'}>იყიდე ${coin(t.p)}</button><button class="btn" data-a="skip">აუქციონზე</button></div>
      ${L.buy ? '' : `<p class="hint bad">ფული არ გყოფნის: გაქვს ${coin(p.cash)}. აუქციონზე იაფადაც შეიძლება წავიდეს.</p>`}</div></div>`;
    if (box.hidden || box.dataset.k !== 'buy') { box.hidden = false; box.dataset.k = 'buy'; box.classList.remove('go'); void box.offsetWidth; box.classList.add('go'); }
    if (busy) $$('[data-a]', box).forEach(b => { b.disabled = true; });
  }
  // ----- the treasure chest's question: the same card on every screen, its clock, who has answered; the answers for
  // whoever answers from this device (on a phone shared by several people, one after another) -----
  let quizKey = '', quizAt = 0;
  const LETTERS = ['ა', 'ბ', 'გ'];
  const quizItem = (st, q) => { const Q = themeOf(st).quiz; return Q && Q[q]; };
  function quizHead(st, s) {
    return `<div class="qz-h" style="background-image:linear-gradient(90deg,rgba(44,27,16,.96) 30%,rgba(44,27,16,.55) 62%,rgba(44,27,16,.15)),url(${ART('sc_chest')})"><img src="${ART('ui_chest_wood_o')}" alt=""><div><b>${esc(W.chest)}</b><small>გახსნა ${esc(pName(st, s))} · სწორ პასუხზე მას ${coin(QUIZ_WIN)}, სხვებს ${coin(QUIZ_SHARE)}</small></div></div>`;
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
    box.innerHTML = `<div class="bc qz">${quizHead(st, Q.s)}
      <div class="bc-b"><p class="qz-q">${esc(item.q)}</p>
      <div class="au-clock"><i style="animation-duration:${dur}s;animation-delay:-${gone.toFixed(2)}s"></i></div>
      ${lead}<div class="qz-as">${answers}</div><div class="au-who">${who}</div>${foot}</div></div>`;
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
    box.innerHTML = `<div class="bc qz reveal">${quizHead(st, e.s)}<div class="bc-b"><p class="qz-q">${esc(item.q)}</p><div class="qz-as">${rows}</div>
      <p class="qz-x">${esc(item.x)}</p><div class="qz-gs">${gains}</div></div></div>`;
    box.hidden = false; box.dataset.k = 'reveal'; box.classList.remove('go'); void box.offsetWidth; box.classList.add('go');
    if (won.some(s => controls(s))) Sound.coin(); else Sound.card();
    let closed = false;
    box.onclick = () => { closed = true; };
    const until = Date.now() + Math.max(4500, 6500 / rate);
    while (!closed && Date.now() < until && document.visibilityState !== 'hidden') await sleep(80);
    box.onclick = null;
    hideCard();
  }
  function hideCard() { const b = $('#buycard'); if (b) { b.hidden = true; b.dataset.k = ''; } }
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
    busy(b) { busy = b; if (b) $$('#panel [data-a], #buycard [data-a], #sheet [data-a]').forEach(x => { x.disabled = true; }); },
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
      if (sea() && seaScene(t)) return `<button class="x float-x" data-close aria-label="დახურვა">×</button><div class="deed-h" style="${sceneBg(t, 'linear-gradient(180deg,rgba(13,16,22,0),rgba(13,16,22,.85))')}"><h2>${esc(t.n)}</h2></div><p class="prose">${about}</p>${story(i)}`;
      return `<div class="sheet-h"><h2>${esc(t.n)}</h2><button class="x" data-close aria-label="დახურვა">×</button></div><p class="prose">${about}</p>${story(i)}`;
    }
    const owner = o ? `<p class="owner"><img src="${por(st.players[o.o].hero)}" alt="" style="--c:${SEAT_COLORS[o.o]}">${esc(st.players[o.o].name)}${o.m ? ' · <b class="bad">დაგირავებული</b>' : ''}</p>` : '<p class="owner free">ჯერ არავისია</p>';
    if (mine) foot = manageButtons(st, seat, i);
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
    if (t.k === 'p' && o.lv > 0) b.push(`<button class="btn small" data-a="sell" data-i="${i}" ${Engine.canSell(st, seat, i) ? '' : 'disabled'}>− ${esc(W.tower)} ${coin(GROUPS[t.g].b / 2)}</button>`);
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
    if (rs.length) rows.push({ c: '#8a6a4f', n: W.roads, ts: rs });
    if (us.length) rows.push({ c: '#7a4a2a', n: W.util, ts: us });
    return rows;
  }
  function player(st) {
    const s = arg, p = st.players[s];
    if (!p) return null;
    const rows = holdings(st, s);
    const list = rows.length ? rows.map(r => `<div class="hold"><h4 style="--g:${r.c}">${esc(r.n)}${r.full ? ' <span class="tag">მთელი</span>' : ''}</h4>${r.ts.map(i => tileRow(st, i)).join('')}</div>`).join('') : '<p class="prose">ჯერ არაფერი აქვს.</p>';
    const bio = HEROES[p.hero].b ? `<p class="prose bio">${esc(HEROES[p.hero].b)}</p>` : '';
    return `<div class="sheet-h"><img class="sh-por" src="${por(p.hero)}" alt="" style="--c:${SEAT_COLORS[s]}"><div><h2>${esc(p.name)}</h2><small>${esc(HEROES[p.hero].n)}</small></div><button class="x" data-close aria-label="დახურვა">×</button></div>
      ${bio}<p class="facts"><span>ფული ${coin(p.cash)}</span><span>ქონება ${coin(Engine.worth(st, s))}</span>${p.fe.length ? `<span>${esc(W.feather)} ${p.fe.length}</span>` : ''}</p>${list}`;
  }
  function tileRow(st, i, actions) {
    const o = st.own[i], t = BOARD[i];
    const lv = o && o.lv ? `<span class="lvi" title="${esc(LEVEL_NAMES[o.lv])}">${lvIcons(o.lv)}</span>` : '';
    const rent = Engine.rentAt(st, i, 7);
    return `<div class="trow${o && o.m ? ' mort' : ''}"><button class="tlink" data-deed="${i}" style="--g:${t.k === 'p' ? GROUPS[t.g].c : '#8a6a4f'}">${esc(t.n)}</button>${lv}<span class="tr-r">${o && o.m ? '<b class="bad">დაგირავებული</b>' : t.k === 'util' ? '×' + UTIL_MULT[Engine.countOf(st, o.o, UTILS)] : 'ქირა ' + coin(rent)}</span>${actions || ''}</div>`;
  }

  // managing your own things: towers up and down, pawning
  function estate(st) {
    const s = View.mySeat(), p = st.players[s];
    if (!p) return null;
    const L = Engine.legal(st, s), rows = holdings(st, s);
    const debt = st.phase === 'debt' && st.turn === s ? `<div class="debtbar">ვალი ${coin(st.pend.a)} · გაქვს ${coin(p.cash)} <button class="btn small gold" data-a="pay" ${p.cash >= st.pend.a ? '' : 'disabled'}>გადაიხადე</button></div>` : '';
    const note = L.manage ? '' : `<p class="hint">${W.buildLater}</p>`;
    const list = rows.length ? rows.map(r => `<div class="hold"><h4 style="--g:${r.c}">${esc(r.n)}${r.full ? ' <span class="tag">მთელი</span>' : ''}</h4>${r.ts.map(i => tileRow(st, i, L.manage ? rowActions(st, s, i, L) : '')).join('')}</div>`).join('') : `<p class="prose">${W.nothingYet}</p>`;
    return `<div class="sheet-h"><h2>${esc(W.estate)}</h2><span class="sh-cash">${coin(p.cash)}</span><button class="x" data-close aria-label="დახურვა">×</button></div>${debt}${note}${list}`;
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
        ${pl.fe.length ? `<div class="money"><span>${esc(W.feather)}</span><button class="ib" data-fe="${key}" data-d="-1">−</button><b>${x.f}</b><button class="ib" data-fe="${key}" data-d="1">+</button><small>აქვს ${pl.fe.length}</small></div>` : ''}</div>`;
    };
    const tabs = others.map(x => `<button class="who${x === d.to ? ' on' : ''}" data-to="${x}" style="--c:${SEAT_COLORS[x]}"><img src="${por(st.players[x].hero)}" alt="">${esc(st.players[x].name)}</button>`).join('');
    const why = Engine.tradeBlock(st, { from: s, to: d.to, give: d.give, get: d.get });
    return `<div class="sheet-h"><h2>ვაჭრობა</h2><button class="x" data-close aria-label="დახურვა">×</button></div>
      <div class="whos">${tabs}</div>
      <div class="tsides">${side(s, d.give, 'give')}${side(d.to, d.get, 'get')}</div>
      <p class="hint">${W.tradeTowers} ${them.bot ? 'ბოტი მხოლოდ მომგებიან გარიგებას ეთანხმება.' : ''}</p>
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
    const list = x => [...x.p.map(i => `<span class="pick on static" style="--g:${BOARD[i].k === 'p' ? GROUPS[BOARD[i].g].c : '#8a6a4f'}">${esc(BOARD[i].n)}<small>${BOARD[i].p}${st.own[i] && st.own[i].m ? ' · დაგირ.' : ''}</small></span>`), x.c ? `<span class="pick static money-p">${coin(x.c)}</span>` : '', x.f ? `<span class="pick static">${esc(W.feather)} ×${x.f}</span>` : ''].join('') || '<span class="hint">არაფერი</span>';
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
        'გახსენი „მამული" მთავარი ეკრანიდან: აპივით გაიხსნება, ბრაუზერის ზოლების გარეშე.'],
      mac: ['Safari-ს ზედა მენიუში აირჩიე <b class="en">File → Add to Dock…</b>',
        '„მამული" Dock-ში გამოჩნდება და ცალკე ფანჯარაში გაიხსნება.'],
      firefox: ['გახსენი ბრაუზერის მენიუ <b>⋮</b>', 'აირჩიე <b class="en">Install</b> ან <b class="en">Add to Home screen</b>', 'გახსენი „მამული" მთავარი ეკრანიდან.']
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
