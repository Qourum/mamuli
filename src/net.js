// ===== rooms =====
// A room is a Supabase Realtime channel named after its four-letter code (the same project as მეტეხი's online mode;
// the publishable key below is meant to be public: it can only join channels). The host's browser runs the game and
// sends the whole state to everyone after every change; the others send their moves to the host. Presence shows who
// is in the room. If the host disappears, the next player in seat order takes over with their copy of the state.
// "local" is a game on this device only (people taking turns and computer players), without any network.

const PROTO = 2;                 // 2: a move's steps are in 'steps' (in 1 they hid the event's number)
const ONLINE = {
  ws: 'wss://wnpqmcucnqcpcceqwega.supabase.co/realtime/v1',
  key: 'sb_publishable_DEGb_dkdj1s3QEJFrxc-Aw_apfCzfNx',
  abc: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
  gone: 10000,      // the host silent this long: the next player takes over
  away: 5000,       // a player missing from the room this long counts as away
  awayWait: 12000,  // on an away player's turn, wait this long before the computer plays for them
  tradeWait: 60000  // an offer nobody answers is declined after this long
};
const randCode = n => Array.from({ length: n }, () => ONLINE.abc[Math.floor(Math.random() * ONLINE.abc.length)]).join('');
const rndHost = () => { try { return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296; } catch (e) { return Math.random(); } };
const clone = o => JSON.parse(JSON.stringify(o));
const now = () => Date.now();

// ----- storage (it can be missing or throw: a private window, blocked site data) -----
const store = {
  get(k) { try { const v = localStorage.getItem('mamuli.' + k); return v == null ? null : JSON.parse(v); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('mamuli.' + k, JSON.stringify(v)); } catch (e) { } },
  del(k) { try { localStorage.removeItem('mamuli.' + k); } catch (e) { } }
};
function myPid() {
  const forced = /[?&]pid=([A-Za-z0-9]{3,12})/.exec(location.search);   // testing several players in one browser
  if (forced) return forced[1];
  let id = store.get('pid');
  if (!id || typeof id !== 'string') { id = randCode(10); store.set('pid', id); }
  return id;
}

// ----- the two ways to reach the others: Supabase Realtime, and BroadcastChannel (tabs of one browser, for testing) -----
function rtLib() {
  if (window.MetekhiRT) return Promise.resolve(window.MetekhiRT);
  return new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = 'rt.js?v=' + BUILD;
    s.async = true;
    s.onload = () => window.MetekhiRT ? ok(window.MetekhiRT) : no(new Error('rt'));
    s.onerror = () => no(new Error('rt'));
    document.head.appendChild(s);
  });
}
function supaNet() {
  let rt = null, ch = null, meta = null;
  return {
    async join(code, m, h) {
      meta = m;
      const RT = await rtLib();
      rt = new RT.RealtimeClient(ONLINE.ws, { params: { apikey: ONLINE.key, eventsPerSecond: 10 }, heartbeatIntervalMs: 15000 });
      const c = rt.channel('mamuli-' + code, { config: { broadcast: { self: false, ack: false }, presence: { key: m.pid } } });
      ch = c;
      c.on('broadcast', { event: 'm' }, msg => { if (ch === c) h.msg(msg && msg.payload); });
      c.on('presence', { event: 'sync' }, () => {
        if (ch !== c) return;
        const s = c.presenceState(), peers = {};
        for (const k in s) { const x = s[k] && s[k][0]; if (x) peers[k] = x; }
        h.peers(peers);
      });
      await new Promise((ok, no) => {
        let done = false;
        const t = setTimeout(() => { if (!done) { done = true; no(new Error('timeout')); } }, 12000);
        c.subscribe(s => {
          if (ch !== c) return;
          if (s === 'SUBSCRIBED') {
            c.track(meta).catch(() => { });              // again after every reconnection
            if (!done) { done = true; clearTimeout(t); ok(); }
            h.status(true);
          } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
            h.status(false);
            if (!done && s !== 'CLOSED') { done = true; clearTimeout(t); no(new Error(s)); }
          }
        });
      });
    },
    send(p) { if (ch) ch.send({ type: 'broadcast', event: 'm', payload: p }).catch(() => { }); },
    track(m) { meta = m; if (ch) ch.track(m).catch(() => { }); },
    leave() {
      const c = ch; ch = null;
      if (c) { try { c.untrack().catch(() => { }); } catch (e) { } try { rt.removeChannel(c); } catch (e) { } }
      try { if (rt) rt.disconnect(); } catch (e) { }
    }
  };
}
function bcNet() {
  let bc = null, meta = null, peers = {}, seen = {}, beat = null;
  return {
    async join(code, m, h) {
      meta = m;
      bc = new BroadcastChannel('mamuli-' + code);
      bc.onmessage = e => {
        const x = e.data;
        if (!x) return;
        if (x.__pres) { seen[x.__pres.pid] = now(); peers[x.__pres.pid] = x.__pres; return; }
        h.msg(x);
      };
      const tick = () => {
        if (!bc) return;
        bc.postMessage({ __pres: meta });
        const live = {};
        for (const k in peers) if (now() - seen[k] < 3500) live[k] = peers[k];
        live[meta.pid] = meta;
        peers = live;
        h.peers(Object.assign({}, live));
      };
      beat = setInterval(tick, 1000);
      tick();
      setTimeout(() => h.status(true), 30);
    },
    send(p) { if (bc) bc.postMessage(p); },
    track(m) { meta = m; },
    leave() { clearInterval(beat); if (bc) bc.close(); bc = null; }
  };
}

