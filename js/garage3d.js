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
    office:  { pos: [-1.2, 1.8, 6.2], look: [-1.6, 0.7, 3.8], label: 'OFFICE' },
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
  let liftKartId = null;                       // which kart is ON the lift (you choose now)
  // wear is PER KART — your daily doesn't inherit the rally car's sins
  const wearAll = () => JSON.parse(localStorage.getItem('vc_wear2') || '{}');
  const FRESH = { tire: 0, engine: 1, flat: false };
  function wearGet(id) {
    const all = wearAll();
    return Object.assign({}, FRESH, all[id || liftKartId] || {});
  }
  function wearSet(w, id) {
    const all = wearAll();
    all[id || liftKartId] = w;
    localStorage.setItem('vc_wear2', JSON.stringify(all));
  }
  // migrate the old global wear onto the active kart, once
  (() => {
    const old = localStorage.getItem('vc_wear');
    if (!old) return;
    try {
      const act = localStorage.getItem('vc_activeKart');
      if (act) { const all = wearAll(); all[act] = JSON.parse(old); localStorage.setItem('vc_wear2', JSON.stringify(all)); }
    } catch (e) {}
    localStorage.removeItem('vc_wear');
  })();
  // wear accrues at every race end — onto the kart that RACED (the active one)
  const _origEnd = window.endRace;
  if (_origEnd && !_origEnd._lift) {
    window.endRace = function () {
      _origEnd.apply(this, arguments);
      try {
        const d = (typeof player !== 'undefined' && player && player.dmg) || null;
        if (!d) return;
        const act = localStorage.getItem('vc_activeKart');
        if (!act) return;
        const w = wearGet(act);
        w.tire = Math.min(1, +(w.tire + (d.wear || 0) * 0.55).toFixed(3));
        w.engine = Math.max(0.25, +Math.min(w.engine, 0.35 + (d.engine ?? 1) * 0.65).toFixed(3));
        if (d.flat) w.flat = true;
        wearSet(w, act);
      } catch (e) {}
    };
    window.endRace._lift = true;
  }

  function buildLiftCar() {
    if (liftCar) { scene.remove(liftCar); liftCar = null; }
    for (const s of liftSmoke) scene.remove(s.m);
    liftSmoke = [];
    closeHood();
    let kit = null;
    try {
      const liv = JSON.parse(localStorage.getItem('vc_livery') || '[]');
      kit = liv.find(k => k.id === liftKartId) || liv.find(k => k.id === localStorage.getItem('vc_activeKart')) || liv[0] || null;
      if (kit) liftKartId = kit.id;
    } catch (e) {}
    const carKit = kit ? { chassis: kit.chassis || 'gt', paint: kit.paint || 0, wheels: kit.wheels || 0, decal: kit.decal || 'none' }
                       : { chassis: 'gt', paint: 0, wheels: 0, decal: 'none' };
    liftCar = buildCarMesh(0xcccccc, 0x14274a, carKit);
    liftCar.position.set(-3.1, 1.52, 2.2);               // riding high — walk under her
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
  function orbitCam() {                        // the FULL sphere — she's on a lift, get under her
    const c = liftCar ? liftCar.position : new THREE.Vector3(-3.1, 1.5, 2.2);
    const px = c.x + Math.sin(orbit.th) * Math.sin(orbit.ph) * orbit.r;
    const py = Math.max(0.18, c.y + 0.35 + Math.cos(orbit.ph) * orbit.r);   // never through the floor
    const pz = c.z + Math.cos(orbit.th) * Math.sin(orbit.ph) * orbit.r;
    camera.position.set(px, py, pz);
    camera.userData.look.set(c.x, c.y + 0.3, c.z);
    camera.lookAt(camera.userData.look);
  }
  function renderLift() {
    const pan = $('gStationPanel');
    const w = wearGet(), my = inv();
    const clean = w.tire < 0.15 && w.engine > 0.92 && !w.flat;
    const tirePart = Object.keys(my).map(id => PARTS.find(p => p.id === id && p.fam === 'Tires' && my[id] > 0)).find(Boolean);
    const gasket = Object.keys(my).map(id => PARTS.find(p => p.id === id && p.kind === 'gasket' && my[id] > 0)).find(Boolean);
    const jobs = [];
    if (found.has('flat') || found.has('susp') || found.has('tires')) {
      const label = found.has('flat') ? '🛞 flat tire' : found.has('susp') ? '🔩 loose suspension + worn tires' : '🛞 tire wear ' + Math.round(w.tire * 100) + '%';
      jobs.push(tirePart
        ? `<div class="gRow"><div class="gInfo"><b>${label}</b><small>fits: ${tirePart.name}</small></div><button class="gGrab" data-fix="tires">WRENCH</button></div>`
        : `<div class="gRow"><div class="gInfo"><b>${label}</b><small>you own no tires — the shop does</small></div><button class="gGrab" data-shop="1">SHOP</button></div>`);
    }
    if (found.has('engine')) {
      jobs.push(gasket
        ? `<div class="gRow"><div class="gInfo"><b>⚙️ engine service · ${Math.round(w.engine * 100)}%</b><small>uses: ${gasket.name}</small></div><button class="gGrab" data-fix="engine">WRENCH</button></div>`
        : `<div class="gRow"><div class="gInfo"><b>⚙️ engine service · ${Math.round(w.engine * 100)}%</b><small>needs a head gasket (HG) — do not forget this</small></div><button class="gGrab" data-shop="1">SHOP</button></div>`);
    }
    // THE EXTRACTOR (Workshop tier+): chase out stripped bolts, labor only
    if (tier() >= 2) {
      if (w.tire > 0.05 && w.tire <= 0.25)
        jobs.push(`<div class="gRow"><div class="gInfo"><b>🪛 extractor: chewed tire bolts</b><small>labor only — Workshop perk</small></div><button class="gGrab" data-fix="exTire">WRENCH</button></div>`);
      if (w.engine >= 0.8 && w.engine < 0.99)
        jobs.push(`<div class="gRow"><div class="gInfo"><b>🪛 extractor: stripped mounts</b><small>labor only — Workshop perk</small></div><button class="gGrab" data-fix="exEng">WRENCH</button></div>`);
    }
    // THE BAY: real space. Engine + drift assist occupy it; stamped builds install here.
    const bay = bayState();
    const builds = EM().builds();
    const curEng = bay.k && bay.k.parts && bay.k.parts.Engine;
    const curB = builds.find(b => b.id === curEng);
    const bayRows = builds.slice(-4).reverse().map(b => {
      if (b.id === curEng) return `<div class="gRow"><div class="gInfo"><b>⚙️ ${b.name}</b><small>installed · ${b.vp} vp</small></div></div>`;
      const v = engineVol(b.id);
      const fits = v + (bay.assist ? ASSIST_VOL : 0) <= bay.cap;
      return `<div class="gRow"><div class="gInfo"><b>⚙️ ${b.name}</b><small>${b.designation} · ${b.vp} vp · ${v} units</small></div>
        ${fits ? `<button class="gGrab" data-install="${b.id}">WRENCH IN</button>`
               : `<button class="gGrab" data-nofit="${b.id}">WON'T FIT</button>`}</div>`;
    }).join('');
    const liv = JSON.parse(localStorage.getItem('vc_livery') || '[]');
    const picker = liv.length > 1 ? '<div class="gBins">' + liv.map(k =>
      `<button class="gGrab" data-pick="${k.id}" ${k.id === liftKartId ? 'disabled' : ''}>${(k.name || 'kart').toUpperCase()}</button>`).join('') + '</div>' : '';
    pan.innerHTML = `<h3>THE LIFT · ${liftCar ? liftCar.userData.kitName.toUpperCase() : ''}</h3>
      ${picker}
      <p class="gKind">DRAG TO ORBIT (FULL SPHERE) · PINCH/SCROLL TO ZOOM · TAP A PART TO SHAKE IT</p>
      <button class="gAction" id="gHood">${hoodGroup ? 'CLOSE THE HOOD' : '🔧 POP THE HOOD'}</button>
      ${clean ? '<p class="gEmpty">she’s clean. go put some laps on her.</p>'
        : jobs.length ? '<p class="gKind">THE JOB SHEET</p>' + jobs.join('')
        : '<p class="gEmpty">something’s off with this kart… get your hands on it and find it.</p>'}
      <p class="gKind">ENGINE BAY · ${bay.used}/${bay.cap} UNITS</p>
      <div class="gRow"><div class="gInfo"><b>🧰 drift assist unit</b><small>${bay.assist ? ASSIST_VOL + ' units · steadies the rear' : 'REMOVED — she\'s spicy now'}</small></div>
        <button class="gGrab" data-assist="1">${bay.assist ? 'PULL IT' : 'REFIT'}</button></div>
      ${bayRows || '<p class="gEmpty">no stamped builds — the workbench is waiting</p>'}`;
    pan.classList.add('open');
    pan.querySelectorAll('[data-fix]').forEach(b => b.onclick = () => wrench(b.dataset.fix, { tirePart, gasket }));
    pan.querySelectorAll('[data-shop]').forEach(b => b.onclick = () => { close(); window.closeGarage(); setTimeout(() => window.vcTab && vcTab('shop'), 180); });
    pan.querySelectorAll('[data-install]').forEach(b => b.onclick = () => wrench('install', { buildId: b.dataset.install }));
    pan.querySelectorAll('[data-nofit]').forEach(b => b.onclick = () =>
      say(bay.assist ? 'no room — pull the drift assist and it fits' : 'no room in this chassis. bigger kart, smaller engine.', true));
    pan.querySelectorAll('[data-assist]').forEach(b => b.onclick = () => wrench('assist', {}));
    pan.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
      liftKartId = b.dataset.pick;
      found = new Set();
      buildLiftCar();
      renderLift();
      say('🛗 ' + (liftCar ? liftCar.userData.kitName.toUpperCase() : 'kart') + ' on the lift');
    });
    const hd = $('gHood');
    if (hd) hd.onclick = () => { hoodGroup ? closeHood() : openHood(); renderLift(); };
  }

  // ---------------- THE WRENCH (slice 2): drag round and round until it slows
  // to a stop. Keep cranking past the stop and you STRIP it — Jank Law on labor.
  function wrench(job, parts) {
    const ov = document.createElement('div');
    ov.id = 'gWrench';
    ov.innerHTML = `
      <div class="wrTitle">${job === 'tires' ? 'TIRE SWAP' : 'ENGINE SERVICE'}</div>
      <div class="wrRing"><canvas id="wrCv" width="440" height="440"></canvas>
        <div class="wrTool">🔧</div></div>
      <div class="wrHint">drag in circles — it slows when it’s torqued. stop there.</div>
      <button class="wrBail">walk away</button>`;
    const css = document.createElement('style');
    css.textContent = `
      #gWrench { position:absolute; inset:0; z-index:30; background:rgba(5,8,18,.88);
        display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; touch-action:none; }
      #gWrench .wrTitle { font-weight:900; letter-spacing:3px; color:#eef3ff; font-size:18px; }
      #gWrench .wrRing { position:relative; width:min(64vw,440px); aspect-ratio:1; }
      #gWrench canvas { width:100%; height:100%; }
      #gWrench .wrTool { position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
        font-size:64px; transform:rotate(0deg); pointer-events:none; }
      #gWrench .wrHint { color:#8fa8e8; font-size:13px; max-width:260px; text-align:center; }
      #gWrench .wrBail { background:none; border:1.5px solid #2e6bff; color:#8fa8e8; border-radius:8px; padding:8px 18px; }`;
    ov.appendChild(css);
    root.appendChild(ov);
    const cv = ov.querySelector('#wrCv'), cx2 = cv.getContext('2d'), tool = ov.querySelector('.wrTool');
    let revs = 0, lastA = null, done = false, stripped = false, overRevs = 0;
    const NEED = 4.2;
    function draw() {
      const p = Math.min(1, Math.pow(revs / NEED, 0.65));
      cx2.clearRect(0, 0, 440, 440);
      cx2.lineWidth = 26; cx2.lineCap = 'round';
      cx2.strokeStyle = 'rgba(46,107,255,.18)';
      cx2.beginPath(); cx2.arc(220, 220, 180, 0, Math.PI * 2); cx2.stroke();
      cx2.strokeStyle = stripped ? '#ff4433' : p >= 1 ? '#ffd23e' : '#2e6bff';
      cx2.beginPath(); cx2.arc(220, 220, 180, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); cx2.stroke();
      cx2.fillStyle = '#eef3ff'; cx2.font = '900 44px Poppins, sans-serif'; cx2.textAlign = 'center';
      cx2.fillText(stripped ? 'STRIPPED' : p >= 1 ? 'TORQUED' : Math.round(p * 100) + '%', 220, 236);
    }
    draw();
    let tick = 0;
    function onMove(e) {
      if (done) return;
      const r = ov.querySelector('.wrRing').getBoundingClientRect();
      const a = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
      if (lastA !== null) {
        let d = a - lastA;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        const dd = Math.abs(d) / (Math.PI * 2);
        const p0 = Math.min(1, Math.pow(revs / NEED, 0.65));
        revs += dd * (p0 >= 1 ? 1 : (1 - p0 * 0.55));           // it gets HEAVY near the stop
        if (p0 >= 1) overRevs += dd;
        tool.style.transform = 'rotate(' + Math.round(revs * 360) + 'deg)';
        tick += dd;
        if (tick > 0.09) {                                       // ratchet clicks
          tick = 0;
          try {
            if (typeof audio !== 'undefined' && audio.ctx) {
              const o = audio.ctx.createOscillator(); o.type = 'square'; o.frequency.value = p0 >= 1 ? 180 : 900;
              const gg = audio.ctx.createGain(); gg.gain.setValueAtTime(0.05, audio.ctx.currentTime);
              gg.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + 0.03);
              o.connect(gg); gg.connect(audio.master); o.start(); o.stop(audio.ctx.currentTime + 0.04);
            }
          } catch (er) {}
          if (navigator.vibrate) navigator.vibrate(p0 >= 1 ? 24 : 8);
        }
        if (overRevs > 1.1 && !stripped) { stripped = true; finish(); return; }
      }
      lastA = a;
      draw();
    }
    function onUp() {
      lastA = null;
      if (done) return;
      if (Math.pow(revs / NEED, 0.65) >= 1) finish();
    }
    function finish() {
      done = true;
      const w = wearGet(), my = inv();
      if (job === 'tires') {
        my[parts.tirePart.id] = Math.max(0, (my[parts.tirePart.id] || 0) - 1);
        w.tire = stripped ? 0.18 : 0;
        w.flat = false;
        found.delete('flat'); found.delete('susp'); found.delete('tires');
        logReceipt('tire swap', parts.tirePart.name, stripped ? 'stripped — janky' : 'torqued to spec');
      } else if (job === 'engine') {
        my[parts.gasket.id] = Math.max(0, (my[parts.gasket.id] || 0) - 1);
        w.engine = stripped ? 0.88 : 1;
        found.delete('engine');
        logReceipt('engine service', parts.gasket.name, stripped ? 'stripped — janky' : 'torqued to spec');
      } else if (job === 'install') {
        const k = activeKart();
        if (k) {
          k.parts = k.parts || {};
          k.parts.Engine = parts.buildId;
          saveKart(k);
          const b = EM().builds().find(x => x.id === parts.buildId);
          logReceipt('engine install', b ? b.name : parts.buildId, stripped ? 'mounts stripped' : 'strapped & connected');
        }
      } else if (job === 'exTire') {
        w.tire = stripped ? 0.12 : 0;
        logReceipt('extractor: tire bolts', '—', stripped ? 'stripped AGAIN. incredible.' : 'clean threads');
      } else if (job === 'exEng') {
        w.engine = stripped ? 0.92 : 1;
        logReceipt('extractor: engine mounts', '—', stripped ? 'stripped AGAIN. incredible.' : 'clean threads');
      } else if (job === 'assist') {
        const k = activeKart();
        if (k) { k.assistOut = !k.assistOut; saveKart(k);
          logReceipt(k.assistOut ? 'drift assist REMOVED' : 'drift assist refitted', '—', stripped ? 'bolts chewed' : ''); }
      }
      setInv(my); wearSet(w);
      say(stripped ? '💀 stripped the bolts — janky, but she’ll hold. mostly.'
                   : '✅ torqued to spec. beautiful work.', stripped);
      if (navigator.vibrate) navigator.vibrate(stripped ? [60, 40, 120] : [20, 30, 20, 30, 80]);
      draw();
      setTimeout(() => { ov.remove(); buildLiftCar(); renderLift(); }, 900);
    }
    ov.addEventListener('pointermove', onMove);
    ov.addEventListener('pointerup', onUp);
    ov.querySelector('.wrBail').onclick = () => ov.remove();
  }

  // ---------------- SLICE 3: THE BAY GRID — parts occupy real space.
  // Trailmakers rule: complex shapes, simple volumes. Units are bay-blocks.
  const BAYS = { gt: 40, muscle: 48, rally: 36, formula: 30, truck: 60, kart: 16, bike: 8 };
  const ASSIST_VOL = 8;                        // the factory drift-assist unit
  function engineVol(id) {
    if (!id) return 10;                        // stock lump
    if (String(id).startsWith('b')) {          // a stamped build: size letter + turbo
      const b = EM().builds().find(x => x.id === id);
      if (!b) return 10;
      const sz = (b.designation || 'M')[0];
      return (sz === 'S' ? 12 : sz === 'L' ? 32 : 20) + (b.designation.includes('T') ? 6 : 0);
    }
    return 12;                                 // catalog part
  }
  const activeKart = () => {
    const liv = JSON.parse(localStorage.getItem('vc_livery') || '[]');
    return liv.find(k => k.id === localStorage.getItem('vc_activeKart')) || liv[0] || null;
  };
  function saveKart(k) {
    const liv = JSON.parse(localStorage.getItem('vc_livery') || '[]');
    const i = liv.findIndex(x => x.id === k.id);
    if (i >= 0) liv[i] = k; else liv.push(k);
    localStorage.setItem('vc_livery', JSON.stringify(liv));
    if (window.ECON && ECON.dirty) ECON.dirty();
  }
  function bayState() {
    const k = activeKart();
    const cap = BAYS[k && k.chassis || 'gt'] || 40;
    const engV = engineVol(k && k.parts && k.parts.Engine);
    const assist = !(k && k.assistOut);
    return { k, cap, engV, assist, used: engV + (assist ? ASSIST_VOL : 0) };
  }

  // ---------------- SLICE 5: OFFICE — receipts, rent tiers, the job inbox shell.
  const TIERS = [
    null,
    { name: 'RENTED LOCKUP', rent: 40,  perk: 'a lift, a bench, a dream' },
    { name: 'THE WORKSHOP',  rent: 200, perk: 'THE EXTRACTOR — un-strip your sins' },
    { name: 'GARAGE GRANDE', rent: 500, perk: 'DYNO CORNER — re-roll one build per cycle' },
  ];
  const tier = () => Math.min(3, Math.max(1, +(localStorage.getItem('vc_g_tier') || 1)));
  const receipts = () => JSON.parse(localStorage.getItem('vc_receipts') || '[]');
  function logReceipt(job, partName, note) {
    const r = receipts();
    r.unshift({ n: r.length + 1, job, part: partName || '—', note: note || '', when: 'race day ' + (+(localStorage.getItem('vc_g_races') || 0)) });
    localStorage.setItem('vc_receipts', JSON.stringify(r.slice(0, 40)));
  }
  // rent cycles on race count (endRace wrap #5 — the chain holds)
  const _rentEnd = window.endRace;
  if (_rentEnd && !_rentEnd._rent) {
    window.endRace = function () {
      _rentEnd.apply(this, arguments);
      try {
        const n = +(localStorage.getItem('vc_g_races') || 0) + 1;
        localStorage.setItem('vc_g_races', n);
        if (n % 12 === 0) {
          const t = TIERS[tier()];
          const money = +(localStorage.getItem('vc_money') || 0);
          if (money >= t.rent) {
            localStorage.setItem('vc_money', money - t.rent);
            if (window.toast) toast('🏚️ garage rent paid: ₡' + t.rent + ' (' + t.name + ')');
          } else if (tier() > 1) {
            localStorage.setItem('vc_g_tier', tier() - 1);
            if (window.toast) toast('🏚️ couldn\'t make rent — downsized to ' + TIERS[tier()].name);
          }
          localStorage.setItem('vc_dyno_used', '0');
          if (window.ECON) ECON.refreshBalance();
        }
      } catch (e) {}
    };
    window.endRace._rent = true;
  }
  function renderOffice() {
    const pan = $('gStationPanel');
    const t = tier(), T = TIERS[t];
    const races = +(localStorage.getItem('vc_g_races') || 0);
    const due = 12 - (races % 12);
    const jobs = JSON.parse(localStorage.getItem('vc_jobs') || '[]');
    const money = +(localStorage.getItem('vc_money') || 0);
    const up = TIERS[t + 1];
    pan.innerHTML = `<h3>OFFICE</h3>
      <div class="gSpec"><b>${T.name}</b> · rent ₡${T.rent} every 12 race days · due in ${due}</div>
      <p class="gEmpty">${T.perk}</p>
      ${up ? `<button class="gAction" id="gUpTier">UPGRADE: ${up.name} · ₡${up.rent}/cycle${money < up.rent ? ' (need ₡' + up.rent + ' on hand)' : ''}</button>` : ''}
      ${t >= 3 ? `<button class="gAction" id="gDyno" ${localStorage.getItem('vc_dyno_used') === '1' ? 'disabled' : ''}>🎲 DYNO: re-roll your newest build (1/cycle)</button>` : ''}
      <p class="gKind">JOB REQUESTS</p>
      ${jobs.length ? jobs.map(j => `<div class="gRow"><div class="gInfo"><b>${j.from}: ${j.text}</b></div></div>`).join('')
                    : '<p class="gEmpty">quiet. when the league connects, your team\'s requests land here.</p>'}
      <p class="gKind">RECEIPTS</p>
      ${receipts().slice(0, 8).map(r => `<div class="gRow"><div class="gInfo"><b>#${r.n} ${r.job}</b><small>${r.part}${r.note ? ' · ' + r.note : ''} · ${r.when}</small></div></div>`).join('')
        || '<p class="gEmpty">no work on the books yet</p>'}`;
    pan.classList.add('open');
    const upB = $('gUpTier');
    if (upB) upB.onclick = () => {
      if (money < up.rent) { say('rent is due on signing — you need ₡' + up.rent + ' on hand', true); return; }
      localStorage.setItem('vc_money', money - up.rent);
      localStorage.setItem('vc_g_tier', t + 1);
      if (window.ECON) ECON.refreshBalance();
      say('📜 signed the lease: ' + up.name);
      renderOffice();
    };
    const dy = $('gDyno');
    if (dy) dy.onclick = () => {
      const bs = EM().builds();
      if (!bs.length) { say('nothing to dyno — stamp a build first', true); return; }
      const b = bs[bs.length - 1];
      const old = b.vp;
      b.vp = Math.max(30, Math.round(b.vp * (0.92 + Math.random() * 0.22)));
      EM().saveBuilds(bs);
      localStorage.setItem('vc_dyno_used', '1');
      logReceipt('dyno session', b.name, old + ' → ' + b.vp + ' vp');
      say('🎲 the dyno says: ' + b.name + ' is ' + b.vp + ' vp (was ' + old + ')');
      renderOffice();
    };
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

    // THE LIFT (left-front): a REAL two-post lift — the car rides high, you walk under
    for (const dx of [-0.55, 0.55]) {
      put(box(0.28, 0.34, 3.4, 0xb8452a), -3.1 + dx, 1.32, 2.2, 0.5);        // rails, raised
      for (const dz of [-1.2, 1.2])
        put(box(0.18, 1.5, 0.18, 0x3a3f4a), -3.1 + dx, 0.75, 2.2 + dz, 0);   // tall posts
    }
    put(box(0.9, 0.1, 0.5, 0x2a3140), -1.6, 0.3, 3.8);                       // control pedestal
    put(box(0.5, 0.5, 0.08, 0xff8c1a, 0x331a00), -1.6, 0.75, 3.8);           // UP/DOWN panel

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    root.insertBefore(renderer.domElement, root.firstChild);

    renderer.domElement.addEventListener('pointerdown', ptrDown);
    renderer.domElement.addEventListener('pointermove', ptrMove);
    renderer.domElement.addEventListener('pointerup', ptrUp);
    renderer.domElement.addEventListener('wheel', ptrWheel, { passive: false });
    renderer.domElement.addEventListener('touchmove', ptrTouch, { passive: false });
    addEventListener('keydown', keyDown);
    addEventListener('keyup', keyUp);
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
    else if (p.x > -2.2 && p.x < -1 && p.z > 3.2) goTo('office');   // the pedestal
    else if (p.x < -1 && p.z > 0.5) goTo('lift');
  }
  // ---- WALK MODE: the garage is a place you're IN. Left thumb (or WASD) walks,
  // right thumb (or mouse drag) looks. At the lift you're in ORBIT: full sphere.
  const walk = { yaw: Math.PI, pitch: -0.08, x: 0, z: 7.6, joy: null, look: null, keys: {} };
  const mode = () => curStation === 'lift' ? 'orbit' : 'walk';

  function ptrDown(e) {
    const half = renderer.domElement.getBoundingClientRect().width * 0.42;
    if (mode() === 'orbit') { orbit.drag = { x: e.clientX, y: e.clientY }; orbit.moved = 0; return; }
    const isTouch = e.pointerType === 'touch';
    if (isTouch && e.clientX < half && !walk.joy) walk.joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 };
    else if (!walk.look) walk.look = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
  }
  function ptrMove(e) {
    if (mode() === 'orbit') {
      if (!orbit.drag) return;
      const dx = e.clientX - orbit.drag.x, dy = e.clientY - orbit.drag.y;
      orbit.moved += Math.abs(dx) + Math.abs(dy);
      orbit.th -= dx * 0.008;
      orbit.ph = Math.max(0.12, Math.min(2.85, orbit.ph + dy * 0.006));   // the FULL sphere
      orbit.drag = { x: e.clientX, y: e.clientY };
      return;
    }
    if (walk.joy && e.pointerId === walk.joy.id) {
      walk.joy.dx = Math.max(-1, Math.min(1, (e.clientX - walk.joy.x0) / 60));
      walk.joy.dy = Math.max(-1, Math.min(1, (e.clientY - walk.joy.y0) / 60));
      const nub = $('gJoyNub');
      if (nub) nub.style.transform = `translate(${walk.joy.dx * 26}px, ${walk.joy.dy * 26}px)`;
    } else if (walk.look && e.pointerId === walk.look.id) {
      const dx = e.clientX - walk.look.x, dy = e.clientY - walk.look.y;
      walk.look.moved += Math.abs(dx) + Math.abs(dy);
      walk.yaw -= dx * 0.006;
      walk.pitch = Math.max(-0.9, Math.min(0.7, walk.pitch - dy * 0.004));
      walk.look.x = e.clientX; walk.look.y = e.clientY;
    }
  }
  function ptrUp(e) {
    if (mode() === 'orbit') {
      if (!orbit.drag) return;
      const still = orbit.moved < 8;
      orbit.drag = null;
      if (!still || !liftCar) return;
      castAt(e);
      const hit = ray.intersectObjects(liftCar.children, true)[0];
      if (hit) shakePart(hit.object);
      return;
    }
    if (walk.joy && e.pointerId === walk.joy.id) {
      walk.joy = null;
      const nub = $('gJoyNub'); if (nub) nub.style.transform = '';
    } else if (walk.look && e.pointerId === walk.look.id) {
      const still = walk.look.moved < 8;
      walk.look = null;
      if (still) onTap(e);                    // a still tap = interact with what you see
    }
  }
  function ptrWheel(e) {
    if (mode() !== 'orbit') return;
    e.preventDefault();
    orbit.r = Math.max(2.0, Math.min(8.5, orbit.r + e.deltaY * 0.01));
  }
  let pinch0 = 0;
  function ptrTouch(e) {
    if (mode() !== 'orbit' || e.touches.length !== 2) return;
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    if (pinch0) orbit.r = Math.max(2.0, Math.min(8.5, orbit.r * (pinch0 / d)));
    pinch0 = d;
    e.preventDefault();
  }
  function keyDown(e) { walk.keys[e.key.toLowerCase()] = true; }
  function keyUp(e) { walk.keys[e.key.toLowerCase()] = false; }
  function walkStep() {                        // called from loop()
    if (mode() !== 'walk' || tween) return;
    let mx = 0, mz = 0;
    if (walk.joy) { mx = walk.joy.dx; mz = -walk.joy.dy; }
    if (walk.keys.w || walk.keys.arrowup) mz = 1;
    if (walk.keys.s || walk.keys.arrowdown) mz = -1;
    if (walk.keys.a || walk.keys.arrowleft) mx = -1;
    if (walk.keys.d || walk.keys.arrowright) mx = 1;
    if (mx || mz) {
      const sp = 0.075;
      walk.x += (Math.sin(walk.yaw) * mz + Math.sin(walk.yaw + Math.PI / 2) * mx) * sp;
      walk.z += (Math.cos(walk.yaw) * mz + Math.cos(walk.yaw + Math.PI / 2) * mx) * sp;
      walk.x = Math.max(-7.3, Math.min(7.3, walk.x));
      walk.z = Math.max(-5.3, Math.min(7.9, walk.z));
      const pan = $('gStationPanel');          // walking away closes the paperwork
      if (pan && pan.classList.contains('open') && (mx || mz)) pan.classList.remove('open');
    }
    camera.position.set(walk.x, 1.68, walk.z);
    camera.userData.look.set(
      walk.x + Math.sin(walk.yaw) * Math.cos(walk.pitch),
      1.68 + Math.sin(walk.pitch),
      walk.z + Math.cos(walk.yaw) * Math.cos(walk.pitch));
    camera.lookAt(camera.userData.look);
  }

  // ---- POP THE HOOD: the bay becomes visible — holographic volumes over the car
  let hoodGroup = null;
  function openHood() {
    closeHood();
    if (!liftCar) return;
    const bay = bayState();
    hoodGroup = new THREE.Group();
    const holo = (w, h, d, c, o2) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o2, depthWrite: false }));
    const outline = holo(1.9, 0.85, 1.5, 0x2e6bff, 0.10);
    outline.add(new THREE.LineSegments(new THREE.EdgesGeometry(outline.geometry),
      new THREE.LineBasicMaterial({ color: 0x4d86ff })));
    hoodGroup.add(outline);
    const engFrac = bay.engV / bay.cap, asFrac = ASSIST_VOL / bay.cap;
    const eng = holo(1.9 * engFrac * 2.2, 0.7, 1.3, 0x5ee23b, 0.3);
    eng.position.x = -0.9 + 1.9 * engFrac;
    hoodGroup.add(eng);
    if (bay.assist) {
      const as = holo(1.9 * asFrac * 2.2, 0.5, 1.0, 0xff8c1a, 0.35);
      as.position.x = 0.9 - 1.9 * asFrac;
      hoodGroup.add(as);
    }
    hoodGroup.position.set(0, 1.35, 0.9);      // floats over the bay, hood "open"
    liftCar.add(hoodGroup);
    orbit.ph = 0.6; orbit.th = 0.5; orbit.r = 4.4;   // camera swings over the bay
  }
  function closeHood() {
    if (hoodGroup) { try { hoodGroup.parent.remove(hoodGroup); } catch (e) {} hoodGroup = null; }
  }

  function goTo(name) {
    if (!STATIONS[name] || name === curStation) { openPanel(name); return; }
    const st = STATIONS[name];
    tween = { t: 0, fromP: camera.position.clone(), toP: new THREE.Vector3(...st.pos),
              fromL: camera.userData.look.clone(), toL: new THREE.Vector3(...st.look) };
    curStation = name;
    if (name !== 'lift') {                     // hand the body back to your feet where you land
      walk.x = st.pos[0]; walk.z = st.pos[2];
      walk.yaw = Math.atan2(st.look[0] - st.pos[0], st.look[2] - st.pos[2]);
      walk.pitch = -0.1;
      closeHood();
    }
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
    else walkStep();
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
    else if (name === 'office') { renderOffice(); return; }
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
      <div id="gStationPanel"></div>
      <div id="gJoy"><div id="gJoyNub"></div></div>`;
    const css = document.createElement('style');
    css.textContent = `
      #gToast { display:none; position:absolute; top:56px; left:50%; transform:translateX(-50%);
        z-index:20; background:rgba(10,17,40,.95); border:1.5px solid #2e6bff; color:#eef3ff;
        border-radius:10px; padding:10px 18px; font-size:14px; font-weight:700; max-width:86%;
        text-align:center; pointer-events:none; }
      #gToast.bad { border-color:#ff8c1a; color:#ffd9a8; }
      #engGarage .gSlot, #engGarage .gGrab, #engGarage .gAction { min-height: 42px; }
      #gJoy { position:absolute; left:22px; bottom:88px; width:84px; height:84px; border-radius:50%;
        border:2px solid rgba(46,107,255,.4); background:rgba(10,17,40,.35); display:none;
        align-items:center; justify-content:center; pointer-events:none; }
      #gJoyNub { width:36px; height:36px; border-radius:50%; background:rgba(77,134,255,.75); }
      @media (pointer: coarse) { #gJoy { display:flex; } }`;
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
    walk.x = 0; walk.z = 7.6; walk.yaw = Math.PI; walk.pitch = -0.08;
    camera.position.set(walk.x, 1.68, walk.z);
    camera.userData.look.set(0, 1.4, 0);
    renderArmful();
    if (!raf) loop();
  }
  function close() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (root) root.style.display = 'none';
    $('gDoors').style.display = '';
    if (window.ECON && ECON.garageUI) ECON.garageUI();   // livery rack may need fresh builds
  }

  return { open, close,
    _dbg: {
      station: () => curStation,
      lift: () => liftCar,
      shake: () => liftCar && shakePart(liftCar.children[1]),
      cast: (x, y) => {
        castAt({ clientX: x, clientY: y });
        return liftCar ? ray.intersectObjects(liftCar.children, true).length : -1;
      },
    } };
})();
