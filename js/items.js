// VALCORSA — Smashkart items v1 (DESIGN.md §4.5): Spare Tire + The Jack.
// Items are physical objects. They ride visibly on the roof rack (zero UI chrome),
// spawn from supply crates on the road, and only exist at SMASHKART venues.
// Player: E (or the touch ITEM button). AI karts pick up and use items too.
(function () {
  const CRATE_LINES = 6, RESPAWN = 12, TIRE_SPEED = 34;
  let crates = [], tires = [], active = false;

  function thunk(freq, dur, vol, delay = 0) {   // tiny sfx via the master bus (M mute applies)
    try {
      const ctx = audio.ctx; if (!ctx) return;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = freq;
      o.connect(g); g.connect(audio.master);
      const t0 = ctx.currentTime + delay;
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) {}
  }

  // ---- meshes (toon-flat, matching the game's look) ----
  function crateMesh() {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.7, 1.7), toonMat(0xb98a4e));
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.28, 1.85), toonMat(0x8a6136));
    lid.position.y = 0.85;
    box.castShadow = true;
    g.add(box, lid);
    return g;
  }
  function tireMesh() {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.45, 12), toonMat(0x1c1f24));
    c.rotation.z = Math.PI / 2;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.47, 8), toonMat(0xd8d3c6));
    hub.rotation.z = Math.PI / 2;
    c.castShadow = true;
    g.add(c, hub);
    g.userData.spin = c;
    return g;
  }
  function cardTexture() {
    if (cardTexture._t) return cardTexture._t;
    const c = document.createElement('canvas'); c.width = 128; c.height = 180;
    const g = c.getContext('2d');
    g.fillStyle = '#f9f5e8'; g.fillRect(0, 0, 128, 180);
    g.strokeStyle = '#d8cfb8'; g.lineWidth = 5; g.strokeRect(4, 4, 120, 172);
    g.fillStyle = '#c73a2c';
    g.font = 'bold 38px Georgia'; g.textAlign = 'left';
    g.fillText('J', 12, 44);
    g.font = '26px Georgia'; g.fillText('♥', 11, 72);
    g.font = '78px Georgia'; g.textAlign = 'center'; g.fillText('♥', 64, 118);
    g.save(); g.translate(116, 138); g.rotate(Math.PI);
    g.font = 'bold 38px Georgia'; g.textAlign = 'left'; g.fillText('J', 0, 0);
    g.restore();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return cardTexture._t = t;
  }
  function jackMesh() { // The Jack IS the Jack of Hearts — a playing card on your roof
    const g = new THREE.Group();
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.78, 1.1),
      new THREE.MeshBasicMaterial({ map: cardTexture(), side: THREE.DoubleSide }));
    face.position.y = 0.55;
    g.add(face);
    return g;
  }

  // ---- the round item box, top middle (player only) ----
  const ITEM_ICONS = {
    tire: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="13" fill="none" stroke="#2b2119" stroke-width="9"/><circle cx="20" cy="20" r="4.5" fill="#2b2119"/></svg>',
    jack: '<div class="cardIcon"><span class="cj">J</span><span class="ch">♥</span></div>',
  };
  function updateItemBox(item) {
    const box = document.getElementById('itemBox');
    if (!box) return;
    if (item && ITEM_ICONS[item]) { box.innerHTML = ITEM_ICONS[item]; box.classList.add('on'); }
    else box.classList.remove('on');
  }

  function setRoof(car, item) {
    if (car._roof) { car.mesh.remove(car._roof); car._roof = null; }
    car.item = item || null;
    if (item) {
      car._roof = item === 'tire' ? tireMesh() : jackMesh();
      car._roof.scale.setScalar(0.8);
      car._roof.position.set(0, 1.45, -0.15);
      car.mesh.add(car._roof);
    }
    if (car.isPlayer) updateItemBox(car.item);
  }

  function onRaceBuilt() {
    crates = []; tires = [];
    updateItemBox(null);
    active = !track.open && track.def && track.def.mode === 'SMASHKART';
    if (!active) return;
    const { samples, rights, N, halfW } = track;
    for (let l = 0; l < CRATE_LINES; l++) {
      const i = Math.round(N * ((l + 0.6) / CRATE_LINES)) % N;
      const sp = samples[i], r = rights[i];
      for (const lat of [-halfW * 0.55, 0, halfW * 0.55]) {
        const x = sp.x + r.x * lat, z = sp.z + r.z * lat;
        const m = crateMesh();
        m.position.set(x, terrainHeight(x, z) + 0.85, z);
        scene.add(m);
        crates.push({ x, z, mesh: m, dead: 0 });
      }
    }
  }

  function give(car) {
    setRoof(car, Math.random() < 0.5 ? 'tire' : 'jack');
  }

  function useItem(car) {
    if (!active || !car || !car.item || car.spun > 0 || car.finished) return;
    const item = car.item;
    setRoof(car, null);
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    if (item === 'tire') {
      const t = { x: car.x + fx * 3.2, z: car.z + fz * 3.2, y: car.y + 0.62,
                  vx: car.velX + fx * TIRE_SPEED, vz: car.velZ + fz * TIRE_SPEED,
                  owner: car, grace: 0.45, life: 22, mesh: tireMesh(), roll: 0 };
      scene.add(t.mesh);
      tires.push(t);
      thunk(150, 0.12, 0.22);
    } else { // the Jack: up and FORWARD into a glide along the track
      car.air = { vy: 8.5 };
      car.velX += fx * 9; car.velZ += fz * 9;
      thunk(300, 0.15, 0.22); thunk(460, 0.22, 0.14, 0.05);
    }
  }

  function spinOut(car) {
    car.spun = 1.0;
    if (car.item) setRoof(car, null);            // the hit spills your carry
    thunk(90, 0.3, 0.32); thunk(60, 0.35, 0.2, 0.05);
  }

  function update(dt) {
    if (!active || !track || !cars || !cars.length) return;
    if (state !== 'race' && state !== 'countdown') return;

    // supply crates: spin, get grabbed, respawn
    for (const c of crates) {
      if (c.dead > 0) {
        c.dead -= dt;
        if (c.dead <= 0) c.mesh.visible = true;
        continue;
      }
      c.mesh.rotation.y += dt * 1.1;
      if (state !== 'race') continue;
      for (const car of cars) {
        if (car.item || car.finished || car.spun > 0 || (car.dmg && car.dmg.shattered)) continue;
        if ((car.x - c.x) ** 2 + (car.z - c.z) ** 2 < 3.4 * 3.4) {
          c.dead = RESPAWN; c.mesh.visible = false;
          give(car);
          if (car.isPlayer) thunk(660, 0.09, 0.18);
          break;
        }
      }
    }

    // rolling tires
    for (let i = tires.length - 1; i >= 0; i--) {
      const t = tires[i];
      t.life -= dt; t.grace -= dt;
      const sp = Math.hypot(t.vx, t.vz);
      let gone = t.life <= 0 || sp < 5;
      if (!gone) {
        t.x += t.vx * dt; t.z += t.vz * dt;
        const drag = Math.max(0, 1 - 0.035 * dt);
        t.vx *= drag; t.vz *= drag;
        const info = track.nearestInfo(t.x, t.z);   // wall bounce at the track boundary
        if (info.d > track.outerLimit) {
          const spn = track.samples[info.i];
          const nx = (t.x - spn.x) / info.d, nz = (t.z - spn.z) / info.d;
          const vOut = t.vx * nx + t.vz * nz;
          if (vOut > 0) { t.vx -= 2 * vOut * nx; t.vz -= 2 * vOut * nz; thunk(120, 0.07, 0.1); }
          const over = info.d - track.outerLimit;
          t.x -= nx * over; t.z -= nz * over;
        }
        t.y = terrainHeight(t.x, t.z) + 0.62;
        t.mesh.position.set(t.x, t.y, t.z);
        t.mesh.rotation.y = Math.atan2(t.vx, t.vz);
        t.mesh.userData.spin.rotation.x += sp * dt / 0.62;
        if (state === 'race') {
          for (const car of cars) {
            if (car === t.owner && t.grace > 0) continue;
            if (car.air || car.spun > 0) continue;   // jacked karts fly clean over — earn your dodge
            if ((car.x - t.x) ** 2 + (car.z - t.z) ** 2 < 2.2 * 2.2) {
              spinOut(car);
              gone = true;
              break;
            }
          }
        }
      }
      if (gone) { scene.remove(t.mesh); tires.splice(i, 1); }
    }

    // the Jack of Hearts twirls gently on every roof carrying it
    for (const car of cars) if (car._roof && car.item === 'jack') car._roof.rotation.y += dt * 2.2;

    // AI karts play too
    if (state === 'race') {
      for (const car of cars) {
        if (car.isPlayer || !car.item || car.finished || car.spun > 0) continue;
        car._aiItemT = (car._aiItemT === undefined ? 2 + Math.random() * 4 : car._aiItemT) - dt;
        if (car._aiItemT > 0) continue;
        const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
        const preyAhead = cars.some(o => {
          if (o === car || o.finished) return false;
          const dx = o.x - car.x, dz = o.z - car.z, d = Math.hypot(dx, dz) || 1;
          return d < 45 && (dx * fx + dz * fz) / d > 0.85;
        });
        const straight = track.kappa[car.idx] < 0.0045;
        if ((car.item === 'tire' && (preyAhead || car._aiItemT < -6)) ||
            (car.item === 'jack' && (straight || car._aiItemT < -6))) {
          useItem(car);
          car._aiItemT = 3 + Math.random() * 5;
        }
      }
    }
  }

  addEventListener('keydown', e => {
    if (e.repeat) return;
    if (e.key.toLowerCase() === 'e' && state === 'race' && typeof player !== 'undefined' && player)
      useItem(player);
  });

  window.ITEMS = { update, onRaceBuilt, useItem };
})();
