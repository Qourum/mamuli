// Read-only consequences of a trade. The rules remain in Engine: both sides are applied before
// checking collections, rent or construction, so exchanging two towns in one region cannot
// accidentally promise a completed collection.
const TradeInsights = (() => {
  function preview(st, tr, seat) {
    const player = st && st.players && st.players[seat];
    const result = {
      valid: false, reason: 'bad', seat,
      cashBefore: player ? player.cash : 0, cashAfter: player ? player.cash : 0,
      cashReceived: 0, cashGiven: 0, incoming: [], outgoing: [],
      feathersBefore: player && player.fe ? player.fe.length : 0,
      feathersAfter: player && player.fe ? player.fe.length : 0,
      groups: [], roads: null, utilities: null,
      redemptionCost: 0, cashAfterIncomingRedemption: player ? player.cash : 0
    };
    if (!st || !Array.isArray(st.players) || !Array.isArray(st.own) || !tr || !player || player.out ||
        !Number.isInteger(tr.from) || !Number.isInteger(tr.to) ||
        (seat !== tr.from && seat !== tr.to)) return result;
    const give = Engine.cleanSide(tr.give), get = Engine.cleanSide(tr.get);
    if (!give || !get) return result;
    const clean = { from: tr.from, to: tr.to, give, get };
    const why = Engine.tradeBlock(st, clean);
    if (why) { result.reason = why; return result; }

    const incoming = seat === tr.from ? get : give, outgoing = seat === tr.from ? give : get;
    // Copy only the mutable rule inputs. No events, dice, decks or source ownership are changed.
    const after = { ...st, trade: null,
      players: st.players.map(p => ({ ...p })),
      own: st.own.map(o => o ? { ...o } : null)
    };
    for (const i of give.p) after.own[i].o = tr.to;
    for (const i of get.p) after.own[i].o = tr.from;
    after.players[tr.from].cash += get.c - give.c;
    after.players[tr.to].cash += give.c - get.c;
    Object.assign(result, {
      valid: true, reason: '', incoming: incoming.p, outgoing: outgoing.p,
      cashAfter: after.players[seat].cash, cashReceived: incoming.c, cashGiven: outgoing.c,
      feathersAfter: player.fe.length + incoming.f - outgoing.f
    });
    result.redemptionCost = incoming.p.reduce((sum, i) => sum + (after.own[i].m ? Engine.unmortCost(i) : 0), 0);
    result.cashAfterIncomingRedemption = result.cashAfter - result.redemptionCost;

    const owns = (state, i) => !!state.own[i] && state.own[i].o === seat;
    const changed = [...new Set(incoming.p.concat(outgoing.p).filter(i => BOARD[i].k === 'p').map(i => BOARD[i].g))].sort((a, b) => a - b);
    for (const gi of changed) {
      const tiles = GROUP_TILES[gi], before = Engine.countOf(st, seat, tiles), count = Engine.countOf(after, seat, tiles);
      const mortgaged = tiles.filter(i => owns(after, i) && after.own[i].m);
      const redemptionCost = mortgaged.reduce((sum, i) => sum + Engine.unmortCost(i), 0);
      const redeemed = { ...after, own: after.own.map(o => o ? { ...o } : null), players: after.players.map(p => ({ ...p })) };
      for (const i of mortgaged) redeemed.own[i].m = false;
      redeemed.players[seat].cash -= redemptionCost;
      const buildTurnReady = st.turn === seat && (st.phase === 'roll' || st.phase === 'end');
      const buildable = tiles.filter(i => !Engine.buildBlock(after, seat, i));
      const buildableAfterRedemption = tiles.filter(i => !Engine.buildBlock(redeemed, seat, i));
      result.groups.push({
        gi, before, after: count, total: tiles.length,
        received: incoming.p.filter(i => BOARD[i].k === 'p' && BOARD[i].g === gi),
        given: outgoing.p.filter(i => BOARD[i].k === 'p' && BOARD[i].g === gi),
        completed: before < tiles.length && count === tiles.length,
        broken: before === tiles.length && count < tiles.length,
        missing: tiles.filter(i => !owns(after, i)), mortgaged, redemptionCost,
        buildCost: Engine.buildCost(tiles[0]),
        // Affordability is for this collection independently, after redeeming its mortgages.
        // It does not assert that several collections can all be developed with the same cash.
        firstBuildAffordable: buildableAfterRedemption.length > 0,
        buildTurnReady, buildableNow: buildTurnReady ? buildable : [],
        buildableAfterRedemption, hotelLevel: 5,
        rentBefore: tiles.filter(i => owns(st, i)).map(i => ({ i, rent: Engine.rentAt(st, i, 7) })),
        rentAfter: tiles.filter(i => owns(after, i)).map(i => ({ i, rent: Engine.rentAt(after, i, 7) }))
      });
    }

    const collection = (tiles, rates, key) => {
      const before = Engine.countOf(st, seat, tiles), count = Engine.countOf(after, seat, tiles);
      return {
        before, after: count, total: tiles.length,
        received: incoming.p.filter(i => tiles.includes(i)), given: outgoing.p.filter(i => tiles.includes(i)),
        // These are the ordinary rates of each un-mortgaged property. A mortgaged property
        // still counts towards the collection in Engine, but earns no rent of its own.
        [key + 'Before']: rates[before], [key + 'After']: rates[count],
        mortgaged: tiles.filter(i => owns(after, i) && after.own[i].m),
        activeBefore: tiles.filter(i => owns(st, i) && !st.own[i].m).length,
        activeAfter: tiles.filter(i => owns(after, i) && !after.own[i].m).length
      };
    };
    result.roads = collection(ROADS, ROAD_RENT, 'rent');
    result.utilities = collection(UTILS, UTIL_MULT, 'multiplier');
    return result;
  }
  return { preview };
})();

if (typeof module !== 'undefined') module.exports = TradeInsights;
