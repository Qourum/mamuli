// ===== the menu, the room's lobby, and starting up =====

const PROFILE = (() => {
  const p = store.get('profile') || {};
  return { hero: HEROES[p.hero] ? p.hero : 'david', name: Engine.cleanName(p.name || '') };
})();
const saveProfile = () => store.set('profile', PROFILE);
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
    else if (id === 'bRules') { Sheet.open('rules'); }
  }
  return { render, onClick };
})();

// ----- the lobby: who is in, which hero, how long, start -----
const Lobby = (() => {
  let sel = -1;                                 // on a shared device: whose hero is being chosen
  function render(st) {
    if (!st || UI.screen !== 'lobby') { if (st && st.phase === 'lobby') UI.go('lobby'); else return; }
    const online = ROOM && ROOM.mode === 'online', host = ROOM && (ROOM.role === 'local' || st.host === ROOM.me);
    const mine = s => ROOM && (ROOM.role === 'local' ? !st.players[s].bot : st.players[s].pid === ROOM.me);
    if (sel < 0 || !st.players[sel] || !mine(sel)) sel = st.players.findIndex((p, s) => mine(s));
    $('#lobbyTitle').textContent = online ? 'ოთახი' : 'თამაში ამ მოწყობილობაზე';
    const codeBox = $('#codeBox');
    codeBox.hidden = !online;
    if (online) {
      $('#roomCode').textContent = ROOM.code || '····';
      const here = Object.keys(ROOM.peers || {}).length;
      $('#roomState').textContent = !ROOM.up ? 'ვუკავშირდები…' : st.players.length ? `ოთახში ${here || 1} ადამიანია` : 'ვუკავშირდები…';
    }
    $('#seats').innerHTML = st.players.map((p, s) => {
      const tags = [p.pid === st.host && online ? '<span class="tag">მასპინძელი</span>' : '', p.bot ? '<span class="tag">ბოტი</span>' : '',
        online && p.pid === ROOM.me ? '<span class="tag me">შენ</span>' : '', online && !p.bot && p.pid !== ROOM.me && ROOM.peers && !ROOM.peers[p.pid] ? '<span class="tag warn">კავშირს ელოდება</span>' : ''].join('');
      const canKick = host ? p.pid !== st.host : p.pid === (ROOM && ROOM.me);
      return `<li class="seat${s === sel ? ' sel' : ''}" data-seat="${s}" style="--c:${SEAT_COLORS[s]}"><img src="${por(p.hero)}" alt=""><div><b>${esc(p.name)}</b><small>${esc(HEROES[p.hero].n)}</small><span class="tags">${tags}</span></div>${canKick && st.players.length > 1 ? `<button class="ib" data-kick="${s}" aria-label="მოშორება">×</button>` : ''}</li>`;
    }).join('') + (st.players.length < MAX_PLAYERS ? `<li class="seat empty">${MAX_PLAYERS - st.players.length} ადგილი თავისუფალია</li>` : '');
    // the hero of the selected seat
    const me = st.players[sel];
    $('#lobbyHeroes').innerHTML = me ? `<p class="lbl">${online ? 'შენი გმირი' : esc(me.name) + ': გმირი'}</p><div class="hero-pick">${HERO_KEYS.map(h => {
      const taken = st.players.some((p, s) => s !== sel && p.hero === h);
      return `<button class="hero${me.hero === h ? ' on' : ''}" data-lhero="${h}" ${taken ? 'disabled' : ''} aria-label="${esc(HEROES[h].n)}"><img src="${por(h)}" alt=""></button>`;
    }).join('')}</div>` : '<p class="lbl">ამ თამაშს უყურებ</p>';
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
  function onClick(ev) {
    Sound.unlock();
    const st = View.st || (ROOM && ROOM.st);
    if (!st || !ROOM) return;
    const seat = ev.target.closest('[data-seat]'), kick = ev.target.closest('[data-kick]'), hero = ev.target.closest('[data-lhero]');
    const cfg = ev.target.closest('[data-cfg]'), lob = ev.target.closest('[data-lob]');
    if (kick) { const s = +kick.dataset.kick; move(st.players[s].pid === ROOM.me && ROOM.role !== 'local' ? { t: 'leave' } : { t: 'kick', s }); return; }
    if (hero && !hero.disabled) {
      if (ROOM.role !== 'local') { PROFILE.hero = hero.dataset.lhero; saveProfile(); }
      move({ t: 'hero', h: hero.dataset.lhero, seat: sel });
      return;
    }
    if (seat && ROOM.role === 'local' && !st.players[+seat.dataset.seat].bot) { sel = +seat.dataset.seat; render(st); return; }
    if (cfg && !cfg.disabled) { const [mode, r] = cfg.dataset.cfg.split(':'); move({ t: 'cfg', mode, rounds: +r || st.cfg.rounds }); return; }
    if (lob && !lob.disabled) {
      if (lob.dataset.lob === 'start') { move({ t: 'start' }); return; }
      move({ t: lob.dataset.lob });
      return;
    }
    const id = ev.target.closest('button') && ev.target.closest('button').id;
    if (id === 'bShare') share();
    else if (id === 'bCopy') copyLink();
    else if (id === 'bLeave') { leaveRoom(false); setHash(''); UI.go('menu'); }
  }
  const link = () => location.origin + location.pathname + '#' + ROOM.code;
  async function share() {
    const url = link();
    try { if (navigator.share) { await navigator.share({ title: 'მამული', text: `მამული: შემოდი ოთახში ${ROOM.code}`, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    copyLink();
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(link()); UI.toast('ბმული დაკოპირდა', 1800, 'good'); }
    catch (e) { UI.toast(`ბმული: ${esc(link())}`, 5000); }
  }
  return { render, onClick };
})();

// ----- wiring -----
function boot() {
  $('#scr-menu').addEventListener('click', Menu.onClick);
  $('#nameIn').addEventListener('change', e => { PROFILE.name = Engine.cleanName(e.target.value); saveProfile(); });
  $('#codeIn').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); });
  $('#codeIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('#bJoin').click(); });
  $('#scr-lobby').addEventListener('click', Lobby.onClick);
  $('#sheet').addEventListener('click', Sheet.onClick);
  $('#scr-game').addEventListener('click', ev => {
    Sound.unlock();
    const a = ev.target.closest('#panel [data-a], #buycard [data-a]');
    if (a && !a.disabled) { const m = { t: a.dataset.a }; if (a.dataset.seat != null) m.seat = +a.dataset.seat; move(m); return; }
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
  const code = (location.hash || '').replace('#', '').toUpperCase();
  UI.go('menu');
  if (SITE && /^[A-Z0-9]{4}$/.test(code)) joinRoom(code);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
