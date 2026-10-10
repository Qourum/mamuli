// Small native 3D reveals for the event cards. No generation service is called at play time.
// Only one card renderer is alive; a closed/replaced card releases its scene and WebGL context.
const Card3D = (() => {
  let active = null;
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
  const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

  function mount(host, kind = 'bottle') {
    if (active) active.dispose();
    if (!host || !window.THREE) return null;
    const T = window.THREE;
    let renderer, scene, camera, frame = 0, disposed = false, resize = null, lost = null, draw = null;
    const objects = new Set(), materials = new Set(), textures = new Set();
    function dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      if (resize) resize.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      if (renderer) {
        if (lost) renderer.domElement.removeEventListener('webglcontextlost', lost);
        renderer.renderLists.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      }
      objects.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
      textures.forEach(t => t.dispose());
      host.classList.remove('has-3d');
      if (active === controller) active = null;
    }
    const controller = { dispose };
    // Hoisted so cleanup is also safe when constructing the renderer fails.
    function visibility() {
      if (disposed) return;
      if (document.visibilityState === 'hidden') cancelAnimationFrame(frame);
      else if (draw) draw(performance.now());
    }
    try {
      renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(1.25, window.devicePixelRatio || 1));
      renderer.outputEncoding = T.sRGBEncoding;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.setAttribute('aria-hidden', 'true');
      scene = new T.Scene();
      // Six tiny procedural studio faces give the curved glass and brass real reflected light.
      // Three filters this cube for PBR on its first render; disposing the source releases that cache.
      const studio = Array.from({ length: 6 }, (_, side) => {
        const face = document.createElement('canvas'); face.width = face.height = 128;
        const paint = face.getContext('2d'), wash = paint.createLinearGradient(0, 0, 0, 128);
        wash.addColorStop(0, '#597b86'); wash.addColorStop(.52, '#b8bdab'); wash.addColorStop(1, '#554737');
        paint.fillStyle = wash; paint.fillRect(0, 0, 128, 128);
        if (side === 0 || side === 4) {
          const softbox = paint.createLinearGradient(17, 0, 57, 0);
          softbox.addColorStop(0, '#aecbd5'); softbox.addColorStop(.24, '#f9f9e7'); softbox.addColorStop(.7, '#fff9da'); softbox.addColorStop(1, '#a1c3cb');
          paint.fillStyle = softbox; paint.fillRect(17, 10, 40, 105);
        }
        if (side === 2) { paint.fillStyle = '#fff1ce'; paint.fillRect(20, 20, 88, 88); }
        return face;
      });
      const environment = new T.CubeTexture(studio); environment.encoding = T.sRGBEncoding; environment.needsUpdate = true;
      textures.add(environment); scene.environment = environment;
      camera = new T.PerspectiveCamera(35, 1, .1, 20);
      camera.position.set(2.2, 1.65, 4.5);
      camera.lookAt(0, .12, 0);
      scene.add(new T.HemisphereLight(0xd7efff, 0x695233, 1.5));
      const key = new T.DirectionalLight(0xffedce, 3.2); key.position.set(-3, 5, 4); scene.add(key);
      const rim = new T.DirectionalLight(0x74d8ff, 1.6); rim.position.set(3, 2, -2); scene.add(rim);
      function mat(color, opt = {}) {
        const m = new T.MeshStandardMaterial({ color, roughness: .55, ...opt }); materials.add(m); return m;
      }
      function mesh(g, m, parent = scene) { objects.add(g); const v = new T.Mesh(g, m); parent.add(v); return v; }
      const gold = mat(0xe8b63c, { metalness: .87, roughness: .2, envMapIntensity: 1.1 });
      const wood = mat(0x67351c, { roughness: .75 });
      const wax = mat(kind === 'bottle' ? 0x972e24 : 0x763227, { roughness: .42 });
      const shadow = mesh(new T.CircleGeometry(1.22, 48), mat(0x071b23, { transparent: true, opacity: .13, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2; shadow.position.y = -.88; shadow.scale.y = .68;
      let animate;
      if (kind === 'chest') {
        const chest = new T.Group(); chest.rotation.y = -.16; chest.position.y = -.63; scene.add(chest);
        const base = mesh(new T.BoxGeometry(1.55, .65, .92), wood, chest); base.position.y = .1;
        const inside = mesh(new T.BoxGeometry(1.35, .08, .72), mat(0x261a10), chest); inside.position.y = .45;
        [-.56, .56].forEach(x => {
          const band = mesh(new T.BoxGeometry(.075, .68, .95), gold, chest); band.position.set(x, .1, 0);
        });
        const lock = mesh(new T.BoxGeometry(.22, .29, .09), gold, chest); lock.position.set(0, .27, .51);
        const slot = mesh(new T.BoxGeometry(.027, .095, .012), mat(0x2c2114), chest); slot.position.set(0, .28, .563);
        const lid = new T.Group(); lid.position.set(0, .46, -.46); chest.add(lid);
        const shell = mesh(new T.CylinderGeometry(.46, .46, 1.55, 28, 1, false, 0, Math.PI), wood, lid);
        shell.rotation.z = Math.PI / 2; shell.position.set(0, 0, .46);
        // A curved roof with two brass straps, joined to a hinge behind the chest.
        [-.56, .56].forEach(x => {
          const band = mesh(new T.TorusGeometry(.467, .035, 6, 26, Math.PI), gold, lid);
          band.rotation.y = Math.PI / 2; band.position.set(x, 0, .46);
        });
        const glow = new T.PointLight(0xffbb48, 0, 4); glow.position.set(0, .65, .22); chest.add(glow);
        const coins = [];
        for (let i = 0; i < 15; i++) {
          const c = mesh(new T.CylinderGeometry(.105, .105, .035, 20), gold, chest);
          const a = i * 2.39996, r = .16 + .026 * i;
          c.position.set(Math.cos(a) * r, .46 + (i % 3) * .043, Math.sin(a) * r * .68);
          c.rotation.set(.1 * Math.sin(i), 0, .1 * Math.cos(i));
          coins.push({ c, y: c.position.y, i });
        }
        const sparkleMat = mat(0xffd66b, { emissive: 0xffbe31, emissiveIntensity: .6, transparent: true, opacity: 0 });
        const sparkles = [];
        for (let i = 0; i < 6; i++) {
          const s = mesh(new T.OctahedronGeometry(.035), sparkleMat, chest);
          s.position.set(Math.sin(i * 2.1) * .52, .62 + i * .12, Math.cos(i) * .22); sparkles.push(s);
        }
        animate = p => {
          const open = smooth((p - .12) / .68);
          lid.rotation.x = -1.18 * open;
          glow.intensity = open * 1.5;
          coins.forEach(({ c, y, i }) => { c.position.y = y + Math.sin(Math.PI * smooth((p - .34) / .55)) * (.14 + i % 3 * .06); });
          sparkleMat.opacity = Math.sin(Math.PI * smooth((p - .38) / .62)) * .9;
          sparkles.forEach((s, i) => { s.rotation.y = p * 4 + i; });
        };
      } else {
        const isBottle = kind === 'bottle';
        if (isBottle) {
          const bottle = new T.Group(); bottle.position.set(-.64, -.77, .05); bottle.rotation.z = -.28; scene.add(bottle);
          const profile = [[0, 0], [.21, 0], [.31, .06], [.34, .2], [.33, .64], [.29, .8], [.14, .97], [.115, 1.13], [.15, 1.15]];
          const glass = new T.MeshPhysicalMaterial({ color: 0x286e62, metalness: 0, roughness: .09, clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: 1.2,
            transparent: true, opacity: .6, side: T.DoubleSide, depthWrite: false }); materials.add(glass);
          mesh(new T.LatheGeometry(profile.map(([r, y]) => new T.Vector2(r, y)), 40), glass, bottle);
          const rimGlass = new T.MeshPhysicalMaterial({ color: 0x64b9a7, roughness: .08, clearcoat: 1, envMapIntensity: 1.35, transparent: true, opacity: .87 }); materials.add(rimGlass);
          const rim = mesh(new T.TorusGeometry(.14, .035, 8, 30), rimGlass, bottle);
          rim.rotation.x = Math.PI / 2; rim.position.y = 1.135;
          const heel = mesh(new T.TorusGeometry(.295, .022, 7, 32), rimGlass, bottle); heel.rotation.x = Math.PI / 2; heel.position.y = .065;
          const cork = mesh(new T.CylinderGeometry(.11, .1, .18, 18), mat(0x9f7550), bottle); cork.position.y = 1.2;
          const grain = mat(0x735136), pore = new T.SphereGeometry(.011, 5, 4);
          for (let i = 0; i < 14; i++) {
            const a = i * 2.39996, speck = mesh(pore, grain, cork);
            speck.position.set(Math.sin(a) * .103, -.061 + i % 4 * .04, Math.cos(a) * .103);
            speck.scale.y = .65;
          }
          bottle.userData.cork = cork;
          scene.userData.bottle = bottle;
        }
        // The letter itself is curved geometry, opening from a roll into a sheet.
        const ink = document.createElement('canvas'); ink.width = 256; ink.height = 320;
        const ctx = ink.getContext('2d');
        ctx.fillStyle = '#e9d39b'; ctx.fillRect(0, 0, 256, 320);
        ctx.strokeStyle = '#a88148'; ctx.lineWidth = 2; ctx.strokeRect(17, 17, 222, 286);
        ctx.strokeStyle = '#584534'; ctx.lineWidth = 3;
        for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(43, 157 + i * 17); ctx.lineTo(210 - i % 3 * 17, 157 + i * 17); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(128, 86, 30, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(128, 48); ctx.lineTo(138, 86); ctx.lineTo(128, 120); ctx.lineTo(118, 86); ctx.closePath(); ctx.stroke();
        const tex = new T.CanvasTexture(ink); tex.encoding = T.sRGBEncoding; textures.add(tex);
        const paper = mesh(new T.PlaneGeometry(1.12, 1.28, 24, 28), mat(0xffedc8, { map: tex, side: T.DoubleSide, roughness: .84 }));
        paper.rotation.y = -.16;
        const seal = mesh(new T.CylinderGeometry(.10, .10, .035, 24), wax); seal.rotation.x = Math.PI / 2;
        const emblem = mesh(new T.TorusGeometry(.058, .008, 4, 20), gold); emblem.rotation.x = 0;
        const a = paper.geometry.attributes.position;
        const rest = new Float32Array(a.array);
        animate = p => {
          const rise = smooth(p / .55), open = smooth((p - .3) / .67);
          paper.position.set(isBottle ? -.21 + .36 * rise : 0, -.35 + .8 * rise, .18);
          for (let i = 0; i < a.count; i++) {
            const y = rest[i * 3 + 1], angle = y / 1.28 * Math.PI * 2;
            a.setXYZ(i, rest[i * 3], y * open + Math.sin(angle) * .11 * (1 - open), Math.cos(angle) * .11 * (1 - open) + .02 * Math.sin(rest[i * 3] * 4));
          }
          a.needsUpdate = true; paper.geometry.computeVertexNormals();
          seal.visible = emblem.visible = open > .35;
          seal.position.set(paper.position.x + .26, paper.position.y - .44 * open, .224);
          emblem.position.copy(seal.position); emblem.position.z += .021;
          seal.scale.setScalar(open); emblem.scale.setScalar(open);
          if (isBottle) {
            const bottle = scene.userData.bottle, cork = bottle.userData.cork;
            cork.position.set(-.24 * rise, 1.2 + .42 * rise, 0); cork.rotation.z = -.7 * rise;
            bottle.rotation.z = -.28 - .18 * smooth((p - .55) / .4);
          }
        };
      }
      const started = performance.now(), duration = 1350;
      function size() {
        if (disposed) return;
        const w = Math.min(360, host.clientWidth || 300), h = Math.min(240, host.clientHeight || 180);
        renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
        renderer.render(scene, camera);
      }
      function render(now) {
        if (disposed || document.visibilityState === 'hidden') return;
        const p = reduced() ? 1 : Math.min(1, (now - started) / duration);
        animate(p); renderer.render(scene, camera);
        if (p < 1) frame = requestAnimationFrame(render);
      }
      draw = render;
      lost = ev => { ev.preventDefault(); dispose(); };
      renderer.domElement.addEventListener('webglcontextlost', lost);
      host.appendChild(renderer.domElement); host.classList.add('has-3d');
      active = controller;
      size();
      if (window.ResizeObserver) { resize = new ResizeObserver(size); resize.observe(host); }
      document.addEventListener('visibilitychange', visibility);
      render(started);
      return controller;
    } catch (_) { dispose(); return null; }
  }
  return { mount, stop() { if (active) active.dispose(); } };
})();
