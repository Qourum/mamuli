// Compare preview consequences with accepted trades through the production rule engine.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({ console });
vm.runInContext(['data.js', 'themes.js', 'engine.js', 'trade-insights.js'].map(f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n') + '\nglobalThis.api = { Engine, TradeInsights, BOARD, GROUP_TILES, ROADS, UTILS };', context);
const { Engine: E, TradeInsights: TI, BOARD, GROUP_TILES, ROADS, UTILS } = context.api;
const json = value => JSON.parse(JSON.stringify(value));
const side = (p = [], c = 0, f = 0) => ({ p, c, f });
const trade = (give, get) => ({ from: 0, to: 1, give, get });
function state() {
  const st = E.newLobby('a');
  E.lobbyJoin(st, 'a', 'A', 'david'); E.lobbyJoin(st, 'b', 'B', 'tamar');
  st.phase = 'roll'; st.turn = 0;
  return st;
}
function own(st, seat, ids, mortgage = false, level = 0) {
  for (const i of ids) st.own[i] = { o: seat, m: mortgage, lv: level };
}
function accepted(st, tr) {
  const out = json(st), rnd = E.mulberry(123);
  assert.equal(E.act(out, tr.from, { t: 'offer', to: tr.to, give: tr.give, get: tr.get }, rnd), '');
  assert.equal(E.act(out, tr.to, { t: 'accept' }, rnd), '');
  return out;
}
function parity(st, tr) {
  const before = JSON.stringify(st), beforeTrade = JSON.stringify(tr), after = accepted(st, tr);
  for (const seat of [tr.from, tr.to]) {
    const p = TI.preview(st, tr, seat);
    assert(p.valid);
    assert.equal(p.cashAfter, after.players[seat].cash);
    assert.equal(p.feathersAfter, after.players[seat].fe.length);
    for (const g of p.groups) {
      assert.equal(g.after, E.countOf(after, seat, GROUP_TILES[g.gi]));
      for (const r of g.rentAfter) assert.equal(r.rent, E.rentAt(after, r.i, 7));
      const actualBuild = GROUP_TILES[g.gi].filter(i => after.turn === seat && !E.buildBlock(after, seat, i));
      assert.deepEqual(json(g.buildableNow), json(actualBuild));
    }
    assert.equal(p.roads.after, E.countOf(after, seat, ROADS));
    assert.equal(p.utilities.after, E.countOf(after, seat, UTILS));
    for (const i of p.incoming) {
      assert.equal(after.own[i].o, seat);
      assert.equal(after.own[i].m, st.own[i].m, 'mortgage survives the transfer');
    }
  }
  assert.equal(JSON.stringify(st), before, 'preview does not mutate state');
  assert.equal(JSON.stringify(tr), beforeTrade, 'preview does not normalize its input in place');
}

{
  const st = state(); own(st, 0, [6, 8]); own(st, 1, [9]);
  const tr = trade(side([], 120), side([9])), p = TI.preview(st, tr, 0), g = p.groups[0];
  assert.equal(g.before, 2); assert.equal(g.after, 3); assert(g.completed);
  assert(g.firstBuildAffordable); assert.equal(g.buildCost, 50); assert.equal(g.hotelLevel, 5);
  assert.deepEqual(json(g.buildableNow), [6, 8, 9]); assert.deepEqual(json(g.missing), []);
  assert.equal(p.cashAfter, 1380); parity(st, tr);
}
{
  const st = state(); own(st, 0, [6, 8]); own(st, 1, [9]);
  const tr = trade(side([6]), side([9])), g = TI.preview(st, tr, 0).groups[0];
  assert.equal(g.after, 2); assert.equal(g.completed, false); assert.equal(g.firstBuildAffordable, false);
  assert.deepEqual(json(g.missing), [6]); parity(st, tr);
}
{
  const st = state(); own(st, 0, [6, 8, 9]);
  const tr = trade(side([9]), side()), p = TI.preview(st, tr, 0);
  assert(p.groups[0].broken); assert.equal(p.groups[0].after, 2);
  assert.equal(p.groups[0].rentAfter[0].rent, BOARD[6].rent[0]); parity(st, tr);
}
{
  const st = state(); own(st, 1, [6, 8]); own(st, 0, [9]);
  const tr = trade(side([9]), side([], 200)), p = TI.preview(st, tr, 1);
  assert.deepEqual(json(p.incoming), [9]); assert.deepEqual(json(p.outgoing), []);
  assert.equal(p.cashAfter, 1300); assert(p.groups[0].completed);
  assert(p.groups[0].firstBuildAffordable); assert.equal(p.groups[0].buildTurnReady, false);
  assert.deepEqual(json(p.groups[0].buildableNow), [], 'receiver must wait for own turn'); parity(st, tr);
}
{
  const st = state(); own(st, 0, [6, 8]); own(st, 1, [9], true); own(st, 0, [6], true);
  st.players[0].cash = 170;
  const tr = trade(side([], 10), side([9])), p = TI.preview(st, tr, 0), g = p.groups[0];
  assert(p.valid); assert(g.completed); assert.equal(g.redemptionCost, E.unmortCost(6) + E.unmortCost(9));
  assert.equal(p.redemptionCost, E.unmortCost(9), 'top-level redemption is incoming mortgages only');
  assert.equal(g.firstBuildAffordable, false, 'all mortgages in the set must be redeemed before construction');
  assert.deepEqual(json(g.buildableNow), []); assert.equal(g.rentAfter.find(x => x.i === 9).rent, 0);
  st.players[0].cash = 250;
  assert(TI.preview(st, tr, 0).groups[0].firstBuildAffordable); parity(st, tr);
  const after = accepted(st, tr);
  for (const i of [6, 9]) assert.equal(E.act(after, 0, { t: 'unmort', i }, E.mulberry(8)), '');
  assert.equal(E.act(after, 0, { t: 'build', i: 6 }, E.mulberry(8)), '', 'predicted redemption and first building really succeed');
  assert.equal(E.act(after, 0, { t: 'build', i: 6 }, E.mulberry(8)), 'even', 'completion does not bypass even building');
}
{
  const st = state(); own(st, 0, [6, 8]); own(st, 1, [9]); st.players[0].cash = 120;
  const tr = trade(side([], 120), side([9])), p = TI.preview(st, tr, 0);
  assert(p.valid); assert.equal(p.cashAfter, 0); assert(p.groups[0].completed);
  assert.equal(p.groups[0].firstBuildAffordable, false); parity(st, tr);
  assert.equal(TI.preview(st, trade(side([], 121), side([9])), 0).valid, false);
}
{
  const st = state(); own(st, 0, [5, 12]); own(st, 1, [15, 28]);
  const tr = trade(side([], 50), side([15, 28])), p = TI.preview(st, tr, 0);
  assert.equal(p.roads.before, 1); assert.equal(p.roads.after, 2);
  assert.equal(p.roads.rentBefore, 25); assert.equal(p.roads.rentAfter, 50);
  assert.equal(p.utilities.multiplierBefore, 4); assert.equal(p.utilities.multiplierAfter, 10);
  assert.equal(p.groups.length, 0); parity(st, tr);
  own(st, 1, [15], true);
  const m = TI.preview(st, tr, 0); assert.equal(m.roads.rentAfter, 50); assert.equal(m.roads.activeAfter, 1);
  assert.deepEqual(json(m.roads.mortgaged), [15]); parity(st, tr);
}
{
  const st = state(); st.players[0].fe = ['s']; st.players[1].fe = ['c'];
  const tr = trade(side([], 40, 1), side([], 10, 1)); parity(st, tr);
}
{
  const st = state(); own(st, 0, [6, 8]); own(st, 1, [9]);
  const tr = trade(side([], 10), side([9]));
  assert.equal(TI.preview(st, tr, 2).valid, false);
  assert.equal(TI.preview(st, trade(side(), side()), 0).reason, 'empty');
  assert.equal(TI.preview(st, { ...tr, get: null }, 0).valid, false);
  assert.equal(TI.preview(null, tr, 0).valid, false);
  st.trade = json(tr);
  own(st, 0, [9]); assert.equal(TI.preview(st, tr, 0).valid, false, 'stale owner cannot be offered');
  assert.equal(E.act(st, 1, { t: 'accept' }, E.mulberry(1)), 'stale', 'production engine rejects the same stale offer');
  own(st, 1, [9]); st.players[1].out = true; assert.equal(TI.preview(st, tr, 0).valid, false);
}
{
  const st = state(); own(st, 0, [6, 8, 9], false, 1); own(st, 1, [16]);
  assert.equal(TI.preview(st, trade(side([6]), side([16])), 0).valid, false, 'built collections cannot be traded');
}
{
  // Content validity does not promise that a pending debt permits construction.
  const st = state(); own(st, 0, [6, 8]); own(st, 1, [9]);
  const tr = trade(side([], 10), side([9]));
  st.phase = 'debt'; st.pend = { a: 100, to: 1 };
  const g = TI.preview(st, tr, 0).groups[0];
  assert(g.completed); assert.equal(g.buildTurnReady, false); assert.deepEqual(json(g.buildableNow), []);
}
{
  const st = state(); own(st, 0, [6, 8]); own(st, 1, [9]);
  parity(st, trade(side([], '20.9'), { p: ['9', 9, -1, 80], c: -4, f: 0 }));
}
{
  const rnd = E.mulberry(90210);
  for (let k = 0; k < 100; k++) {
    const st = state();
    for (const t of BOARD) if (['p', 'road', 'util'].includes(t.k) && rnd() < 0.85) own(st, rnd() < 0.5 ? 0 : 1, [t.i], rnd() < 0.2);
    st.players.forEach(p => p.cash = 100 + Math.floor(rnd() * 600));
    const choose = seat => st.own.map((o, i) => o && o.o === seat && rnd() < 0.45 ? i : -1).filter(i => i >= 0);
    const tr = trade(side(choose(0), 1 + Math.floor(rnd() * 90)), side(choose(1), Math.floor(rnd() * 90)));
    parity(st, tr);
  }
}
console.log('Trade insights: engine parity, set completion/breakage, recipient direction, mortgages, cash, roads/utilities, stale offers and immutability passed.');
