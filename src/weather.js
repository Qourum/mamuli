// ===== local 3D weather: travelling clouds and occasional small storm cells =====
// World materials share one uniform across cached GLBs and world remakes. A weak
// collection tracks actual material objects; cloned userData is never a marker.
const Weather3D = (() => {
  const T = window.THREE;
  if (!T) return null;
  const SHADE = { value: new T.Vector4(0, 0, 1, 0) }, PATCHED = new WeakSet(), HOOKS = new WeakMap();
  const KEY = '|weather3d-local-v1', TAU = Math.PI * 2;
  let activeOwner = null, patchedCount = 0;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const smooth = (a, b, n) => { const p = clamp((n - a) / (b - a), 0, 1); return p * p * (3 - 2 * p); };
  const frac = n => n - Math.floor(n);
  function rng(seed) { let n = seed >>> 0; return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; }; }

  const vertexHeader = 'varying vec3 vWeatherWorld;\n';
  const fragmentHeader = `uniform vec4 uWeatherZone;
    varying vec3 vWeatherWorld;
    float localWeatherShade() {
      if (uWeatherZone.w <= .0001) return 0.0;
      float d = length(vWeatherWorld.xz - uWeatherZone.xy) / max(.01, uWeatherZone.z);
      return clamp(uWeatherZone.w, 0.0, .4) * (1.0 - smoothstep(.18, 1.0, d));
    }\n`;
  function header(source, text) {
    return /^\s*#version[^\n]*\n/.test(source) ? source.replace(/^(\s*#version[^\n]*\n)/, '$1' + text) : text + source;
  }
  function patchMaterial(mat, mobile = false) {
    if (!mat || mat.isMeshDepthMaterial || mat.isMeshDistanceMaterial) return;
    const record = HOOKS.get(mat);
    if (PATCHED.has(mat) && record && mat.onBeforeCompile === record.wrapper && mat.customProgramCacheKey === record.key) return;
    const oldHook = mat.onBeforeCompile, oldKey = mat.customProgramCacheKey;
    const modeKey = KEY + (mobile ? '-vertex' : '');
    const defaultKey = oldKey === T.Material.prototype.customProgramCacheKey;
    const originalKey = defaultKey ? oldHook.toString() : null;
    const hookChangedAlone = record && oldHook !== record.wrapper && oldKey === record.key;
    const replacedKey = hookChangedAlone ? String(oldKey.call(mat)).replace(KEY, '') + '|hook:' + oldHook.toString() : null;
    const wrapper = function (shader, renderer) {
      if (oldHook) oldHook.call(this, shader, renderer);
      shader.uniforms.uWeatherZone = SHADE;
      // A manually copied wrapper can appear on a new material. Keep declarations
      // unique while still binding the current module-global uniform.
      if (/varying (vec3 vWeatherWorld|float vWeatherShade);/.test(shader.vertexShader)) return;
      // The soft, broad storm shade can interpolate across phone geometry. This
      // avoids a distance/smoothstep and vec3 varying in every scene fragment.
      shader.vertexShader = header(shader.vertexShader, mobile ? 'uniform vec4 uWeatherZone;\nvarying float vWeatherShade;\n' : vertexHeader);
      shader.fragmentShader = header(shader.fragmentShader, mobile ? 'varying float vWeatherShade;\nfloat localWeatherShade() { return vWeatherShade; }\n' : fragmentHeader);
      const shadePosition = mobile ? `vWeatherShade = 0.0;
        if (uWeatherZone.w > .0001) {
          vec2 weatherDelta = (modelMatrix * weatherP).xz - uWeatherZone.xy;
          float weatherD = length(weatherDelta) / max(.01, uWeatherZone.z);
          vWeatherShade = clamp(uWeatherZone.w, 0.0, .4) * (1.0 - smoothstep(.18, 1.0, weatherD));
        }` : 'vWeatherWorld = (modelMatrix * weatherP).xyz;';
      const world = `
        vec4 weatherP = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          weatherP = instanceMatrix * weatherP;
        #endif
        ${shadePosition}`;
      if (shader.vertexShader.includes('#include <project_vertex>')) {
        // transformed already includes native morph/skin and the prior hook's
        // wind. Instancing is applied explicitly before the world matrix.
        shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>' + world);
      } else {
        shader.vertexShader = shader.vertexShader.replace(/void\s+main\s*\(\s*\)\s*\{/, match => match + `
          vec4 weatherP = vec4(position, 1.0);
          #ifdef USE_INSTANCING
            weatherP = instanceMatrix * weatherP;
          #endif
          ${shadePosition}`);
      }
      const shade = 'outgoingLight *= 1.0 - localWeatherShade();\n';
      if (shader.fragmentShader.includes('#include <output_fragment>')) shader.fragmentShader = shader.fragmentShader.replace('#include <output_fragment>', shade + '#include <output_fragment>');
      else if (shader.fragmentShader.includes('#include <opaque_fragment>')) shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', shade + '#include <opaque_fragment>');
      else shader.fragmentShader = shader.fragmentShader.replace(/}\s*$/, 'gl_FragColor.rgb *= 1.0 - localWeatherShade();\n}');
    };
    const key = function () {
      const base = replacedKey != null ? replacedKey : defaultKey ? originalKey : oldKey ? oldKey.call(this) : '';
      return String(base).endsWith(modeKey) ? String(base) : String(base) + modeKey;
    };
    mat.onBeforeCompile = wrapper; mat.customProgramCacheKey = key; mat.needsUpdate = true;
    if (!PATCHED.has(mat)) patchedCount++;
    PATCHED.add(mat); HOOKS.set(mat, { wrapper, key });
  }

  function mergedCloud(seed, storm, mobile) {
    const random = rng(seed), positions = [], normals = [], colors = [], m = new T.Matrix4(), q = new T.Quaternion();
    const lobes = mobile ? (storm ? 15 : 9) : (storm ? 21 : 13);
    for (let i = 0; i < lobes; i++) {
      const a = random() * TAU, r = random() * (storm ? 1.35 : .9), size = .34 + random() * (storm ? .43 : .30);
      const geo = new T.SphereGeometry(1, mobile ? 8 : 12, mobile ? 6 : 8);
      m.compose(new T.Vector3(Math.cos(a) * r, .10 + random() * .30, Math.sin(a) * r * .65), q, new T.Vector3(size * 1.4, size * .68, size)); geo.applyMatrix4(m);
      const flat = geo.toNonIndexed(), p = flat.attributes.position, n = flat.attributes.normal;
      const shade = .83 + random() * .15;
      for (let j = 0; j < p.count; j++) { positions.push(p.getX(j), p.getY(j), p.getZ(j)); normals.push(n.getX(j), n.getY(j), n.getZ(j)); colors.push(shade, shade, shade); }
      flat.dispose(); geo.dispose();
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(normals, 3)); g.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); g.computeBoundingSphere(); return g;
  }
  function lightningGeo(seed) {
    const random = rng(seed), vertices = [], normals = [], color = [], matrix = new T.Matrix4(), q = new T.Quaternion(), up = new T.Vector3(0, 1, 0);
    const stem = Array.from({ length: 10 }, (_, i) => new T.Vector3((random() - .5) * .25, 4.65 * (1 - i / 9), (random() - .5) * .22));
    function segment(a, b, radius) {
      const vector = b.clone().sub(a), geo = new T.CylinderGeometry(radius, radius * .78, vector.length(), 5, 1, true);
      q.setFromUnitVectors(up, vector.normalize()); matrix.compose(a.clone().add(b).multiplyScalar(.5), q, new T.Vector3(1, 1, 1)); geo.applyMatrix4(matrix);
      const flat = geo.toNonIndexed(), p = flat.attributes.position, n = flat.attributes.normal;
      for (let j = 0; j < p.count; j++) { vertices.push(p.getX(j), p.getY(j), p.getZ(j)); normals.push(n.getX(j), n.getY(j), n.getZ(j)); color.push(1, 1, 1); }
      flat.dispose(); geo.dispose();
    }
    for (let i = 0; i < stem.length - 1; i++) segment(stem[i], stem[i + 1], .012);
    for (const start of [2, 4, 6]) {
      let a = stem[start];
      for (let j = 0; j < 3; j++) { const b = a.clone().add(new T.Vector3((start % 3 ? 1 : -1) * (.16 + random() * .12), -.18 - random() * .17, (random() - .5) * .28)); segment(a, b, .006); a = b; }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(normals, 3)); g.computeBoundingSphere(); return g;
  }

  function create(opts) {
    const mobile = !!opts.mobile;
    const parent = opts.parent, waterY = opts.waterY == null ? .02 : opts.waterY, outerY = opts.outerWaterY == null ? -.3 : opts.outerWaterY;
    const seed = opts.seed == null ? Math.floor(Math.random() * 4294967296) >>> 0 : opts.seed >>> 0;
    const owner = {}; activeOwner = owner; SHADE.value.set(0, 0, 1, 0);
    const group = new T.Group(); group.name = 'Travelling 3D clouds and local thunderstorms'; parent.add(group);
    const own = new Set(), ownMats = new Set(), keep = x => { own.add(x); return x; };
    const mat = (constructor, options) => { const m = keep(new constructor(options)); ownMats.add(m); return m; };
    let dead = false, epoch = null, elapsed = 0, lastScan = -100, currentId = 0, lastThunder = '', scans = 0;
    const temp = new T.Object3D(), rainQ = new T.Quaternion(), rainVelocity = new T.Vector3(), localUp = new T.Vector3(0, 1, 0);
    const fairColor = new T.Color(0xd8e2e5), stormColor = new T.Color(0x657c89);
    function specification(id) {
      const random = rng((seed ^ Math.imul(id + 1, 2654435761)) >>> 0), angle = random() * TAU, r = 1.15 + random() * 2.3;
      return { id, duration: 12 + random() * 6, quiet: 45 + random() * 25, x: Math.cos(angle) * r, z: Math.sin(angle) * r, radius: 1.6 + random() * .65, drift: random() * TAU, wind: .035 + random() * .035, strength: .29 + random() * .095, boltOffset: 3.2 + random() * .8, boltInterval: 3.8 + random() * .9, height: 5.2 + random() * .45 };
    }
    const firstStart = 14 + rng(seed ^ 0x729ac35b)() * 6;
    let start = firstStart, spec = specification(0);
    const cloudMat = mat(T.MeshStandardMaterial, { color: 0xe3ecec, vertexColors: true, roughness: 1, transparent: true, opacity: .81, depthWrite: false });
    const clouds = new T.InstancedMesh(keep(mergedCloud(seed ^ 413, false, mobile)), cloudMat, 4); clouds.name = 'Four drifting 3D fair-weather clouds'; clouds.instanceMatrix.setUsage(T.DynamicDrawUsage); clouds.frustumCulled = false; group.add(clouds);
    const stormMat = mat(T.MeshStandardMaterial, { color: fairColor, vertexColors: true, roughness: 1, transparent: true, opacity: 0, depthWrite: false });
    const stormCloud = new T.Mesh(keep(mergedCloud(seed ^ 725, true, mobile)), stormMat); stormCloud.name = 'Travelling storm cloud'; group.add(stormCloud);
    const rainMat = mat(T.MeshBasicMaterial, { color: 0xb8deed, transparent: true, opacity: 0, depthWrite: false });
    const rain = new T.InstancedMesh(keep(new T.CylinderGeometry(.0035, .0022, .115, 4, 1, false)), rainMat, mobile ? 48 : 144); rain.name = 'Local falling 3D rain'; rain.instanceMatrix.setUsage(T.DynamicDrawUsage); rain.frustumCulled = false; group.add(rain);
    const boltGeos = Array.from({ length: 3 }, (_, i) => keep(lightningGeo(seed + i * 703)));
    const boltMat = mat(T.MeshBasicMaterial, { color: 0xe4f4ff, transparent: true, opacity: .94, depthWrite: false });
    const bolt = new T.Mesh(boltGeos[0], boltMat); bolt.name = 'Thin branched 3D lightning'; bolt.visible = false; group.add(bolt);
    const rippleGeo = keep(new T.TorusGeometry(1, .032, 4, 18)); rippleGeo.rotateX(Math.PI / 2);
    const rippleMat = mat(T.MeshBasicMaterial, { color: 0xc5e9eb, transparent: true, opacity: 0, depthWrite: false });
    const ripples = new T.InstancedMesh(rippleGeo, rippleMat, mobile ? 9 : 24); ripples.name = 'Rain ripples on the sea'; ripples.instanceMatrix.setUsage(T.DynamicDrawUsage); ripples.frustumCulled = false; group.add(ripples);
    const random = rng(seed ^ 1221);
    const raindata = Array.from({ length: rain.count }, () => ({ phase: random(), a: random() * TAU, r: Math.sqrt(random()) * .87, speed: .88 + random() * .28 }));
    const cloudData = Array.from({ length: clouds.count }, (_, i) => ({ a: random() * TAU, r: 8.3 + random() * 4.3, y: 4.1 + random() * 1.5, scale: .7 + random() * .5, speed: .008 + i * .0025 }));
    let state = { active: false, raining: false, strength: 0, zone: [0, 0, spec.radius], lightning: false, nextFlash: start + spec.boltOffset, time: 0 };
    function scan() {
      parent.traverse(o => {
        for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) if (!ownMats.has(m)) patchMaterial(m, mobile);
      }); scans++;
    }
    scan(); lastScan = 0;
    function update(time, dt) {
      if (dead || activeOwner !== owner) return;
      if (epoch == null) epoch = time;
      const reduced = typeof opts.reducedMotion === 'function' ? opts.reducedMotion() : !!opts.reducedMotion;
      elapsed = reduced ? 3 : Math.max(0, time - epoch);
      if (elapsed < start - 8 && currentId > 0) { currentId = 0; start = firstStart; spec = specification(0); }
      // Select the next cell during its eight-second arrival, while the preceding
      // storm has long cleared. The travelling cloud therefore does not pop in at
      // the instant the next shower begins.
      while (elapsed >= start + spec.duration + spec.quiet - 8) { start += spec.duration + spec.quiet; spec = specification(++currentId); }
      if (elapsed - lastScan >= 1 || elapsed < lastScan) { scan(); lastScan = elapsed; }
      for (let i = 0; i < clouds.count; i++) {
        const a = cloudData[i], angle = a.a + elapsed * a.speed;
        temp.position.set(Math.cos(angle) * a.r, a.y + .07 * Math.sin(elapsed * .09 + a.a), Math.sin(angle) * a.r); temp.rotation.set(0, -angle + .4, 0); temp.scale.setScalar(a.scale); temp.updateMatrix(); clouds.setMatrixAt(i, temp.matrix);
      }
      clouds.instanceMatrix.needsUpdate = true;
      const age = elapsed - start, envelope = reduced ? 0 : smooth(0, 3.2, age) * (1 - smooth(spec.duration - 3.2, spec.duration, age));
      const driftTime = clamp(age, 0, spec.duration), zx = clamp(spec.x + Math.cos(spec.drift) * spec.wind * driftTime, -4.25, 4.25), zz = clamp(spec.z + Math.sin(spec.drift) * spec.wind * driftTime, -4.25, 4.25);
      const arrive = smooth(-8, 0, age), depart = smooth(spec.duration, spec.duration + 7, age), outX = Math.cos(spec.drift + Math.PI) * 7.4, outZ = Math.sin(spec.drift + Math.PI) * 7.4;
      stormCloud.position.set(zx * arrive + outX * (1 - arrive) + Math.cos(spec.drift) * depart * 3.5, spec.height + .10 * Math.sin(elapsed * .16), zz * arrive + outZ * (1 - arrive) + Math.sin(spec.drift) * depart * 3.5);
      stormCloud.rotation.y = spec.drift + .035 * Math.sin(elapsed * .1); stormCloud.scale.setScalar(spec.radius / 1.75 * .78);
      stormMat.color.copy(fairColor).lerp(stormColor, envelope); stormMat.opacity = reduced ? 0 : .66 * smooth(-8, -4, age) * (1 - depart); stormCloud.visible = stormMat.opacity > .01;
      const strength = envelope * spec.strength;
      SHADE.value.set(zx, zz, spec.radius, strength);
      rainMat.opacity = envelope * .53; rain.visible = envelope > .01; rippleMat.opacity = envelope * .31; ripples.visible = rain.visible;
      const windX = Math.cos(spec.drift) * .28, windZ = Math.sin(spec.drift) * .28;
      rainQ.setFromUnitVectors(localUp, rainVelocity.set(windX, -1, windZ).normalize());
      if (rain.visible) for (let i = 0; i < rain.count; i++) {
        const d = raindata[i], u = frac(elapsed * d.speed + d.phase), x = zx + Math.cos(d.a) * d.r * spec.radius + windX * u, z = zz + Math.sin(d.a) * d.r * spec.radius + windZ * u;
        const floor = Math.max(Math.abs(x), Math.abs(z)) > 6.2 ? outerY : waterY;
        temp.position.set(x, spec.height - .23 - (spec.height - .23 - floor) * u, z); temp.quaternion.copy(rainQ); temp.scale.set(1, .83 + .44 * d.phase, 1); temp.updateMatrix(); rain.setMatrixAt(i, temp.matrix);
      }
      // Hidden rain does not need its GPU instance buffer rewritten each frame.
      if (rain.visible) rain.instanceMatrix.needsUpdate = true;
      if (ripples.visible) for (let i = 0; i < ripples.count; i++) {
        const d = raindata[i * 5], u = frac(elapsed * .72 + d.phase), x = zx + Math.cos(d.a) * d.r * spec.radius, z = zz + Math.sin(d.a) * d.r * spec.radius;
        temp.position.set(x, (Math.max(Math.abs(x), Math.abs(z)) > 6.2 ? outerY : waterY) + .008, z); temp.rotation.set(0, 0, 0); const r = .019 + u * .070; temp.scale.set(r, r * (1 - u), r); temp.updateMatrix(); ripples.setMatrixAt(i, temp.matrix);
      }
      if (ripples.visible) ripples.instanceMatrix.needsUpdate = true;
      const boltAge = age - spec.boltOffset, strike = Math.floor(boltAge / spec.boltInterval), flashAge = boltAge - strike * spec.boltInterval;
      const flash = !reduced && envelope > .15 && boltAge >= 0 && age < spec.duration - 1 && flashAge >= 0 && flashAge < .16;
      bolt.visible = flash;
      if (flash) {
        const variant = Math.abs(strike + currentId) % boltGeos.length; bolt.geometry = boltGeos[variant];
        const angle = (strike + 1) * 2.39996, r = spec.radius * .26; bolt.position.set(zx + Math.cos(angle) * r, waterY + .015, zz + Math.sin(angle) * r); bolt.rotation.y = spec.drift; bolt.scale.set(1, (spec.height - .35 - waterY) / 4.65, 1);
        const event = currentId + ':' + strike;
        if (event !== lastThunder) { lastThunder = event; if (typeof opts.onThunder === 'function') { try { opts.onThunder({ x: bolt.position.x, z: bolt.position.z, strength: .65 + envelope * .25 }); } catch (_) { } } }
      }
      let nextFlash = start + spec.boltOffset + Math.max(0, Math.floor(boltAge / spec.boltInterval) + 1) * spec.boltInterval;
      if (nextFlash >= start + spec.duration - 1) { const following = specification(currentId + 1); nextFlash = start + spec.duration + spec.quiet + following.boltOffset; }
      state = { active: envelope > .001, raining: rain.visible, strength, zone: [zx, zz, spec.radius], lightning: flash, nextFlash, time: elapsed };
    }
    // Initial fair-weather shapes are visible before the board's first update,
    // while the first update itself establishes a relative storm clock.
    for (let i = 0; i < cloudData.length; i++) { const a = cloudData[i]; temp.position.set(Math.cos(a.a) * a.r, a.y, Math.sin(a.a) * a.r); temp.rotation.set(0, -a.a + .4, 0); temp.scale.setScalar(a.scale); temp.updateMatrix(); clouds.setMatrixAt(i, temp.matrix); }
    stormCloud.visible = rain.visible = ripples.visible = false;
    return {
      group, update,
      dispose() { if (dead) return; dead = true; if (activeOwner === owner) { activeOwner = null; SHADE.value.set(0, 0, 1, 0); } parent.remove(group); group.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); group.clear(); for (const item of own) item.dispose(); own.clear(); ownMats.clear(); },
      stats() { return { ...state, zone: state.zone.slice(), seed, cycle: currentId, stormStart: start, duration: spec.duration, quiet: spec.quiet, firstStorm: firstStart, clouds: clouds.count + 1, drops: rain.count, ripples: ripples.count, maxFlash: .16, minimumFlashGap: 3.8, scans, patchedMaterials: patchedCount, mobile, shade: mobile ? 'vertex' : 'fragment' }; }
    };
  }
  return { create };
})();
