// ===== the rules =====
// The whole game is one plain object (the state). act() checks that a move is allowed, changes the state and adds
// events (what happened, for the screens to animate and for the log). Only the host's browser runs it; everyone else
// receives copies of the state. Everything here is deterministic given the random function passed in.

const Engine = (() => {
  // the room's theme gives the cards (and the chest's questions); the feather card's place in a deck (-1: it has none)
  const deckOf = st => themeOf(st).deck;
  const featherOf = (st, d) => deckOf(st)[d].findIndex(c => c.k === 'feather');

  function mulberry(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(a, rnd) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // ----- the lobby -----
  function newLobby(hostPid) {
    return {
      v: 1, term: 0, seq: 0, phase: 'lobby', host: hostPid, theme: 'mamuli',
      cfg: { mode: 'rounds', rounds: 30 },
      players: [], own: BOARD.map(() => null), turn: 0, round: 1,
      dice: [3, 4], rolls: 0, again: false, pend: null, trade: null, auc: null, dseed: 0,
      decks: { s: [], c: [] }, qd: [], quiz: null, ev: [], evn: 0, winner: -1, tn: 0, offered: -1, memo: []
    };
  }
  const seatOf = (st, pid) => st.players.findIndex(p => p.pid === pid);
  const cleanName = s => String(s == null ? '' : s).replace(/[\u0000-\u001f<>&"]/g, '').trim().slice(0, 16);
  const themeKey = st => THEMES[st && st.theme] ? st.theme : 'mamuli';
  const freeHero = (st, pref) => {
    const keys = heroKeys(themeKey(st)), used = new Set(st.players.map(p => p.hero));
    if (pref && keys.includes(pref) && !used.has(pref)) return pref;
    return keys.find(h => !used.has(h)) || keys[0];
  };
  // the hero a player would like in each theme (an older page sends just one name)
  function cleanPrefs(x) {
    const out = {};
    if (typeof x === 'string') { if (HEROES[x]) out[HEROES[x].t] = x; return out; }
    if (x && typeof x === 'object') for (const k in THEMES) if (typeof x[k] === 'string' && HEROES[x[k]] && HEROES[x[k]].t === k) out[k] = x[k];
    return out;
  }
  function newPlayer(pid, name, hero, bot, pref) {
    return { pid, name, hero, pref: pref || {}, bot: !!bot, cash: START_CASH, pos: 0, jail: false, jt: 0, fe: [], out: false, outAt: 0, dbl: 0, away: false };
  }
  // someone knocks: a newcomer gets a seat while there is one; a returning player is simply back
  function lobbyJoin(st, pid, name, hero) {
    const s = seatOf(st, pid);
    if (s >= 0) { st.players[s].away = false; return s; }
    if (st.phase !== 'lobby') return -1;                 // the game is on: watchers only
    if (st.players.length >= MAX_PLAYERS) return -2;
    const pref = cleanPrefs(hero), h = freeHero(st, pref[themeKey(st)]);
    st.players.push(newPlayer(pid, cleanName(name) || HEROES[h].s, h, false, pref));
    return st.players.length - 1;
  }
  // a player who is called after their hero takes the new hero's name too
  function setHero(p, h) {
    const auto = !HEROES[p.hero] || p.name === HEROES[p.hero].s;
    p.hero = h;
    if (auto) p.name = HEROES[h].s;
  }
  function lobbyAct(st, pid, a, rnd) {
    if (st.phase !== 'lobby') return 'started';
    const s = seatOf(st, pid), host = pid === st.host;
    switch (a && a.t) {
      case 'hero': {
        if (s < 0 || !HEROES[a.h] || HEROES[a.h].t !== themeKey(st)) return 'bad';
        if (st.players.some((p, i) => i !== s && p.hero === a.h)) return 'taken';
        const p = st.players[s];
        setHero(p, a.h);
        p.pref = Object.assign({}, p.pref, { [themeKey(st)]: a.h });
        return '';
      }
      // the host picks the world: everyone gets a hero of it, the one they had there before if it is free
      case 'theme': {
        if (!host) return 'host';
        const k = THEMES[a.k] ? a.k : 'mamuli', was = themeKey(st);
        if (k === was) return '';
        st.theme = k;
        const keys = heroKeys(k), used = new Set(), next = st.players.map(() => null);
        st.players.forEach(p => { p.pref = Object.assign({}, p.pref, { [was]: p.hero }); });
        st.players.forEach((p, i) => { const w = p.pref[k]; if (w && keys.includes(w) && !used.has(w)) { next[i] = w; used.add(w); } });
        st.players.forEach((p, i) => { if (!next[i]) { next[i] = keys.find(h => !used.has(h)) || keys[0]; used.add(next[i]); } });
        st.players.forEach((p, i) => setHero(p, next[i]));
        return '';
      }
      case 'name': if (s < 0) return 'bad'; st.players[s].name = cleanName(a.n) || HEROES[st.players[s].hero].s; return '';
      case 'addbot': {
        if (!host) return 'host';
        if (st.players.length >= MAX_PLAYERS) return 'full';
        const h = freeHero(st, null);
        st.players.push(newPlayer('bot-' + Math.floor(rnd() * 1e9).toString(36), HEROES[h].s, h, true, {}));
        return '';
      }
      case 'kick': {
        const k = a.s | 0, p = st.players[k];
        if (!p) return 'bad';
        if (!(host || p.pid === pid) || p.pid === st.host) return 'host';   // the host cannot be removed; anyone can leave
        st.players.splice(k, 1); return '';
      }
      case 'cfg': {
        if (!host) return 'host';
        const mode = a.mode === 'full' ? 'full' : 'rounds';
        const rounds = [20, 30, 40].includes(a.rounds | 0) ? a.rounds | 0 : 30;
        st.cfg = { mode, rounds }; return '';
      }
      case 'start': {
        if (!host) return 'host';
        if (st.players.length < 2) return 'few';
        start(st, rnd); return '';
      }
    }
    return 'bad';
  }
  function start(st, rnd) {
    shuffle(st.players, rnd);                            // who goes first is decided by lot
    for (const p of st.players) Object.assign(p, { cash: START_CASH, pos: 0, jail: false, jt: 0, fe: [], out: false, outAt: 0, dbl: 0 });
    st.own = BOARD.map(() => null);
    const deck = deckOf(st), quiz = themeOf(st).quiz;
    st.decks = { s: shuffle(deck.s.map((_, i) => i), rnd), c: shuffle(deck.c.map((_, i) => i), rnd) };
    st.qd = quiz ? shuffle(quiz.map((_, i) => i), rnd) : [];       // the chest's questions, in the order they come
    Object.assign(st, { turn: 0, round: 1, phase: 'roll', again: false, pend: null, trade: null, auc: null, quiz: null, winner: -1, rolls: 0, tn: 1, offered: -1, memo: [] });
    st.dseed = 1 + Math.floor(rnd() * 2147483646);       // every screen throws the dice the same way (see throwSeed)
    push(st, 'start', {});
    push(st, 'turn', { s: 0, r: 1 });
  }

  // The dice's throw (how they fly, bounce and come to rest) is worked out from a number every device can know ahead:
  // the game's seed and the count of rolls. So the dice tumble and land alike on every phone, and each phone can work
  // the next throw out before it is needed.
  function throwSeed(st, r) {
    if (!st || !st.dseed) return 0;
    return ((Math.imul(st.dseed ^ 0x5bd1e995, 0x27d4eb2d) ^ Math.imul((r | 0) + 1, 0x165667b1)) >>> 0) || 1;
  }

  // ----- small helpers -----
  function push(st, k, o) {
    st.evn++;
    st.ev.push(Object.assign({}, o, { n: st.evn, k }));
    if (st.ev.length > 90) st.ev.splice(0, st.ev.length - 90);
  }
  const activeSeats = st => st.players.map((p, i) => i).filter(i => !st.players[i].out);
  function groupOwner(st, g) {
    const ts = GROUP_TILES[g], o0 = st.own[ts[0]];
    if (!o0) return -1;
    for (const i of ts) { const o = st.own[i]; if (!o || o.o !== o0.o) return -1; }
    return o0.o;
  }
  const countOf = (st, seat, list) => list.reduce((n, i) => n + (st.own[i] && st.own[i].o === seat ? 1 : 0), 0);
  function rentAt(st, i, sum, mode) {
    const t = BOARD[i], o = st.own[i];
    if (!o || o.m) return 0;
    if (t.k === 'p') return o.lv > 0 ? t.rent[o.lv + 1] : t.rent[groupOwner(st, t.g) === o.o ? 1 : 0];
    if (t.k === 'road') return ROAD_RENT[countOf(st, o.o, ROADS)] * (mode === 'double' ? 2 : 1);
    if (t.k === 'util') return sum * (mode === 'ten' ? 10 : UTIL_MULT[countOf(st, o.o, UTILS)]);
    return 0;
  }
  const buildCost = i => GROUPS[BOARD[i].g].b;
  const mortValue = i => BOARD[i].p / 2;
  const unmortCost = i => Math.ceil(BOARD[i].p * 0.55);
  // why a tower cannot go up here ('' = it can)
  function buildBlock(st, seat, i) {
    const t = BOARD[i], o = st.own[i];
    if (!t || t.k !== 'p' || !o || o.o !== seat) return 'own';
    if (o.lv >= 5) return 'max';
    if (groupOwner(st, t.g) !== seat) return 'group';
    const ts = GROUP_TILES[t.g];
    if (ts.some(j => st.own[j].m)) return 'mort';
    if (o.lv !== Math.min(...ts.map(j => st.own[j].lv))) return 'even';
    if (st.players[seat].cash < buildCost(i)) return 'cash';
    return '';
  }
  function canSell(st, seat, i) {
    const t = BOARD[i], o = st.own[i];
    if (!t || t.k !== 'p' || !o || o.o !== seat || o.lv <= 0) return false;
    return o.lv === Math.max(...GROUP_TILES[t.g].map(j => st.own[j].lv));
  }
  function canMort(st, seat, i) {
    const t = BOARD[i], o = st.own[i];
    if (!o || o.o !== seat || o.m) return false;
    if (t.k === 'p' && GROUP_TILES[t.g].some(j => st.own[j] && st.own[j].lv > 0)) return false;
    return true;
  }
  // everything the player could still raise by selling towers and pawning
  function raiseMax(st, seat) {
    let n = 0;
    st.own.forEach((o, i) => { if (o && o.o === seat) { if (o.lv) n += o.lv * buildCost(i) / 2; if (!o.m) n += mortValue(i); } });
    return n;
  }
  function worth(st, seat) {
    const p = st.players[seat];
    if (!p || p.out) return 0;
    let w = p.cash;
    st.own.forEach((o, i) => { if (o && o.o === seat) { w += o.m ? BOARD[i].p / 2 : BOARD[i].p; if (o.lv) w += o.lv * buildCost(i); } });
    return w;
  }
  function nearest(pos, list) { for (const i of list) if (i > pos) return i; return list[0]; }

  // ----- money and movement -----
  function transfer(st, seat, to, a, why, i) {
    st.players[seat].cash -= a;
    if (to >= 0) st.players[to].cash += a;
    push(st, 'pay', { s: seat, to, a, why, i });
  }
  // pay now, or fall into debt (the player has to sell, pawn or go bankrupt). then = how the turn goes on once paid
  function charge(st, seat, a, to, then, why, i) {
    if (a <= 0) return true;
    if (st.players[seat].cash >= a) { transfer(st, seat, to, a, why, i); return true; }
    st.phase = 'debt';
    st.pend = { k: 'debt', a, to, then, why, i };
    push(st, 'debt', { s: seat, a, to, why, i });
    return false;
  }
  function salary(st, seat) { st.players[seat].cash += SALARY; push(st, 'salary', { s: seat, a: SALARY }); }
  function step(st, seat, n) {
    const p = st.players[seat], from = p.pos;
    p.pos = ((from + n) % 40 + 40) % 40;
    push(st, 'move', { s: seat, from, to: p.pos, steps: n });      // not 'n': that is the event's number
    if (n > 0 && from + n >= 40) salary(st, seat);
  }
  function goTo(st, seat, to) {
    const p = st.players[seat], from = p.pos, n = (to - from + 40) % 40;
    p.pos = to;
    push(st, 'move', { s: seat, from, to, steps: n, fly: true });
    if (n > 0 && from + n >= 40) salary(st, seat);
  }
  function toJail(st, seat, why) {
    const p = st.players[seat], from = p.pos;
    p.pos = JAIL; p.jail = true; p.jt = 0; p.dbl = 0; st.again = false;
    push(st, 'jail', { s: seat, from, why });
  }
  function release(st, seat, how) {
    const p = st.players[seat];
    p.jail = false; p.jt = 0;
    push(st, 'free', { s: seat, how });
  }

  // ----- landing on a square: true = done, false = the player has to decide something first (buy, debt) -----
  function land(st, seat, mode) {
    const p = st.players[seat], t = BOARD[p.pos];
    switch (t.k) {
      case 'p': case 'road': case 'util': {
        const o = st.own[p.pos];
        if (!o) { st.phase = 'buy'; st.pend = { k: 'buy', i: p.pos }; return false; }
        if (o.o === seat || o.m) return true;
        const a = rentAt(st, p.pos, st.dice[0] + st.dice[1], mode);
        return charge(st, seat, a, o.o, 'land', 'rent', p.pos);
      }
      case 'tax': return charge(st, seat, t.a, -1, 'land', 'tax', p.pos);
      case 'scroll': return card(st, seat, 's');
      case 'chest': return card(st, seat, 'c');
      case 'gojail': toJail(st, seat, 'tile'); return true;
    }
    return true;
  }
  function card(st, seat, deck) {
    const d = st.decks[deck], id = d.shift(), c = deckOf(st)[deck][id], p = st.players[seat];
    if (c.k !== 'feather') d.push(id);
    if (c.k === 'quiz') return ask(st, seat);
    push(st, 'card', { s: seat, d: deck, id });
    switch (c.k) {
      case 'cash':
        if (c.n > 0) { p.cash += c.n; push(st, 'gain', { s: seat, a: c.n }); return true; }
        return charge(st, seat, -c.n, -1, 'land', 'card');
      case 'move': goTo(st, seat, c.to); return land(st, seat);
      case 'back': step(st, seat, -c.n); return land(st, seat);
      case 'near': goTo(st, seat, nearest(p.pos, c.w === 'road' ? ROADS : UTILS)); return land(st, seat, c.w === 'road' ? 'double' : 'ten');
      case 'jail': toJail(st, seat, 'card'); return true;
      case 'feather': p.fe.push(deck); return true;
      case 'repair': {
        let towers = 0, forts = 0;
        st.own.forEach(o => { if (o && o.o === seat) { if (o.lv === 5) forts++; else towers += o.lv; } });
        return charge(st, seat, towers * c.a + forts * c.b, -1, 'land', 'repair');
      }
    }
    return true;
  }
  // ----- the treasure chest's question: everyone answers on their own phone; whoever knew it gets money, the one who
  // opened the chest most. A wrong answer costs nothing. The host's clock ends it when time is up (closeQuiz).
  function ask(st, seat) {
    const q = st.qd.shift();
    st.qd.push(q);
    st.phase = 'quiz'; st.pend = { k: 'quiz' };
    st.quiz = { q, s: seat, ans: {} };
    push(st, 'quiz', { s: seat, q });
    return false;
  }
  function endQuiz(st) {
    const Q = st.quiz;
    if (!Q) return;
    const right = themeOf(st).quiz[Q.q].c;
    st.quiz = null; st.pend = null;
    push(st, 'quizEnd', { s: Q.s, q: Q.q, c: right, ans: Object.assign({}, Q.ans) });
    for (const s of activeSeats(st)) {
      if (Q.ans[s] !== right) continue;
      const a = s === Q.s ? QUIZ_WIN : QUIZ_SHARE;
      st.players[s].cash += a;
      push(st, 'gain', { s, a, why: 'quiz' });
    }
    settle(st, st.turn);
  }
  function closeQuiz(st) { if (st.phase === 'quiz' && st.quiz) endQuiz(st); }
  // a computer player knows the answer a little more than half the time (worked out from the game, so it is the same
  // whenever it is asked)
  function botAnswer(st, seat) {
    const Q = st.quiz, right = themeOf(st).quiz[Q.q].c;
    const r = mulberry((st.dseed ^ Math.imul(Q.q + 1, 0x9e3779b1) ^ Math.imul(seat + 1, 0x85ebca6b) ^ Math.imul(st.rolls + 1, 0x27d4eb2d)) >>> 0)();
    return r < 0.6 ? right : (right + (r < 0.8 ? 1 : 2)) % 3;
  }
  // the move is over: doubles roll again, otherwise the player may still build or trade and then ends the turn
  function settle(st, seat) {
    const p = st.players[seat];
    st.pend = null;
    if (st.again && !p.jail && !p.out) st.phase = 'roll';
    else { st.phase = 'end'; st.again = false; }
  }
  // ----- the auction: a town the player did not buy goes to whoever offers most -----
  // Everyone still in the game may bid, the one who said no as well; a bid raises the last by at least BID_STEP and
  // cannot be more than the bidder has. The host ends it a few seconds after the last bid (hammer), or at once when
  // nobody else can or will bid.
  const BID_STEP = 10;
  function startAuction(st, seat, i) {
    st.phase = 'auction';
    st.pend = { k: 'auction', i };
    st.auc = { i, hi: 0, by: -1, n: 0, out: [], from: seat };
    push(st, 'auction', { s: seat, i });
    if (auctionDone(st)) endAuction(st);
  }
  const canStillBid = (st, s) => { const A = st.auc; return s !== A.by && !A.out.includes(s) && st.players[s].cash >= A.hi + BID_STEP; };
  const auctionDone = st => !activeSeats(st).some(s => canStillBid(st, s));
  function endAuction(st) {
    const A = st.auc;
    if (!A) return;
    st.auc = null; st.pend = null;
    const w = A.by >= 0 ? st.players[A.by] : null;
    if (w && !w.out && w.cash >= A.hi && !st.own[A.i]) {
      w.cash -= A.hi;
      st.own[A.i] = { o: A.by, lv: 0, m: false };
      push(st, 'won', { s: A.by, i: A.i, a: A.hi });
    } else push(st, 'unsold', { i: A.i });
    settle(st, st.turn);
  }
  // the host's clock: no new bid for a while
  function hammer(st) { if (st.phase === 'auction' && st.auc) endAuction(st); }

  function nextTurn(st) {
    const n = st.players.length;
    let i = st.turn, wrapped = false, guard = 0;
    do { i = (i + 1) % n; if (i === 0) wrapped = true; } while (st.players[i].out && ++guard < n);
    st.trade = null; st.pend = null; st.again = false; st.auc = null; st.quiz = null;
    if (wrapped) {
      st.round++;
      if (st.cfg.mode === 'rounds' && st.round > st.cfg.rounds) { st.round = st.cfg.rounds; return finish(st, 'rounds'); }
    }
    st.turn = i; st.tn++;
    st.players[i].dbl = 0;
    st.phase = 'roll';
    push(st, 'turn', { s: i, r: st.round });
  }
  function finish(st, why) {
    const alive = activeSeats(st).sort((a, b) => worth(st, b) - worth(st, a));
    st.winner = alive.length ? alive[0] : -1;
    st.phase = 'over'; st.pend = null; st.trade = null; st.auc = null; st.quiz = null;
    push(st, 'over', { s: st.winner, why });
  }
  // the order at the end: those still standing by worth, then the bankrupt, the last to fall first
  function ranking(st) {
    const alive = activeSeats(st).sort((a, b) => worth(st, b) - worth(st, a));
    const out = st.players.map((p, i) => i).filter(i => st.players[i].out).sort((a, b) => st.players[b].outAt - st.players[a].outAt);
    return alive.concat(out);
  }
  function bankrupt(st, seat, to) {
    const p = st.players[seat];
    let cash = p.cash;
    st.own.forEach((o, i) => { if (o && o.o === seat && o.lv) { cash += o.lv * buildCost(i) / 2; o.lv = 0; } });  // the towers go back to the bank for half
    if (to >= 0 && !st.players[to].out) {
      const c = st.players[to];
      c.cash += cash;
      st.own.forEach(o => { if (o && o.o === seat) o.o = to; });
      c.fe.push(...p.fe);
    } else {
      st.own.forEach((o, i) => { if (o && o.o === seat) st.own[i] = null; });
      for (const d of p.fe) st.decks[d].push(featherOf(st, d));
      to = -1;
    }
    p.cash = 0; p.fe = []; p.out = true; p.outAt = st.evn + 1; p.jail = false;
    if (st.trade && (st.trade.from === seat || st.trade.to === seat)) st.trade = null;
    st.pend = null;
    push(st, 'bankrupt', { s: seat, to });
    if (activeSeats(st).length <= 1) return finish(st, 'last');
    if (st.turn === seat) nextTurn(st);
  }

  // ----- trading -----
  function cleanSide(x) {
    if (!x || typeof x !== 'object') return null;
    const p = Array.isArray(x.p) ? x.p.map(Number).filter(i => Number.isInteger(i) && i >= 0 && i < 40) : [];
    return { p: [...new Set(p)], c: Math.max(0, Math.floor(+x.c || 0)), f: Math.max(0, Math.floor(+x.f || 0)) };
  }
  function tradeBlock(st, tr) {
    const A = st.players[tr.from], B = st.players[tr.to];
    if (!A || !B || A.out || B.out || tr.from === tr.to) return 'bad';
    const side = (x, seat) => {
      const pl = st.players[seat];
      if (x.c > pl.cash || x.f > pl.fe.length) return false;
      for (const i of x.p) {
        const o = st.own[i], t = BOARD[i];
        if (!o || o.o !== seat) return false;
        if (t.k === 'p' && GROUP_TILES[t.g].some(j => st.own[j] && st.own[j].lv > 0)) return false;
      }
      return true;
    };
    if (!side(tr.give, tr.from) || !side(tr.get, tr.to)) return 'bad';
    const empty = x => !x.p.length && !x.c && !x.f;
    if (empty(tr.give) && empty(tr.get)) return 'empty';
    return '';
  }
  function doTrade(st, tr) {
    const A = st.players[tr.from], B = st.players[tr.to];
    for (const i of tr.give.p) st.own[i].o = tr.to;
    for (const i of tr.get.p) st.own[i].o = tr.from;
    A.cash += tr.get.c - tr.give.c; B.cash += tr.give.c - tr.get.c;
    B.fe.push(...A.fe.splice(0, tr.give.f));
    A.fe.push(...B.fe.splice(0, tr.get.f));
    push(st, 'trade', { from: tr.from, to: tr.to, give: tr.give, get: tr.get });
  }

  // ----- what a player may do now (for the buttons) -----
  function legal(st, seat) {
    const L = {};
    const p = st.players[seat];
    if (!p || p.out || st.phase === 'lobby' || st.phase === 'over') return L;
    if (st.trade) {
      if (st.trade.to === seat) L.accept = L.decline = true;
      if (st.trade.from === seat) L.cancel = true;
    }
    if (st.phase === 'auction' && st.auc) {
      const A = st.auc;
      if (A.by === seat) L.lead = true;
      else if (!A.out.includes(seat)) { L.bid = p.cash >= A.hi + BID_STEP; L.pass = true; }
      return L;
    }
    if (st.phase === 'quiz' && st.quiz) { if (st.quiz.ans[seat] == null) L.answer = true; return L; }
    if (st.turn !== seat) return L;
    const ph = st.phase, free = !st.trade;
    if (ph === 'roll' && free) {
      L.roll = true;
      if (p.jail) { L.jailpay = p.cash >= JAIL_FINE; L.feather = p.fe.length > 0; }
    }
    if (ph === 'buy') { L.buy = p.cash >= BOARD[st.pend.i].p; L.skip = true; }
    if (ph === 'end' && free) L.end = true;
    if (ph === 'debt') { L.pay = p.cash >= st.pend.a; L.bankrupt = true; L.manage = true; L.cover = true; }
    if ((ph === 'roll' || ph === 'end') && free) { L.manage = true; L.build = true; L.trade = activeSeats(st).length > 1; }
    return L;
  }

  // ----- a move -----
  // returns '' when done, otherwise why not (the screen shows it)
  function act(st, seat, a, rnd) {
    const p = st.players[seat];
    if (!p || p.out) return 'out';
    if (!a || typeof a.t !== 'string') return 'bad';
    if (st.phase === 'over' || st.phase === 'lobby') return 'over';
    const mine = st.turn === seat, ph = st.phase, i = a.i | 0, o = st.own[i];
    switch (a.t) {
      case 'roll': {
        if (!mine || ph !== 'roll' || st.trade) return 'turn';
        const d = [1 + Math.floor(rnd() * 6), 1 + Math.floor(rnd() * 6)], dbl = d[0] === d[1], sum = d[0] + d[1];
        st.dice = d; st.rolls++;
        push(st, 'roll', { s: seat, d, w: throwSeed(st, st.rolls) });
        if (p.jail) {
          st.again = false;
          if (dbl) { release(st, seat, 'dbl'); step(st, seat, sum); if (land(st, seat)) settle(st, seat); }
          else if (++p.jt >= 3) {
            if (charge(st, seat, JAIL_FINE, -1, 'jail', 'fine')) { release(st, seat, 'fine'); step(st, seat, sum); if (land(st, seat)) settle(st, seat); }
          } else { st.phase = 'end'; push(st, 'stay', { s: seat, t: p.jt }); }
          return '';
        }
        if (dbl) {
          p.dbl++;
          if (p.dbl >= 3) { toJail(st, seat, 'dbl'); st.phase = 'end'; return ''; }
          st.again = true;
        } else st.again = false;
        step(st, seat, sum);
        if (land(st, seat)) settle(st, seat);
        return '';
      }
      case 'buy': {
        if (!mine || ph !== 'buy') return 'turn';
        const t = BOARD[st.pend.i];
        if (p.cash < t.p) return 'cash';
        p.cash -= t.p;
        st.own[t.i] = { o: seat, lv: 0, m: false };
        push(st, 'buy', { s: seat, i: t.i, a: t.p });
        settle(st, seat);
        return '';
      }
      case 'skip': {
        if (!mine || ph !== 'buy') return 'turn';
        const i2 = st.pend.i;
        push(st, 'skip', { s: seat, i: i2 });
        startAuction(st, seat, i2);
        return '';
      }
      case 'bid': {
        const A = st.auc;
        if (ph !== 'auction' || !A) return 'turn';
        if (A.out.includes(seat)) return 'passed';
        if (A.by === seat) return 'lead';
        // a computer player names its sum, a person raises by a step (whatever the bid is by the time it arrives)
        const amt = a.a != null ? Math.floor(+a.a) : A.hi + Math.max(BID_STEP, Math.floor(+a.inc || BID_STEP));
        if (!Number.isFinite(amt) || amt < A.hi + BID_STEP) return 'low';
        if (amt > p.cash) return 'cash';
        A.hi = amt; A.by = seat; A.n++;
        push(st, 'bid', { s: seat, a: amt, i: A.i });
        if (auctionDone(st)) endAuction(st);
        return '';
      }
      case 'pass': {
        const A = st.auc;
        if (ph !== 'auction' || !A) return 'turn';
        if (A.out.includes(seat)) return 'passed';
        if (A.by === seat) return 'lead';
        A.out.push(seat);
        push(st, 'pass', { s: seat, i: A.i });
        if (auctionDone(st)) endAuction(st);
        return '';
      }
      case 'answer': {
        const Q = st.quiz;
        if (ph !== 'quiz' || !Q) return 'turn';
        if (Q.ans[seat] != null) return 'answered';
        const c = Math.floor(+a.c);
        if (!(c >= 0 && c <= 2)) return 'bad';
        Q.ans[seat] = c;
        push(st, 'answer', { s: seat });
        if (activeSeats(st).every(s => Q.ans[s] != null)) endQuiz(st);
        return '';
      }
      case 'end': {
        if (!mine || ph !== 'end' || st.trade) return 'turn';
        nextTurn(st);
        return '';
      }
      case 'jailpay': {
        if (!mine || ph !== 'roll' || !p.jail || st.trade) return 'turn';
        if (p.cash < JAIL_FINE) return 'cash';
        transfer(st, seat, -1, JAIL_FINE, 'fine');
        release(st, seat, 'pay');
        return '';
      }
      case 'feather': {
        if (!mine || ph !== 'roll' || !p.jail || !p.fe.length || st.trade) return 'turn';
        const d = p.fe.shift();
        st.decks[d].push(featherOf(st, d));
        release(st, seat, 'feather');
        return '';
      }
      case 'build': {
        if (!mine || !(ph === 'roll' || ph === 'end') || st.trade) return 'turn';
        const why = buildBlock(st, seat, i);
        if (why) return why;
        p.cash -= buildCost(i); o.lv++;
        push(st, 'build', { s: seat, i, lv: o.lv });
        return '';
      }
      case 'sell': {
        if (!mine || !(ph === 'roll' || ph === 'end' || ph === 'debt') || st.trade) return 'turn';
        if (!canSell(st, seat, i)) return 'even';
        p.cash += buildCost(i) / 2; o.lv--;
        push(st, 'sell', { s: seat, i, lv: o.lv });
        return '';
      }
      case 'mort': {
        if (!mine || !(ph === 'roll' || ph === 'end' || ph === 'debt') || st.trade) return 'turn';
        if (!canMort(st, seat, i)) return 'mort';
        p.cash += mortValue(i); o.m = true;
        push(st, 'mort', { s: seat, i });
        return '';
      }
      case 'unmort': {
        if (!mine || !(ph === 'roll' || ph === 'end') || st.trade) return 'turn';
        if (!o || o.o !== seat || !o.m) return 'bad';
        if (p.cash < unmortCost(i)) return 'cash';
        p.cash -= unmortCost(i); o.m = false;
        push(st, 'unmort', { s: seat, i });
        return '';
      }
      case 'pay': {
        if (!mine || ph !== 'debt') return 'turn';
        const pd = st.pend;
        if (p.cash < pd.a) return 'cash';
        transfer(st, seat, pd.to, pd.a, pd.why, pd.i);
        st.pend = null;
        if (pd.then === 'jail') { release(st, seat, 'fine'); step(st, seat, st.dice[0] + st.dice[1]); if (land(st, seat)) settle(st, seat); }
        else settle(st, seat);
        return '';
      }
      case 'bankrupt': {
        if (!mine || ph !== 'debt') return 'turn';
        bankrupt(st, seat, st.pend.to);
        return '';
      }
      case 'cover': {   // a debt paid the easy way: towers sold and towns pawned, those that matter least first
        if (!mine || ph !== 'debt') return 'turn';
        for (let guard = 0; p.cash < st.pend.a && guard < 80; guard++) {
          const m = botRaise(st, seat);
          if (!m || act(st, seat, m, rnd)) break;
        }
        if (p.cash >= st.pend.a) return act(st, seat, { t: 'pay' }, rnd);
        bankrupt(st, seat, st.pend.to);
        return '';
      }
      case 'offer': {
        if (!mine || !(ph === 'roll' || ph === 'end') || st.trade) return 'turn';
        const tr = { from: seat, to: a.to | 0, give: cleanSide(a.give), get: cleanSide(a.get) };
        if (!tr.give || !tr.get) return 'bad';
        const why = tradeBlock(st, tr);
        if (why) return why;
        st.trade = tr; st.offered = st.tn;
        push(st, 'offer', { from: tr.from, to: tr.to });
        return '';
      }
      case 'accept': {
        const tr = st.trade;
        if (!tr || tr.to !== seat) return 'bad';
        st.trade = null;
        if (tradeBlock(st, tr)) { push(st, 'decline', { from: tr.from, to: tr.to, stale: true }); return 'stale'; }
        doTrade(st, tr);
        return '';
      }
      case 'decline': {
        const tr = st.trade;
        if (!tr || tr.to !== seat) return 'bad';
        st.trade = null;
        st.memo.push({ from: tr.from, to: tr.to, k: tr.get.p.concat(tr.give.p).sort((x, y) => x - y).join(','), r: st.round });
        if (st.memo.length > 30) st.memo.splice(0, st.memo.length - 30);
        push(st, 'decline', { from: tr.from, to: tr.to });
        return '';
      }
      case 'cancel': {
        const tr = st.trade;
        if (!tr || tr.from !== seat) return 'bad';
        st.trade = null;
        push(st, 'cancel', { from: tr.from, to: tr.to });
        return '';
      }
    }
    return 'bad';
  }

  // ----- the computer players (and anyone away for too long) -----
  function maxRentAgainst(st, seat) {
    let m = 0;
    st.own.forEach((o, i) => { if (o && o.o !== seat && !o.m) m = Math.max(m, rentAt(st, i, 7)); });
    return m;
  }
  const reserveFor = (st, seat) => Math.min(600, Math.max(100, 60 + 0.4 * maxRentAgainst(st, seat)));
  const unowned = st => BOARD.reduce((n, t, i) => n + (OWNABLE(t) && !st.own[i] ? 1 : 0), 0);
  function wants(st, seat, i, reserve) {
    const t = BOARD[i], p = st.players[seat];
    if (p.cash < t.p) return false;
    if (p.cash - t.p >= reserve) return true;
    if (t.k === 'p') {
      const others = GROUP_TILES[t.g].filter(j => j !== i);
      const mine = others.filter(j => st.own[j] && st.own[j].o === seat).length;
      const owners = new Set(others.filter(j => st.own[j]).map(j => st.own[j].o));
      if (mine === others.length) return p.cash - t.p >= 40;                       // finishes my region
      if (owners.size === 1 && !owners.has(seat) && others.every(j => st.own[j])) return p.cash - t.p >= 60;  // stops someone else's
    }
    if (t.k === 'road' && countOf(st, seat, ROADS) >= 2) return p.cash - t.p >= 60;
    return false;
  }
  function botBuild(st, seat, reserve) {
    const p = st.players[seat];
    let best = null, bestGain = 0;
    for (let i = 0; i < 40; i++) {
      if (buildBlock(st, seat, i)) continue;
      const cost = buildCost(i);
      if (p.cash - cost < reserve) continue;
      const t = BOARD[i], lv = st.own[i].lv, gain = (t.rent[lv + 2] - t.rent[lv ? lv + 1 : 1]) / cost;
      if (gain > bestGain) { bestGain = gain; best = i; }
    }
    return best == null ? null : { t: 'build', i: best };
  }
  function botUnmort(st, seat, reserve) {
    const p = st.players[seat];
    for (let i = 0; i < 40; i++) {
      const o = st.own[i];
      if (o && o.o === seat && o.m && p.cash - unmortCost(i) >= reserve + 150) return { t: 'unmort', i };
    }
    return null;
  }
  // find money for a debt: the towers that bring least first, then pawn what matters least
  function botRaise(st, seat) {
    let sell = null, sellRent = Infinity;
    for (let i = 0; i < 40; i++) if (canSell(st, seat, i)) { const r = BOARD[i].rent[st.own[i].lv + 1]; if (r < sellRent) { sellRent = r; sell = i; } }
    if (sell != null) return { t: 'sell', i: sell };
    let mort = null, score = Infinity;
    for (let i = 0; i < 40; i++) {
      if (!canMort(st, seat, i)) continue;
      const t = BOARD[i];
      let s = t.p;
      if (t.k === 'p' && groupOwner(st, t.g) === seat) s += 1000;
      if (t.k === 'road') s += 60 * countOf(st, seat, ROADS);
      if (s < score) { score = s; mort = i; }
    }
    return mort == null ? null : { t: 'mort', i: mort };
  }
  function valueFor(st, seat, i, extra) {
    const t = BOARD[i], o = st.own[i];
    let v = t.p * (o && o.m ? 0.5 : 1);
    if (t.k === 'p') {
      const others = GROUP_TILES[t.g].filter(j => j !== i);
      const have = others.filter(j => (st.own[j] && st.own[j].o === seat) || (extra && extra.includes(j))).length;
      if (have === others.length) v += t.p * 1.6;
      else if (have) v += t.p * 0.3;
    }
    if (t.k === 'road') v += 40 * countOf(st, seat, ROADS);
    return v;
  }
  // does this hand over the last town of a region to the other side?
  function completesFor(st, seat, i, also) {
    const t = BOARD[i];
    if (t.k !== 'p') return false;
    return GROUP_TILES[t.g].filter(j => j !== i).every(j => (st.own[j] && st.own[j].o === seat) || (also && also.includes(j)));
  }
  function likes(st, seat, tr) {
    const p = st.players[seat], inP = tr.give, outP = tr.get;      // the bot receives give, hands over get
    if (outP.c > p.cash) return false;
    let gain = inP.c + 40 * inP.f, loss = outP.c + 40 * outP.f;
    for (const i of inP.p) gain += valueFor(st, seat, i, inP.p);
    for (const i of outP.p) {
      loss += valueFor(st, seat, i);
      if (completesFor(st, tr.from, i, outP.p)) loss += BOARD[i].p * 1.6;  // the other side gets a whole region
    }
    return gain >= loss * 1.05 + 10;
  }
  const noTowers = g => st => GROUP_TILES[g].every(j => !st.own[j] || st.own[j].lv === 0);
  const refused = (st, from, to, key) => st.memo.some(m => m.from === from && m.to === to && m.k === key && st.round - m.r < 6);
  // a computer player that misses one town of a region asks its holder for it: a swap when it can finish a region for
  // them too, otherwise money
  function botOffer(st, seat, reserve) {
    const p = st.players[seat];
    for (let g = 0; g < GROUPS.length; g++) {
      const ts = GROUP_TILES[g], mine = ts.filter(i => st.own[i] && st.own[i].o === seat);
      if (mine.length !== ts.length - 1) continue;
      const miss = ts.find(i => !mine.includes(i)), o = st.own[miss];
      if (!o || st.players[o.o].out || !noTowers(g)(st)) continue;
      const x = o.o;
      let swap = null;
      for (let g2 = 0; g2 < GROUPS.length && swap == null; g2++) {
        if (g2 === g || !noTowers(g2)(st)) continue;
        const ts2 = GROUP_TILES[g2], theirs = ts2.filter(i => st.own[i] && st.own[i].o === x);
        if (theirs.length !== ts2.length - 1) continue;
        const m2 = ts2.find(i => !theirs.includes(i));
        if (st.own[m2] && st.own[m2].o === seat) swap = m2;
      }
      if (swap != null) {
        const sweet = Math.max(0, Math.round((BOARD[miss].p - BOARD[swap].p + 50) / 10) * 10);
        const key = [miss, swap].sort((a, b) => a - b).join(',');
        if (!refused(st, seat, x, key) && p.cash - sweet >= reserve / 2) return { t: 'offer', to: x, give: { p: [swap], c: sweet, f: 0 }, get: { p: [miss], c: 0, f: 0 } };
      }
      const bid = Math.round(BOARD[miss].p * 2.8 / 10) * 10;
      if (!refused(st, seat, x, String(miss)) && p.cash - bid >= reserve) return { t: 'offer', to: x, give: { p: [], c: bid, f: 0 }, get: { p: [miss], c: 0, f: 0 } };
    }
    return null;
  }
  // what a town is worth to a computer player at an auction: a bargain is welcome, a town that finishes its region (or
  // would finish someone else's) is worth more; it keeps some money back
  function auctionValue(st, seat, i) {
    const t = BOARD[i], p = st.players[seat], reserve = reserveFor(st, seat);
    let v = t.p * 0.75;
    if (t.k === 'p') {
      const others = GROUP_TILES[t.g].filter(j => j !== i);
      const mine = others.filter(j => st.own[j] && st.own[j].o === seat).length;
      const owners = new Set(others.filter(j => st.own[j]).map(j => st.own[j].o));
      if (mine === others.length) v = t.p * 1.7;
      else if (owners.size === 1 && !owners.has(seat) && others.every(j => st.own[j])) v = t.p * 1.25;
      else if (mine) v = t.p;
    } else if (t.k === 'road') v = t.p * (0.75 + 0.2 * countOf(st, seat, ROADS));
    return Math.floor(Math.min(v, p.cash - reserve * 0.5) / BID_STEP) * BID_STEP;
  }
  // the next thing a computer player does, or null when it has nothing to do now (also while it waits for an answer)
  function botMove(st, seat, cautious) {
    const p = st.players[seat];
    if (!p || p.out || st.phase === 'over' || st.phase === 'lobby') return null;
    if (st.phase === 'auction' && st.auc) {
      const A = st.auc;
      if (A.out.includes(seat) || A.by === seat) return null;
      if (cautious) return { t: 'pass' };
      const max = auctionValue(st, seat, A.i);
      if (A.hi + BID_STEP > max || A.hi + BID_STEP > p.cash) return { t: 'pass' };
      const gap = max - A.hi;
      const inc = A.hi === 0 ? Math.max(BID_STEP, Math.floor(max * 0.45 / BID_STEP) * BID_STEP) : gap > 160 ? 50 : gap > 60 ? 20 : BID_STEP;
      return { t: 'bid', a: Math.min(max, A.hi + inc) };
    }
    if (st.phase === 'quiz' && st.quiz) return st.quiz.ans[seat] != null || cautious ? null : { t: 'answer', c: botAnswer(st, seat) };
    if (st.trade && st.trade.to === seat) return { t: !cautious && likes(st, seat, st.trade) ? 'accept' : 'decline' };
    if (st.trade && st.trade.from === seat) return cautious ? { t: 'cancel' } : null;
    if (st.turn !== seat || st.trade) return null;
    const ph = st.phase, reserve = reserveFor(st, seat);
    if (ph === 'debt') { if (p.cash >= st.pend.a) return { t: 'pay' }; return botRaise(st, seat) || { t: 'bankrupt' }; }
    if (ph === 'buy') return { t: wants(st, seat, st.pend.i, reserve) ? 'buy' : 'skip' };
    if (ph === 'roll' || ph === 'end') {
      if (!cautious && st.offered !== st.tn) { const o = botOffer(st, seat, reserve); if (o) return o; }
      const b = botBuild(st, seat, reserve); if (b) return b;
      const u = botUnmort(st, seat, reserve); if (u) return u;
      if (ph === 'roll') {
        if (p.jail) {
          const early = unowned(st) > 8;
          if (early && p.fe.length) return { t: 'feather' };
          if (early && p.cash >= JAIL_FINE + reserve) return { t: 'jailpay' };
        }
        return { t: 'roll' };
      }
      return { t: 'end' };
    }
    return null;
  }

  // the host ends the game early: whoever is worth most wins
  function stop(st) { if (st.phase !== 'lobby' && st.phase !== 'over') finish(st, 'stop'); }

  return {
    mulberry, newLobby, lobbyJoin, lobbyAct, seatOf, cleanName, act, legal, botMove, stop, hammer, closeQuiz, throwSeed, BID_STEP,
    rentAt, buildBlock, canSell, canMort, buildCost, mortValue, unmortCost, raiseMax, worth, ranking,
    groupOwner, countOf, tradeBlock, cleanSide, activeSeats, featherOf, deckOf, themeKey
  };
})();

if (typeof module !== 'undefined') module.exports = Engine;
