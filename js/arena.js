// VALCORSA ARENAS — the rotating playlist, game 1: DEMO DERBY.
// An arena def (def.arena) is a walled floor, not a lap. Derby rules: damage is
// the scoreboard — shattered karts are OUT, last one rolling takes the crown.
// Derby AI hunts the nearest living kart instead of following the spline.
'use strict';

window.ARENA = (() => {
  const $ = id => document.getElementById(id);
  let active = null, outOrder = [], overT = 0;

  function onRaceBuilt() {
    active = (track && track.def && track.def.arena) || null;
    outOrder = []; overT = 0;
    if (!active) return;
    // derby HUD language: no laps, no lap clock
    $('lapCount').textContent = 'LAST KART ROLLING';
    $('position').textContent = cars.length + ' ALIVE';
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

  // hunting AI: full send at the nearest living target, handbrake to swing hits
  function derbyInputs(car) {
    const foes = cars.filter(c => c !== car && !c.dnf);
    if (!foes.length) return { throttle: 0.4, brake: 0, steer: 0, handbrake: 0 };
    let best = null, bd = 1e9;
    for (const f of foes) { const d = (f.x - car.x) ** 2 + (f.z - car.z) ** 2; if (d < bd) { bd = d; best = f; } }
    const dx = best.x - car.x, dz = best.z - car.z;
    let want = Math.atan2(dx, dz) - car.heading;
    while (want > Math.PI) want -= 2 * Math.PI;
    while (want < -Math.PI) want += 2 * Math.PI;
    const dist = Math.sqrt(bd);
    return {
      throttle: Math.abs(want) < 1.2 ? 1 : 0.5,
      brake: 0,
      steer: THREE.MathUtils.clamp(want * 2.2, -1, 1),
      handbrake: (dist < 18 && Math.abs(want) > 0.5) ? 1 : 0,   // swing the tail into them
    };
  }

  function update(dt) {
    if (!active || state !== 'race') return;
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
