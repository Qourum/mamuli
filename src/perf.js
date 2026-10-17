// ===== the phone test: with ?test in the address, how the board runs on this device =====
// A badge at the screen's edge shows how many frames a second the board draws. Tapped, it opens a panel: the quality set
// by hand (the game's own choice, or low to maximum), the frame target (the game's own, 60, 120, or every frame the
// screen offers), and a test that turns the camera round the board for eight seconds under each quality and measures
// every drawn frame. The results go into the technical log and are copied, to be sent.

const PerfTest = (() => {
  if (!/[?&]test\b/.test(location.search)) return null;
  const QUAL = [['auto', 'ავტო'], ['low', 'დაბალი'], ['mid', 'საშუალო'], ['high', 'მაღალი'], ['max', 'მაქსიმუმი']];
  const CAPS = [['auto', 'ავტო'], [60, '60'], [120, '120'], [0, 'ზღვრის გარეშე']];
  const NAME = Object.fromEntries(QUAL);
  const RUNS = [['low', 0], ['mid', 0], ['high', 0], ['max', 0], ['auto', 'auto']];     // each quality as fast as it goes; then the game as it is
  const results = [];
  let badge = null, panel = null, hz = 0, preset = 'auto', cap = 'auto', busy = false, doing = '', lastF = 0, lastT = 0, fps = 0;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const info = () => (typeof Board3D !== 'undefined' && Board3D.test ? Board3D.test.info() : null);
  const gpuName = () => { try { return Board3D.gpu().replace(/^gpu /, '').split(' · ')[0]; } catch (e) { return '?'; } };
  const capOf = c => (c === 'auto' ? undefined : c);
  const set = o => Board3D.test.set(Object.assign({}, o, 'cap' in o ? { cap: o.cap === 'auto' ? null : o.cap } : {}));

  // the screen's own rate: the time between the frames the browser offers, over about a second
  function measureHz() {
    return new Promise(res => {
      const ts = [];
      const step = t => {
        ts.push(t);
        if (ts.length < 70) return requestAnimationFrame(step);
        const d = ts.slice(1).map((x, k) => x - ts[k]).sort((a, b) => a - b);
        res(Math.round(1000 / d[d.length >> 1]));
      };
      requestAnimationFrame(step);
    });
  }
  function tick() {
    const now = performance.now(), p = typeof Board3D !== 'undefined' && Board3D._perf ? Board3D._perf() : null;
    if (p && lastT) fps = Math.round((p.frames - lastF) * 1000 / (now - lastT));
    if (p) { lastF = p.frames; lastT = now; }
    const i = info();
    if (badge) badge.textContent = i && i.playing ? `${fps} fps · ${i.pr}x` : 'ტესტი';
    if (panel && !panel.hidden) status();
  }
  function status() {
    const s = panel.querySelector('[data-st]'), i = info();
    if (!s) return;
    s.textContent = doing || (i ? `${i.w}×${i.h} პიქსელი (${i.pr}x) · ჩრდილები ${i.shadows ? `${i.soft ? 'რბილი' : 'ჩვეულებრივი'} ${i.map}` : 'არა'} · ${Math.round(i.tris / 1000)} ათასი სამკუთხედი, ${i.calls} ხატვა · ${fps} fps (მიზანი ${i.target})` : '3D დაფა ჯერ არ არის');
  }
  function line(r) {
    const s = r.s, c = r.cap === 'auto' ? `მიზანი ${r.target}` : 'ზღვრის გარეშე';
    return `${NAME[r.q]} ${r.w}×${r.h} (${r.pr}x, ${c}): ` + (s ? `${s.fps} fps · ნელი 1% ${s.low1} · უარესი ${s.worst} მწ · შეფერხება ${s.stutters}/${s.frames}` : 'კადრები არ მოვიდა');
  }
  function report() {
    const i = info() || {};
    return [`შენი ჯერი · ტელეფონის ტესტი ${typeof BUILD !== 'undefined' ? BUILD : ''}`, navigator.userAgent,
      `ეკრანი ${screen.width}×${screen.height} · dpr ${window.devicePixelRatio || 1} · ${hz || '?'} ჰც · ${gpuName()} · ${i.mobile ? 'ტელეფონი' : 'კომპიუტერი'}`,
      `სამყარო ${i.world || '?'}`, ...results.map(line)].join('\n');
  }
  function render() {
    const i = info(), playing = i && i.playing;
    panel.innerHTML = `
      <h3>ტელეფონის ტესტი</h3>
      <small>${esc(gpuName())} · ეკრანი ${screen.width}×${screen.height}, dpr ${window.devicePixelRatio || 1}${hz ? ` · ${hz} ჰც` : ''}</small>
      <small class="st" data-st></small>
      <b>ხარისხი</b>
      <div class="row">${QUAL.map(([k, n]) => `<button class="btn small${k === preset ? ' on' : ''}" data-q="${k}" ${busy ? 'disabled' : ''}>${n}</button>`).join('')}</div>
      <b>კადრები წამში</b>
      <div class="row">${CAPS.map(([k, n]) => `<button class="btn small${k === cap ? ' on' : ''}" data-cap="${k}" ${busy ? 'disabled' : ''}>${n}</button>`).join('')}</div>
      <div class="row"><button class="btn gold wide" data-run ${busy || !playing ? 'disabled' : ''}>${busy ? 'ტესტი მიდის…' : 'ტესტის გაშვება (1 წუთი)'}</button></div>
      ${playing ? '' : '<small>ჯერ თამაში დაიწყე ბოტებთან, მერე აქ გაუშვი ტესტი: კამერა დაფას შემოუვლის და ყოველ კადრს გაზომავს.</small>'}
      ${results.length ? `<pre data-res>${esc(report())}</pre><div class="row"><button class="btn wide" data-copy ${busy ? 'disabled' : ''}>შედეგების კოპირება</button></div>` : ''}
      <div class="row"><button class="btn ghost wide" data-close>დახურვა</button></div>`;
    status();
  }
  async function runAll() {
    const i = info();
    if (busy || !i || !i.playing) return;
    busy = true; results.length = 0; render();
    if (!hz) hz = await measureHz();
    for (const [q, c] of RUNS) {
      set({ preset: q, cap: c });
      doing = `${NAME[q]}: მზადდება…`; status();
      await wait(1500);                              // the shaders made again, the first slow frames over
      doing = `${NAME[q]}: იზომება…`; status();
      const s = await Board3D.test.bench(8), a = info() || {};
      const r = { q, cap: c, s, pr: a.pr, w: a.w, h: a.h, target: a.target };
      results.push(r);
      Diag.note('test', line(r));
      render();
    }
    doing = '';
    set({ preset, cap });
    busy = false; render();
  }
  function copy() {
    const text = report(), pre = panel.querySelector('[data-res]');
    const select = () => { if (!pre) return; const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); UI.toast('მონიშნულია: დააკოპირე'); };
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(() => UI.toast('დაკოპირდა'), select); return; } } catch (e) { }
    select();
  }
  function onClick(e) {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.q) { preset = b.dataset.q; set({ preset }); render(); }
    else if (b.dataset.cap != null) { cap = b.dataset.cap === 'auto' ? 'auto' : +b.dataset.cap; set({ cap }); render(); }
    else if (b.hasAttribute('data-run')) runAll();
    else if (b.hasAttribute('data-copy')) copy();
    else if (b.hasAttribute('data-close')) panel.hidden = true;
  }
  function start() {
    badge = document.createElement('button');
    badge.className = 'ptest-badge'; badge.type = 'button'; badge.textContent = 'ტესტი';
    badge.setAttribute('aria-label', 'ტელეფონის ტესტი');
    badge.addEventListener('click', () => { panel.hidden = !panel.hidden; if (!panel.hidden) render(); });
    panel = document.createElement('div');
    panel.className = 'ptest'; panel.hidden = true;
    panel.addEventListener('click', onClick);
    document.body.append(badge, panel);
    setInterval(tick, 500);
    setTimeout(() => measureHz().then(h => { hz = h; if (!panel.hidden) render(); }), 2500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  return { report, get results() { return results; }, runAll, capOf };
})();
