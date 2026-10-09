// ===== მამული: the board, the regions, the cards and the heroes =====
// Everything here is plain data; the rules live in engine.js.

const SALARY = 200;        // collected on passing or landing on the start
const START_CASH = 1500;
const JAIL_FINE = 50;
const JAIL = 10;           // the dungeon's square
const MAX_PLAYERS = 6;

// regions: name, colour of the band on their squares, price of one tower
const GROUPS = [
  { n: 'ხევსურეთი', c: '#9a7452', b: 50 },
  { n: 'სვანეთი', c: '#72bde6', b: 50 },
  { n: 'სამეგრელო', c: '#55ad5f', b: 100 },
  { n: 'იმერეთი', c: '#ee8f3e', b: 100 },
  { n: 'სამცხე', c: '#2fa39d', b: 150 },
  { n: 'ქართლი', c: '#e4bc3c', b: 150 },
  { n: 'კახეთი', c: '#a8365f', b: 200 },
  { n: 'თბილისი', c: '#4064c8', b: 200 }
];

// k: p = a town of a region, road = caravanserai, util = mill / wine cellar, scroll / chest = cards,
// tax, start, jail, feast (free square), gojail
const BOARD = [
  { k: 'start', n: 'სტარ\u00adტი' },
  { k: 'p', g: 0, n: 'მუცო', p: 60 },
  { k: 'chest', n: 'სა\u00adგან\u00adძუ\u00adრი' },
  { k: 'p', g: 0, n: 'შა\u00adტი\u00adლი', p: 80 },
  { k: 'tax', n: 'ხარკი', a: 200 },
  { k: 'road', n: 'ანანურის ქარვასლა', s: 'ა\u00adნა\u00adნუ\u00adრი', p: 200 },
  { k: 'p', g: 1, n: 'ლა\u00adტა\u00adლი', p: 100 },
  { k: 'scroll', n: 'ბე\u00adდის გრაგ\u00adნი\u00adლი' },
  { k: 'p', g: 1, n: 'უშ\u00adგუ\u00adლი', p: 110 },
  { k: 'p', g: 1, n: 'მეს\u00adტია', p: 120 },
  { k: 'jail', n: 'ზინ\u00adდა\u00adნი' },
  { k: 'p', g: 2, n: 'ნო\u00adქა\u00adლა\u00adქე\u00adვი', p: 140 },
  { k: 'util', n: 'წის\u00adქვი\u00adლი', p: 150, ic: 'mill' },
  { k: 'p', g: 2, n: 'რუხი', p: 150 },
  { k: 'p', g: 2, n: 'ზუგ\u00adდი\u00adდი', p: 160 },
  { k: 'road', n: 'გონიოს ქარვასლა', s: 'გო\u00adნი\u00adო', p: 200 },
  { k: 'p', g: 3, n: 'შო\u00adრა\u00adპა\u00adნი', p: 180 },
  { k: 'chest', n: 'სა\u00adგან\u00adძუ\u00adრი' },
  { k: 'p', g: 3, n: 'გე\u00adგუ\u00adთი', p: 190 },
  { k: 'p', g: 3, n: 'ქუ\u00adთაი\u00adსი', p: 200 },
  { k: 'feast', n: 'სუფრა' },
  { k: 'p', g: 4, n: 'ხერთ\u00adვი\u00adსი', p: 220 },
  { k: 'scroll', n: 'ბე\u00adდის გრაგ\u00adნი\u00adლი' },
  { k: 'p', g: 4, n: 'აწ\u00adყუ\u00adრი', p: 230 },
  { k: 'p', g: 4, n: 'ა\u00adხალ\u00adცი\u00adხე', p: 250 },
  { k: 'road', n: 'რიკოთის ქარვასლა', s: 'რი\u00adკო\u00adთი', p: 200 },
  { k: 'p', g: 5, n: 'სუ\u00adრა\u00adმი', p: 260 },
  { k: 'p', g: 5, n: 'უფ\u00adლის\u00adცი\u00adხე', p: 270 },
  { k: 'util', n: 'მა\u00adრა\u00adნი', p: 150, ic: 'qvevri' },
  { k: 'p', g: 5, n: 'მცხე\u00adთა', p: 290 },
  { k: 'gojail', n: 'ზინ\u00adდა\u00adნში!' },
  { k: 'p', g: 6, n: 'სიღ\u00adნა\u00adღი', p: 300 },
  { k: 'p', g: 6, n: 'თე\u00adლა\u00adვი', p: 310 },
  { k: 'chest', n: 'სა\u00adგან\u00adძუ\u00adრი' },
  { k: 'p', g: 6, n: 'გრემი', p: 330 },
  { k: 'road', n: 'თბილისის ქარვასლა', s: 'თბი\u00adლი\u00adსი', p: 200 },
  { k: 'scroll', n: 'ბე\u00adდის გრაგ\u00adნი\u00adლი' },
  { k: 'p', g: 7, n: 'ძვე\u00adლი თბი\u00adლი\u00adსი', p: 360 },
  { k: 'tax', n: 'ბაჟი', a: 100 },
  { k: 'p', g: 7, n: 'ნა\u00adრი\u00adყა\u00adლა', p: 400 }
];

