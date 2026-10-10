// ===== talking in an online room: each phone's microphone to the others, straight from phone to phone =====
// Every phone has two switches, shown in the room and over the board: its microphone (off at first, and off again in
// every new room) and the others' voices (on at first; this phone remembers). What each has on is part of what it tells
// the room (presence), and a short message says it at once. Two phones are joined when one of them speaks and the other
// listens: WebRTC carries the sound between them, peer to peer, and the room's channel only carries the handshake (the
// phone whose id sorts first offers, the other answers, and each sends all its addresses at once: two messages). Some
// mobile networks let no direct connection through; between such phones the sound would need a relay (a TURN server,
// below: none yet), so they cannot hear each other, and say so.
// Each speaker's voice also goes to a level meter, so that the chips of the players show who is speaking.

const Voice = (() => {
  const ok = typeof RTCPeerConnection !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }];
  const TURN = [];                       // a relay, once there is one: { urls: 'turn:…', username: '…', credential: '…' }
  let mic = false, hear = store.get('voice.hear') !== false, vn = Date.now(), track = null, mine = null, asking = false, blocked = false;
  let actx = null, tickT = 0, ticks = 0, unblocking = false;
  const conns = new Map(), flags = {}, tries = {}, told = {}, loud = {};
  const live = () => ok && !!ROOM && ROOM.mode === 'online';
  const vo = () => (mic ? 1 : 0) | (hear ? 2 : 0);

  // ----- who has what on -----
  function setFlags(pid, o, n) {
    if (typeof o !== 'number' || pid === (ROOM && ROOM.me)) return;
    const f = flags[pid];
    if (f && (n || 0) < f.n) return;                         // an older word (presence comes a few seconds after the message)
    flags[pid] = { o, n: n || 0 };
  }
  // two phones are joined while one speaks and the other listens
  function wanted(pid) {
    const f = flags[pid];
    if (!live() || !f || pid === ROOM.me || !ROOM.peers[pid]) return false;
    return (mic && (f.o & 2) > 0) || ((f.o & 1) > 0 && hear);
  }
  function update() {
    if (!live()) return;
    const t = Date.now();
    for (const pid in ROOM.peers) {
      if (pid === ROOM.me || conns.has(pid) || !wanted(pid) || ROOM.me > pid) continue;     // (the other phone offers)
      if (tries[pid] && tries[pid].wait > t) continue;
      offer(pid);
    }
    for (const [pid, C] of conns) {
      feed(C);
      if (wanted(pid)) { C.idle = 0; continue; }
      if (!C.idle) C.idle = t; else if (t - C.idle > 6000) close(pid, true);           // not needed for a while: closed
    }
    render();
  }
  // this phone's voice goes to a phone that listens, and to no other
  function feed(C) {
    const f = flags[C.pid], want = !!(mic && track && f && (f.o & 2));
    if (!C.tr || C.feeding === want) return;
    C.feeding = want;
    C.tr.sender.replaceTrack(want ? track : null).catch(() => { C.feeding = null; });
  }

  // ----- the connections -----
  function connect(pid, n) {
    const pc = new RTCPeerConnection({ iceServers: ICE.concat(TURN) });
    const C = { pid, pc, n: n || Math.random().toString(36).slice(2, 10), tr: null, audio: null, meter: null, at: Date.now(), up: false, idle: 0, timer: 0 };
    conns.set(pid, C);
    pc.ontrack = e => attach(C, (e.streams && e.streams[0]) || new MediaStream([e.track]));
    const watch = () => {
      if (conns.get(pid) !== C) return;
      const s = pc.connectionState || pc.iceConnectionState;
      if (s === 'connected' || s === 'completed') { if (!C.up) Diag.note('voice', `connected to ${pid} in ${Date.now() - C.at} ms`); C.up = true; tries[pid] = null; clearTimeout(C.timer); }
      else if (s === 'failed') lost(C, 'failed');
      else if (s === 'disconnected') setTimeout(() => { if (conns.get(pid) === C && (pc.connectionState || pc.iceConnectionState) === 'disconnected') lost(C, 'disconnected'); }, 8000);
      render();
    };
    pc.onconnectionstatechange = watch;
    pc.oniceconnectionstatechange = watch;
    C.timer = setTimeout(() => { if (conns.get(pid) === C && !C.up) lost(C, 'no connection'); }, 16000);
    return C;
  }
  // all of this phone's addresses are in the description it sends (gathered first: then two messages are enough)
  const gathered = pc => new Promise(done => {
    if (pc.iceGatheringState === 'complete') return done();
    const t = setTimeout(done, 3000);
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); done(); } });
  });
  async function offer(pid) {
    const C = connect(pid);
    try {
      C.tr = C.pc.addTransceiver('audio', { direction: 'sendrecv' });
      feed(C);
      await C.pc.setLocalDescription(await C.pc.createOffer());
      await gathered(C.pc);
      if (conns.get(pid) !== C) return;
      send('v', { k: 'offer', n: C.n, sdp: C.pc.localDescription.sdp }, pid);
    } catch (e) { lost(C, 'offer: ' + (e && e.message)); }
  }
  async function answer(pid, d) {
    if (conns.has(pid)) close(pid, false);                  // that phone started again (a reload, a lost connection)
    const C = connect(pid, d.n);
    try {
      await C.pc.setRemoteDescription({ type: 'offer', sdp: d.sdp });
      C.tr = C.pc.getTransceivers()[0] || null;
      if (C.tr) { C.tr.direction = 'sendrecv'; feed(C); }
      await C.pc.setLocalDescription(await C.pc.createAnswer());
      await gathered(C.pc);
      if (conns.get(pid) !== C) return;
      send('v', { k: 'answer', n: C.n, sdp: C.pc.localDescription.sdp }, pid);
    } catch (e) { lost(C, 'answer: ' + (e && e.message)); }
  }
  // it did not work out: tried again a little later (by the phone that offers); after two tries the player is told
  function lost(C, why, quiet) {
    if (conns.get(C.pid) !== C) return;
    Diag.note('voice', `${C.pid}: ${why}`);
    const t = tries[C.pid] = tries[C.pid] || { n: 0, wait: 0 };
    t.n++; t.wait = Date.now() + Math.min(60000, 5000 * t.n);
    close(C.pid, !quiet);
    if (t.n >= 2 && !told[C.pid] && wanted(C.pid)) {
      told[C.pid] = 1;
      UI.toast(`${esc(who(C.pid))}: ხმოვანი კავშირი ვერ დამყარდა. ზოგი მობილური ქსელი პირდაპირ კავშირს არ უშვებს; სცადე Wi-Fi.`, 6000, 'bad');
    }
    setTimeout(update, t.wait - Date.now() + 50);
  }
  function close(pid, bye) {
    const C = conns.get(pid);
    if (!C) return;
    conns.delete(pid);
    clearTimeout(C.timer);
    try { C.pc.close(); } catch (e) { }
    if (C.audio) { C.audio.srcObject = null; C.audio.remove(); }
    if (C.meter) try { C.meter.src.disconnect(); } catch (e) { }
    if (bye && live()) send('v', { k: 'bye', n: C.n }, pid);
    render();
  }
  const who = pid => { const st = ROOM && ROOM.st, s = st ? Engine.seatOf(st, pid) : -1; return s >= 0 ? st.players[s].name : (ROOM && ROOM.peers[pid] && ROOM.peers[pid].name) || '?'; };

  // ----- the sound: each voice through its own (hidden) player, and into a level meter -----
  function audioCtx() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } }
    if (actx && actx.state === 'suspended') actx.resume().catch(() => { });
    return actx;
  }
  function meter(stream) {
    const a = audioCtx();
    if (!a) return null;
    try { const src = a.createMediaStreamSource(stream), an = a.createAnalyser(); an.fftSize = 512; src.connect(an); return { src, an, buf: new Uint8Array(an.fftSize) }; } catch (e) { return null; }
  }
  const level = m => { if (!m) return 0; m.an.getByteTimeDomainData(m.buf); let s = 0; for (let k = 0; k < m.buf.length; k++) { const x = (m.buf[k] - 128) / 128; s += x * x; } return Math.sqrt(s / m.buf.length); };
  function attach(C, stream) {
    if (!C.audio) {
      const a = document.createElement('audio');
      a.autoplay = true; a.setAttribute('playsinline', ''); a.hidden = true;
      (document.getElementById('voices') || document.body).appendChild(a);
      C.audio = a;
    }
    C.audio.srcObject = stream;
    C.audio.muted = !hear;
    play(C.audio);
    C.meter = meter(stream);
  }
  // a browser plays sound only after a touch: what could not start is started by the next one
  function play(a) { const p = a.play(); if (p && p.catch) p.catch(() => { if (hear && !blocked) { blocked = true; render(); } }); }
  document.addEventListener('pointerdown', () => {
    unblocking = blocked;
    if (!conns.size) return;
    audioCtx();
    let any = false;
    for (const C of conns.values()) if (C.audio && C.audio.paused) { any = true; C.audio.play().then(() => { if (blocked) { blocked = false; render(); } }, () => { }); }
    if (!any && blocked) { blocked = false; render(); }
  }, true);

  // ----- the switches -----
  async function setMic(on) {
    if (!ok || on === mic || asking) return;
    if (on) {
      if (!live()) return;
      asking = true; render();
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        track = s.getAudioTracks()[0] || null;
      } catch (e) {
        asking = false;
        Diag.note('voice', 'microphone: ' + (e && (e.name || e.message)));
        UI.toast(e && e.name === 'NotAllowedError' ? 'მიკროფონის ნება არ არის. დართე ნება ბრაუზერში (საიტის პარამეტრები → მიკროფონი) და სცადე თავიდან.' : 'მიკროფონი ვერ ჩაირთო.', 5600, 'bad');
        render();
        return;
      }
      asking = false;
      if (!track || !live()) { if (track) track.stop(); track = null; render(); return; }      // (the room was left meanwhile)
      track.onended = () => { if (mic) setMic(false); };                                       // a phone call, the system took it
      mine = meter(new MediaStream([track]));
      mic = true;
    } else {
      mic = false;
      if (track) track.stop();
      track = null; mine = null;
    }
    for (const C of conns.values()) { C.feeding = null; feed(C); }       // (a new microphone track: given again)
    say();
  }
  function setHear(on) {
    hear = !!on;
    store.set('voice.hear', hear);
    if (hear) audioCtx();
    for (const C of conns.values()) if (C.audio) { C.audio.muted = !hear; if (hear) play(C.audio); }
    if (!hear) blocked = false;
    say();
  }
  // what changed goes to the room at once (and with this phone's presence, for those who come later)
  function say() {
    vn = Date.now();
    if (live()) { send('v', { k: 'st', o: vo(), vn }); if (ROOM.net) ROOM.net.track(meta()); }
    update();
  }

  // ----- what the room says -----
  function msg(from, d) {
    if (!ok || !d || !live()) return;
    if (d.k === 'st') { setFlags(from, d.o, d.vn); update(); return; }
    if (d.k === 'offer' && typeof d.sdp === 'string' && typeof d.n === 'string') { answer(from, d); return; }
    if (d.k === 'answer' && typeof d.sdp === 'string') {
      const C = conns.get(from);
      if (C && C.n === d.n && C.pc.signalingState === 'have-local-offer') C.pc.setRemoteDescription({ type: 'answer', sdp: d.sdp }).catch(e => lost(C, 'answer: ' + (e && e.message)));
      return;
    }
    if (d.k === 'bye') {                                     // the other phone closed it: not needed, or it never got through
      const C = conns.get(from);
      if (C && C.n === d.n) { if (C.up) close(from, false); else lost(C, 'given up by the other phone', true); }
    }
  }
  function peers(map) {
    if (!ok) return;
    for (const pid in map) { const p = map[pid]; if (p && typeof p.vo === 'number') setFlags(pid, p.vo, p.vn); }
    update();
  }
  // out of the room: every connection closed, the microphone too (the others' voices stay as they were)
  function leave() {
    for (const pid of [...conns.keys()]) close(pid, false);
    if (track) track.stop();
    track = null; mine = null; mic = false; asking = false; blocked = false;
    for (const o of [flags, tries, told, loud]) for (const k in o) delete o[k];
    render();
  }

  // ----- on the screen: the two switches (in the room and over the board), and who speaks on the players' chips -----
  const ICONS = {
    mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2.5" width="6" height="11.5" rx="3" fill="currentColor"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21.2h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    micOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2.5" width="6" height="11.5" rx="3" fill="currentColor" opacity=".55"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21.2h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".55"/><path d="M4 3.5l16 17" stroke="#ff6a5c" stroke-width="2.4" stroke-linecap="round"/></svg>',
    hear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 9h4l5-4.2v14.4l-5-4.2h-4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.2a8 8 0 0 1 0 11.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    hearOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 9h4l5-4.2v14.4l-5-4.2h-4z" fill="currentColor" opacity=".55"/><path d="M16 9.2l5 5.6M21 9.2l-5 5.6" stroke="#ff6a5c" stroke-width="2.3" stroke-linecap="round"/></svg>'
  };
  function render() {
    const show = live();
    for (const bar of document.querySelectorAll('[data-vbar]')) if (bar.hidden === show) bar.hidden = !show;
    if (!show) return chips();
    const joined = [...conns.values()].filter(C => C.up).length;
    for (const b of document.querySelectorAll('[data-voice="mic"]')) {
      const key = `${mic}${asking}`;
      if (b.dataset.k !== key) {
        b.dataset.k = key;
        b.innerHTML = mic ? ICONS.mic : ICONS.micOff;
        b.classList.toggle('on', mic); b.classList.toggle('wait', asking);
        b.setAttribute('aria-pressed', mic ? 'true' : 'false');
        b.title = mic ? 'მიკროფონი ჩართულია: გესმით (დააჭირე გამოსართავად)' : 'მიკროფონის ჩართვა: ილაპარაკე სხვებთან';
        b.setAttribute('aria-label', b.title);
      }
    }
    for (const b of document.querySelectorAll('[data-voice="hear"]')) {
      const key = `${hear}${blocked}${joined}`;
      if (b.dataset.k !== key) {
        b.dataset.k = key;
        b.innerHTML = hear ? ICONS.hear : ICONS.hearOff;
        b.classList.toggle('on', hear); b.classList.toggle('ask', hear && blocked);
        b.setAttribute('aria-pressed', hear ? 'true' : 'false');
        b.title = hear ? (blocked ? 'შეეხე ეკრანს, რომ სხვების ხმა გაიგო' : 'სხვების ხმა ჩართულია (დააჭირე გამოსართავად)') : 'სხვების ხმა გამორთულია (დააჭირე ჩასართავად)';
        b.setAttribute('aria-label', b.title);
      }
    }
    chips();
    if ((mic || conns.size) && !tickT) tickT = setInterval(tick, 160);
  }
  // the players' chips: a microphone on those who have it on, and a ring round whoever is speaking now
  function chips() {
    const st = ROOM && ROOM.st;
    for (const el of document.querySelectorAll('#players .pl[data-s], #seats .seat[data-seat]')) {
      const s = +(el.dataset.s != null ? el.dataset.s : el.dataset.seat), pid = st && st.players[s] ? st.players[s].pid : '';
      const on = live() && !!pid && (pid === ROOM.me ? mic : !!(flags[pid] && flags[pid].o & 1));
      const talk = on && loud[pid] > Date.now();
      if (el.classList.contains('vmic') !== on) el.classList.toggle('vmic', on);
      if (el.classList.contains('talk') !== talk) el.classList.toggle('talk', talk);
    }
  }
  function tick() {
    if (!live() || (!mic && !conns.size)) { clearInterval(tickT); tickT = 0; for (const k in loud) delete loud[k]; chips(); return; }
    const t = Date.now();
    if (mic && mine && level(mine) > 0.035) loud[ROOM.me] = t + 450;
    for (const [pid, C] of conns) if (C.up && C.meter && level(C.meter) > 0.03) loud[pid] = t + 450;
    chips();
    if (++ticks % 6 === 0) update();                        // (connections no longer needed close after a while)
  }
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-voice]');
    if (!b) return;
    ev.preventDefault();
    if (b.dataset.voice === 'mic') setMic(!mic);
    else if (unblocking && hear) unblocking = false;       // the touch that let the voices play: they stay on
    else setHear(!hear);
  });

  return {
    ok, msg, peers, leave, render, chips, setMic, setHear,
    get vo() { return vo(); }, get vn() { return vn; }, get mic() { return mic; }, get hear() { return hear; },
    // for the technical log and tests
    _state: () => ({ mic, hear, blocked, flags: JSON.parse(JSON.stringify(flags)), conns: [...conns.values()].map(C => ({ pid: C.pid, up: C.up, state: C.pc.connectionState || C.pc.iceConnectionState, sending: !!(C.tr && C.tr.sender.track) })) }),
    _stats: async () => { const out = {}; for (const [pid, C] of conns) { let rx = 0, tx = 0; (await C.pc.getStats()).forEach(r => { if (r.type === 'inbound-rtp' && r.kind === 'audio') rx += r.bytesReceived || 0; if (r.type === 'outbound-rtp' && r.kind === 'audio') tx += r.bytesSent || 0; }); out[pid] = { rx, tx }; } return out; }
  };
})();
