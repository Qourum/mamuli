// Plays many whole games between computer players and checks the rules' invariants after every move.
// node tests/sim.js [games]
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = vm.createContext({ console, Math, Set, Map, JSON, Array, Object, Number, String });
const src = ['data.js', 'engine.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
vm.runInContext(src + '\n;globalThis.__E = Engine; globalThis.__B = BOARD; globalThis.__G = GROUP_TILES; globalThis.__C = CARDS;', ctx);
const E = ctx.__E, BOARD = ctx.__B, GROUP_TILES = ctx.__G, CARDS = ctx.__C;

let fail = 0;
const assert = (c, msg, st) => { if (!c) { fail++; if (fail < 8) { console.log('FAIL:', msg); if (st) console.log(JSON.stringify(st.ev.slice(-12))); } } };

function check(st) {
  st.players.forEach((p, s) => {
    assert(Number.isFinite(p.cash) && p.cash >= 0, `cash of ${s} is ${p.cash}`, st);
    assert(p.pos >= 0 && p.pos < 40, 'pos');
    if (p.out) assert(p.cash === 0 && !st.own.some(o => o && o.o === s), 'bankrupt keeps things', st);
  });
  st.own.forEach((o, i) => {
    if (!o) return;
    const t = BOARD[i];
    assert(t.k === 'p' || t.k === 'road' || t.k === 'util', 'owned non-ownable ' + i);
    assert(o.lv >= 0 && o.lv <= 5, 'level');
    assert(t.k === 'p' || o.lv === 0, 'tower on a road');
    if (o.lv) assert(!o.m, 'tower on a pawned town', st);
    if (o.lv) assert(E.groupOwner(st, t.g) === o.o, 'tower without the whole region', st);
    if (t.k === 'p' && o.m) assert(GROUP_TILES[t.g].every(j => !st.own[j] || st.own[j].lv === 0), 'towers next to a pawned town', st);
  });
  for (const g of GROUP_TILES) {                         // building evenly
    if (!g.every(i => st.own[i])) continue;
    const lv = g.map(i => st.own[i].lv);
    assert(Math.max(...lv) - Math.min(...lv) <= 1, 'uneven towers ' + lv, st);
  }
  for (const d of ['s', 'c']) {                          // each feather card exists exactly once
    const inDeck = st.decks[d].filter(x => x === E.FEATHER[d]).length;
    const held = st.players.reduce((n, p) => n + p.fe.filter(x => x === d).length, 0);
    assert(inDeck + held === 1, 'feather count ' + d + ' ' + inDeck + '+' + held, st);
    assert(st.decks[d].length + held === CARDS[d].length, 'deck size', st);
  }
  // the log counts its events one by one (the screen relies on it to know what it has not shown yet)
  st.ev.forEach((e, k) => assert(e.n === st.evn - st.ev.length + 1 + k, `event number ${e.n} (${e.k}) at ${k} of ${st.ev.length}, last ${st.evn}`, st));
  if (st.phase === 'debt') assert(st.pend && st.pend.a > 0, 'debt without amount');
  if (st.phase === 'buy') assert(st.pend && !st.own[st.pend.i], 'buying an owned square');
  if (st.phase === 'auction') {
    const A = st.auc;
    assert(A && !st.own[A.i] && st.pend && st.pend.k === 'auction', 'auction without its town', st);
    if (A) assert(A.by < 0 || (st.players[A.by].cash >= A.hi && !A.out.includes(A.by)), 'a bid nobody can pay', st);
  } else assert(!st.auc, 'an auction left over in phase ' + st.phase, st);
  // the dice's throws are numbered: every screen can work them out
  const r = st.ev.filter(e => e.k === 'roll');
  if (r.length) assert(r[r.length - 1].w === E.throwSeed(st, st.rolls), 'throw seed', st);
}

function game(seed, n, cfg, withTrades) {
  const rnd = E.mulberry(seed);
  const st = E.newLobby('p0');
  E.lobbyJoin(st, 'p0', 'A', 'david');
  for (let k = 1; k < n; k++) E.lobbyAct(st, 'p0', { t: 'addbot' }, rnd);
  E.lobbyAct(st, 'p0', { t: 'cfg', ...cfg }, rnd);
  st.players.forEach(p => p.bot = true);
  assert(E.lobbyAct(st, 'p0', { t: 'start' }, rnd) === '', 'start');
  let moves = 0, trades = 0, seen = 0;
  while (st.phase !== 'over' && moves < 60000) {
    // sometimes the player whose turn it is offers a random trade
    if (withTrades && !st.trade && (st.phase === 'roll' || st.phase === 'end') && rnd() < 0.05) {
      const s = st.turn, others = E.activeSeats(st).filter(x => x !== s);
      const to = others[Math.floor(rnd() * others.length)];
      const pick = seat => st.own.map((o, i) => o && o.o === seat ? i : -1).filter(i => i >= 0 && rnd() < 0.3);
      const offer = { t: 'offer', to, give: { p: pick(s), c: Math.floor(rnd() * 100), f: 0 }, get: { p: pick(to), c: 0, f: 0 } };
      const r = E.act(st, s, offer, rnd);
      if (!r) { trades++; check(st); }
    }
    let acted = false;
    if (st.phase === 'auction') stat.auctions = (stat.auctions || 0) + (st.auc.n === 0 && st.auc.out.length === 0 ? 1 : 0);
    for (let s = 0; s < st.players.length && !acted; s++) {
      const a = E.botMove(st, s);
      if (!a) continue;
      const r = E.act(st, s, a, rnd);
      assert(r === '', `bot move ${JSON.stringify(a)} refused: ${r} (phase ${st.phase})`, st);
      if (r) return { stuck: true };
      acted = true;
    }
    if (!acted && st.phase === 'auction') { E.hammer(st); acted = true; stat.hammers = (stat.hammers || 0) + 1; }   // the host's clock
    assert(acted, 'nobody can move in phase ' + st.phase, st);
    if (!acted) return { stuck: true };
    check(st);
    seen = countLog(st, seen);
    moves++;
  }
  return { over: st.phase === 'over', moves, rounds: st.round, out: st.players.filter(p => p.out).length, trades, st };
}
// the auction's outcome is counted from the log as it goes by
function countLog(st, from) { for (const e of st.ev) if (e.n > from) { if (e.k === 'won') stat.won++; if (e.k === 'unsold') stat.unsold++; } return st.evn; 
}

const N = +(process.argv[2] || 300);
const stat = { rounds: [], full: [], outs: 0, stuck: 0, unfinished: 0, trades: 0, auctions: 0, hammers: 0, won: 0, unsold: 0 };
for (let g = 0; g < N; g++) {
  const n = 2 + (g % 5);
  const r1 = game(1000 + g, n, { mode: 'rounds', rounds: [20, 30, 40][g % 3] }, g % 2 === 0);
  if (r1.stuck) stat.stuck++; else { stat.rounds.push(r1.moves); stat.outs += r1.out; stat.trades += r1.trades; if (!r1.over) stat.unfinished++; }
  const r2 = game(5000 + g, n, { mode: 'full' }, g % 2 === 1);
  if (r2.stuck) stat.stuck++; else { stat.full.push(r2.rounds); if (!r2.over) stat.unfinished++; stat.trades += r2.trades; }
}
const avg = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0;
const med = a => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1] || 0; };
console.log(`games: ${N * 2}, failures: ${fail}, stuck: ${stat.stuck}, unfinished: ${stat.unfinished}`);
console.log(`round-limit games: avg ${avg(stat.rounds)} moves; bankruptcies ${stat.outs}`);
console.log(`full games: rounds avg ${avg(stat.full)}, median ${med(stat.full)}, max ${Math.max(...stat.full)}`);
console.log(`trades done: ${stat.trades}`);
console.log(`auctions: ${stat.auctions}, sold ${stat.won}, unsold ${stat.unsold}, ended by the clock ${stat.hammers}`);
process.exit(fail ? 1 : 0);
