// VALCORSA ARENAS — the rotating playlist, game 1: DEMO DERBY.
// An arena def (def.arena) is a walled floor, not a lap. Derby rules: damage is
// the scoreboard — shattered karts are OUT, last one rolling takes the crown.
// Derby AI hunts the nearest living kart instead of following the spline.
'use strict';

window.ARENA = (() => {
  const $ = id => document.getElementById(id);
  let active = null, outOrder = [], overT = 0;

  // the rotating playlist: the arena hosts a different game each day
  function gameOfTheDay() {
    const d = new Date(), k = d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate();
    return ['derby', 'koth', 'derby', 'koth'][k % 4];   // relay joins when handoffs exist
  }
  let hill = null, hillMesh = null;
  function onRaceBuilt() {
    const a = (track && track.def && track.def.arena) || null;
    active = a === 'playlist' ? gameOfTheDay() : a;
    outOrder = []; overT = 0; hill = null;
    if (!active) return;
    if (active === 'koth') {
      moveHill();
      $('lapCount').textContent = 'KING OF THE HILL';
      $('position').textContent = 'HOLD THE RING';
    } else {
    // derby HUD language: no laps, no lap clock
    $('lapCount').textContent = 'LAST KART ROLLING';
    $('position').textContent = cars.length + ' ALIVE';
    }
    // derby health rides every DMG impact: race thresholds are too forgiving for a
    // wrecking bowl, so hits drain a pool and zero = OUT (wrap-once, roar.js pattern)
    if (window.DMG && !DMG._arenaWrap) {
      DMG._arenaWrap = true;
      const orig = DMG.impact.bind(DMG);
      DMG.impact = (car, v) => {
        orig(car, v);
        if (active && !car.dnf && v > 4) {
          car.derbyHp = (car.derbyHp ?? 100) - v * 1.5;
          if (car.derbyHp <= 0) { car.dnf = true; if (car.dmg) car.dmg.shattered = true; }
        }
      };
    }
  }

  function moveHill() {
    const a = Math.random() * Math.PI * 2, r = 12 + Math.random() * 30;
    hill = { x: Math.cos(a) * r, z: Math.sin(a) * r, until: (typeof raceTime !== 'undefined' ? raceTime : 0) + 30 };
    if (!hillMesh) {
      hillMesh = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.RingGeometry(11.5, 14, 40),
        new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.25; hillMesh.add(ring);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.6, 30, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.22 }));
      beam.position.y = 15; hillMesh.add(beam);
      scene.add(hillMesh);
    }
    hillMesh.position.set(hill.x, 0, hill.z);
  }

  // hunting AI: full send at the nearest living target, handbrake to swing hits
  function derbyInputs(car) {
    // KOTH: the hill is the target; fight only once you're near it
    let tx = null, tz = null;
    if (active === 'koth' && hill) { tx = hill.x; tz = hill.z; }   // pile IN — the fight happens on the hill
    if (tx == null) {
      const foes = cars.filter(c => c !== car && !c.dnf);
      if (!foes.length) return { throttle: 0.4, brake: 0, steer: 0, handbrake: 0 };
      let best = null, bd = 1e9;
      for (const f of foes) { const d = (f.x - car.x) ** 2 + (f.z - car.z) ** 2; if (d < bd) { bd = d; best = f; } }
      tx = best.x; tz = best.z;
    }
    const dx = tx - car.x, dz = tz - car.z;
    let want = Math.atan2(dx, dz) - car.heading;
    while (want > Math.PI) want -= 2 * Math.PI;
    while (want < -Math.PI) want += 2 * Math.PI;
    const dist = Math.hypot(dx, dz);
    const koth = active === 'koth';
    return {
      // KOTH wants ARRIVAL, not orbit: back off the gas near the ring and settle in it
      throttle: koth ? (dist > 34 ? 1 : dist > 14 ? 0.5 : 0.1) : (Math.abs(want) < 1.2 ? 1 : 0.5),
      brake: koth && dist < 9 ? 0.5 : 0,
      steer: THREE.MathUtils.clamp(want * 2.2, -1, 1),
      handbrake: (!koth && dist < 18 && Math.abs(want) > 0.5) ? 1 : 0,   // swing the tail into them
    };
  }

  const HOLD_TO_WIN = 25;
  function kothUpdate(dt) {
    if (!hill) return;
    if (raceTime > hill.until) moveHill();
    for (const c of cars) {
      if (c.dnf) continue;
      if (Math.hypot(c.x - hill.x, c.z - hill.z) < 14) c.hold = (c.hold || 0) + dt;
    }
    const lead = [...cars].sort((a, b) => (b.hold || 0) - (a.hold || 0))[0];
    $('position').textContent = 'HOLD ' + Math.floor(player.hold || 0) + 's / ' + HOLD_TO_WIN;
    $('lapCount').textContent = 'KING: ' + (lead && (lead.hold || 0) > 0 ? lead.name + ' ' + Math.floor(lead.hold) + 's' : 'nobody yet');
    if (lead && (lead.hold || 0) >= HOLD_TO_WIN) {
      state = 'results';
      stopMusic();
      const order = [...cars].sort((a, b) => (b.hold || 0) - (a.hold || 0));
      let html = '<div class="resInner"><h2>KING OF THE HILL</h2><table>';
      order.forEach((c, i) => {
        html += `<tr class="${c.isPlayer ? 'me' : ''}"><td>${i + 1}</td>
          <td><span class="dot" style="background:#${c.color.toString(16).padStart(6, '0')}"></span>${c.name}</td>
          <td>${i === 0 ? '👑 ' : ''}${Math.floor(c.hold || 0)}s on the hill</td></tr>`;
      });
      html += '</table><button onclick="restartRace()">Run It Back</button><button onclick="backToMenu()">Back to Menu</button></div>';
      $('results').innerHTML = html;
      $('results').style.display = 'flex';
      active = null;
    }
  }
  function update(dt) {
    if (!active || state !== 'race') return;
    if (active === 'koth') { kothUpdate(dt); return; }
    if (cars.length && cars[0].derbyHp == null) for (const c of cars) c.derbyHp = 100;   // cars spawn after onRaceBuilt
    // book eliminations as they happen
    for (const c of cars) if (c.dnf && !outOrder.includes(c)) {
      outOrder.push(c);
      if (window.toast && !c.isPlayer) toast('💥 ' + c.name + ' is OUT — ' + cars.filter(x => !x.dnf).length + ' left');
    }
    const alive = cars.filter(c => !c.dnf);
    $('position').textContent = alive.length + ' ALIVE';
    $('lapCount').textContent = player.dnf ? 'WRECKED' : 'LAST KART ROLLING';
    $('curLap').textContent = 'HP ' + Math.max(0, Math.round(player.derbyHp ?? 100));
    // over when one stands (or the player is out and watching hurts)
    if (alive.length <= 1 || (player.dnf && overT === 0)) overT = raceTime + (alive.length <= 1 ? 1.5 : 4);
    if (overT && raceTime > overT) finish(alive);
  }

  function finish(alive) {
    state = 'results';
    stopMusic();
    const order = [...alive, ...[...outOrder].reverse()];       // winner first, first-out last
    let html = '<div class="resInner"><h2>DERBY RESULT</h2><table>';
    order.forEach((c, i) => {
      html += `<tr class="${c.isPlayer ? 'me' : ''}"><td>${i + 1}</td>
        <td><span class="dot" style="background:#${c.color.toString(16).padStart(6, '0')}"></span>${c.name}</td>
        <td>${i === 0 ? '👑 LAST ROLLING' : 'wrecked'}</td></tr>`;
    });
    html += '</table><button onclick="restartRace()">Run It Back</button><button onclick="backToMenu()">Back to Menu</button></div>';
    $('results').innerHTML = html;
    $('results').style.display = 'flex';
    overT = 0; active = null;
  }

  return { onRaceBuilt, update, derbyInputs, get active() { return active; } };
})();