// ----- the session -----
let ROOM = null;
const isHost = () => ROOM && (ROOM.role === 'host' || ROOM.role === 'local');
function newRoom(mode, role, code) {
  return {
    mode, role, code, me: myPid(), st: null, net: null, peers: {}, up: false, err: '',
    hostPid: '', heardHost: 0, joinedAt: now(), aid: 0, seenAid: {}, sent: null, sentAt: 0,
    driveT: null, beatT: null, helloT: null, missing: {}, tradeAt: 0, tradeKey: '', awayAt: {}
  };
}
function meta() {
  const st = ROOM.st, s = st ? Engine.seatOf(st, ROOM.me) : -1, p = s >= 0 ? st.players[s] : null;
  return { pid: ROOM.me, name: p ? p.name : PROFILE.name, hero: p ? p.hero : PROFILE.hero, h: isHost() ? 1 : 0, v: PROTO };
}
function send(t, d, to) {
  if (!ROOM || !ROOM.net) return;
  ROOM.net.send({ t, d, f: ROOM.me, to });
}

// the host (or this device) changed the state: count it, keep a copy, tell everyone, show it, let the computer move
function commit() {
  const st = ROOM.st;
  st.seq++;
  if (ROOM.mode === 'online') {
    store.set('room.' + ROOM.code, { st, at: now() });
    send('st', { p: PROTO, st });
  } else store.set('local', { st, at: now() });
  View.show(st);
  drive();
}

