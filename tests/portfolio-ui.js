// Render the production Sheet closure with real data/rules and a tiny sheet host.
// Checks the words and accessible card controls players actually receive, without WebGL.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
const ui = read('ui.js');
const start = ui.indexOf('const Sheet = (() => {'), end = ui.indexOf('// the host starts a new game', start);
assert(start >= 0 && end > start);
const exported = 'return { open, close, refresh, kind: () => kind, onClick };';
const sheet = ui.slice(start, end).replace(exported, 'return { open, close, refresh, kind: () => kind, onClick, assetCard, tradeSummary };');
assert.notEqual(sheet, ui.slice(start, end), 'test exposes production render functions');
const navigation = { focuses: [], scrolls: [] };
let markup = '';
const body = {
  get innerHTML() { return markup; },
  set innerHTML(value) { markup = value; this.scrollTop = 0; },
  scrollTop: 0,
  querySelector(selector) {
    if (selector === '.trade-summary') return { scrollIntoView(options) { navigation.scrolls.push(options); } };
    if (selector.startsWith('[data-')) return { focus(options) { navigation.focuses.push({ selector, options }); } };
    return null;
  }
};
const box = { hidden: true, classList: { add() {}, remove() {} } };
let seat = 0;
const View = { st: null, mySeat: () => seat, controls: s => s === seat, idle() {} };
const ctx = vm.createContext({ console, View, requestAnimationFrame: f => f(),
  document: { querySelector: q => q === '#sheetBody' ? body : q === '#sheet' ? box : null },
  matchMedia: () => ({ matches: false })
});
vm.runInContext(['data.js', 'themes.js', 'pictures.js', 'engine.js', 'trade-insights.js'].map(read).join('\n') + '\n' +
  ui.slice(0, ui.indexOf('// ----- sounds:')) + '\n' + sheet + '\nglobalThis.api = { Sheet, Engine, BOARD, GROUPS, GROUP_TILES, useTheme, tName, W };', ctx);