const ROAD_RENT = [0, 25, 50, 100, 200];
const UTIL_MULT = [0, 4, 10];

// rent of a town: [alone, whole region, 1 tower, 2, 3, 4, fortress]. The fortress rent climbs from 250 on the cheapest
// town to 2000 on Narikala; the towers take a growing share of it.
(function rents() {
  const r5 = x => Math.max(5, Math.round(x / 5) * 5), r10 = x => Math.round(x / 10) * 10;
  for (const t of BOARD) {
    if (t.k !== 'p') continue;
    const F = r10(250 + (t.p - 60) / 340 * 1750);
    const base = Math.max(4, Math.round(F * 0.017));
    t.rent = [base, base * 2, r5(F * 0.1), r5(F * 0.3), r10(F * 0.64), r10(F * 0.82), F];
  }
})();
for (let i = 0; i < BOARD.length; i++) BOARD[i].i = i;
const GROUP_TILES = GROUPS.map((g, gi) => BOARD.filter(t => t.k === 'p' && t.g === gi).map(t => t.i));
const ROADS = BOARD.filter(t => t.k === 'road').map(t => t.i);
const UTILS = BOARD.filter(t => t.k === 'util').map(t => t.i);
const OWNABLE = t => t.k === 'p' || t.k === 'road' || t.k === 'util';

// what stands on a town, by level (art file and name)
const LEVELS = [
  null,
  { a: 't_archer_1', n: 'ხის კოშკი' },
  { a: 't_archer_2', n: 'ქვის კოშკი' },
  { a: 't_archer_3', n: 'სამეფო კოშკი' },
  { a: 't_archerp_3', n: 'გუშაგიანი კოშკი' },
  { a: 's_fort', n: 'ციხე-სიმაგრე' }
];