// ----- starting a room -----
async function hostRoom() {
  leaveRoom(true);
  for (let tries = 0; tries < 3; tries++) {
    ROOM = newRoom('online', 'host', randCode(4));
    const st = Engine.newLobby(ROOM.me);
    Engine.lobbyJoin(st, ROOM.me, PROFILE.name, PROFILE.hero);
    ROOM.st = st;
    UI.go('lobby');
    Lobby.connecting();
    try { await connect(); } catch (e) { return fail(e && e.message === 'rt' ? 'site' : 'net'); }
    await wait(900);                                       // someone else already hosts a room with this code: another code
    if (!ROOM) return;
    if (!Object.values(ROOM.peers).some(p => p.h && p.pid !== ROOM.me)) break;
    leaveRoom(true);
  }
  if (!ROOM) return fail('net');
  setHash(ROOM.code);
  commit();
}
async function joinRoom(code) {
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 4) { UI.toast('ოთახის კოდი ოთხი ნიშანია'); return; }
  leaveRoom(true);
  ROOM = newRoom('online', 'guest', code);
  setHash(code);
  UI.go('lobby');
  Lobby.connecting();
  try { await connect(); } catch (e) { return fail(e && e.message === 'rt' ? 'site' : 'net'); }
  if (!ROOM) return;
  const t0 = now();
  const knock = () => {
    if (!ROOM || ROOM.role !== 'guest') return;
    if (ROOM.st) return;                                    // we are in
    const saved = store.get('room.' + ROOM.code);
    const hostHere = Object.values(ROOM.peers).some(p => p.h && p.pid !== ROOM.me);
    // nobody hosts it any more, but this device played in it: carry on from our copy
    if (!hostHere && now() - t0 > 4500 && saved && saved.st && Engine.seatOf(saved.st, ROOM.me) >= 0 && saved.st.phase !== 'over') return takeOver(saved.st);
    if (now() - t0 > 9500) return fail(hostHere ? 'net' : 'notfound');
    send('hello', { name: PROFILE.name, hero: PROFILE.hero, p: PROTO });
    ROOM.helloT = setTimeout(knock, 1500);
  };
  knock();
}
function playLocal(resume) {
  leaveRoom(true);
  ROOM = newRoom('local', 'local', '');
  if (resume) {
    const saved = store.get('local');
    if (saved && saved.st && saved.st.phase !== 'lobby') {
      ROOM.st = saved.st;
      UI.go('game');
      View.reset(ROOM.st);
      drive();
      return;
    }
  }
  const st = Engine.newLobby(ROOM.me);
  Engine.lobbyJoin(st, ROOM.me, PROFILE.name, PROFILE.hero);
  for (let i = 0; i < 2; i++) Engine.lobbyAct(st, ROOM.me, { t: 'addbot' }, rndHost);
  ROOM.st = st;
  UI.go('lobby');
  View.show(st);
}
async function connect() {
  const kind = /[?&]net=bc\b/.test(location.search) ? bcNet : supaNet;
  ROOM.net = kind();
  const room = ROOM;
  await ROOM.net.join(ROOM.code, meta(), {
    msg: m => { if (ROOM === room) onMsg(m); },
    peers: p => { if (ROOM === room) onPeers(p); },
    status: up => { if (ROOM === room) onStatus(up); }
  });
  ROOM.up = true;
  clearInterval(ROOM.beatT);
  ROOM.beatT = setInterval(() => beat(room), 2500);
}
function fail(why) {
  const msg = {
    site: 'ონლაინ ოთახები მხოლოდ თამაშის საიტზე მუშაობს',
    net: 'კავშირი ვერ დამყარდა. შეამოწმე ინტერნეტი და სცადე თავიდან.',
    notfound: 'ოთახი ვერ მოიძებნა. შეამოწმე კოდი.',
    full: 'ოთახი სავსეა.',
    started: 'ამ ოთახში თამაში უკვე დაიწყო.',
    version: 'თამაშის ვერსიები განსხვავდება. ყველამ განაახლეთ გვერდი.'
  }[why] || why;
  const code = ROOM && ROOM.role === 'guest' ? ROOM.code : '';
  leaveRoom(true);
  setHash('');
  UI.go('menu');
  if (code && (why === 'net' || why === 'notfound')) { const c = $('#codeIn'); if (c) c.value = code; }   // to try again with one tap
  UI.toast(msg, 4200);
}
function leaveRoom(quiet) {
  if (!ROOM) return;
  const r = ROOM;
  if (r.mode === 'online') {
    if (!quiet || r.st) send('bye', {});
    clearTimeout(r.helloT); clearInterval(r.beatT);
    if (r.net) r.net.leave();
  }
  clearTimeout(r.driveT);
  ROOM = null;
  View.clear();
}
const wait = ms => new Promise(r => setTimeout(r, ms));
// the room stays in the address (…#join=ABCD): a reload goes back into it, and the address itself is the invitation
function setHash(code) {
  try { history.replaceState(null, '', location.pathname + location.search + (code ? '#join=' + code : '')); } catch (e) { }
}

