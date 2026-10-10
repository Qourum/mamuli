// მამული's offline helper. Only the website registers it; tools/build.py fills in the version and the picture list.
// The page comes from the network when it can, so an update arrives at once, and from the cache when it cannot.
// Pictures, the 3D library and the fonts come from the cache and are refreshed in the background. Once the game has
// loaded, the page asks the helper to keep every picture, so a game with the computer players works without a connection.
const VERSION = "b0385d86d2";
const ARTS = ["por_h_david.webp", "por_h_tamar.webp", "por_h_gorgasali.webp", "por_h_erekle.webp", "por_h_kakutsa.webp", "por_h_tariel.webp", "por_h_avtandil.webp", "por_h_gurdjieff.webp", "por_h_abrag.webp", "por_h_amirani.webp", "por_h_mikha.webp", "por_h_prometheus.webp", "h_tamar.webp", "h_gorgasali.webp", "h_erekle.webp", "h_kakutsa.webp", "h_tariel.webp", "h_avtandil.webp", "h_gurdjieff.webp", "h_abrag.webp", "h_amirani.webp", "h_mikha.webp", "h_prometheus.webp", "h_davidride.webp", "por_p_blackbeard.webp", "por_p_bonny.webp", "por_p_read.webp", "por_p_chingshih.webp", "por_p_omalley.webp", "por_p_morgan.webp", "por_p_kidd.webp", "por_p_roberts.webp", "por_p_barbarossa.webp", "por_p_bellamy.webp", "por_p_labuse.webp", "por_p_stortebeker.webp", "bg_sea.webp", "sc_north.webp", "sc_gotland.webp", "sc_med.webp", "sc_atlantic.webp", "sc_antilles.webp", "sc_caribbean.webp", "sc_indian.webp", "sc_pacific.webp", "sc_oak.webp", "sc_cocos.webp", "sc_qar.webp", "sc_whydah.webp", "sc_galley.webp", "sc_fortune.webp", "sc_lighthouse.webp", "sc_shipyard.webp", "sc_customs.webp", "sc_whirlpool.webp", "sc_port.webp", "sc_isle.webp", "sc_tavern.webp", "sc_kraken.webp", "sc_chest.webp", "sc_bottle.webp", "t_archer_2.webp", "s_fort.webp", "s_camp.webp", "t_palisade.webp", "ui_page.webp", "ui_chest_wood.webp", "ui_chest_wood_o.webp", "ui_coin.webp", "ui_coinbag.webp", "ui_book.webp", "ui_feather.webp", "g_svan.webp", "g_elbrus.webp", "g_pass.webp", "g_stone.webp", "g_tbilisi.webp", "m_heligoland.glb", "m_cocos.glb", "m_volcano.glb", "m_gotland.glb", "m_customs.glb", "m_gramvousa.glb", "m_lighthouse.glb", "m_shipyard.glb", "m_cheungchau.glb", "m_oak.glb", "m_port.glb", "m_castaway.glb", "m_tavern.glb", "m_kraken.glb", "m_qar.glb", "m_whydah.glb", "m_galley.glb", "m_fortune.glb", "m_whirlpool.glb"];
const PAGE = 'mamuli-page-' + VERSION, FILES = 'mamuli-files', FONTS = 'mamuli-fonts';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'rt.js'];
const LIB = ['vendor/three.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(Promise.all([caches.open(PAGE).then(c => c.addAll(SHELL)), caches.open(FILES).then(c => c.addAll(LIB))]).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('mamuli-page-') && k !== PAGE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'keep-all') e.waitUntil(keepAll()); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  // Google's fonts: the style sheet is looked at again now and then, the font files never change
  if (u.hostname === 'fonts.googleapis.com') return e.respondWith(kept(FONTS, r, r.url, true));
  if (u.hostname === 'fonts.gstatic.com') return e.respondWith(kept(FONTS, r, r.url, false));
  if (u.origin !== location.origin) return;
  if (u.pathname.includes('/art/') || u.pathname.includes('/vendor/')) return e.respondWith(kept(FILES, r, r.url.split('?')[0], true));
  if (r.mode === 'navigate' || SHELL.some(s => s !== './' && u.pathname.endsWith('/' + s))) e.respondWith(page(r));
});

async function page(r) {
  const c = await caches.open(PAGE);
  try {
    // asked of the server itself each time (the browser may keep an old copy for minutes): a new version arrives at once
    const res = await fetch(r, { cache: 'no-cache' });
    if (res.ok) c.put(r, res.clone());
    return res;
  } catch (err) {
    return (await c.match(r, { ignoreSearch: true })) || (r.mode === 'navigate' && ((await c.match('index.html')) || (await c.match('./')))) || Response.error();
  }
}
// from the cache at once when it is there (refreshed for next time if it may change), otherwise from the network
async function kept(name, r, key, refresh) {
  const c = await caches.open(name);
  const hit = await c.match(key);
  if (hit && !refresh) return hit;
  const fresh = fetch(r).then(res => { if (res.ok) c.put(key, res.clone()); return res; }).catch(() => null);
  if (hit) { fresh.catch(() => { }); return hit; }
  return (await fresh) || Response.error();
}
// every picture not kept yet, a few at a time (a failed one is simply tried again next time)
async function keepAll() {
  const c = await caches.open(FILES), base = new URL('art/', self.registration.scope).href;
  const have = new Set((await c.keys()).map(q => q.url.split('?')[0]));
  const todo = ARTS.map(n => base + n).filter(u => !have.has(u));
  const next = async () => {
    for (let u = todo.shift(); u; u = todo.shift()) {
      try { const res = await fetch(u); if (res.ok) await c.put(u, res); } catch (err) { }
    }
  };
  await Promise.all([next(), next(), next(), next()]);
}
