// VALCORSA — THE GARAGE GARAGE (slice 1 of the Standardization, DESIGN §6.6).
// A small 3D garage behind the Engineer door: tap between stations, GRAB parts
// into your armful, LOAD the six bench bins, build an engine FROM the bins,
// name it, stamp it — it earns its designation. v1 is a built room; the station
// layout mirrors Adam's future scanned real garage so the swap is seamless.
'use strict';

window.GARAGE3D = (() => {
  const $ = id => document.getElementById(id);
  const EM = () => window.ENGINEMATH;
  const inv = () => JSON.parse(localStorage.getItem('vc_inv') || '{}');
  const setInv = o => localStorage.setItem('vc_inv', JSON.stringify(o));

  let root, renderer, scene, camera, raf = 0, built = false;
  let curStation = 'door', tween = null;
  let armful = [];          // [{id, n}] max 8 stacks — what you're carrying
  let bins = [null, null, null, null, null, null];   // {id, n} per bench bin
  let sel = {};             // bench build slots: block/crank/pistons/cam/head/gasket/turbo/bolts

  const STATIONS = {
    door:    { pos: [0, 3.2, 8.6],  look: [0, 1.4, 0],    label: 'GARAGE' },
    lift:    { pos: [-0.6, 2.2, 4.9], look: [-3.1, 1.3, 2.2], label: 'THE LIFT' },
    shelf:   { pos: [4.4, 2.0, 2.2],look: [6.4, 1.4, -1], label: 'ENGINE SHELF' },
    drawers: { pos: [-4.2, 1.9, 2.4],look: [-6.2, 1.1, -1],label: 'HARDWARE' },
    legacy:  { pos: [-2.6, 2.0, -1.6],look: [-3.4, 1.5, -5.4],label: 'THE SHELF' },
    bench:   { pos: [0, 2.4, 1.4],  look: [0, 0.9, -3.2], label: 'WORKBENCH' },
  };

  // ---------------- THE LIFT (slice 1 of the vision): your kart, raised, inspectable.
  // Race wear PERSISTS now (vc_wear) and shows on the car as visible jank: bald grey
  // tires, a listing stance, smoke stains. Orbit it, grab parts, SHAKE them — loose
  // things rattle and the garage tells you what your hands found.
  let liftCar = null, liftSmoke = [], found = new Set();
  const wearGet = () => JSON.parse(localStorage.getItem('vc_wear') || '{"tire":0,"engine":1,"flat":false}');
  const wearSet = w => localStorage.setItem('vc_wear', JSON.stringify(w));
  // wear accrues at every race end (4th wrap in the endRace chain — they compose)
  const _origEnd = window.endRace;
  if (_origEnd && !_origEnd._lift) {
    window.endRace = function () {
      _origEnd.apply(this, arguments);
      try {
        const d = (typeof player !== 'undefined' && player && player.dmg) || null;
        if (!d) return;
        const w = wearGet();
        w.tire = Math.min(1, +(w.tire + (d.wear || 0) * 0.55).toFixed(3));
        w.engine = Math.max(0.25, +Math.min(w.engine, 0.35 + (d.engine ?? 1) * 0.65).toFixed(3));
        if (d.flat) w.flat = true;
        wearSet(w);
      } catch (e) {}
    };
    window.endRace._lift = true;
  }

  function buildLiftCar() {
    if (liftCar) { scene.remove(liftCar); liftCar = null; }
    for (const s of liftSmoke) scene.remove(s.m);
    liftSmoke = [];
    let kit = null;
    try {
      const liv = JSON.parse(localStorage.getItem('vc_livery') || '[]');
      kit = liv.find(k => k.id === localStorage.getItem('vc_activeKart')) || liv[0] || null;
    } catch (e) {}
    const carKit = kit ? { chassis: kit.chassis || 'gt', paint: kit.paint || 0, wheels: kit.wheels || 0, decal: kit.decal || 'none' }
                       : { chassis: 'gt', paint: 0, wheels: 0, decal: 'none' };
    liftCar = buildCarMesh(0xcccccc, 0x14274a, carKit);
    liftCar.position.set(-3.1, 0.62, 2.2);
    liftCar.rotation.y = 0.5;
    liftCar.userData.kitName = kit ? (kit.name || 'YOUR KART') : 'YOUR KART';
    scene.add(liftCar);
    applyWear();
  }
  function applyWear() {
    const w = wearGet();
    const wheels = liftCar.userData.wheels || [];
    wheels.forEach((wg, i) => {
      const tire = wg.children[0];
      if (tire && tire.material) {
        tire.material = tire.material.clone();
        tire.material.color.lerp(new THREE.Color(0x8a8a86), w.tire * 0.7);   // balding grey
      }
      if (w.flat && i === wheels.length - 1) { wg.scale.y = 0.68; wg.rotation.z = 0.1; }
    });
    if (w.tire > 0.45) { liftCar.rotation.z = 0.035; liftCar.rotation.x = 0.02; }  // she LISTS
    if (w.engine < 0.8) {                                          // smoke-stained + idle wisps
      const stain = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.8),
        new THREE.MeshBasicMaterial({ color: 0x1a140e, transparent: true, opacity: 0.5, depthWrite: false }));
      stain.rotation.x = -Math.PI / 2;
      stain.position.set(0, 1.15, 1.2);
      liftCar.add(stain);
    }
  }
  function thunk(loose) {                                          // diagnosis by ear
    try {
      if (typeof audio === 'undefined' || !audio.ctx) return;
      const t0 = audio.ctx.currentTime;
      const n = loose ? 4 : 1;
      for (let i = 0; i < n; i++) {
        const o = audio.ctx.createOscillator();
        o.type = 'sine'; o.frequency.value = loose ? 140 + Math.random() * 160 : 90;
        const gg = audio.ctx.createGain();
        gg.gain.setValueAtTime(0.12, t0 + i * 0.07);
        gg.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.07 + 0.09);
        o.connect(gg); gg.connect(audio.master);
        o.start(t0 + i * 0.07); o.stop(t0 + i * 0.07 + 0.12);
      }
    } catch (e) {}
  }
  let shakeAnim = null;
  function shakePart(obj) {
    const w = wearGet();
    let wheelGroup = null;
    for (const wg of (liftCar.userData.wheels || [])) if (wg === obj || wg.children.includes(obj) || (obj.parent && wg.children.includes(obj.parent))) wheelGroup = wg;
    const target = wheelGroup || obj;
    let loose = false, verdict;
    if (wheelGroup) {
      if (w.flat && wheelGroup.scale.y < 1) { loose = true; verdict = 'that tire is FLAT. very flat.'; found.add('flat'); }
      else if (w.tire > 0.6) { loose = true; verdict = 'suspension is LOOSE — she rattles like a maraca'; found.add('susp'); }
      else if (w.tire > 0.3) { loose = true; verdict = 'tires are ' + Math.round(w.tire * 100) + '% worn — getting slick'; found.add('tires'); }
      else verdict = 'wheel is tight. solid.';
    } else {
      if (w.engine < 0.8) { loose = true; verdict = 'engine is down on compression — ' + Math.round(w.engine * 100) + '% health'; found.add('engine'); }
      else verdict = 'body is solid. nice and stiff.';
    }
    shakeAnim = { t: 0, obj: target, base: target.position.clone(), amp: loose ? 0.055 : 0.012 };
    thunk(loose);
    say((loose ? '🔩 ' : '✅ ') + verdict, loose);
    if (navigator.vibrate) navigator.vibrate(loose ? [20, 40, 20, 40, 20] : 14);
    if (curStation === 'lift') renderLift();
  }

  // orbit-inspect controls while at the lift
  const orbit = { on: false, th: 2.6, ph: 1.05, r: 5.6, drag: null, moved: 0 };
  function orbitCam() {
    const c = liftCar ? liftCar.position : new THREE.Vector3(-3.1, 0.8, 2.2);
    const y = Math.max(0.4, Math.cos(orbit.ph)) * orbit.r;
    camera.position.set(c.x + Math.sin(orbit.th) * Math.sin(orbit.ph) * orbit.r,
                        c.y + y * 0.55 + 0.4,
                        c.z + Math.cos(orbit.th) * Math.sin(orbit.ph) * orbit.r);
    camera.userData.look.set(c.x, c.y + 0.35, c.z);
    camera.lookAt(camera.userData.look);
  }
  function renderLift() {
    const pan = $('gStationPanel');
    const w = wearGet();
    const clean = w.tire < 0.15 && w.engine > 0.92 && !w.flat;
    const lines = [];
    if (found.has('flat')) lines.push('🛞 flat tire — needs a swap');
    if (found.has('susp')) lines.push('🔩 loose suspension — rattling');
    if (found.has('tires')) lines.push('🛞 tire wear ' + Math.round(w.tire * 100) + '%');
    if (found.has('engine')) lines.push('⚙️ engine down to ' + Math.round(w.engine * 100) + '%');
    pan.innerHTML = `<h3>THE LIFT · ${liftCar ? liftCar.userData.kitName.toUpperCase() : ''}</h3>
      <p class="gKind">DRAG TO ORBIT · PINCH/SCROLL TO ZOOM · TAP A PART TO SHAKE IT</p>
      ${clean ? '<p class="gEmpty">she’s clean. go put some laps on her.</p>'
        : lines.length ? '<p class="gKind">FOUND SO FAR</p>' + lines.map(l => `<div class="gRow"><div class="gInfo"><b>${l}</b></div></div>`).join('')
        : '<p class="gEmpty">something’s off with this kart… get your hands on it and find it.</p>'}
      <p class="gEmpty" style="opacity:.55">fixing arrives with THE WRENCH (slice 2)</p>`;
    pan.classList.add('open');
  }

  // ---------------------------------------------------------------- the room
  function buildScene() {
    if (built) return; built = true;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1020);
    scene.fog = new THREE.Fog(0x0a1020, 14, 26);
    camera = new THREE.PerspectiveCamera(58, 1, 0.1, 60);

    const mat = (c, e) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, emissive: e || 0 });
    const box = (w, h, d, c, e) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, e));
    const put = (m, x, y, z, ry) => { m.position.set(x, y, z); if (ry) m.rotation.y = ry; scene.add(m); return m; };

    put(box(16, 0.2, 12, 0x1a2030), 0, -0.1, 0);                      // floor
    put(box(16, 6, 0.3, 0x141c2e), 0, 3, -6);                         // back wall
    put(box(0.3, 6, 12, 0x131b2c), -8, 3, 0);                         // left wall
    put(box(0.3, 6, 12, 0x131b2c), 8, 3, 0);                          // right wall
    // checker floor strip (the nation's flag, painted on concrete)
    for (let i = 0; i < 8; i++)
      put(box(1, 0.02, 1, i % 2 ? 0x2e6bff : 0xff8c1a), -3.5 + i, 0.02, 4.6);

    // hanging bulbs
    for (const [x, z] of [[-3, 0], [3, 0]]) {
      put(box(0.06, 1.4, 0.06, 0x222833), x, 5.1, z);
      const bulb = put(new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffd9a0 })), x, 4.35, z);
      const l = new THREE.PointLight(0xffd9a0, 22, 18, 1.8); l.position.copy(bulb.position); scene.add(l);
    }
    scene.add(new THREE.AmbientLight(0x33415f, 1.4));

    // ENGINE SHELF (right wall): posts, boards, crates
    for (const z of [-3.4, 0.6]) put(box(0.14, 3.4, 0.14, 0x3a3f4a), 6.9, 1.7, z);
    for (const y of [0.7, 1.7, 2.7]) put(box(0.9, 0.08, 4.4, 0x4a4436), 6.9, y, -1.4);
    const CRATE_C = [0x2e6bff, 0xff8c1a, 0x4a5568, 0x2e6bff, 0x6b7a99, 0xff8c1a, 0x4a5568, 0x2e6bff, 0x6b7a99];
    CRATE_C.forEach((c, i) => put(box(0.62, 0.5, 0.8, c), 6.9, 1.0 + Math.floor(i / 3), -3 + (i % 3) * 1.4));

    // HARDWARE DRAWERS (left wall): chest with drawer fronts
    put(box(1.4, 2.2, 3.6, 0x2a3140), -7.1, 1.1, 0.4);
    for (let r = 0; r < 4; r++) for (let cI = 0; cI < 3; cI++) {
      put(box(0.06, 0.4, 1.0, 0x3d4a63), -6.36, 0.45 + r * 0.5, -0.8 + cI * 1.2);
      put(box(0.1, 0.06, 0.3, 0xb9c8f2), -6.3, 0.45 + r * 0.5, -0.8 + cI * 1.2);   // handles
    }

    // THE SHELF (legacy relics, back-left): a warm little museum
    put(box(2.6, 0.08, 0.8, 0x4a4436), -3.4, 1.9, -5.5);
    put(box(2.6, 0.08, 0.8, 0x4a4436), -3.4, 1.1, -5.5);
    for (let i = 0; i < 4; i++)
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.4, 10), mat(0xc99a2e, 0x332200)),
          -4.4 + i * 0.7, 2.15, -5.5);

    // WORKBENCH (center-back): table + SIX BINS in a 2×3 grid
    put(box(4.6, 0.18, 1.9, 0x53483a), 0, 0.95, -3.4);                // top
    for (const [x, z] of [[-2.1, -2.7], [2.1, -2.7], [-2.1, -4.1], [2.1, -4.1]])
      put(box(0.16, 0.95, 0.16, 0x2f2a22), x, 0.48, z);
    for (let i = 0; i < 6; i++) {
      const bx = -1.5 + (i % 3) * 1.5, bz = i < 3 ? -3.0 : -3.9;
      const bin = put(box(1.1, 0.34, 0.72, 0x18305e, 0x0a1a3a), bx, 1.13, bz);
      bin.userData.bin = i;
      const rim = put(box(1.16, 0.05, 0.78, 0x2e6bff, 0x123), bx, 1.3, bz);
      rim.userData.bin = i;
    }
    // pegboard behind the bench
    put(box(4.6, 2.0, 0.08, 0x1c2740), 0, 2.6, -5.9);

    // THE LIFT (left-front): two rails on posts, your kart on top
    for (const dx of [-0.55, 0.55]) {
      put(box(0.28, 0.5, 3.4, 0xb8452a), -3.1 + dx, 0.35, 2.2, 0.5);         // rails
      for (const dz of [-1.2, 1.2])
        put(box(0.16, 0.42, 0.16, 0x3a3f4a),
            -3.1 + dx * Math.cos(0.5) - dz * Math.sin(0.5) * 0, 0.18, 2.2 + dz, 0);  // posts (chunky toy lift)
    }
    put(box(0.9, 0.1, 0.5, 0x2a3140), -1.6, 0.3, 3.8);                       // control pedestal
    put(box(0.5, 0.5, 0.08, 0xff8c1a, 0x331a00), -1.6, 0.75, 3.8);           // UP/DOWN panel

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    root.insertBefore(renderer.domElement, root.firstChild);

    renderer.domElement.addEventListener('pointerdown', onTap);
    renderer.domElement.addEventListener('pointerdown', liftDown);
    renderer.domElement.addEventListener('pointermove', liftMove);
    renderer.domElement.addEventListener('pointerup', liftUp);
    renderer.domElement.addEventListener('wheel', liftWheel, { passive: false });
    renderer.domElement.addEventListener('touchmove', liftTouch, { passive: false });
    renderer.domElement.addEventListener('touchend', () => { pinch0 = 0; });
    const st = STATIONS.door;
    camera.position.set(...st.pos);
    camera.lookAt(...st.look);
    camera.userData.look = new THREE.Vector3(...st.look);
  }

  // tap a bin / crate cluster / drawers / relic shelf / the lift → glide there
  const ray = new THREE.Raycaster(), v2 = new THREE.Vector2();
  function castAt(e) {
    const r = renderer.domElement.getBoundingClientRect();
    v2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(v2, camera);
  }
  function onTap(e) {
    if (curStation === 'lift') return;                   // the lift has its own hands (orbit/shake)
    castAt(e);
    const hit = ray.intersectObjects(scene.children, false)[0];
    const carHit = liftCar && ray.intersectObjects(liftCar.children, true)[0];
    if (carHit) { goTo('lift'); return; }
    if (!hit) return;
    const p = hit.object.position;
    if (p.x > 5) goTo('shelf');
    else if (p.x < -5) goTo('drawers');
    else if (p.z < -5 && p.x < -1.5) goTo('legacy');
    else if (p.z < -2 && p.z > -4.5 && Math.abs(p.x) < 3) goTo('bench');
    else if (p.x < -1 && p.z > 0.5) goTo('lift');
  }
  // lift-mode input: drag orbits, pinch/wheel zooms, a still tap shakes the part under it
  function liftDown(e) {
    if (curStation !== 'lift') return;
    orbit.drag = { x: e.clientX, y: e.clientY }; orbit.moved = 0;
  }
  function liftMove(e) {
    if (curStation !== 'lift' || !orbit.drag) return;
    const dx = e.clientX - orbit.drag.x, dy = e.clientY - orbit.drag.y;
    orbit.moved += Math.abs(dx) + Math.abs(dy);
    orbit.th -= dx * 0.008;
    orbit.ph = Math.max(0.5, Math.min(1.45, orbit.ph - dy * 0.005));
    orbit.drag = { x: e.clientX, y: e.clientY };
  }
  function liftUp(e) {
    if (curStation !== 'lift' || !orbit.drag) return;
    const still = orbit.moved < 8;
    orbit.drag = null;
    if (!still || !liftCar) return;
    castAt(e);
    const hit = ray.intersectObjects(liftCar.children, true)[0];
    if (hit) shakePart(hit.object);
  }
  function liftWheel(e) {
    if (curStation !== 'lift') return;
    e.preventDefault();
    orbit.r = Math.max(2.4, Math.min(7.5, orbit.r + e.deltaY * 0.01));
  }
  let pinch0 = 0;
  function liftTouch(e) {
    if (curStation !== 'lift' || e.touches.length !== 2) return;
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    if (pinch0) orbit.r = Math.max(2.4, Math.min(7.5, orbit.r * (pinch0 / d)));
    pinch0 = d;
    e.preventDefault();
  }

  function goTo(name) {
    if (!STATIONS[name] || name === curStation) { openPanel(name); return; }
    const st = STATIONS[name];
    tween = { t: 0, fromP: camera.position.clone(), toP: new THREE.Vector3(...st.pos),
              fromL: camera.userData.look.clone(), toL: new THREE.Vector3(...st.look) };
    curStation = name;
    document.querySelectorAll('#gStationBar button').forEach(b => b.classList.toggle('on', b.dataset.st === name));
    $('gStationPanel').classList.remove('open');
    setTimeout(() => openPanel(name), 460);
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    const w = root.clientWidth, h = root.clientHeight;
    if (renderer.domElement.width !== w * renderer.getPixelRatio())
      { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    if (tween) {
      tween.t = Math.min(1, tween.t + 0.038);
      const k = tween.t < 0.5 ? 2 * tween.t * tween.t : 1 - Math.pow(-2 * tween.t + 2, 2) / 2;
      camera.position.lerpVectors(tween.fromP, tween.toP, k);
      camera.userData.look.lerpVectors(tween.fromL, tween.toL, k);
      camera.lookAt(camera.userData.look);
      if (tween.t >= 1) tween = null;
    } else if (curStation === 'lift') orbitCam();
    if (shakeAnim) {                                     // the grab-shake wobble
      shakeAnim.t += 0.05;
      const a = shakeAnim.amp * Math.max(0, 1 - shakeAnim.t);
      shakeAnim.obj.position.copy(shakeAnim.base)
        .add(new THREE.Vector3(Math.sin(shakeAnim.t * 40) * a, Math.sin(shakeAnim.t * 53) * a * 0.6, 0));
      if (shakeAnim.t >= 1) { shakeAnim.obj.position.copy(shakeAnim.base); shakeAnim = null; }
    }
    if (liftCar && wearGet().engine < 0.8 && Math.random() < 0.06) {    // idle smoke wisps
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.06 + Math.random() * 0.05, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0x555a63, transparent: true, opacity: 0.4, depthWrite: false }));
      m.position.set(liftCar.position.x + (Math.random() - 0.5) * 0.4, 1.5, liftCar.position.z + 0.8);
      scene.add(m);
      liftSmoke.push({ m, life: 1 });
    }
    for (let i = liftSmoke.length - 1; i >= 0; i--) {
      const s = liftSmoke[i];
      s.life -= 0.012;
      s.m.position.y += 0.012;
      s.m.scale.multiplyScalar(1.012);
      s.m.material.opacity = s.life * 0.4;
      if (s.life <= 0) { scene.remove(s.m); liftSmoke.splice(i, 1); }
    }
    renderer.render(scene, camera);
  }

  // ---------------------------------------------------------------- panels
  const kindLabel = { block: 'BLOCKS', crank: 'CRANKSHAFTS', pistons: 'PISTON SETS', cam: 'CAMSHAFTS', head: 'HEADS', turbo: 'TURBOS', bolts: 'BOLTS', gasket: 'GASKETS' };
  const armfulN = () => armful.reduce((a, s) => a + s.n, 0);

  function grabRow(p, my) {
    const carried = (armful.find(s => s.id === p.id) || {}).n || 0;
    const left = (my[p.id] || 0) - carried;
    return `<div class="gRow"><div class="gInfo"><b>${p.code}</b><small>${p.name.split('"')[1] || ''} · ${p.brand}${carried ? ' · carrying ×' + carried : ''}</small></div>
      <button class="gGrab" data-grab="${p.id}" ${left <= 0 || armful.length >= 8 && !carried ? 'disabled' : ''}>GRAB</button></div>`;
  }

  function openPanel(name) {
    const pan = $('gStationPanel'), my = inv();
    let html = '';
    if (name === 'shelf' || name === 'drawers') {
      const kinds = name === 'shelf' ? ['block', 'crank', 'pistons', 'cam', 'head', 'turbo'] : ['bolts', 'gasket'];
      html = `<h3>${STATIONS[name].label}</h3>`;
      let any = false;
      for (const k of kinds) {
        const owned = EM().atoms.filter(p => p.kind === k && (my[p.id] || 0) > 0);
        if (!owned.length) continue;
        any = true;
        html += `<p class="gKind">${kindLabel[k]}</p>` + owned.map(p => grabRow(p, my)).join('');
      }
      if (!any) html += `<p class="gEmpty">nothing here yet — the Parts Shop sells the ${name === 'shelf' ? 'engine stack' : 'hardware'}</p>
        <button class="gAction hero" id="gShopCta">OPEN THE PARTS SHOP</button>`;
    } else if (name === 'legacy') {
      const relics = JSON.parse(localStorage.getItem('vc_legacy') || '[]');
      html = `<h3>THE SHELF</h3><p class="gKind">PRE-STANDARD ERA</p>` +
        (relics.length ? relics.slice(0, 24).map(r => `<div class="gRow"><div class="gInfo"><b>${r.name}</b><small>${r.brand} · retired by the VCRA</small></div></div>`).join('')
                       : '<p class="gEmpty">no relics — you joined after the Standardization</p>') +
        `<p class="gEmpty">the Standardization Act retired these. they watch you work.</p>`;
    } else if (name === 'bench') { renderBench(); return; }
    else if (name === 'lift') { renderLift(); return; }
    else { pan.classList.remove('open'); return; }
    pan.innerHTML = html;
    pan.classList.add('open');
    const cta = pan.querySelector('#gShopCta');   // straight line from empty shelf to the store
    if (cta) cta.onclick = () => { close(); window.closeGarage(); setTimeout(() => window.vcTab && vcTab('shop'), 180); };
    pan.querySelectorAll('[data-grab]').forEach(b => b.onclick = () => {
      const id = b.dataset.grab, s = armful.find(x => x.id === id);
      if (s) s.n++; else armful.push({ id, n: 1 });
      if (navigator.vibrate) navigator.vibrate(8);
      renderArmful(); openPanel(name);
    });
  }

  function renderArmful() {
    const tray = $('gArmful');
    tray.innerHTML = armful.length
      ? '<span class="gArmLab">ARMFUL</span>' + armful.map((s, i) =>
          `<button class="gArmChip" data-drop="${i}">${EM().atoms.find(p => p.id === s.id).code}${s.n > 1 ? ' ×' + s.n : ''}</button>`).join('')
      : '';
    tray.querySelectorAll('[data-drop]').forEach(b => b.onclick = () => {   // tap = put one back
      const s = armful[+b.dataset.drop]; s.n--; if (s.n <= 0) armful.splice(+b.dataset.drop, 1);
      renderArmful(); if ($('gStationPanel').classList.contains('open')) openPanel(curStation);
    });
  }

  // ---------------------------------------------------------------- the bench
  const SLOTS = ['block', 'crank', 'pistons', 'cam', 'head', 'gasket', 'turbo', 'bolts'];
  function binOf(kind) { return bins.find(b => b && EM().atoms.find(p => p.id === b.id).kind === kind); }
  // hardware never needs a bin — gaskets and bolt boxes ride in your pockets.
  // (Six bins hold the big six; a full turbo build is 8 codes, so this is load-bearing.)
  function stackOf(kind) {
    const b = binOf(kind); if (b) return b;
    if (kind !== 'gasket' && kind !== 'bolts') return null;
    return armful.find(s => (EM().atoms.find(p => p.id === s.id) || {}).kind === kind) || null;
  }

  function renderBench() {
    const pan = $('gStationPanel');
    const binHtml = bins.map((b, i) => {
      if (!b) return `<div class="gBin"><span>BIN ${i + 1}</span><small>empty</small></div>`;
      const p = EM().atoms.find(x => x.id === b.id);
      return `<div class="gBin full"><span>${p.code}</span><small>×${b.n} / ${EM().binCap(p)}</small></div>`;
    }).join('');
    const slotHtml = SLOTS.map(k => {
      const cur = sel[k];
      const need = k === 'bolts' ? 'VM8×24 box' : k === 'gasket' ? 'HG-' + (sel.block ? sel.block.size : '?') : kindLabel[k];
      return `<button class="gSlot ${cur ? 'filled' : ''} ${k === 'turbo' ? 'opt' : ''}" data-slot="${k}">
        <span>${k.toUpperCase()}${k === 'turbo' ? ' (optional)' : ''}</span><b>${cur ? cur.code : '— ' + need}</b></button>`;
    }).join('');
    const missing = ['block', 'crank', 'pistons', 'cam', 'head', 'gasket', 'bolts'].filter(k => !sel[k]);
    const ready = !missing.length;
    let spec = '';
    if (sel.block) {
      const partial = { block: sel.block, crank: sel.crank || sel.block, pistons: sel.pistons || sel.block,
                        cam: sel.cam || { grind: 2, brand: 'Norte Motori' }, head: sel.head || { flow: 1, brand: 'Norte Motori' }, turbo: sel.turbo };
      const s = EM().compute(Object.assign({}, partial, sel));
      const vpTxt = s.jank ? `${s.vpLo}–${s.vpHi} vp?` : `~${s.vp} vp`;
      spec = `<div class="gSpec"><b>${s.designation}</b> · ${vpTxt} · ${s.mass} kg · heat ${s.heat} · rel ${s.rel}${ready ? '' : ' <i>(projected)</i>'}</div>` +
        (s.jank ? `<div class="gSpec" style="opacity:.75">🔧 jank ${s.jank}: ${s.jankNotes.join(', ')} — the dyno decides at the stamp</div>` : '');
    }
    const nothingStaged = !armful.length && bins.every(b => !b);
    pan.innerHTML = `<h3>WORKBENCH</h3>
      <div class="gBins">${binHtml}</div>
      ${nothingStaged ? `<button id="gGoShelf" class="gAction">BINS ARE EMPTY — GRAB PARTS AT THE SHELF</button>` : ''}
      ${armful.length ? `<button id="gLoad" class="gAction">LOAD BINS (${armfulN()} in the armful)</button>` : ''}
      <div class="gSlots">${slotHtml}</div>${spec}
      <input id="gEngName" maxlength="16" placeholder="Name this engine…" autocomplete="off" ${ready ? '' : 'style="display:none"'}>
      <button id="gStamp" class="gAction hero" ${ready ? '' : 'disabled'}>${ready ? 'BUILD &amp; STAMP' : 'NEEDS: ' + missing.map(m => m.toUpperCase()).join(' · ')}</button>`;
    pan.classList.add('open');

    if ($('gLoad')) $('gLoad').onclick = loadBins;
    if ($('gGoShelf')) $('gGoShelf').onclick = () => goTo('shelf');
    pan.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => fillSlot(b.dataset.slot));
    if ($('gStamp')) $('gStamp').onclick = stamp;
  }

  function loadBins() {   // armful → bins, size-weighted caps, overflow stays carried
    for (const s of [...armful]) {
      const p = EM().atoms.find(x => x.id === s.id), cap = EM().binCap(p);
      while (s.n > 0) {
        let bin = bins.find(b => b && b.id === s.id && b.n < cap);
        if (!bin) { const free = bins.indexOf(null); if (free < 0) break; bin = bins[free] = { id: s.id, n: 0 }; }
        const take = Math.min(s.n, cap - bin.n); bin.n += take; s.n -= take;
      }
      if (s.n <= 0) armful.splice(armful.indexOf(s), 1);
    }
    if (armful.length) say('bins are full — some stays in your arms');
    renderArmful(); renderBench();
  }

  // feedback INSIDE the garage — window.toast hides behind this overlay (Adam: "it does nothing")
  function say(msg, bad) {
    let t = $('gToast');
    if (!t) { t = document.createElement('div'); t.id = 'gToast'; root.appendChild(t); }
    t.textContent = msg;
    t.className = bad ? 'bad' : '';
    t.style.display = 'block';
    clearTimeout(say._t);
    say._t = setTimeout(() => { t.style.display = 'none'; }, 2600);
  }

  function fillSlot(kind) {
    if (sel[kind]) { delete sel[kind]; if (kind === 'block') sel = {}; renderBench(); return; }   // tap filled = take off
    const b = stackOf(kind);
    if (!b) { say('no ' + (kindLabel[kind] || kind).toLowerCase() + ' in the bins — grab some at the shelf', true); return; }
    const p = EM().atoms.find(x => x.id === b.id);
    const chk = EM().fitCheck(kind, p, sel);
    if (chk && chk.block) { say(chk.block, true); if (navigator.vibrate) navigator.vibrate([30, 40, 30]); return; }
    sel[kind] = p;
    if (chk && chk.jank) { say('🔧 ' + chk.msg); if (navigator.vibrate) navigator.vibrate([12, 30, 24]); }
    else if (navigator.vibrate) navigator.vibrate(12);
    renderBench();
  }

  function takeFromBin(id, n) {
    for (const [i, b] of bins.entries()) if (b && b.id === id) { b.n -= n; if (b.n <= 0) bins[i] = null; return; }
    const s = armful.find(x => x.id === id);                       // pockets (hardware)
    if (s) { s.n -= n; if (s.n <= 0) armful.splice(armful.indexOf(s), 1); renderArmful(); }
  }

  function stamp() {
    const name = ($('gEngName').value || '').trim() || 'UNNAMED';
    const s = EM().compute(sel);
    s.vp = EM().dynoRoll(s);                  // janky builds meet their truth on the dyno
    const my = inv();
    for (const k of ['block', 'crank', 'pistons', 'cam', 'head', 'gasket', 'bolts']) {
      my[sel[k].id] = Math.max(0, (my[sel[k].id] || 0) - 1); takeFromBin(sel[k].id, 1);
    }
    if (sel.turbo) { my[sel.turbo.id] = Math.max(0, (my[sel.turbo.id] || 0) - 1); takeFromBin(sel.turbo.id, 1); }
    setInv(my);
    const builds = EM().builds();
    const racer = (JSON.parse(localStorage.getItem('apex_account') || 'null') || {}).name || 'you';
    builds.push({ id: 'b' + Date.now().toString(36), name: name.toUpperCase(), ...s,
                  builder: racer, season: 1,
                  parts: ['block', 'crank', 'pistons', 'cam', 'head', 'turbo'].filter(k => sel[k]).map(k => sel[k].code) });
    EM().saveBuilds(builds);
    const wasJanky = s.jank > 0;
    sel = {};
    say(wasJanky
      ? '🎲 THE DYNO SAYS: ' + s.vp + ' vp — "' + name.toUpperCase() + '" · ' + s.designation + ' stamped'
      : '🔧 "' + name.toUpperCase() + '" · ' + s.designation + ' · ' + s.vp + ' vp — stamped & signed');
    if (navigator.vibrate) navigator.vibrate(wasJanky ? [20, 40, 20, 40, 120] : [20, 30, 20, 30, 60]);
    renderBench();
  }

  // ---------------------------------------------------------------- open/close
  function ensureDom() {
    if (root) return;
    root = document.createElement('div');
    root.id = 'engGarage';
    root.innerHTML = `
      <button id="gExit">← DOORS</button>
      <div id="gActBanner"></div>
      <div id="gStationBar">${Object.entries(STATIONS).map(([k, s]) =>
        `<button data-st="${k}" class="${k === 'door' ? 'on' : ''}">${s.label}</button>`).join('')}</div>
      <div id="gArmful"></div>
      <div id="gStationPanel"></div>`;
    const css = document.createElement('style');
    css.textContent = `
      #gToast { display:none; position:absolute; top:56px; left:50%; transform:translateX(-50%);
        z-index:20; background:rgba(10,17,40,.95); border:1.5px solid #2e6bff; color:#eef3ff;
        border-radius:10px; padding:10px 18px; font-size:14px; font-weight:700; max-width:86%;
        text-align:center; pointer-events:none; }
      #gToast.bad { border-color:#ff8c1a; color:#ffd9a8; }
      #engGarage .gSlot, #engGarage .gGrab, #engGarage .gAction { min-height: 42px; }`;
    root.appendChild(css);
    $('garageModal').appendChild(root);
    root.querySelector('#gExit').onclick = close;
    root.querySelectorAll('#gStationBar button').forEach(b => b.onclick = () => goTo(b.dataset.st));
  }

  function open() {
    ensureDom(); buildScene();
    buildLiftCar();                            // fresh kart + fresh wear every visit
    found = new Set();
    root.style.display = 'block';
    $('gDoors').style.display = 'none';
    const refund = localStorage.getItem('vc_act_toast');
    if (refund) {
      $('gActBanner').textContent = 'THE STANDARDIZATION ACT — the VCRA retired your pre-standard engines. Refund: ₡' + refund + '. They live on The Shelf now.';
      $('gActBanner').style.display = 'block';
      localStorage.removeItem('vc_act_toast');
      setTimeout(() => $('gActBanner').style.display = 'none', 9000);
    }
    curStation = 'door';
    camera.position.set(...STATIONS.door.pos);
    camera.userData.look.set(...STATIONS.door.look);
    renderArmful();
    if (!raf) loop();
  }
  function close() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (root) root.style.display = 'none';
    $('gDoors').style.display = '';
    if (window.ECON && ECON.garageUI) ECON.garageUI();   // livery rack may need fresh builds
  }

  return { open, close };
})();