// ბედის გრაგნილი (s) and საგანძური (c). k: cash (n), move (to), back (n), near (road|util), jail, feather, repair (per tower, per fortress)
const CARDS = {
  s: [
    { k: 'move', to: 0, t: 'მეფემ სამეფო კარზე გიხმო. გადადი სტარტზე და აიღე 200.' },
    { k: 'move', to: 39, t: 'ნარიყალაზე დიდი ბაზრობაა. გადადი ნარიყალაზე.' },
    { k: 'move', to: 34, t: 'გრემში ვაჭრები შეიკრიბნენ. გადადი გრემში; სტარტს თუ გაივლი, აიღე 200.' },
    { k: 'move', to: 16, t: 'შორაპნის ხიდი გაიხსნა. გადადი შორაპანში; სტარტს თუ გაივლი, აიღე 200.' },
    { k: 'move', to: 5, t: 'არაგვის გზას დაადექი. გადადი ანანურის ქარვასლაში; სტარტს თუ გაივლი, აიღე 200.' },
    { k: 'near', w: 'road', t: 'ქარავანს გაჰყევი უახლოეს ქარვასლამდე. თუ ის ვინმესია, ორმაგ ქირას გადაუხდი.' },
    { k: 'near', w: 'road', t: 'ქარავანს გაჰყევი უახლოეს ქარვასლამდე. თუ ის ვინმესია, ორმაგ ქირას გადაუხდი.' },
    { k: 'near', w: 'util', t: 'ფქვილი გაგითავდა. გადადი უახლოეს წისქვილზე ან მარანზე; თუ ის ვინმესია, კამათლის ათმაგს გადაუხდი.' },
    { k: 'back', n: 3, t: 'ცხენი დაგიფრთხა. სამი უჯრით უკან დაიხიე.' },
    { k: 'jail', t: 'ბაჟი არ გადაიხადე და დაგიჭირეს. პირდაპირ ზინდანში; სტარტს ვერ გაივლი.' },
    { k: 'feather', t: 'ფასკუნჯმა ბუმბული დაგიტოვა. ერთხელ ზინდანიდან გამოგიყვანს: შეინახე.' },
    { k: 'cash', n: 150, t: 'ქარავანმა შენი აბრეშუმი კარგ ფასად გაყიდა. აიღე 150.' },
    { k: 'cash', n: 50, t: 'მეზობელმა ვალი დაგიბრუნა. აიღე 50.' },
    { k: 'cash', n: 100, t: 'ჭიდაობაში გაიმარჯვე. აიღე 100.' },
    { k: 'cash', n: -15, t: 'ხიდზე გასასვლელი გადაიხადე: 15.' },
    { k: 'repair', a: 25, b: 100, t: 'კოშკებს შეკეთება უნდათ: თითო კოშკზე 25, თითო ციხეზე 100.' }
  ],
  c: [
    { k: 'cash', n: 200, t: 'მარანში ძველი ქვევრი ამოთხარე, ოქროთი სავსე. აიღე 200.' },
    { k: 'cash', n: -50, t: 'აქიმს მიაკითხე. გადაიხადე 50.' },
    { k: 'cash', n: 100, t: 'რთველი კარგი გამოვიდა. აიღე 100.' },
    { k: 'cash', n: 100, t: 'შორეულმა ბიძამ მემკვიდრეობა დაგიტოვა. აიღე 100.' },
    { k: 'feather', t: 'ფასკუნჯმა ბუმბული დაგიტოვა. ერთხელ ზინდანიდან გამოგიყვანს: შეინახე.' },
    { k: 'jail', t: 'ხარკი დაგავიწყდა. პირდაპირ ზინდანში; სტარტს ვერ გაივლი.' },
    { k: 'move', to: 0, t: 'სამეფო კარიდან მოგიხმეს. გადადი სტარტზე და აიღე 200.' },
    { k: 'cash', n: -100, t: 'ქორწილში მეჯვარე იყავი. საჩუქარზე 100 დაგიჯდა.' },
    { k: 'cash', n: 50, t: 'ბაზარში ჩურჩხელა გაყიდე. აიღე 50.' },
    { k: 'repair', a: 40, b: 115, t: 'ზამთრის მერე გალავანი შეაკეთე: თითო კოშკზე 40, თითო ციხეზე 115.' },
    { k: 'cash', n: 20, t: 'ხარკი ზედმეტი გადაგიხდია. დაგიბრუნეს 20.' },
    { k: 'cash', n: 25, t: 'მოჭიდავეთა შეჯიბრში მეორე ადგილი დაიკავე. აიღე 25.' },
    { k: 'cash', n: -50, t: 'სოფლის ხიდის აშენებას შეეწიე: 50.' },
    { k: 'cash', n: 50, t: 'სუფრის თამადა იყავი, სტუმრებმა დაგასაჩუქრეს. აიღე 50.' },
    { k: 'cash', n: 100, t: 'ცხენი კარგ ფასად გაყიდე. აიღე 100.' },
    { k: 'cash', n: -50, t: 'ბატონის ცხენს ნალი დაუვარდა და შენ გაგაჭედინეს. გადაიხადე 50.' }
  ]
};

// the heroes of მეტეხი, the players' figures
const HEROES = {
  david: { n: 'დავით აღმაშენებელი', s: 'დავითი' },
  tamar: { n: 'თამარ მეფე', s: 'თამარი' },
  gorgasali: { n: 'ვახტანგ გორგასალი', s: 'ვახტანგი' },
  erekle: { n: 'ერეკლე II', s: 'ერეკლე' },
  kakutsa: { n: 'ქაქუცა ჩოლოყაშვილი', s: 'ქაქუცა' },
  tariel: { n: 'ტარიელი', s: 'ტარიელი' },
  avtandil: { n: 'ავთანდილი', s: 'ავთანდილი' },
  gurdjieff: { n: 'გიორგი გურჯიევი', s: 'გურჯიევი' },
  abrag: { n: 'აბრაგი', s: 'აბრაგი' },
  amirani: { n: 'ამირანი', s: 'ამირანი' },
  mikha: { n: 'მიხა ხელაშვილი', s: 'მიხა' },
  prometheus: { n: 'პრომეთე', s: 'პრომეთე' }
};
const HERO_KEYS = Object.keys(HEROES);

// one colour per seat: rings, flags on owned squares, the players' list
const SEAT_COLORS = ['#e8574a', '#4ea4f0', '#7dd065', '#f2c443', '#b57be6', '#ff9440'];

if (typeof module !== 'undefined') module.exports = { SALARY, START_CASH, JAIL_FINE, JAIL, MAX_PLAYERS, GROUPS, BOARD, ROAD_RENT, UTIL_MULT, GROUP_TILES, ROADS, UTILS, OWNABLE, LEVELS, CARDS, HEROES, HERO_KEYS, SEAT_COLORS };
