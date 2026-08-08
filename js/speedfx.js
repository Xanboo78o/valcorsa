/* VALCORSA — SPEED LANGUAGE (js/speedfx.js): the game finally LOOKS as fast as it feels.
   Sparks (impacts, wall grinds, dragging bumpers), fat drift smoke, landing dust,
   anime speed-lines past big speed. Also the visual half of ANNOYING damage:
   the torn bumper that hangs off the nose and grinds the road.
   Self-contained: zero index.html/style.css edits. Hooks = wrapping
   window.updateCarVisuals (per-frame) and DMG.impact (spark bursts). */
'use strict';
(function () {
  let ready = false, lastScene = null;
  const S_N = 280;
  let sGeo = null, sPts = null, sPos = null, sVel = null, sLife = null, sCur = 0;
  const smokes = [], dusts = [];
  let slCanvas = null, slCtx = null, slW = 0, slH = 0;

  function dotTex(inner, outer) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, inner); g.addColorStop(1, outer);
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  function buildPools(sc) {
    sPos = new Float32Array(S_N * 3); sVel = new Float32Array(S_N * 3); sLife = new Float32Array(S_N);
    for (let i = 0; i < S_N; i++) sPos[i * 3 + 1] = -999;
    sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    sPts = new THREE.Points(sGeo, new THREE.PointsMaterial({
      size: 0.17, map: dotTex('rgba(255,246,205,1)', 'rgba(255,140,26,0)'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd9a0 }));
    sPts.frustumCulled = false;
    sc.add(sPts);
    const mk = (pool, n, inner, outer) => {
      for (let i = 0; i < n; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: dotTex(inner, outer), transparent: true, depthWrite: false, opacity: 0 }));
        sp.visible = false;
        sc.add(sp);
        pool.push({ sp, t: 0, dur: 1, grow: 1, rise: 1 });
      }
    };
    if (!smokes.length) mk(smokes, 70, 'rgba(240,244,252,0.85)', 'rgba(240,244,252,0)');
    else smokes.forEach(o => sc.add(o.sp));
    if (!dusts.length) mk(dusts, 40, 'rgba(196,180,152,0.8)', 'rgba(196,180,152,0)');
    else dusts.forEach(o => sc.add(o.sp));
  }

  function init() {
    if (typeof scene === 'undefined' || !scene) return;
    if (ready && scene === lastScene) return;
    lastScene = scene;
    buildPools(scene);
    ensureDebris(scene);
    if (!slCanvas) {
      slCanvas = document.createElement('canvas');
      slCanvas.id = 'speedLines';
      slCanvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:14';
      document.body.appendChild(slCanvas);
      slCtx = slCanvas.getContext('2d');
    }
    ready = true;
  }

  function sparks(x, y, z, n, dx, dz, power) {
    if (!ready) return;
    for (let i = 0; i < n; i++) {
      const j = sCur = (sCur + 1) % S_N;
      sPos[j * 3] = x; sPos[j * 3 + 1] = y; sPos[j * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2, r = 0.4 + Math.random();
      sVel[j * 3] = dx * power * r + Math.cos(a) * 2.4;
      sVel[j * 3 + 1] = 2.2 + Math.random() * 3.6;
      sVel[j * 3 + 2] = dz * power * r + Math.sin(a) * 2.4;
      sLife[j] = 0.3 + Math.random() * 0.32;
    }
  }

  function puff(pool, x, y, z, scale, dur, rise) {
    if (!ready) return;
    let best = null;
    for (const o of pool) { if (!o.sp.visible) { best = o; break; } if (!best || o.t < best.t) best = o; }
    best.sp.visible = true;
    best.sp.position.set(x, y, z);
    best.sp.scale.setScalar(scale * 0.6);
    best.t = best.dur = dur;
    best.grow = scale;
    best.rise = rise;
  }

  function stepPools(dt) {
    for (let j = 0; j < S_N; j++) {
      if (sLife[j] <= 0) continue;
      sLife[j] -= dt;
      if (sLife[j] <= 0) { sPos[j * 3 + 1] = -999; continue; }
      sPos[j * 3] += sVel[j * 3] * dt;
      sPos[j * 3 + 1] += sVel[j * 3 + 1] * dt;
      sPos[j * 3 + 2] += sVel[j * 3 + 2] * dt;
      sVel[j * 3 + 1] -= 23 * dt;
      if (sPos[j * 3 + 1] < -50) sPos[j * 3 + 1] = -999, sLife[j] = 0;
    }
    sGeo.attributes.position.needsUpdate = true;
    for (const pool of [smokes, dusts]) for (const o of pool) {
      if (!o.sp.visible) continue;
      o.t -= dt;
      if (o.t <= 0) { o.sp.visible = false; o.sp.material.opacity = 0; continue; }
      const k = o.t / o.dur;
      o.sp.material.opacity = k * 0.6;
      o.sp.position.y += o.rise * dt;
      const s = o.grow * (1.35 - k * 0.75);
      o.sp.scale.setScalar(s);
    }
  }

  // ---------------------------------------------------------------- CRASHES
  // The McQueen: damage.js decides a car is having one (car.crash) — this side
  // makes it LOOK and SOUND like one: tumble, body-skid, sparks, crumple, boom.
  let bufs = null, bufsLoading = false;
  function loadBufs() {
    if (bufs || bufsLoading) return;
    if (typeof audio === 'undefined' || !audio || !audio.ctx) return;
    bufsLoading = true;
    const names = ['crash0', 'crash1', 'crash2', 'scrape0', 'scrape1'];
    Promise.all(names.map(n => fetch('sfx/' + n + '.mp3')
      .then(r => r.arrayBuffer()).then(b => audio.ctx.decodeAudioData(b)).catch(() => null)))
      .then(arr => { bufs = {}; names.forEach((n, i) => bufs[n] = arr[i]); });
  }
  function playBuf(name, rate, gain) {
    if (!bufs || !bufs[name] || typeof audio === 'undefined' || !audio.ctx) return;
    const src = audio.ctx.createBufferSource(), g = audio.ctx.createGain();
    src.buffer = bufs[name];
    src.playbackRate.value = rate || 1;
    g.gain.value = gain || 1;
    src.connect(g); g.connect(audio.master || audio.ctx.destination);
    src.start();
  }
  function attn(c) {                       // crashes far up the road are quieter
    if (c.isPlayer || typeof player === 'undefined' || !player) return 1;
    const d = Math.hypot(c.x - player.x, c.z - player.z);
    return 1 / (1 + d / 55);
  }
  function boomSound(c, sev) {
    loadBufs();
    if (typeof audio === 'undefined' || !audio || !audio.ctx) return;
    const k = attn(c);
    if (k < 0.08) return;
    const t = audio.ctx.currentTime;
    const o = audio.ctx.createOscillator(), g = audio.ctx.createGain();   // the sub WHOMP
    o.type = 'sine';
    o.frequency.setValueAtTime(85, t);
    o.frequency.exponentialRampToValueAtTime(24, t + 0.55);
    g.gain.setValueAtTime(0.95 * k, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(g); g.connect(audio.master || audio.ctx.destination);
    o.start(t); o.stop(t + 0.75);
    playBuf('crash' + Math.floor(Math.random() * 3), 0.9 + Math.random() * 0.2, Math.min(1.4, 0.7 + sev / 150) * k);
    setTimeout(() => playBuf('crash' + Math.floor(Math.random() * 3), 0.78, 0.5 * k), 95);   // the crumple-after
    setTimeout(() => playBuf('scrape' + (Math.random() < 0.5 ? 0 : 1), 1.12, 0.5 * k), 190); // …and the whoosh-grind
  }

  // ---------------------------------------------------------------- THE LOUD SILENCE
  // The moment you leave the ground everything drops away: the whole mix ducks and goes
  // muffled, and all that's left is air moving past you. Then you land and it ALL comes
  // back at once, louder than it left. The silence is the thing that makes the impact
  // hurt — it's the trick every crash-compilation editor uses.
  // (Filtered noise only. Never a pure tone — see the tinnitus rule in roar.js.)
  let mixLP = null, mixG = null, windG = null, windF = null, mixOn = false, silK = 0;
  function ensureMix() {
    if (mixOn || typeof audio === 'undefined' || !audio || !audio.ctx || !audio.master) return;
    const ctx = audio.ctx;
    try {
      mixLP = ctx.createBiquadFilter(); mixLP.type = 'lowpass'; mixLP.frequency.value = 22000;
      mixG = ctx.createGain(); mixG.gain.value = 1;
      audio.master.disconnect();                       // splice the duck in ahead of the speakers
      audio.master.connect(mixLP); mixLP.connect(mixG); mixG.connect(ctx.destination);
      const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = b; src.loop = true;
      windF = ctx.createBiquadFilter(); windF.type = 'bandpass'; windF.frequency.value = 380; windF.Q.value = 0.5;
      windG = ctx.createGain(); windG.gain.value = 0;
      src.connect(windF); windF.connect(windG); windG.connect(ctx.destination);  // wind bypasses its own duck
      src.start();
      mixOn = true;
    } catch (e) { mixOn = false; }
  }
  function slam(hard) {                                // touchdown: the world kicks the door in
    if (!mixOn) return;
    const t = audio.ctx.currentTime, k = Math.min(1, hard / 14);
    silK = 0;
    mixG.gain.cancelScheduledValues(t);
    mixG.gain.setValueAtTime(1 + 0.3 * k, t);
    mixG.gain.setTargetAtTime(1, t + 0.03, 0.3);
    mixLP.frequency.cancelScheduledValues(t);
    mixLP.frequency.setValueAtTime(22000, t);
    windG.gain.cancelScheduledValues(t);
    windG.gain.setTargetAtTime(0, t, 0.08);
  }
  function crashMix(dt) {
    if (typeof player === 'undefined' || !player) return;
    ensureMix();
    if (!mixOn) return;
    // gated on actually racing: if a race ever ends mid-flight, the duck must let go
    // rather than leave the menu sounding like it's underwater
    const racing = typeof state === 'undefined' || state === 'race' || state === 'tt' || state === 'freeroam';
    const flying = !!(player.crash && player.air) && racing;
    silK = flying ? Math.min(1, silK + dt * 6) : Math.max(0, silK - dt * 3.2);
    if (silK <= 0.001 && !flying) return;              // idle: leave the graph alone
    const t = audio.ctx.currentTime, k = silK;
    mixG.gain.setTargetAtTime(1 - k * 0.85, t, 0.04);
    mixLP.frequency.setTargetAtTime(22000 - k * 21500, t, 0.05);
    windG.gain.setTargetAtTime(k * 0.34, t, 0.07);
    windF.frequency.setTargetAtTime(300 + k * 520, t, 0.12);
  }

  // real crumple: shove the nose vertices back like crushed sheet metal.
  // Every kart's welded geometry is unique to it, so mutating in place is safe.
  function crumple(c, sev) {
    if (!c.mesh) return;
    c._crumpleN = (c._crumpleN || 0) + 1;
    if (c._crumpleN > 3) return;                        // fully crushed is crushed
    for (const m of c.mesh.children) {
      if (!m.isMesh || !m.geometry || !m.geometry.attributes.position) continue;
      if (m === c._bmesh || m.isSprite) continue;
      const pos = m.geometry.attributes.position;
      m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox;
      if (bb.max.z - bb.min.z < 0.6) continue;          // trinkets keep their shape
      const zThr = bb.max.z - 1.15, depth = 1.15;
      let touched = false;
      for (let i = 0; i < pos.count; i++) {
        const z = pos.getZ(i);
        if (z <= zThr) continue;
        const f = Math.min(1, (z - zThr) / depth) * sev;
        pos.setZ(i, z - f * 0.5);
        pos.setY(i, pos.getY(i) - f * 0.1 * Math.random());
        pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * 0.12 * f);
        touched = true;
      }
      if (touched) { pos.needsUpdate = true; m.geometry.computeVertexNormals(); }
    }
  }

  // debris: dark shards that fly off a big one
  const debris = [];
  function ensureDebris(sc) {
    if (debris.length) { debris.forEach(o => sc.add(o.m)); return; }
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.16 + Math.random() * 0.14, 0.05, 0.2 + Math.random() * 0.16),
        new THREE.MeshBasicMaterial({ color: Math.random() < 0.7 ? 0x161a20 : 0x8f98a6 }));
      m.visible = false;
      sc.add(m);
      debris.push({ m, t: 0, vx: 0, vy: 0, vz: 0, rx: 0, rz: 0 });
    }
  }
  let dCur = 0;
  function throwDebris(c, n) {
    for (let i = 0; i < n; i++) {
      const o = debris[dCur = (dCur + 1) % debris.length];
      o.m.visible = true;
      o.m.position.set(c.x + (Math.random() - 0.5) * 1.4, c.y + 0.5 + Math.random() * 0.5, c.z + (Math.random() - 0.5) * 1.4);
      o.vx = (Math.random() - 0.5) * 9; o.vz = (Math.random() - 0.5) * 9;
      o.vy = 3.5 + Math.random() * 6;
      o.rx = (Math.random() - 0.5) * 14; o.rz = (Math.random() - 0.5) * 14;
      o.t = 1.5;
      o.baseY = c.y;
    }
  }
  function stepDebris(dt) {
    for (const o of debris) {
      if (!o.m.visible) continue;
      o.t -= dt;
      if (o.t <= 0) { o.m.visible = false; continue; }
      o.vy -= 21 * dt;
      o.m.position.x += o.vx * dt; o.m.position.y += o.vy * dt; o.m.position.z += o.vz * dt;
      if (o.m.position.y < (o.baseY || 0) + 0.05 && o.vy < 0) { o.vy *= -0.3; o.vx *= 0.6; o.vz *= 0.6; o.m.position.y = (o.baseY || 0) + 0.05; }
      o.m.rotation.x += o.rx * dt; o.m.rotation.z += o.rz * dt;
      if (o.t < 0.4) o.m.scale.setScalar(o.t / 0.4);
    }
  }

  // ---------------------------------------------------------------- CRASHPHYS
  // The wreck is SIMULATED, not animated. damage.js seeds angular velocity from the
  // geometry of the hit (square = end over end, glancing = barrel roll) and after that
  // nothing is on rails: main.js gravity owns the arc and the bounces, this owns the
  // attitude, and ground contact trades the two against each other — a car sliding on
  // its roof digs in and keeps rolling, rotation scrubs speed, speed feeds rotation.
  // It ends when it runs out of energy, wherever that is. No phases, no timers.
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function crashPhys(c, dt) {
    const cr = c.crash;
    const speed = Math.hypot(c.velX || 0, c.velZ || 0);
    const air = !!c.air;
    cr.life += dt;

    if (air) {
      const d = Math.exp(-0.22 * dt);            // air hardly touches a tumble
      cr.wr *= d; cr.wp *= d; cr.wy *= d;
      c._smkT = (c._smkT || 0) - dt;
      if (c._smkT <= 0) { c._smkT = 0.08; puff(smokes, c.x, c.y + 0.4, c.z, 1.1, 0.7, 0.6); }
    } else {
      // cos(roll) tells us which face is down: +1 on the wheels, -1 on the roof, 0 on a door
      const up = Math.cos(cr.rA);
      if (Math.abs(up) < 0.72 && speed > 5) {
        // it's riding an edge — that edge digs into the tarmac and levers the car
        // further over. THIS is the rolling crash, and it's emergent: keep the speed
        // up and it keeps going over, run out of speed and it drops where it is.
        cr.wr = clamp(cr.wr + Math.sign(cr.wr || 1) * speed * 0.5 * dt, -13, 13);
      }
      cr.wr *= Math.exp(-2.4 * dt);              // tarmac eats rotation
      cr.wp *= Math.exp(-5.0 * dt);
      cr.wy *= Math.exp(-2.4 * dt);
      // …and rotation eats speed: a car scrubbing sideways on its bodywork stops fast
      const bite = Math.min(2.4, Math.abs(cr.wr) * 0.12 + (1 - Math.abs(up)) * 0.9);
      const dec = Math.exp(-bite * dt);
      c.velX *= dec; c.velZ *= dec;
      // sparks + smoke wherever metal is touching road
      if (speed > 4 && Math.abs(up) < 0.9) {
        c._skT = (c._skT || 0) - dt;
        if (c._skT <= 0) {
          c._skT = 0.05;
          sparks(c.x + (Math.random() - 0.5) * 1.2, c.y + 0.1, c.z + (Math.random() - 0.5) * 1.2,
                 5, -(c.velX || 0) / Math.max(1, speed), -(c.velZ || 0) / Math.max(1, speed), speed * 0.18);
          puff(smokes, c.x, c.y + 0.3, c.z, 1.0, 0.6, 1.0);
        }
        c._scrT = (c._scrT || 0) - dt;
        if (c._scrT <= 0) { c._scrT = 0.34; playBuf('scrape' + (Math.random() < 0.5 ? 0 : 1), 0.9 + Math.random() * 0.3, 0.4 * attn(c)); }
      }
    }

    cr.rA += cr.wr * dt;
    cr.pA += cr.wp * dt;
    c.heading += cr.wy * dt;                     // yaw IS heading — it spins as it slides

    // has it run out? then it rocks back down onto its wheels and hands you the car back
    const spin = Math.abs(cr.wr) + Math.abs(cr.wp) + Math.abs(cr.wy);
    if (!air && speed < 3.5 && spin < 1.4) {
      const tgt = Math.round(cr.rA / (Math.PI * 2)) * Math.PI * 2;
      cr.rA += (tgt - cr.rA) * Math.min(1, dt * 4.5);
      cr.pA *= Math.exp(-6 * dt);
      cr.wr *= 0.2; cr.wp *= 0.2; cr.wy *= 0.2;
      if (Math.abs(cr.rA - tgt) < 0.05) { c._tumbleA = 0; delete c.crash; return; }
    }
    if (cr.life > 11) { c._tumbleA = 0; delete c.crash; return; }   // failsafe: nobody crashes forever

    c.mesh.rotateZ(cr.rA);
    c.mesh.rotateX(cr.pA);
  }

  function crashFX(c, dt) {
    // one-shot triggers set by damage.js
    if (c._boom) { boomSound(c, c._boom); if (c._boom > 105) throwDebris(c, 5 + Math.floor(Math.random() * 5)); c._boom = 0; }
    if (c._crumple) { crumple(c, c._crumple); c._crumple = 0; }
    // every touchdown is its own event — main.js sets _land to the speed it came down at
    if (c._land) {
      const hard = c._land; c._land = 0;
      if (c.crash && hard > 3) {
        boomSound(c, Math.min(120, 22 + hard * 6));
        for (let k = 0; k < Math.min(9, 3 + hard * 0.5); k++)
          puff(dusts, c.x + (Math.random() - 0.5) * 2, c.y + 0.15, c.z + (Math.random() - 0.5) * 2, 1.3, 0.7, 0.9);
        if (hard > 9) throwDebris(c, 2 + Math.floor(Math.random() * 3));
        if (c.isPlayer) slam(hard);                  // the mix comes back on like a door
      }
    }
    if (c.crash && c.mesh) crashPhys(c, dt);
  }

  function ensureBumper(c) {
    const has = c.dmg && c.dmg.bumper;
    if (has && !c._bmesh && c.mesh) {
      const sgn = c.dmg.bumper;
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.09, 0.16),
        new THREE.MeshBasicMaterial({ color: 0x161a20 }));
      m.position.set(0.4 * sgn, 0.16, 1.95);
      m.rotation.z = 0.55 * sgn;
      m.rotation.y = 0.35 * sgn;
      c.mesh.add(m);
      c._bmesh = m;
    } else if (!has && c._bmesh) {             // fixed / new race: let it go
      if (c._bmesh.parent) c._bmesh.parent.remove(c._bmesh);
      c._bmesh = null;
    }
  }

  function carFX(c, dt) {
    if (!c.mesh || !c.mesh.visible) return;
    const speed = Math.hypot(c.velX || 0, c.velZ || 0);
    ensureBumper(c);
    crashFX(c, dt);
    if (c.crash) return;                       // crashing cars are busy crashing
    if (speed < 4) { c._py = c.y; c._pvy = 0; return; }
    const sinH = Math.sin(c.heading || 0), cosH = Math.cos(c.heading || 0);

    // fat drift smoke — slide angle between nose and travel
    const velAng = Math.atan2(c.velX, c.velZ);
    let slide = (c.heading || 0) - velAng;
    while (slide > Math.PI) slide -= 2 * Math.PI;
    while (slide < -Math.PI) slide += 2 * Math.PI;
    if (Math.abs(slide) > 0.16 && speed > 11) {
      c._smkT = (c._smkT || 0) - dt;
      if (c._smkT <= 0) {
        c._smkT = 0.045;
        puff(smokes, c.x - sinH * 1.15 + (Math.random() - 0.5) * 0.9,
             c.y + 0.25, c.z - cosH * 1.15 + (Math.random() - 0.5) * 0.9,
             0.95 + Math.min(1.7, Math.abs(slide) * 2.3), 0.8, 1.3);
      }
    }

    // wall-grind sparks — lateral distance from the centerline sample vs road half-width
    if (typeof track !== 'undefined' && track && track.samples && typeof c.idx === 'number') {
      const s0 = track.samples[c.idx];
      if (s0) {
        const lat = Math.hypot(c.x - s0.x, c.z - s0.z);
        const hw = (typeof halfW !== 'undefined' && halfW) ? halfW
                 : (track.def && track.def.width ? track.def.width / 2 : 9);
        if (lat > hw - 0.55 && speed > 13) {
          c._grT = (c._grT || 0) - dt;
          if (c._grT <= 0) {
            c._grT = 0.07;
            const side = Math.sign((c.x - s0.x) * cosH - (c.z - s0.z) * sinH) || 1;
            sparks(c.x + cosH * 0.9 * side, c.y + 0.18, c.z - sinH * 0.9 * side,
                   4, sinH * 0.4, cosH * 0.4, speed * 0.12);
          }
        }
      }
    }

    // landing dust — was falling hard, now it isn't
    const vy = (c.y - (c._py ?? c.y)) / Math.max(dt, 1e-3);
    if ((c._pvy ?? 0) < -7.5 && vy > -1.5) {
      for (let k = 0; k < 5; k++)
        puff(dusts, c.x + (Math.random() - 0.5) * 1.7, c.y + 0.12, c.z + (Math.random() - 0.5) * 1.7,
             1.15, 0.65, 0.8);
    }
    c._pvy = vy; c._py = c.y;

    // engine dropout — backfire puff + a couple of sparks out the back
    if (c._bang) {
      c._bang = false;
      puff(smokes, c.x - sinH * 1.5, c.y + 0.55, c.z - cosH * 1.5, 0.85, 0.5, 1.9);
      sparks(c.x - sinH * 1.5, c.y + 0.45, c.z - cosH * 1.5, 5, -sinH, -cosH, 3.5);
    }

    // the dragging bumper earns its keep: constant grind sparks at the torn corner
    if (c._bmesh && speed > 10) {
      c._bsT = (c._bsT || 0) - dt;
      if (c._bsT <= 0) {
        c._bsT = 0.085;
        const sgn = c.dmg.bumper;
        sparks(c.x + sinH * 1.9 + cosH * 0.55 * sgn, c.y + 0.08, c.z + cosH * 1.9 - sinH * 0.55 * sgn,
               3, sinH * 0.3, cosH * 0.3, speed * 0.1);
      }
    }
  }

  function drawSpeedLines() {
    if (!slCtx) return;
    const w = slCanvas.clientWidth || innerWidth, h = slCanvas.clientHeight || innerHeight;
    if (w !== slW || h !== slH) { slW = slCanvas.width = w; slH = slCanvas.height = h; }
    slCtx.clearRect(0, 0, slW, slH);
    if (typeof state === 'undefined' || (state !== 'race' && state !== 'tt' && state !== 'freeroam')) return;
    if (typeof player === 'undefined' || !player) return;
    const sp = Math.hypot(player.velX || 0, player.velZ || 0);
    const k = Math.min(1, Math.max(0, (sp - 54) / 20));
    if (k <= 0.02) return;
    const cx = slW / 2, cy = slH * 0.46;
    slCtx.strokeStyle = 'rgba(255,255,255,' + (0.34 * k).toFixed(3) + ')';
    slCtx.lineWidth = 1.5;
    const n = Math.round(10 + 16 * k);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const rimX = cx + Math.cos(a) * slW * 0.75, rimY = cy + Math.sin(a) * slH * 0.75;
      const t0 = 0.55 + Math.random() * 0.2, t1 = t0 + 0.1 + Math.random() * 0.16 * k;
      slCtx.beginPath();
      slCtx.moveTo(cx + (rimX - cx) * t0, cy + (rimY - cy) * t0);
      slCtx.lineTo(cx + (rimX - cx) * t1, cy + (rimY - cy) * t1);
      slCtx.stroke();
    }
  }

  function update(dt) {
    init();
    if (!ready) return;
    if (typeof cars !== 'undefined' && cars && (typeof state === 'undefined' || state !== 'menu'))
      for (const c of cars) carFX(c, dt);
    stepPools(dt);
    stepDebris(dt);
    crashMix(dt);
    drawSpeedLines();
  }

  window.SPEEDFX = { update, sparks, puffSmoke: (x, y, z, s) => puff(smokes, x, y, z, s || 1, 0.8, 1.3),
    // debug tap for headless verification of the loud silence
    _mix: () => (mixOn ? { k: +silK.toFixed(3), gain: +mixG.gain.value.toFixed(3),
                           lp: Math.round(mixLP.frequency.value), wind: +windG.gain.value.toFixed(3) } : null) };

  // ---- hooks ----
  const _ucv = window.updateCarVisuals;
  if (typeof _ucv === 'function') {
    window.updateCarVisuals = function (dt) {
      _ucv.apply(this, arguments);
      try { update(dt || 1 / 60); } catch (e) {}
    };
  }
  const wrapImpact = () => {
    if (!window.DMG || DMG._sfxWrapped) { if (!window.DMG) setTimeout(wrapImpact, 500); return; }
    DMG._sfxWrapped = true;
    const _imp = DMG.impact;
    DMG.impact = function (car, v) {
      _imp.apply(this, arguments);
      if (car && v > 7 && car.mesh) {
        init();
        sparks(car.x, (car.y || 0) + 0.4, car.z, Math.min(24, Math.round(5 + v)),
               -Math.sin(car.heading || 0) * 0.3, -Math.cos(car.heading || 0) * 0.3, Math.min(9, v * 0.28));
      }
    };
  };
  wrapImpact();
})();
