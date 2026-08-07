/* VALCORSA — FLEX: wrap packs + celebration packs. The racer's gacha.
   Flex only, never speed (house rule: money buys options, not power).
   Wraps = underglow + tire-smoke colors on YOUR kart; celebrations play when
   you finish. P1 in any race = a free pack. Self-contained: own button/modal/
   styles/storage; hooks endRace by wrapping it (chain-safe with radio.js). */
'use strict';
(function () {
  const F = {};
  window.FLEX = F;
  const $id = id => document.getElementById(id);
  const money = () => +(localStorage.getItem('vc_money') ?? 600);
  const setMoney = n => { localStorage.setItem('vc_money', Math.max(0, Math.round(n))); try { ECON.refreshBalance(); } catch (e) {} };

  // ---- the catalogs ----
  const GLOWS = [
    { id: 'g_crimson', n: 'Crimson Glow', c: 0xe23b2e, r: 0 }, { id: 'g_volt', n: 'Volt Blue', c: 0x2b8cff, r: 0 },
    { id: 'g_lime', n: 'Lime Glow', c: 0x5ee23b, r: 0 }, { id: 'g_gold', n: 'Gold Glow', c: 0xd9ad4b, r: 0 },
    { id: 'g_violet', n: 'Violet Glow', c: 0x9b4bff, r: 0 }, { id: 'g_ice', n: 'Ice Glow', c: 0x9be8ff, r: 0 },
    { id: 'g_pulse', n: 'Rosso Pulse', c: 0xff2211, r: 1, pulse: 1 }, { id: 'g_aurora', n: 'AURORA', c: 0xffffff, r: 2, hue: 1 },
  ];
  const SMOKES = [
    { id: 's_rojo', n: 'Rojo Smoke', c: 0xe86a5a, r: 0 }, { id: 's_azul', n: 'Azul Smoke', c: 0x6a9de8, r: 0 },
    { id: 's_verde', n: 'Verde Smoke', c: 0x7ee86a, r: 0 }, { id: 's_rosa', n: 'Rosa Smoke', c: 0xf0a7d8, r: 0 },
    { id: 's_oro', n: 'Oro Smoke', c: 0xf2cf6b, r: 1 }, { id: 's_negro', n: 'Negro Smoke', c: 0x333333, r: 1 },
  ];
  const CELEBS = [
    { id: 'c_donuts', n: 'Victory Donuts', r: 0 }, { id: 'c_horn', n: 'The Big Horn', r: 0 },
    { id: 'c_bounce', n: 'Bounce', r: 0 }, { id: 'c_flames', n: 'Flame Show', r: 1 },
    { id: 'c_fireworks', n: 'Fireworks', r: 1 }, { id: 'c_champagne', n: 'Champagne', r: 2 },
  ];
  const RNAME = ['', '★ RARE', '★★ LEGEND'], RCOL = ['#c9c2ad', '#d9ad4b', '#e23b2e'];
  const WRAP_POOL = [...GLOWS, ...SMOKES], PRICE = { wrap: 150, celeb: 180 };

  const owned = () => JSON.parse(localStorage.getItem('vc_flex') || '{}');
  const setOwned = o => localStorage.setItem('vc_flex', JSON.stringify(o));
  const equip = () => JSON.parse(localStorage.getItem('vc_flex_eq') || '{}');
  const setEquip = o => localStorage.setItem('vc_flex_eq', JSON.stringify(o));
  const tokens = () => +(localStorage.getItem('vc_flex_tok') || 0);
  const setTokens = n => localStorage.setItem('vc_flex_tok', Math.max(0, n));

  function pull(pool) {                       // rarity odds: 70/24/6
    const roll = Math.random();
    const want = roll < 0.06 ? 2 : roll < 0.30 ? 1 : 0;
    const tier = pool.filter(i => i.r === want);
    const from = tier.length ? tier : pool;
    return from[Math.floor(Math.random() * from.length)];
  }
  F.openPack = function (kind, free) {
    if (!free) {
      if (tokens() > 0) setTokens(tokens() - 1);
      else if (money() >= PRICE[kind]) setMoney(money() - PRICE[kind]);
      else { toastF('Not enough ₡'); return; }
    }
    const item = pull(kind === 'wrap' ? WRAP_POOL : CELEBS);
    const o = owned();
    let dupe = false;
    if (o[item.id]) { dupe = true; setMoney(money() + 40); }
    else { o[item.id] = 1; setOwned(o); }
    reveal(item, dupe);
    renderModal();
  };
  function toastF(m) { if (window.toast) toast(m); }

  // ---- P1 = free pack (wrap endRace; radio.js wrapped it first — chains fine) ----
  const orig = window.endRace;
  if (orig && !orig._flex) {
    window.endRace = function () {
      orig.apply(this, arguments);
      try {
        if (raceStandings().findIndex(c => c.isPlayer) === 0) {
          setTokens(tokens() + 1);
          toastF('🎁 P1! Free flex pack earned — open it in FLEX');
        }
        playCeleb();
      } catch (e) {}
    };
    window.endRace._flex = true;
  }

  // ---- underglow (attached to the player mesh, survives race rebuilds via polling) ----
  let glowMesh = null, glowOn = null;
  function tickGlow() {
    const eq = equip();
    const spec = GLOWS.find(g => g.id === eq.glow);
    const havePlayer = typeof player !== 'undefined' && player && player.mesh;
    if (!spec || !havePlayer) {
      if (glowMesh && glowMesh.parent) glowMesh.parent.remove(glowMesh);
      glowMesh = null; glowOn = null;
      return;
    }
    if (!glowMesh || glowMesh.parent !== player.mesh || glowOn !== spec.id) {
      if (glowMesh && glowMesh.parent) glowMesh.parent.remove(glowMesh);
      const geo = new THREE.PlaneGeometry(3.4, 5.2);
      const mat = new THREE.MeshBasicMaterial({ color: spec.c, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      glowMesh = new THREE.Mesh(geo, mat);
      glowMesh.rotation.x = -Math.PI / 2;
      glowMesh.position.y = 0.07;
      player.mesh.add(glowMesh);
      glowOn = spec.id;
    }
    const t = performance.now() / 1000;
    if (spec.pulse) glowMesh.material.opacity = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(t * 6));
    if (spec.hue) glowMesh.material.color.setHSL((t * 0.15) % 1, 0.9, 0.6);
  }

  // ---- colored tire smoke (own tiny sprite pool) ----
  const smokes = [];
  function tickSmoke(dt) {
    const eq = equip();
    const spec = SMOKES.find(s => s.id === eq.smoke);
    const havePlayer = typeof player !== 'undefined' && player && player.mesh && typeof scene !== 'undefined';
    if (spec && havePlayer && player.slip > 8 && Math.hypot(player.velX, player.velZ) > 10) {
      if (smokes.length < 36) {
        const m = new THREE.Sprite(new THREE.SpriteMaterial({ color: spec.c, transparent: true, opacity: 0.5, depthWrite: false }));
        const back = 2.2;
        m.position.set(player.x - Math.sin(player.heading) * back + (Math.random() - 0.5),
          player.y + 0.4, player.z - Math.cos(player.heading) * back + (Math.random() - 0.5));
        m.scale.setScalar(0.8 + Math.random() * 0.7);
        scene.add(m);
        smokes.push({ m, life: 0.7 });
      }
    }
    for (let i = smokes.length - 1; i >= 0; i--) {
      const s = smokes[i];
      s.life -= dt;
      s.m.position.y += dt * 1.6;
      s.m.scale.multiplyScalar(1 + dt * 1.4);
      s.m.material.opacity = Math.max(0, s.life) * 0.7;
      if (s.life <= 0) { scene.remove(s.m); smokes.splice(i, 1); }
    }
  }

  // ---- celebrations (play at YOUR finish, behind the live results) ----
  let celebT = 0, celebKind = null, bursts = [];
  function playCeleb() {
    const eq = equip();
    if (!eq.celeb) return;
    celebKind = eq.celeb; celebT = 3.2;
    if (celebKind === 'c_horn') hornBlast();
  }
  function hornBlast() {
    try {
      if (typeof audio === 'undefined' || !audio.ctx) return;
      for (const f of [392, 523]) {
        const o = audio.ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
        const g = audio.ctx.createGain();
        g.gain.setValueAtTime(0.12, audio.ctx.currentTime);
        g.gain.setValueAtTime(0.12, audio.ctx.currentTime + 0.5);
        g.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + 0.8);
        o.connect(g); g.connect(audio.master);
        o.start(); o.stop(audio.ctx.currentTime + 0.85);
      }
    } catch (e) {}
  }
  function burst(x, y, z, color, n) {
    if (typeof scene === 'undefined') return;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
      m.position.set(x, y, z);
      m.scale.setScalar(0.35 + Math.random() * 0.4);
      scene.add(m);
      bursts.push({ m, life: 0.9 + Math.random() * 0.5,
        vx: (Math.random() - 0.5) * 9, vy: 3 + Math.random() * 6, vz: (Math.random() - 0.5) * 9 });
    }
  }
  function tickCeleb(dt) {
    if (celebT > 0 && typeof player !== 'undefined' && player && player.mesh) {
      celebT -= dt;
      const t = 3.2 - celebT;
      if (celebKind === 'c_donuts') player.mesh.rotation.y += dt * 7;
      if (celebKind === 'c_bounce') player.mesh.position.y += Math.abs(Math.sin(t * 9)) * 0.4;
      if (celebKind === 'c_flames' && Math.random() < dt * 12)
        burst(player.x - Math.sin(player.heading) * 2.4, player.y + 0.5, player.z - Math.cos(player.heading) * 2.4, 0xff7a1a, 4);
      if (celebKind === 'c_fireworks' && Math.random() < dt * 4)
        burst(player.x + (Math.random() - 0.5) * 8, player.y + 8 + Math.random() * 5, player.z + (Math.random() - 0.5) * 8,
          [0xe23b2e, 0xd9ad4b, 0x2b8cff, 0x5ee23b][Math.floor(Math.random() * 4)], 14);
      if (celebKind === 'c_champagne' && Math.random() < dt * 14)
        burst(player.x, player.y + 1.6, player.z, 0xfff6d8, 3);
      if (celebKind === 'c_horn' && Math.random() < dt * 8)
        burst(player.x, player.y + 2.2, player.z, [0xe23b2e, 0xf4ecdd, 0x1e5741][Math.floor(Math.random() * 3)], 6);
      if (celebT <= 0 && celebKind === 'c_donuts') player.mesh.rotation.y = 0;
    }
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.life -= dt;
      b.vy -= dt * 9;
      b.m.position.x += b.vx * dt; b.m.position.y += b.vy * dt; b.m.position.z += b.vz * dt;
      b.m.material.opacity = Math.max(0, Math.min(0.9, b.life));
      if (b.life <= 0) { scene.remove(b.m); bursts.splice(i, 1); }
    }
  }

  // main flex loop
  let lastT = performance.now();
  (function loop() {
    requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(0.1, (now - lastT) / 1000);
    lastT = now;
    try { tickGlow(); tickSmoke(dt); tickCeleb(dt); } catch (e) {}
  })();

  // ---- UI ----
  const css = document.createElement('style');
  css.textContent = `
    #flexModal { display:none; position:fixed; inset:0; z-index:74; align-items:center; justify-content:center;
      background:rgba(8,10,14,.78); backdrop-filter:blur(6px); overflow-y:auto; }
    #flexModal .panel { max-width:520px; width:94vw; }
    .flexRow { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; }
    .flexChip { min-width:0!important; background:#1c241f!important; border:1px solid #2f3a32; border-radius:10px;
      padding:9px 12px; font-size:13px; }
    .flexChip.eq { background:#1e5741!important; border-color:#7fb89d; }
    .flexChip.na { opacity:.35; pointer-events:none; }
    .flexHead { font-size:13px; letter-spacing:.14em; text-transform:uppercase; opacity:.7; margin:10px 0 4px; }
    #flexReveal { display:none; position:fixed; inset:0; z-index:76; align-items:center; justify-content:center;
      background:rgba(8,10,14,.85); }
    #flexReveal .card { background:#161b24; border:2px solid #444; border-radius:16px; padding:36px 44px;
      text-align:center; animation:flexPop .45s cubic-bezier(.3,.7,.4,1.4); }
    @keyframes flexPop { from { transform:scale(.4) rotate(-6deg); opacity:0 } to { transform:scale(1) rotate(0); opacity:1 } }
    #flexReveal .rar { font-size:12px; letter-spacing:.2em; font-weight:800; }
    #flexReveal h3 { font-size:26px; margin:8px 0 14px; }`;
  document.head.appendChild(css);

  function renderModal() {
    const m = $id('flexModal');
    if (!m) return;
    const o = owned(), eq = equip();
    const chip = (item, slot) => {
      const own = o[item.id];
      return `<button class="flexChip ${eq[slot] === item.id ? 'eq' : ''} ${own ? '' : 'na'}"
        onclick="FLEX.wear('${slot}','${item.id}')" style="color:${RCOL[item.r]}">${item.n}</button>`;
    };
    m.querySelector('.flexBody').innerHTML = `
      <p class="flexHead">🎁 Packs · balance ₡${money()} · free tokens: ${tokens()}</p>
      <div class="flexRow">
        <button onclick="FLEX.openPack('wrap')">🎨 Wrap Pack ₡${PRICE.wrap}</button>
        <button onclick="FLEX.openPack('celeb')">🏆 Celebration Pack ₡${PRICE.celeb}</button>
      </div>
      <p class="flexHead">Underglow ${eq.glow ? `· <a href="#" onclick="FLEX.wear('glow',null);return false">off</a>` : ''}</p>
      <div class="flexRow">${GLOWS.map(g => chip(g, 'glow')).join('')}</div>
      <p class="flexHead">Tire smoke ${eq.smoke ? `· <a href="#" onclick="FLEX.wear('smoke',null);return false">off</a>` : ''}</p>
      <div class="flexRow">${SMOKES.map(s => chip(s, 'smoke')).join('')}</div>
      <p class="flexHead">Celebration ${eq.celeb ? `· <a href="#" onclick="FLEX.wear('celeb',null);return false">off</a>` : ''}</p>
      <div class="flexRow">${CELEBS.map(c => chip(c, 'celeb')).join('')}</div>`;
  }
  F.wear = function (slot, id) {
    const o = owned(), eq = equip();
    if (id && !o[id]) return;
    eq[slot] = eq[slot] === id ? null : id;
    setEquip(eq);
    renderModal();
  };
  function reveal(item, dupe) {
    let r = $id('flexReveal');
    if (!r) {
      r = document.createElement('div'); r.id = 'flexReveal';
      r.onclick = () => { r.style.display = 'none'; };
      document.body.appendChild(r);
    }
    r.innerHTML = `<div class="card" style="border-color:${RCOL[item.r]}">
      <div class="rar" style="color:${RCOL[item.r]}">${RNAME[item.r] || 'COMMON'}</div>
      <h3>${item.n}</h3>
      <p style="opacity:.7;font-size:13px">${dupe ? 'Duplicate — scrapped for ₡40' : 'Added to your flex locker'}</p>
      <p style="opacity:.5;font-size:12px;margin-top:10px">tap to close</p></div>`;
    r.style.display = 'flex';
  }
  function inject() {
    if ($id('flexBtn')) return;
    const row = $id('diffRow');
    if (!row) return;
    const b = document.createElement('button');
    b.className = 'navBtn'; b.id = 'flexBtn';
    b.textContent = '🎁 FLEX';
    b.onclick = () => { renderModal(); $id('flexModal').style.display = 'flex'; };
    row.insertBefore(b, row.firstChild);
    const m = document.createElement('div');
    m.id = 'flexModal';
    m.innerHTML = `<div class="panel"><h2>🎁 Flex Locker</h2>
      <div class="flexBody"></div>
      <button onclick="document.getElementById('flexModal').style.display='none'">Close</button></div>`;
    document.body.appendChild(m);
  }
  inject();
})();
