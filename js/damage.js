// VALCORSA — damage v1 (DESIGN.md §6.5, the "damage first" slice).
// Self-preservation becomes real: walls, crashes, over-revving and drift-worn tires
// hurt the machine. Symptoms are full-sensory (shake, buzz, wiggle, coughs) — never
// text panels. Catastrophic hits SHATTER the car: DNF. Damage lasts the race only
// (garage repair economy arrives with the Garage Update proper).
(function () {
  let camShake = 0, vibT = 0, endT = 0, heatWarned = false;

  function sfx(freq, dur, vol, type = 'sawtooth') {
    try {
      const ctx = audio.ctx; if (!ctx) return;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      o.connect(g); g.connect(audio.master);
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.start(); o.stop(ctx.currentTime + dur + 0.02);
    } catch (e) {}
  }

  function D(car) {
    return car.dmg || (car.dmg = { wear: 0, flat: false, engine: 1, heat: 0,
                                   shattered: false, cd: 0, stut: 0 });
  }

  function reset() {
    camShake = 0; endT = 0; heatWarned = false;
    if (typeof cars !== 'undefined' && cars) for (const c of cars) c.dmg = null;
  }

  function bump(car, amt) {
    if (!car.isPlayer) return;
    camShake = Math.max(camShake, amt);
    if (navigator.vibrate) navigator.vibrate(Math.round(amt * 120));
  }

  function goFlat(car) {
    const d = D(car);
    if (d.flat) return;
    d.flat = true;
    if (car.isPlayer) { toast('Tire’s gone!'); sfx(140, 0.25, 0.3); }
  }

  // THE McQUEEN: slam the wall, get thrown back across the road, tumble, land,
  // skid on the bodywork in a shower of sparks. Scary on purpose.
  function bigCrash(car, dash) {
    const d = D(car);
    d.cd = 1.4;
    d.engine = Math.max(0.3, d.engine - 0.35);
    if (!d.bumper) d.bumper = Math.random() < 0.5 ? -1 : 1;
    if (!d.flat && Math.random() < 0.5) goFlat(car);
    // deflect INTO the track (wall normal from the centerline, same math as stepCar)
    let nx = 0, nz = 0;
    try {
      const sp = track.samples[car.idx];
      const dd = Math.hypot(car.x - sp.x, car.z - sp.z) || 1;
      nx = (sp.x - car.x) / dd; nz = (sp.z - car.z) / dd;
    } catch (e) {}
    const spd = Math.hypot(car.velX, car.velZ);
    car.velX = car.velX * 0.22 + nx * spd * 0.42;
    car.velZ = car.velZ * 0.22 + nz * spd * 0.42;
    car.y += 0.3;
    car.air = { vy: 6.5 + Math.min(6, dash * 0.028) };            // LAUNCHED
    car.crash = { phase: 'fly', skid: 1.3 + Math.random() * 1.2,
                  roll: (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 5) };
    car._tumbleA = 0;
    car._crumple = 1.3;
    car._boom = dash;
    if (car.isPlayer) { camShake = Math.max(camShake, 1.3); toast('THAT’S A BIG ONE.'); }
  }

  function shatter(car) {
    const d = D(car);
    if (d.shattered) return;
    d.shattered = true;
    car.dnf = true;          // never finishes: results show "DNF (n laps)" natively
    car.spun = 1.6;          // one last pirouette
    bump(car, 1.2);
    sfx(48, 0.6, 0.5); sfx(120, 0.45, 0.3); sfx(30, 0.8, 0.4, 'square');
    if (car.isPlayer) { toast('💥 SHATTERED — DNF'); endT = 3; }
    else if (typeof toast === 'function') toast(car.name + ' has SHATTERED!');
  }

  // impact velocity v = m/s along the collision normal. Thresholds are in DASH units
  // (the speedo the driver reads: world m/s × 3.6 × SPEED_DISPLAY_SCALE) — grazing a
  // wall at cruise is NOT a crash; only the component INTO the obstacle counts.
  const DASH = 3.6 * (typeof SPEED_DISPLAY_SCALE !== 'undefined' ? SPEED_DISPLAY_SCALE : 0.45);
  function impact(car, v) {
    if (state !== 'race' || !v) return;
    const d = D(car);
    if (d.cd > 0 || d.shattered) return;
    // chassis TOUGH softens (or sharpens) the hit — tough 9 truck shrugs off what folds a bike
    const tough = (car.isPlayer && window.ECON && ECON.mods) ? (ECON.mods().tough ?? 5) : 5;
    let dash = v * DASH * (1 - (tough - 5) * 0.04);     // impact speed as the driver reads it
    // pileup law: hitting a wreck escalates — one crash seeds the next
    if (typeof cars !== 'undefined' && dash > 32) {
      for (const o of cars) {
        if (o === car || (!o.crash && !(o.spun > 0))) continue;
        if (Math.hypot(o.x - car.x, o.z - car.z) < 4.5) { dash *= 1.4; break; }
      }
    }
    if (dash < 25) return;                       // a bump: knockback and you're chillin
    d.cd = 0.5;
    if (dash > 195) return shatter(car);         // full-send head-on: carisvaporizeditis
    if (dash > 135) return bigCrash(car, dash);  // THE McQUEEN: launched, tumbling, skidding
    if (dash > 90) {                             // a proper accident — the wall WINS
      car.velX *= 0.22; car.velZ *= 0.22;        // immediate stop: speed dies at the wall
      d.engine = Math.max(0.25, d.engine - (dash - 90) / 260);
      if (!d.flat && dash > 120 && Math.random() < 0.35) goFlat(car);
      if (!d.bumper && dash > 100 && Math.random() < 0.6) {
        d.bumper = Math.random() < 0.5 ? -1 : 1;      // the bumper tears loose and DRAGS
        if (car.isPlayer) toast('Bumper’s hanging — hear it grinding?');
      }
      if (Math.random() < 0.5) car.spun = 0.9 + Math.random() * 0.6;   // and sometimes you LOSE it
      car._crumple = Math.min(1, 0.5 + (dash - 90) / 90);
      car._boom = dash;                          // speedfx: the CRUMPLE sound + debris
      bump(car, 0.5);
      if (car.isPlayer) sfx(70, 0.3, 0.4);
    } else {                                     // a scrape
      d.wear = Math.min(1, d.wear + 0.08);
      bump(car, 0.15);
      if (car.isPlayer) sfx(95, 0.1, 0.15);
    }
  }

  // per-substep: symptoms flow through the car's own controls
  function modInput(car, input, dt) {
    const d = car.dmg;
    if (!d) { D(car); return input; }
    if (d.shattered) return { throttle: 0, brake: 1, steer: 0, handbrake: 0 };
    if (car.crash) return { throttle: 0, brake: 1, steer: 0, handbrake: 0 };   // you're a passenger now
    let { throttle, steer } = input;
    const speed = Math.hypot(car.velX, car.velZ);

    // drift wear: racing tires object to being dragged sideways all day (forgiving rate).
    // The tire's WEAR stat finally matters: tough compounds last longer, softs die young.
    if (input.handbrake && speed > 18) {
      const tw = (car.isPlayer && window.ECON && ECON.mods) ? (ECON.mods().tireWear ?? 6) : 6;
      d.wear += dt / (17 + tw * 3.8);
      if (d.wear >= 1 && !d.flat) goFlat(car);
    }
    // over-rev heat: nearly extinct by decree — you'd need ~45s of continuous absolute
    // flat-out near top speed to cook anything. A very rare occurrence.
    if (throttle > 0.99 && speed > 62) d.heat = Math.min(1.25, d.heat + dt / 45);
    else d.heat = Math.max(0, d.heat - dt / 1.2);
    if (d.heat > 1) {
      d.engine = Math.max(0.3, d.engine - dt * 0.04);
      if (car.isPlayer && !heatWarned) { heatWarned = true; toast('Engine’s cooking — lift off!'); }
    }

    if (d.engine < 1) {
      throttle *= 0.55 + 0.45 * d.engine;
      d.stut -= dt;
      if (d.cutT > 0) {                               // mid-dropout: the pedal is DEAD
        d.cutT -= dt;
        throttle = 0;
      } else if (d.engine < 0.85 && d.stut <= 0) {    // the dropout hits — anywhere, anytime
        d.stut = 1.2 + Math.random() * 3.2 * d.engine;   // sicker engine = more often
        d.cutT = 0.22 + (1 - d.engine) * 0.55;           // …and longer
        car._bang = true;                                // speedfx: backfire puff + sparks
        if (car.isPlayer) { sfx(38, 0.14, 0.5); camShake = Math.max(camShake, 0.25); }
      }
    }
    if (d.flat) {
      if (!d.pull) d.pull = Math.random() < 0.5 ? -1 : 1;
      steer += d.pull * 0.16 + Math.sin(performance.now() / 90) * 0.22;  // it PULLS — hold against it
      throttle *= 0.78;
      d.thT = (d.thT || 0) - dt;
      if (d.thT <= 0 && speed > 6) {                  // thump… thump… thump…
        d.thT = 2.9 / Math.max(6, speed);
        if (car.isPlayer) { sfx(52, 0.05, 0.3); camShake = Math.max(camShake, 0.16); }
      }
      if (car.isPlayer && camShake < 0.1) camShake = 0.1;
    }
    return { ...input, throttle, steer };
  }

  function update(dt) {
    if (state !== 'race') { camShake *= 0.9; return; }
    for (const c of cars) if (c.dmg && c.dmg.cd > 0) c.dmg.cd -= dt;
    camShake *= Math.pow(0.001, dt);
    const pd = typeof player !== 'undefined' && player && player.dmg;
    if (pd && (pd.flat || pd.shattered)) {
      vibT -= dt;
      if (vibT <= 0 && navigator.vibrate) { navigator.vibrate(pd.shattered ? 60 : 22); vibT = 0.55; }
    }
    if (endT > 0) { endT -= dt; if (endT <= 0 && typeof endRace === 'function' && state === 'race') endRace(); }
  }

  function shakeCamera(cam) {
    if (camShake > 0.004) {
      cam.position.x += (Math.random() - 0.5) * camShake * 2;
      cam.position.y += (Math.random() - 0.5) * camShake * 1.4;
      cam.position.z += (Math.random() - 0.5) * camShake * 2;
    }
  }

  window.DMG = { impact, modInput, update, shakeCamera, reset, shatter };
})();
