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
    drawSpeedLines();
  }

  window.SPEEDFX = { update, sparks, puffSmoke: (x, y, z, s) => puff(smokes, x, y, z, s || 1, 0.8, 1.3) };

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