// ----- messages -----
function onMsg(m) {
  if (!m || typeof m !== 'object' || typeof m.t !== 'string' || typeof m.f !== 'string' || m.f === ROOM.me) return;
  if (m.to && m.to !== ROOM.me) return;
  const d = m.d && typeof m.d === 'object' ? m.d : {};
  ROOM.missing[m.f] = 0;
  if (m.t === 'st') return gotState(m.f, d);
  if (ROOM.role === 'host') {
    const st = ROOM.st;
    if (m.t === 'hello') {
      if (d.p !== PROTO) return send('err', { code: 'version' }, m.f);
      const s = Engine.lobbyJoin(st, m.f, d.name, d.hero);
      if (s === -2) return send('err', { code: 'full' }, m.f);
      if (s >= 0 || st.phase === 'lobby') return commit();
      return send('st', { p: PROTO, st }, m.f);            // a watcher
    }
    if (m.t === 'a') {
      const id = d.id | 0;
      if (ROOM.seenAid[m.f] && ROOM.seenAid[m.f] >= id) return send('st', { p: PROTO, st }, m.f);   // a repeat: it already happened
      ROOM.seenAid[m.f] = id;
      const err = applyMove(m.f, d.a);
      if (err) send('err', { code: err, id }, m.f);
      return;
    }
    if (m.t === 'bye') { markAway(m.f, true); return; }
    return;
  }
  // a guest
  if (m.t === 'err') { UI.moveRefused(d.code); if (d.code === 'version' || d.code === 'full') fail(d.code); return; }
  if (m.t === 'bye' && m.f === ROOM.hostPid) ROOM.heardHost = 0;
}
// whoever sends a newer state is the host (a takeover raises the term)
function gotState(from, d) {
  if (d.p !== PROTO) return fail('version');
  const st = d.st;
  if (!st || typeof st !== 'object' || !Array.isArray(st.players)) return;
  const cur = ROOM.st;
  if (cur && (st.term < cur.term || (st.term === cur.term && st.seq <= cur.seq))) {
    if (ROOM.role === 'host' && st.term === cur.term && from !== ROOM.me) send('st', { p: PROTO, st: cur });
    return;
  }
  if (ROOM.role === 'host' && st.term > (cur ? cur.term : -1)) { ROOM.role = 'guest'; clearTimeout(ROOM.driveT); }   // someone else took over
  if (ROOM.role !== 'guest') return;
  clearTimeout(ROOM.helloT);
  ROOM.st = st;
  ROOM.hostPid = from;
  ROOM.heardHost = now();
  ROOM.sent = null;
  store.set('room.' + ROOM.code, { st, at: now() });
  if (ROOM.net) ROOM.net.track(meta());
  if (st.phase === 'lobby') UI.go('lobby'); else UI.go('game');
  View.show(st);
}
// a move from this device: the host applies it at once, a guest sends it
function move(a) {
  if (!ROOM || !ROOM.st) return;
  View.busy(true);                     // the buttons stay off until the screen has caught up with the move
  if (isHost()) {
    const err = applyMove(ROOM.role === 'local' ? actorPid(a) : ROOM.me, a);
    if (err) UI.moveRefused(err);
    return;
  }
  const id = ++ROOM.aid;
  ROOM.sent = { id, a }; ROOM.sentAt = now();
  send('a', { id, a }, ROOM.hostPid || undefined);
}
// on this device several people may play: a move belongs to whoever has to make it
function actorPid(a) {
  const st = ROOM.st;
  if (st.phase === 'lobby') return ROOM.me;
  if (st.trade && (a.t === 'accept' || a.t === 'decline')) return st.players[st.trade.to].pid;
  if (a.seat != null && st.players[a.seat]) return st.players[a.seat].pid;
  return st.players[st.turn].pid;
}
function applyMove(pid, a) {
  const st = ROOM.st;
  if (!a || typeof a !== 'object') return 'bad';
  if (a.t === 'stop') { if (pid !== st.host && ROOM.role !== 'local') return 'host'; Engine.stop(st); commit(); return ''; }
  if (st.phase === 'lobby') {
    if (a.t === 'leave') { const s = Engine.seatOf(st, pid); if (s >= 0 && pid !== st.host) { st.players.splice(s, 1); commit(); } return ''; }
    if (a.t === 'addlocal' && ROOM.role === 'local') {
      if (st.players.length >= MAX_PLAYERS) return 'full';
      Engine.lobbyJoin(st, 'local-' + randCode(6), '', null);
      const p = st.players[st.players.length - 1];
      p.name = HEROES[p.hero].s;
      commit(); return '';
    }
    if (a.t === 'start') {
      const err = Engine.lobbyAct(st, st.host, a, rndHost);
      if (!err) { st.players.forEach(p => { p.away = false; }); commit(); }
      return err;
    }
    const by = ROOM.role === 'local' && a.seat != null && st.players[a.seat] && a.t !== 'addbot' && a.t !== 'cfg' && a.t !== 'kick' ? st.players[a.seat].pid : pid;
    const err = Engine.lobbyAct(st, by, a, rndHost);
    if (!err) commit();
    return err;
  }
  const seat = Engine.seatOf(st, pid);
  if (seat < 0) return 'watch';
  const err = Engine.act(st, seat, a, rndHost);
  if (!err) commit();
  return err;
}

