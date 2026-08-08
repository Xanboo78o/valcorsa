// VALCORSA — damage v1 (DESIGN.md §6.5, the "damage first" slice).
// Self-preservation becomes real: walls and crashes hurt. Symptoms are full-sensory
// (shake, buzz, wiggle, coughs) — never text panels.
// TWO RULES SET THE STAKES:
//  · CRASHES happen everywhere, always. They're huge, physical, and you walk away —
//    shaken (d.shook) for ten seconds, then fine.
//  · BREAKING (flats, sick engines, torn bumpers, DNF) happens ONLY where breakable()
//    says so — the Heiligen stage. See the note there.
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
                                   shattered: false, cd: 0, stut: 0, shook: 0 });
  }

  // THE BREAKAGE RULE (Adam, 2026-08-08: "remove breaking, it's annoying, should only
  // exist in heiligen"). Parts breaking is a RALLY thing: one pass through the pines
  // where a flat or a sick engine IS the story, and no second lap to fix it. Everywhere
  // else, crashes still happen and they're still huge — you just walk away from them
  // shaken (see SHOOK below) instead of driving a broken car for the rest of the race.
  function breakable() {
    try { return !!(track && track.def && (track.def.damage || track.def.id === 'heiligenstage')); }
    catch (e) { return false; }
  }
  // how long you're rattled after a crash, and the top speed you're rattled down to
  const SHOOK = 10;                                        // seconds, Adam's number
  // terminal speed the drag model allows — read lazily so this file never depends on
  // being evaluated after main.js
  const topV = () => Math.sqrt(PHYS.engineAccel / PHYS.drag);

  function reset() {
    camShake = 0; endT = 0; heatWarned = false;
    if (typeof cars !== 'undefined' && cars) for (const c of cars) {
      c.dmg = null;
      c.crash = null; c.air = null; c._tumbleA = 0;   // a restart mid-crash must not inherit the wreck
    }
  }

  function bump(car, amt) {
    if (!car.isPlayer) return;
    camShake = Math.max(camShake, amt);
    if (navigator.vibrate) navigator.vibrate(Math.round(amt * 120));
  }

  function goFlat(car) {
    const d = D(car);
    if (d.flat || !breakable()) return;
    d.flat = true;
    if (car.isPlayer) sfx(140, 0.25, 0.3);        // no toast: you FEEL a flat, you don't read one
  }

  // THE McQUEEN: slam the wall, get thrown back across the road, tumble, land,
  // skid on the bodywork in a shower of sparks. Scary on purpose.
  function bigCrash(car, dash) {
    const d = D(car);
    d.cd = 1.4;
    d.shook = SHOOK;                                   // you walk away from it, but not briskly
    if (breakable()) {                                 // the stage takes its pound of flesh
      d.engine = Math.max(0.3, d.engine - 0.35);
      if (!d.bumper) d.bumper = Math.random() < 0.5 ? -1 : 1;
      if (!d.flat && Math.random() < 0.5) goFlat(car);
    }
    // deflect INTO the track (wall normal from the centerline, same math as stepCar)
    let nx = 0, nz = 0;
    try {
      const sp = track.samples[car.idx];
      const dd = Math.hypot(car.x - sp.x, car.z - sp.z) || 1;
      nx = (sp.x - car.x) / dd; nz = (sp.z - car.z) / dd;
    } catch (e) {}
    const spd = Math.hypot(car.velX, car.velZ);
    // hit geometry decides the crash: square hit = launched end-over-end,
    // glancing hit = violent barrel roll away from the wall (rates in rad/s —
    // this is a rigid-body seed, CRASHPHYS in speedfx.js integrates it for real)
    const vhx = car.velX / (spd || 1), vhz = car.velZ / (spd || 1);
    const cross = vhx * nz - vhz * nx;
    const graze = Math.min(1, Math.abs(cross));
    const side = Math.sign(cross) || (Math.random() < 0.5 ? -1 : 1);
    car.velX = car.velX * 0.22 + nx * spd * 0.42;
    car.velZ = car.velZ * 0.22 + nz * spd * 0.42;
    car.y += 0.3;
    car.air = { vy: (7.5 + Math.min(7.5, dash * 0.035)) * (1 - graze * 0.35) };   // LAUNCHED
    car.crash = {
      wr: side * (0.6 + graze) * (4.5 + dash * 0.055 + Math.random() * 2.5),
      wp: (Math.random() < 0.5 ? -1 : 1) * (1.3 - graze) * (1.6 + dash * 0.022),
      wy: (Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.random() * 2.6),
      rA: 0, pA: 0, life: 0,
    };
    car._crumple = 1.3;
    car._boom = dash;
    if (car.isPlayer) camShake = Math.max(camShake, 1.3);
  }

  function shatter(car) {
    const d = D(car);
    if (d.shattered) return;
    d.shattered = true;
    car.dnf = true;          // never finishes: results show "DNF (n laps)" natively
    car.spun = 1.6;          // one last pirouette
    bump(car, 1.2);
    sfx(48, 0.6, 0.5); sfx(120, 0.45, 0.3); sfx(30, 0.8, 0.4, 'square');
    if (car.isPlayer) endT = 3;                   // the results screen says DNF; no toast needed
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
    let dash = v * DASH * (1 - (tough - 5) * 0.04);     // NOTE: v is the impact-NORMAL speed — a fraction of
    // dash speed even head-on. Tiers below are calibrated to MEASURED wall hits (real ram ≈ 20-45), not display speed.
    // pileup law: hitting a wreck escalates — one crash seeds the next
    if (typeof cars !== 'undefined' && dash > 32) {
      for (const o of cars) {
        if (o === car || (!o.crash && !(o.spun > 0))) continue;
        if (Math.hypot(o.x - car.x, o.z - car.z) < 4.5) { dash *= 1.4; break; }
      }
    }
    if (dash < 12) return;                       // a bump: knockback and you're chillin
    d.cd = 0.5;
    // only the stage can actually end your race. Everywhere else the biggest hit in the
    // game is still just the biggest crash in the game — you get up and you drive.
    if (dash > 135 && breakable()) return shatter(car);
    if (dash > 60) return bigCrash(car, dash);   // THE McQUEEN: launched, tumbling, skidding
    if (dash > 35) {                             // a proper accident — the wall WINS
      car.velX *= 0.22; car.velZ *= 0.22;        // immediate stop: speed dies at the wall
      d.shook = SHOOK;                           // rattled, not ruined
      if (breakable()) {
        d.engine = Math.max(0.25, d.engine - (dash - 35) / 120);
        if (!d.flat && dash > 45 && Math.random() < 0.35) goFlat(car);
        if (!d.bumper && dash > 42 && Math.random() < 0.6)
          d.bumper = Math.random() < 0.5 ? -1 : 1;    // the bumper tears loose and DRAGS (you hear it)
      }
      if (Math.random() < 0.5) car.spun = 0.9 + Math.random() * 0.6;   // and sometimes you LOSE it
      car._crumple = Math.min(1, 0.5 + (dash - 35) / 40);
      car._boom = dash;                          // speedfx: the CRUMPLE sound + debris
      bump(car, 0.5);
      if (car.isPlayer) sfx(70, 0.3, 0.4);
    } else {                                     // a scrape
      if (breakable()) d.wear = Math.min(1, d.wear + 0.08);
      bump(car, 0.15);
      if (car.isPlayer) sfx(95, 0.1, 0.15);
    }
  }

  // per-substep: symptoms flow through the car's own controls
  function modInput(car, input, dt) {
    const d = car.dmg;
    if (!d) { D(car); return input; }
    if (d.shattered) return { throttle: 0, brake: 1, steer: 0, handbrake: 0 };
    if (car.crash) return { throttle: 0, brake: 0, steer: 0, handbrake: 0 };   // you're cargo now — stepCar ignores all of it
    let { throttle, steer } = input;
    const speed = Math.hypot(car.velX, car.velZ);

    // SHAKEN UP: what a crash costs you now. Ten seconds of a car that doesn't want to
    // pull, running a little short of top speed, fading back to normal as you gather
    // yourself. Nothing to repair, nothing to read — you just aren't right for a bit.
    if (d.shook > 0) {
      d.shook -= dt;
      const k = Math.min(1, d.shook / SHOOK);          // 1 the instant you land, 0 when you're over it
      throttle *= 1 - 0.42 * k;
      if (speed > topV() * (1 - 0.2 * k)) throttle = 0;   // and the top end just isn't there yet
    }

    // drift wear: racing tires object to being dragged sideways all day (forgiving rate).
    // The tire's WEAR stat finally matters: tough compounds last longer, softs die young.
    if (breakable() && input.handbrake && speed > 18) {
      const tw = (car.isPlayer && window.ECON && ECON.mods) ? (ECON.mods().tireWear ?? 6) : 6;
      d.wear += dt / (17 + tw * 3.8);
      if (d.wear >= 1 && !d.flat) goFlat(car);
    }
    // over-rev heat: nearly extinct by decree — you'd need ~45s of continuous absolute
    // flat-out near top speed to cook anything. A very rare occurrence.
    if (breakable() && throttle > 0.99 && speed > 62) d.heat = Math.min(1.25, d.heat + dt / 45);
    else d.heat = Math.max(0, d.heat - dt / 1.2);
    if (d.heat > 1) {
      d.engine = Math.max(0.3, d.engine - dt * 0.04);
      if (car.isPlayer && !heatWarned) { heatWarned = true; sfx(190, 0.5, 0.16, 'triangle'); }
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
