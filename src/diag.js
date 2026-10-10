// ===== the technical log: what this phone went through, to copy and send when something goes wrong =====
// Errors, the 3D board losing or getting back its graphics, slow frames (and what was on the screen then), shaders made
// in the middle of a game, how each throw of the dice was got, the connection coming and going. A few hundred lines,
// kept in memory only; the menu shows them with a summary of the device, and a button copies it all.

const Diag = (() => {
  const t0 = Date.now(), lines = [];
  const at = () => ((Date.now() - t0) / 1000).toFixed(1);
  function note(kind, text) {
    lines.push(`${at()} ${kind} ${String(text == null ? '' : text).replace(/\s+/g, ' ').slice(0, 240)}`);
    if (lines.length > 300) lines.splice(0, lines.length - 300);
  }
  // what the screen is busy with (the event being shown)
  const doing = () => { try { return (typeof View !== 'undefined' && View.playing) || 'idle'; } catch (e) { return '?'; } };
  window.addEventListener('error', e => note('error', `${e.message || e} @${String(e.filename || '').split('/').pop()}:${e.lineno || 0}:${e.colno || 0}`));
  window.addEventListener('unhandledrejection', e => { const r = e.reason; note('reject', (r && (r.stack || r.message)) || r); });
  document.addEventListener('visibilitychange', () => note('page', document.visibilityState));
  window.addEventListener('pageshow', e => note('page', 'shown' + (e.persisted ? ' from the back-forward cache' : '')));
  // a frame that came very late (the board's loop tells; a page in the background has no frames and is not counted)
  const slow = ms => note('slow', `frame after ${Math.round(ms)} ms, showing ${doing()}${typeof Dice3D !== 'undefined' && Dice3D.busy ? ', dice rolling' : ''}`);
  function device() {
    const n = navigator, s = screen, out = [];
    out.push(`მამული ${typeof BUILD !== 'undefined' ? BUILD : ''} · ${new Date().toISOString()}`);
    out.push(n.userAgent);
    const installed = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || n.standalone;
    out.push(`screen ${s.width}x${s.height} · window ${innerWidth}x${innerHeight} · dpr ${window.devicePixelRatio || 1} · ${installed ? 'installed' : 'in the browser'}${window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches ? ' · less motion' : ''}`);
    try { if (typeof Board3D !== 'undefined' && Board3D.gpu) out.push(Board3D.gpu()); } catch (e) { out.push('gpu ?'); }
    try {
      if (typeof ROOM !== 'undefined' && ROOM) {
        const st = ROOM.st;
        out.push(`room ${ROOM.mode}/${ROOM.role}${ROOM.code ? ' ' + ROOM.code : ''}${ROOM.mode === 'online' ? ` · connection ${ROOM.up ? 'up' : 'down'}` : ''}${st ? ` · players ${st.players.length} · phase ${st.phase} · seq ${st.seq} · events ${st.evn}` : ''}`);
      }
    } catch (e) { }
    return out.join('\n');
  }
  const report = () => [device(), '', ...lines].join('\n');
  return { note, report, doing, slow };
})();
