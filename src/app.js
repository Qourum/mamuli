// ===== the menu, the room's lobby, and starting up =====

// this device's player: a name, a hero for each world (a king or a hero for მამული, a pirate for the archipelago), and
// the world last played here (a new room starts in it)
const PROFILE = (() => {
  const p = store.get('profile') || {}, of = (h, t) => HEROES[h] && HEROES[h].t === t;
  return { hero: of(p.hero, 'mamuli') ? p.hero : 'david', pirate: of(p.pirate, 'archipelago') ? p.pirate : 'blackbeard',
    theme: THEMES[p.theme] ? p.theme : 'mamuli', name: Engine.cleanName(p.name || '') };
})();
const saveProfile = () => store.set('profile', PROFILE);
// the archipelago is offered on the site when its 3D sea is ready (…?sea shows it before; the preview always does)
const WORLDS_OPEN = !SITE || /[?&]sea\b/.test(location.search);
const heroPrefs = () => ({ mamuli: PROFILE.hero, archipelago: PROFILE.pirate });
const myName = () => PROFILE.name || HEROES[PROFILE.hero].s;

// ----- the first screen -----
const Menu = (() => {
  function render() {
    const pick = $('#heroPick');
    pick.innerHTML = HERO_KEYS.map(h => `<button class="hero${h === PROFILE.hero ? ' on' : ''}" data-hero="${h}" aria-label="${esc(HEROES[h].n)}" aria-pressed="${h === PROFILE.hero}"><img src="${por(h)}" alt=""></button>`).join('');
    $('#heroName').textContent = HEROES[PROFILE.hero].n;
    $('#heroFig').src = ART(PROFILE.hero === 'david' ? 'h_davidride' : 'h_' + PROFILE.hero);
    const nameIn = $('#nameIn');
    if (document.activeElement !== nameIn) nameIn.value = PROFILE.name;
    nameIn.placeholder = HEROES[PROFILE.hero].s;
    const saved = store.get('local');
    $('#bResume').hidden = !(saved && saved.st && saved.st.phase !== 'lobby' && saved.st.phase !== 'over');
    $('#onlineBox').hidden = !SITE;
    $('#onlineNote').hidden = SITE;
    $('#bLocal').classList.toggle('gold', !SITE);          // without online rooms this is the way to play
    $('#bLocal').classList.toggle('big', !SITE);
    Install.render();
  }
  function onClick(ev) {
    Sound.unlock();
    const h = ev.target.closest('[data-hero]');
    if (h) { PROFILE.hero = h.dataset.hero; saveProfile(); render(); return; }
    const id = ev.target.closest('button') && ev.target.closest('button').id;
    if (id === 'bHost') { PROFILE.name = Engine.cleanName($('#nameIn').value); saveProfile(); hostRoom(); }
    else if (id === 'bJoin') { PROFILE.name = Engine.cleanName($('#nameIn').value); saveProfile(); joinRoom($('#codeIn').value); }
    else if (id === 'bLocal') { PROFILE.name = Engine.cleanName($('#nameIn').value); saveProfile(); playLocal(false); }
    else if (id === 'bResume') playLocal(true);
    else if (id === 'bInstall') Install.go();
    else if (id === 'bRules') { Sheet.open('rules'); }
  }
  return { render, onClick };
})();

// ----- putting the game on the home screen, like an app (as მეტეხი does) -----
// Chrome, Edge and Samsung's browser ask the question themselves when the button is pressed; an iPhone or iPad, Safari on
// a Mac and Firefox on Android have no such question, so the button shows the few taps it takes there.
const Install = (() => {
  let ask = null;
  const ua = navigator.userAgent;
  const standalone = () => { try { return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true; } catch (e) { return false; } };
  const top = () => { try { return window.top === window; } catch (e) { return false; } };
  const ios = () => /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const macSafari = () => /Macintosh/.test(ua) && !(navigator.maxTouchPoints > 1) && /Version\/\d+.*Safari\//.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(ua);
  const firefoxAndroid = () => /Android/.test(ua) && /Firefox\//.test(ua);
  // how this browser installs the game ('' = it cannot, or it already is installed)
  function how() {
    if (!SITE || !top() || standalone()) return '';
    if (ask) return 'ask';
    if (ios()) return 'ios';
    if (macSafari()) return 'mac';
    if (firefoxAndroid()) return 'firefox';
    return '';
  }
  function render() { const b = $('#installBox'); if (b) b.hidden = !how(); }
  function go() {
    const h = how();
    if (h === 'ask') {
      const a = ask; ask = null;
      try { a.prompt(); a.userChoice.then(c => { if (c && c.outcome !== 'accepted') ask = null; render(); }, render); } catch (e) { render(); }
      return;
    }
    if (h) Sheet.open('install', h);
  }
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); ask = e; render(); });
  addEventListener('appinstalled', () => { ask = null; render(); UI.toast('მამული დაინსტალირდა: გახსენი მთავარი ეკრანიდან', 3200, 'good'); });
  return { render, go, how };
})();
// the offline helper: the game opens without a connection too (and the browser offers to install it)
function offlineHelper() {
  if (!SITE || !('serviceWorker' in navigator) || !(location.protocol === 'https:' || location.hostname === 'localhost')) return;
  const go = () => navigator.serviceWorker.register('sw.js').then(r => setTimeout(() => {
    const w = r.active || r.waiting || r.installing;
    if (w) w.postMessage('keep-all');                     // all the pictures, once the page has what it needs
  }, 12000)).catch(() => { });
  if (document.readyState === 'complete') go(); else addEventListener('load', go);
}