// ----- who is here -----
function onPeers(peers) {
  ROOM.peers = peers;
  const st = ROOM.st;
  if (ROOM.role === 'guest' && ROOM.hostPid && peers[ROOM.hostPid]) ROOM.heardHost = now();
  if (ROOM.role === 'host' && st) {
    for (const p of st.players) if (!p.bot && p.pid !== ROOM.me) {
      if (peers[p.pid]) { ROOM.missing[p.pid] = 0; if (p.away) markAway(p.pid, false); }
      else if (!ROOM.missing[p.pid]) ROOM.missing[p.pid] = now();
    }
  }
  View.peers();
}
function onStatus(up) {
  ROOM.up = up;
  if (up && ROOM.role === 'host' && ROOM.st) send('st', { p: PROTO, st: ROOM.st });
  if (up && ROOM.role === 'guest' && ROOM.st) send('hello', { name: PROFILE.name, hero: PROFILE.hero, p: PROTO }, ROOM.hostPid || undefined);
  View.peers();
}
function markAway(pid, away) {
  const st = ROOM.st, s = Engine.seatOf(st, pid);
  if (s < 0 || st.players[s].bot || st.players[s].away === away) return;
  if (st.phase === 'lobby' && away) { if (pid !== st.host) { st.players.splice(s, 1); commit(); } return; }   // left the lobby
  st.players[s].away = away;
  ROOM.awayAt[pid] = away ? now() : 0;
  commit();
}
// every few seconds: notice players who left, a host who vanished, a move that got lost
function beat(room) {
  if (ROOM !== room || !ROOM.st) return;
  const st = ROOM.st, t = now();
  if (ROOM.role === 'host') {
    for (const pid in ROOM.missing) if (ROOM.missing[pid] && t - ROOM.missing[pid] > ONLINE.away && !ROOM.peers[pid]) markAway(pid, true);
    if (t - (ROOM.lastSync || 0) > 8000) { ROOM.lastSync = t; send('st', { p: PROTO, st }); }
    drive();
    return;
  }
  if (ROOM.sent && t - ROOM.sentAt > 3000) { send('a', ROOM.sent, ROOM.hostPid || undefined); ROOM.sentAt = t; }   // no answer: once more (the host ignores repeats)
  if (!ROOM.peers[ROOM.hostPid] && t - ROOM.heardHost > ONLINE.gone) maybeTakeOver();
}
// the host is gone: the first player in seat order who is still here carries on
function maybeTakeOver() {
  const st = ROOM.st;
  if (!st || st.phase === 'over') return;
  const next = st.players.find(p => !p.bot && !p.out && p.pid !== st.host && (p.pid === ROOM.me || ROOM.peers[p.pid]));
  if (next && next.pid === ROOM.me) takeOver(st);
}
function takeOver(st) {
  st = clone(st);
  const old = Engine.seatOf(st, st.host);
  if (old >= 0) { st.players[old].away = true; if (st.phase === 'lobby') st.players.splice(old, 1); }
  st.host = ROOM.me;
  st.term++;
  ROOM.role = 'host';
  ROOM.st = st;
  ROOM.hostPid = ROOM.me;
  clearTimeout(ROOM.helloT);
  if (ROOM.net) ROOM.net.track(meta());
  UI.go(st.phase === 'lobby' ? 'lobby' : 'game');
  UI.toast('მასპინძელი წავიდა. ოთახს ახლა შენი ტელეფონი ატარებს.', 3600);
  commit();
}