const { Sheet, Engine: E, BOARD, GROUP_TILES, useTheme, tName } = ctx.api;
function state(theme = 'archipelago') {
  useTheme(theme); seat = 0;
  const st = E.newLobby('a'); st.theme = theme;
  E.lobbyJoin(st, 'a', 'ანა', { mamuli: 'david', archipelago: 'kidd' });
  E.lobbyJoin(st, 'b', 'ნიკა', { mamuli: 'tamar', archipelago: 'teach' });
  st.phase = 'roll'; st.turn = 0; View.st = st;
  return st;
}
const own = (st, owner, tiles, m = false, lv = 0) => tiles.forEach(i => st.own[i] = { o: owner, m, lv });
const side = (p = [], c = 0, f = 0) => ({ p, c, f });
const offer = (give, get) => ({ from: 0, to: 1, give, get });
const open = (kind, arg) => { Sheet.open(kind, arg); return body.innerHTML; };
const text = html => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const glance = html => text(html.match(/<div class="trade-glance">([\s\S]*?)<\/div>/)[1]);
function card(html, i) {
  const match = html.match(new RegExp('<article[^>]*data-property="' + i + '"[\\s\\S]*?<\\/article>'));
  assert(match, 'card for property ' + i); return match[0];
}
function click(data) {
  const attributes = Object.entries(data).map(([name, value]) => ({ name: 'data-' + name, value: String(value) }));
  const target = { dataset: data, attributes, closest(selector) { const m = /^\[data-([^\]]+)\]$/.exec(selector); return m && m[1] in data ? this : null; } };
  Sheet.onClick({ target }); return body.innerHTML;
}
function noNestedButtons(html) {
  let depth = 0;
  for (const tag of html.match(/<\/?button\b[^>]*>/g) || []) {
    if (tag.startsWith('</')) depth--; else { assert.equal(depth, 0, 'property actions must not nest inside deed/selection buttons'); depth++; }
    assert(depth >= 0);
  }
  assert.equal(depth, 0);
}
{
  const st = state(); own(st, 0, [6, 8]); own(st, 0, [9], false, 2); own(st, 0, [12], true);
  const html = open('estate');
  assert.equal((html.match(/class="asset-card/g) || []).length, 4, 'all four owned cards are illustrated');
  assert.match(card(html, 9), /card_09_gramvousa_fort\.jpg/);
  assert.match(card(html, 6), /viewBox="600 0 400 400"/, 'legacy art crops the sharp right-hand subject');
  assert.match(card(html, 9), /2 მეკობრის ქოხი|2 ქოხი/);
  assert.match(card(html, 9), /data-deed="9"/);
  assert.match(card(html, 9), /data-a="sell"/);
  assert.match(card(html, 12), /is-mortgaged/);
  assert.match(card(html, 12), /ქირა შეჩერებულია/);
  assert.match(card(html, 12), /გამოსყიდვა 83/);
  assert.doesNotMatch(card(html, 12), /კამათელი ×/);
  noNestedButtons(html);
}
{
  const st = state(); own(st, 0, [1], false, 5); own(st, 0, [3], false, 5);
  const html = open('estate');
  assert.match(card(html, 1), /1 მეკობრის სასტუმრო|1 სასტუმრო/);
  const note = html.match(/class="portfolio-note">([\s\S]*?)<\/p>/)[1];
  assert.doesNotMatch(note, /მშენებლობა შესაძლებელია/, 'a fully developed collection has no further build level');
  assert.match(note, /განვითარებულ|დასრულებულ|სასტუმრო|ციხე|ბოლომდეა აშენებული/);
}
{
  const st = state(); own(st, 1, [6, 8, 9]);
  const html = open('player', 1), note = html.match(/class="portfolio-note">([\s\S]*?)<\/p>/)[1];
  assert.equal((html.match(/class="asset-card/g) || []).length, 3);
  assert.doesNotMatch(html, /data-a="(?:build|sell|mort|unmort)"/, 'another player\'s cards are read-only');
  assert.doesNotMatch(note, /შენს სვლაზე|უნდა გამოისყიდო/, 'other owner\'s collection does not promise the viewer building rights');
  own(st, 1, [9], true);
  assert.doesNotMatch(open('player', 1).match(/class="portfolio-note">([\s\S]*?)<\/p>/)[1], /უნდა გამოისყიდო/);
}
{
  const st = state(); own(st, 0, [9]);
  const name = st.players[0].name = '\"><img src=x onerror=alert(1)> & კაპიტანი';
  const previous = BOARD[9].n; BOARD[9].n = '<script>bad()</script> & კუნძული';
  const html = open('player', 0);
  assert.doesNotMatch(html, /<img src=x|<script>/);
  assert.match(html, /&quot;&gt;&lt;img src=x onerror=alert\(1\)&gt; &amp; კაპიტანი/);
  assert.match(card(html, 9), /&lt;script&gt;bad\(\)&lt;\/script&gt; &amp; კუნძული/);
  assert(html.includes('title="&quot;&gt;&lt;img'), 'owner name is escaped inside the flag tooltip');
  assert(!html.includes(name)); BOARD[9].n = previous;
}
{
  const st = state(); own(st, 0, [6, 8]); own(st, 1, [9]);
  let html = open('trade');
  assert.match(html, /აირჩიე ქარდები/);
  assert.match(glance(html), /აირჩიე გასაცვლელი ქარდები/);
  assert.match(card(html, 9), /data-pick="get" data-i="9" aria-pressed="false"/);
  body.scrollTop = 480;
  html = click({ pick: 'get', i: '9' });
  assert.equal(body.scrollTop, 480, 'changing a lower card preserves the sheet scroll position');
  assert.equal(navigation.focuses.at(-1).selector, '[data-pick="get"][data-i="9"]');
  assert.equal(navigation.focuses.at(-1).options.preventScroll, true, 'keyboard focus is restored without scrolling');
  assert.match(glance(html), /სრულდება 1 ჯგუფი/); assert.match(glance(html), /გრჩება 1 500/);
  assert.match(card(html, 9), /is-selected/); assert.match(card(html, 9), /aria-pressed="true"/);
  assert.match(text(html), /ასრულებ ჯგუფს/); assert.match(text(html), /2 \/ 3 → 3 \/ 3/);
  assert.match(text(html), /თანხა პირველ მშენებლობასაც ჰყოფნის/);
  assert.match(text(html), /თანაბრად/); assert.match(text(html), /4 ქოხი თითო კუნძულზე → შემდეგ სასტუმრო/);
  html = click({ pick: 'give', i: '6' });
  assert.match(glance(html), /იღებ 1 ქარდს · გასცემ 1/);
  assert.doesNotMatch(glance(html), /სრულდება|იშლება/, 'compact outcome also uses the net two-way transfer');
  assert.match(text(html), /ჯგუფის რაოდენობა უცვლელია/); assert.match(text(html), /2 \/ 3 → 2 \/ 3/);
  assert.doesNotMatch(text(html), /ასრულებ ჯგუფს|თანხა პირველ მშენებლობასაც ჰყოფნის/);
  assert(text(html).includes('კიდევ აკლია: ' + tName(6)));
  const beforeJump = html, beforeJumps = navigation.scrolls.length;
  assert.equal(click({ 'trade-result': '' }), beforeJump, 'jumping to details does not reset the draft');
  assert.equal(navigation.scrolls.length, beforeJumps + 1);
  assert.equal(navigation.scrolls.at(-1).block, 'start');
  noNestedButtons(html);
}
{
  const st = state(); own(st, 0, [1, 3]);
  open('trade');
  let html = click({ pick: 'give', i: '1' });
  assert.match(glance(html), /იშლება 1 ჯგუფი/);
  html = click({ cash: 'give', d: '10' });
  assert.match(glance(html), /გრჩება 1 490/);
  st.players[0].cash = 0; Sheet.refresh();
  assert.match(glance(body.innerHTML), /გადაამოწმე შეთავაზება/);
  assert.doesNotMatch(glance(body.innerHTML), /სრულდება|იშლება/, 'stale invalid draft does not advertise a valid outcome');
}
{
  const st = state(); own(st, 0, [6, 8]); own(st, 1, [9], true); st.players[0].cash = 100;
  const tr = offer(side(), side([9]));
  let html = text(Sheet.tradeSummary(st, tr, 0));
  assert.match(html, /ასრულებ ჯგუფს/); assert.match(html, /ჯერ გამოისყიდე დაგირავებული ქონება: 66/);
  assert.match(html, /არ ჰყოფნის/); assert.doesNotMatch(html, /თანხა პირველ მშენებლობასაც ჰყოფნის/);
  st.players[0].cash = 116;
  html = text(Sheet.tradeSummary(st, tr, 0)); assert.match(html, /თანხა პირველ მშენებლობასაც ჰყოფნის/);
  assert.match(html, /გამოსყიდვა დამატებით 66/);
}
{
  const st = state(); own(st, 0, [9]); own(st, 1, [6, 8]); seat = 1;
  st.trade = offer(side([9]), side([], 120));
  const html = open('offer'), plain = text(html);
  assert.match(plain, /ასრულებ ჯგუფს/); assert.match(plain, /2 \/ 3 → 3 \/ 3/);
  assert.match(plain, /მშენებლობას შენს სვლაზე შეძლებ/);
  assert.doesNotMatch(plain, /თანხა პირველ მშენებლობასაც ჰყოფნის/);
  assert.match(plain, /ფული ახლა 1 500 შემდეგ 1 380/);
  const received = html.split('<h4>შენ მიიღებ</h4>')[1].split('<h4>შენ მისცემ</h4>')[0];
  const given = html.split('<h4>შენ მისცემ</h4>')[1];
  assert.match(received, /data-property="9"/); assert.doesNotMatch(given, /data-property="9"/);
  assert.match(text(given), /ფული 120/); assert.match(html, /data-a="accept" data-seat="1"/);
  own(st, 1, [9]);
  const stale = open('offer');
  assert.match(stale, /აღარ მოქმედებს/); assert.match(stale, /data-a="accept" data-seat="1" disabled/);
  assert.doesNotMatch(stale, /ასრულებ ჯგუფს/);
}
{
  const st = state(); own(st, 0, [5, 12]); own(st, 1, [15, 28]);
  const html = text(Sheet.tradeSummary(st, offer(side(), side([15, 28])), 0));
  assert.match(html, /ქირა: 25 → 50/); assert.match(html, /კამათელი ×4 → კამათელი ×10/);
  assert.match(html, /დაგირავებულ ქონებაზე ქირას ვერ იღებ/);
  const unchanged = JSON.stringify(st); open('estate'); open('player', 1);
  assert.equal(JSON.stringify(st), unchanged, 'rendering portfolios does not mutate game state');
}
{
  const st = state('mamuli'); own(st, 0, [1, 3]);
  const html = open('estate'); assert.match(card(html, 1), /art\/g_pass\.webp/);
  assert.doesNotMatch(text(html), /მეკობრის ქოხი|კუნძული/);
  own(st, 1, [9]); own(st, 0, [6, 8]);
  const summary = text(Sheet.tradeSummary(st, offer(side(), side([9])), 0));
  assert.match(summary, /კოშკები უნდა აშენდეს თანაბრად/); assert.match(summary, /შემდეგ ციხე-სიმაგრე/);
}
console.log('Portfolio UI: illustrated cards, building/mortgage/owner semantics, escaped metadata, live trade net effects, affordability, received offer direction, stale offers, both themes passed.');