// ----- the lobby: who is in, which hero, how long, start -----
const Lobby = (() => {
  let sel = -1;                                 // on a shared device: whose hero is being chosen
  function render(st) {
    if (!st || UI.screen !== 'lobby') { if (st && st.phase === 'lobby') UI.go('lobby'); else return; }
    const online = ROOM && ROOM.mode === 'online', host = ROOM && (ROOM.role === 'local' || st.host === ROOM.me);
    const mine = s => ROOM && (ROOM.role === 'local' ? !st.players[s].bot : st.players[s].pid === ROOM.me);
    if (sel < 0 || !st.players[sel] || !mine(sel)) sel = st.players.findIndex((p, s) => mine(s));
    $('#lobbyTitle').textContent = online ? 'ოთახი' : 'თამაში ამ მოწყობილობაზე';
    // the world: the host picks it, everyone sees which (on the site, once the archipelago's sea is ready)
    const th = Engine.themeKey(st);
    $('#themeBox').innerHTML = !WORLDS_OPEN && th === 'mamuli' ? '' : `<p class="lbl">თემა</p><div class="seg worlds">${Object.values(THEMES).map(t => `<button class="${t.key === th ? 'on' : ''}" data-pickworld="${t.key}" ${host ? '' : 'disabled'}><b>${esc(t.name)}</b><small>${esc(t.tag)}</small></button>`).join('')}</div>`;
    const codeBox = $('#codeBox');
    codeBox.hidden = !online;
    if (online) {
      $('#roomCode').textContent = ROOM.code || '····';
      const here = Object.keys(ROOM.peers || {}).length;
      $('#roomState').textContent = !ROOM.up || !st.players.length ? 'ვუკავშირდები…' : here > 1 ? `ოთახში ${here} ადამიანია` : '';
    }
    $('#seats').innerHTML = st.players.map((p, s) => {
      const tags = [p.pid === st.host && online ? '<span class="tag">მასპინძელი</span>' : '', p.bot ? '<span class="tag">ბოტი</span>' : '',
        online && p.pid === ROOM.me ? '<span class="tag me">შენ</span>' : '', online && !p.bot && p.pid !== ROOM.me && ROOM.peers && !ROOM.peers[p.pid] ? '<span class="tag warn">კავშირს ელოდება</span>' : ''].join('');
      const canKick = host ? p.pid !== st.host : p.pid === (ROOM && ROOM.me);
      return `<li class="seat${s === sel ? ' sel' : ''}" data-seat="${s}" style="--c:${SEAT_COLORS[s]}"><img src="${por(p.hero)}" alt=""><div><b>${esc(p.name)}</b><small>${esc(HEROES[p.hero].n)}</small><span class="tags">${tags}</span></div>${canKick && st.players.length > 1 ? `<button class="ib" data-kick="${s}" aria-label="მოშორება">×</button>` : ''}</li>`;
    }).join('') + (st.players.length >= MAX_PLAYERS ? '' : online
      // a free place in a room: someone is expected (a tap on it invites, like the button)
      ? `<li class="seat wait" data-invite><i></i><div><b>მეგობარს ელოდები…</b><small>გაუგზავნე კოდი ან ბმული · ${MAX_PLAYERS - st.players.length} ადგილი თავისუფალია</small></div></li>`
      : `<li class="seat empty">${MAX_PLAYERS - st.players.length} ადგილი თავისუფალია</li>`);
    // the hero of the selected seat
    const me = st.players[sel];
    const pirate = th === 'archipelago', mh = me && HEROES[me.hero];
    $('#lobbyHeroes').innerHTML = me ? `<p class="lbl">${online ? (pirate ? 'შენი მეკობრე' : 'შენი გმირი') : esc(me.name) + (pirate ? ': მეკობრე' : ': გმირი')}</p><div class="hero-pick">${heroKeys(th).map(h => {
      const taken = st.players.some((p, s) => s !== sel && p.hero === h);
      return `<button class="hero${me.hero === h ? ' on' : ''}" data-lhero="${h}" ${taken ? 'disabled' : ''} aria-label="${esc(HEROES[h].n)}"><img src="${por(h)}" alt=""></button>`;
    }).join('')}</div><p class="hint bio"><b>${esc(mh.n)}</b>${mh.b ? ' · ' + esc(mh.b) : ''}</p>` : '<p class="lbl">ამ თამაშს უყურებ</p>';
    // length
    const opts = [['rounds', 20], ['rounds', 30], ['rounds', 40], ['full', 0]];
    $('#cfg').innerHTML = `<p class="lbl">თამაშის ხანგრძლივობა</p><div class="seg">${opts.map(([m, r]) => {
      const on = st.cfg.mode === m && (m === 'full' || st.cfg.rounds === r);
      return `<button class="${on ? 'on' : ''}" data-cfg="${m}:${r}" ${host ? '' : 'disabled'}>${m === 'full' ? 'ბოლომდე' : r + ' რაუნდი'}</button>`;
    }).join('')}</div><p class="hint">${st.cfg.mode === 'full' ? 'სანამ ერთი არ დარჩება.' : `${st.cfg.rounds} რაუნდის მერე იგებს ის, ვისი ფულიც და ქონებაც ერთად ყველაზე მეტია.`}</p>`;
    const full = st.players.length >= MAX_PLAYERS;
    $('#lobbyActs').innerHTML = host
      ? `<div class="row"><button class="btn" data-lob="addbot" ${full ? 'disabled' : ''}>+ ბოტი</button>${ROOM.role === 'local' ? `<button class="btn" data-lob="addlocal" ${full ? 'disabled' : ''}>+ მოთამაშე</button>` : ''}</div>
         <button class="btn gold wide big" data-lob="start" ${st.players.length < 2 ? 'disabled' : ''}>დაწყება</button>${st.players.length < 2 ? '<p class="hint">დაამატე ბოტი ან დაელოდე მეგობრებს.</p>' : ''}`
      : `<p class="waiting">მასპინძელი თამაშს დაიწყებს, როცა ყველა შემოვა.</p>`;
  }
  // the room is being reached (or made): its code is known already, the rest is not
  function connecting() {
    if (!ROOM || UI.screen !== 'lobby') return;
    $('#lobbyTitle').textContent = 'ოთახი';
    $('#codeBox').hidden = false;
    $('#roomCode').textContent = ROOM.code || '····';
    $('#roomState').textContent = 'ვუკავშირდები…';
    $('#seats').innerHTML = `<li class="seat wait"><i></i><div><b>ვუკავშირდები…</b><small>${ROOM.role === 'host' ? 'ოთახი იქმნება' : 'ოთახს ვეძებ'}</small></div></li>`;
    $('#lobbyHeroes').innerHTML = $('#cfg').innerHTML = $('#lobbyActs').innerHTML = '';
  }
  function onClick(ev) {
    Sound.unlock();
    const bid = ev.target.closest('button') && ev.target.closest('button').id;
    if (bid === 'bLeave') { leaveRoom(false); setHash(''); UI.go('menu'); return; }
    if (ev.target.closest('#bInvite, [data-invite]')) { invite(); return; }
    const st = View.st || (ROOM && ROOM.st);
    if (!st || !ROOM) return;
    const seat = ev.target.closest('[data-seat]'), kick = ev.target.closest('[data-kick]'), hero = ev.target.closest('[data-lhero]');
    const cfg = ev.target.closest('[data-cfg]'), lob = ev.target.closest('[data-lob]');
    if (kick) { const s = +kick.dataset.kick; move(st.players[s].pid === ROOM.me && ROOM.role !== 'local' ? { t: 'leave' } : { t: 'kick', s }); return; }
    if (hero && !hero.disabled) {
      const h = hero.dataset.lhero;
      if (ROOM.role !== 'local') { if (HEROES[h].t === 'archipelago') PROFILE.pirate = h; else PROFILE.hero = h; saveProfile(); }
      move({ t: 'hero', h, seat: sel });
      return;
    }
    const world = ev.target.closest('[data-pickworld]');
    if (world && !world.disabled) { PROFILE.theme = world.dataset.pickworld; saveProfile(); move({ t: 'theme', k: world.dataset.pickworld }); return; }
    if (seat && ROOM.role === 'local' && !st.players[+seat.dataset.seat].bot) { sel = +seat.dataset.seat; render(st); return; }
    if (cfg && !cfg.disabled) { const [mode, r] = cfg.dataset.cfg.split(':'); move({ t: 'cfg', mode, rounds: +r || st.cfg.rounds }); return; }
    if (lob && !lob.disabled) {
      if (lob.dataset.lob === 'start') { move({ t: 'start' }); return; }
      move({ t: lob.dataset.lob });
      return;
    }
  }
  // the room's link, the way მეტეხი does it: the phone's share sheet, or (on a computer) copied for pasting anywhere
  function invite() {
    if (!ROOM || !ROOM.code) return;
    const url = roomLink(ROOM.code), text = `ერთად ვითამაშოთ მამული! ოთახის კოდი: ${ROOM.code}`;
    if (navigator.share && TOUCH) { navigator.share({ title: 'მამული', text, url }).catch(() => { }); return; }
    const done = () => UI.toast(`ბმული დაკოპირდა · კოდი ${esc(ROOM.code)}`, 2400, 'good');
    const show = () => UI.toast(esc(url), 5000);
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(url).then(done, show); return; } } catch (e) { }
    show();
  }
  return { render, onClick, invite, connecting };
})();
const TOUCH = (() => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return 'ontouchstart' in window; } })();
// the invitation link: this page's address with the room in it (a forced test identity is not passed on)
function roomLink(code) {
  try { const u = new URL(location.href); u.hash = ''; u.searchParams.delete('pid'); return u.href.replace(/#$/, '') + '#join=' + code; }
  catch (e) { return location.href.split('#')[0] + '#join=' + code; }
}
// a room code in a link (…#join=ABCD, or the older …#ABCD), or in pasted text
function codeFrom(text) {
  const m = /join=([A-Za-z0-9]{4})(?![A-Za-z0-9])/.exec(text || '') || /^#?([A-Za-z0-9]{4})$/.exec((text || '').trim());
  return m ? m[1].toUpperCase() : '';
}

// ----- wiring -----
function boot() {
  $('#scr-menu').addEventListener('click', Menu.onClick);
  $('#nameIn').addEventListener('change', e => { PROFILE.name = Engine.cleanName(e.target.value); saveProfile(); });
  // the code, or a whole invitation link pasted in
  $('#codeIn').addEventListener('input', e => { const v = e.target.value; e.target.value = (codeFrom(v) || v).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); });
  $('#codeIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('#bJoin').click(); });
  $('#scr-lobby').addEventListener('click', Lobby.onClick);
  $('#sheet').addEventListener('click', Sheet.onClick);
  $('#scr-game').addEventListener('click', ev => {
    Sound.unlock();
    const a = ev.target.closest('#panel [data-a], #buycard [data-a]');
    if (a && !a.disabled) {
      const m = { t: a.dataset.a };
      if (a.dataset.seat != null) m.seat = +a.dataset.seat;
      if (a.dataset.inc) m.inc = +a.dataset.inc;
      if (a.dataset.c != null) { m.c = +a.dataset.c; a.classList.add('picked'); }      // the chest's answer
      move(m);
      return;
    }
    if (ev.target.closest('#bView')) return View.view();
    const d = ev.target.closest('#panel [data-deed]');
    if (d) return Sheet.open('deed', +d.dataset.deed);
    const sh = ev.target.closest('#panel [data-sheet], #buycard [data-sheet]');
    if (sh) return Sheet.open(sh.dataset.sheet);
    const b = ev.target.closest('.dock button');
    if (b && !b.disabled) Sheet.open(b.dataset.open);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') Sheet.close(); });
  document.addEventListener('pointerdown', () => Sound.unlock(), { once: true });
  UI.go('menu');
  // a friend's link: straight into their room (also when the link is opened while the game is already open)
  const fromLink = () => {
    const code = codeFrom(location.hash);
    if (!SITE || !code || (ROOM && ROOM.mode === 'online' && ROOM.code === code)) return;
    if (ROOM && ROOM.st && ROOM.st.phase !== 'lobby' && ROOM.mode === 'online') return;    // not out of a game in progress
    joinRoom(code);
  };
  fromLink();
  window.addEventListener('hashchange', fromLink);
  offlineHelper();
  // the 3D board is made in the background while the menu is on screen, so that a game starts without a stall
  setTimeout(() => Board3D.prepare($('#stage')), 400);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