// ----- the computer players, and players who are away -----
// A computer player waits until the screen has shown everything that happened, then a moment more (so one can see where it
// landed before it buys, say), and only then makes its move. The others' phones play the same things at the same time.
const BEAT = { roll: 550, buy: 700, skip: 700, end: 300, build: 450, sell: 450, mort: 450, unmort: 450, offer: 700, accept: 900, decline: 900, cancel: 500 };
function drive() {
  if (!ROOM || !isHost()) return;
  clearTimeout(ROOM.driveT);
  const st = ROOM.st;
  if (!st || st.phase === 'lobby' || st.phase === 'over') return;
  const seat = st.trade ? st.trade.to : st.turn, p = st.players[seat];
  if (!p) return;
  const key = st.trade ? st.tn + ':' + st.trade.from + '>' + st.trade.to : '';
  if (key !== ROOM.tradeKey) { ROOM.tradeKey = key; ROOM.tradeAt = now(); }
  const away = !p.bot && p.away && ROOM.mode === 'online', computer = p.bot || away;
  let until;                                                                      // not before this time
  if (p.bot) until = now();
  else if (away) until = Math.max(now() + 900, (ROOM.awayAt[p.pid] || 0) + ONLINE.awayWait);
  else if (st.trade) until = Math.max(now() + 500, ROOM.tradeAt + ONLINE.tradeWait);   // a person who does not answer an offer
  else return;                                                                    // a person's turn: wait for them
  const room = ROOM, plan = computer ? Engine.botMove(st, seat, away) : null;
  const beat = plan ? BEAT[plan.t] || 650 : 0;
  const go = () => {
    if (ROOM !== room || ROOM.st !== st) return;
    const left = Math.max(until - now(), computer ? beat - View.idleFor() : 0);
    if (left > 0) { ROOM.driveT = setTimeout(go, computer ? Math.min(left, 300) : left); return; }   // the screen is checked often
    const a = computer ? Engine.botMove(st, seat, away) : (st.trade && st.trade.to === seat ? { t: 'decline' } : null);
    if (!a) return;
    if (!Engine.act(st, seat, a, rndHost)) commit();
  };
  ROOM.driveT = setTimeout(go, 40);
}

// the page went to the background and came back: make sure we are still in the room
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !ROOM || ROOM.mode !== 'online' || !ROOM.net) return;
  if (ROOM.role === 'guest') send('hello', { name: PROFILE.name, hero: PROFILE.hero, p: PROTO }, ROOM.hostPid || undefined);
  else if (ROOM.st) send('st', { p: PROTO, st: ROOM.st });
});
window.addEventListener('pagehide', () => { if (ROOM && ROOM.mode === 'online') send('bye', {}); });
