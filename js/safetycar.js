/* VALCORSA — THE SAFETY CARS (js/safetycar.js). Join a race after lights out and
   there is no waiting screen: you enter at speed-cap behind TWO VCRA safety cars
   running side by side. They escort you to the back of the pack, then peel off.
   Passing them gains you nothing: you get put straight back behind them.
   Self-contained: window.SAFETY.enter() after any startGame; hooks = ucv wrap. */
'use strict';
(function () {
  const CAP_DASH = 145;               // ≈ 90 mph on the dash
  let active = false, phase = 'off', scs = [], sidx = 0, blinkT = 0, peelT = 0, penalties = 0;

  function dashToWorld(d) {
    const k = (typeof SPEED_DISPLAY_SCALE !== 'undefined') ? 3.6 * SPEED_DISPLAY_SCALE : 1.62;
    return d / k;
  }

  function buildSC() {
    const g = buildKitMesh({ chassis: 'lumi', paint: 4, wheels: 0, decal: 'none' }, 0xff8c1a);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xff8c1a }));
    bar.position.set(0, 1.85, -0.2);
    g.add(bar);
    g.userData.bar = bar;
    scene.add(g);
    return g;
  }

  function enter() {
    if (active || typeof player === 'undefined' || !player || typeof track === 'undefined' || !track) return;
    try {
      scs = [buildSC(), buildSC()];
    } catch (e) { return; }
    active = true; phase = 'escort'; penalties = 0;
    sidx = ((player.idx || 0) + 16) % track.N;
    if (window.toast) toast('SAFETY CARS AHEAD — hold 145 until you reach the pack');
  }

  function sampleAt(f) {
    const N = track.N || track.samples.length;
    return track.samples[((Math.floor(f) % N) + N) % N];
  }
  function tangAt(f) {
    const N = track.N || track.samples.length;
    const a = sampleAt(f), b = track.samples[((Math.floor(f) + 2) % N + N) % N];
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
    return [dx / l, dz / l];
  }

  function dropSC() {
    for (const g of scs) if (g.parent) g.parent.remove(g);
    scs = [];
    active = false; phase = 'off';
  }

  function update(dt) {
    if (!active || typeof state === 'undefined' || (state !== 'race' && state !== 'countdown')) { if (active && state === 'menu') dropSC(); return; }
    if (!track || !track.samples || !player) return;
    const spacing = (() => { const a = track.samples[0], b = track.samples[1]; return Math.hypot(b.x - a.x, b.z - a.z) || 1.5; })();
    const cap = dashToWorld(CAP_DASH);
    const scV = cap * 0.97;
    blinkT += dt;

    if (phase === 'escort') {
      // the pair holds formation ~16 samples ahead of the PLAYER — an escort, not an escape
      const N = track.N || track.samples.length;
      const lead = (((sidx - (player.idx || 0)) % N) + N) % N;
      if (lead < 24) sidx = (sidx + scV * dt / spacing) % N;
      const s = sampleAt(sidx), t = tangAt(sidx);
      const px = t[1], pz = -t[0];
      scs.forEach((g, i) => {
        const lat = i === 0 ? -2.3 : 2.3;
        g.position.set(s.x + px * lat, s.y + 0.05, s.z + pz * lat);
        g.rotation.set(0, Math.atan2(t[0], t[1]), 0);
        g.userData.bar.material.color.setHex(Math.floor(blinkT * 4) % 2 ? 0xff8c1a : 0xfff3d8);
      });
      // the leash on the player: speed cap while the safety cars are out
      const v = Math.hypot(player.velX || 0, player.velZ || 0);
      if (v > cap) { const k = cap / v; player.velX *= k; player.velZ *= k; }
      // geometry vs the pair: ahead = past them
      const mx = s.x, mz = s.z;
      const adot = (player.x - mx) * t[0] + (player.z - mz) * t[1];
      const ldot = (player.x - mx) * px + (player.z - mz) * pz;
      if (adot > -6 && adot < 2 && Math.abs(ldot) < 4 && v > cap * 0.5) {
        player.velX *= 0.92; player.velZ *= 0.92;      // their gearbox is your problem now
      }
      if (adot > 4.5) {                                 // you actually passed them. bold.
        penalties++;
        const back = sampleAt(sidx - 14), bt = tangAt(sidx - 14);
        player.x = back.x; player.z = back.z; player.y = back.y + 0.1;
        player.heading = Math.atan2(bt[0], bt[1]);
        player.velX = bt[0] * cap * 0.5; player.velZ = bt[1] * cap * 0.5;
        if (window.toast) toast('YOU PASSED THE SAFETY CAR — back you go (' + penalties + ')');
      }
      // reached the field? any live racing kart nearby ahead = escort's done
      if (typeof cars !== 'undefined') {
        for (const c of cars) {
          if (c.isPlayer || c.finished || (c.dmg && c.dmg.shattered)) continue;
          if (Math.hypot(c.x - player.x, c.z - player.z) < 70) { phase = 'peel'; peelT = 0; break; }
        }
      }
    } else if (phase === 'peel') {
      peelT += dt;
      sidx = (sidx + scV * (1 - peelT * 0.4) * dt / spacing) % track.N;
      const s = sampleAt(sidx), t = tangAt(sidx);
      const px = t[1], pz = -t[0];
      const out = 2.3 + peelT * 6;                      // pull off the racing line
      scs.forEach((g, i) => {
        const lat = (i === 0 ? -1 : 1) * out;
        g.position.set(s.x + px * lat, s.y + 0.05, s.z + pz * lat);
        g.rotation.set(0, Math.atan2(t[0], t[1]), 0);
      });
      if (peelT === dt && window.toast) toast('SAFETY CARS IN — RACE ON');
      if (peelT > 2.2) dropSC();
    }
  }

  window.SAFETY = { enter, update, get active() { return active; }, get penalties() { return penalties; } };

  const _ucv = window.updateCarVisuals;
  if (typeof _ucv === 'function') {
    window.updateCarVisuals = function (dt) {
      _ucv.apply(this, arguments);
      try { update(dt || 1 / 60); } catch (e) {}
    };
  }
})();
