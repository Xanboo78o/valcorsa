/* VALCORSA — BLOCKKIT v2: the toy cars, sculpted (Adam's Trailmakers technique).
   Overrides buildToyCar (the REAL car pipeline — buildKitMesh calls it directly).
   The craft, from studying Trailmakers builds:
     1. slopes come in families — LONG SHALLOW wedges for hoods, steeper for glass
     2. curves are rationed — one obvious rounded moment per car (the seat hump)
     3. wheel wells — arch fenders that wrap the wheels, a whisker wider than the body
   Bodies weld (merge) into one mesh per material; wheels/lamps/riders keep the
   original toy contract so steering, spinning, brake glow and ink outlines all work. */
'use strict';
(function () {
  const MU = window.FX.BufferGeometryUtils;

  /* ---- the vocabulary, v3: SCULPTED, not stacked ----
     Every primitive is now generated at its FINAL WORLD SIZE with a fillet measured in
     real units, instead of a unit cube stretched by a matrix. That matters: a stretched
     unit fillet turns into a smeared ellipse on a long panel, and that smear is exactly
     what reads as "blocky". True-size generation means a door edge and a roof edge have
     the same radius, which is what a real pressed panel looks like.
     The block list API is unchanged — all 30-odd bodies get molded for free. */
  const RBox = window.FX.RoundedBoxGeometry;
  const _cache = new Map();                    // repeated blocks (4 identical arches) build once

  // fillet: a fat panel gets a generous radius, a blade gets a hairline. Never more than
  // a third of the thinnest dimension or the shape eats itself.
  // Tuned by eye: 0.3 of the thin dimension turns a rocker panel into a pool noodle.
  // A fifth, capped low, kills the Lego edge without inflating anything.
  const fil = (a, b, c) => Math.min(0.045, Math.max(0.008, Math.min(a, b, c) * 0.2));

  // rounded 2D path: corners cut back by r and rounded through. Feeds the extrusions.
  function roundPath(pts, r) {
    const s = new THREE.Shape();
    const n = pts.length;
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n], cur = pts[i], nxt = pts[(i + 1) % n];
      const dP = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]) || 1;
      const dN = Math.hypot(nxt[0] - cur[0], nxt[1] - cur[1]) || 1;
      const rp = Math.min(r, dP * 0.45), rn = Math.min(r, dN * 0.45);
      const a = lerp(cur, prev, rp / dP), b = lerp(cur, nxt, rn / dN);
      if (i === 0) s.moveTo(a[0], a[1]); else s.lineTo(a[0], a[1]);
      s.quadraticCurveTo(cur[0], cur[1], b[0], b[1]);
    }
    s.closePath();
    return s;
  }

  // extrude a profile that lives in the (z, y) plane and runs across the car in x —
  // the orientation every profile primitive here uses.
  function crossExtrude(shape, sx, bevel) {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.001, sx - bevel * 2), bevelEnabled: bevel > 0.0005,
      bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 4,
    });
    g.translate(0, 0, -(sx - bevel * 2) / 2);
    g.rotateY(Math.PI / 2);
    return g;
  }

  function makeGeo(t, sx, sy, sz) {
    const r = fil(sx, sy, sz);
    // ONE bevel segment, not two. A single chamfer plus the creased-normal pass below
    // reads as a rounded edge from any distance a player will ever see it from, and costs
    // about a tenth of the triangles a real fillet does. This is the whole budget.
    if (t === 'c') return new RBox(sx, sy, sz, 1, r);
    if (t === 'w') {                           // wedge: full height at -Z, zero at +Z
      const hz = sz / 2, hy = sy / 2;
      return crossExtrude(roundPath([[hz, -hy], [-hz, -hy], [-hz, hy]], Math.min(r * 1.6, sy * 0.3, sz * 0.3)), sx, r * 0.7);
    }
    if (t === 'q') {                           // quarter-round: one shoulder rolls over
      const s = new THREE.Shape();
      const hz = sz / 2, hy = sy / 2;
      s.moveTo(-hz, -hy);
      s.lineTo(hz, -hy);
      s.absellipse(-hz, -hy, sz, sy, 0, Math.PI / 2, false);
      s.closePath();
      return crossExtrude(s, sx, r * 0.7);
    }
    // 'a' — fender arch. ORIGIN AT THE AXLE. Now with a rolled outer lip.
    // the arch profile is NOT unit-sized (it spans 1.24 x 0.7), so sy/sz have always been
    // scale factors here, not dimensions. Treating them as sizes shrinks the wheel well and
    // the fender saws into the tyre.
    const w = sz, h = sy;
    const s = new THREE.Shape();
    s.moveTo(-0.62 * w, -0.1 * h);
    s.lineTo(-0.44 * w, -0.1 * h);
    s.lineTo(-0.44 * w, 0);
    s.absellipse(0, 0, 0.44 * w, 0.44 * h, Math.PI, 0, true);
    s.lineTo(0.44 * w, -0.1 * h);
    s.lineTo(0.62 * w, -0.1 * h);
    s.lineTo(0.62 * w, 0.6 * h);
    s.lineTo(-0.62 * w, 0.6 * h);
    s.closePath();
    return crossExtrude(s, sx, Math.min(0.035, sx * 0.25));
  }

  function geoFor(t, sx, sy, sz) {
    const k = t + '|' + sx.toFixed(3) + '|' + sy.toFixed(3) + '|' + sz.toFixed(3);
    let g = _cache.get(k);
    if (!g) {
      g = makeGeo(t, Math.abs(sx) || 0.01, Math.abs(sy) || 0.01, Math.abs(sz) || 0.01);
      g = g.index ? g.toNonIndexed() : g;
      for (const key of Object.keys(g.attributes)) if (key !== 'position' && key !== 'normal') g.deleteAttribute(key);
      _cache.set(k, g);
    }
    return g;
  }

  /* weld: blocks -> ONE mesh per material. Geometries are normalized to
     non-indexed position+normal so boxes and extrusions merge cleanly.
     block = [type, matKey, x, y, z, sx, sy, sz, ry(quarter turns)] */
  function weld(g, matMap, blocks) {
    const buckets = {};
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (const b of blocks) {
      const [t, mat, x, y, z, sx, sy, sz, ry] = b;
      const geo = geoFor(t, sx, sy, sz).clone();     // already at true size — place only
      e.set(0, (ry || 0) * Math.PI / 2, 0);
      q.setFromEuler(e);
      m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
      geo.applyMatrix4(m4);
      (buckets[mat] = buckets[mat] || []).push(geo);
    }
    for (const key of Object.keys(buckets)) {
      let merged = MU.mergeGeometries(buckets[key], false);
      if (!merged) continue;
      // smooth across the fillets, stay crisp across panel edges — the difference between
      // "moulded bodywork" and "a pile of bricks" is entirely in this one threshold
      if (MU.toCreasedNormals) { try { merged = MU.toCreasedNormals(merged, 0.62); } catch (e) {} }
      const mesh = new THREE.Mesh(merged, matMap[key]);
      mesh.castShadow = true;
      g.add(mesh);
    }
  }

  /* ---- WHEELS v2: a real tyre with rolled shoulders, and a rim with spokes in it.
     Still exactly two meshes per corner (tyre + rim) because everything merges, so the
     draw-call budget is unchanged. Geometry is cached by (radius, width, style): a full
     12-car grid is really only three or four distinct wheels, and building 48 of them
     from scratch was most of the cost of building the grid. */
  const WHEEL = (() => {
    const SEG = 16, tyres = new Map(), rims = new Map(), dishes = new Map();
    const HUBR = [0.55, 0.66, 0.5, 0.4, 0.6];
    function merge(list) {                      // [geo, x, y, z, rx, ry, rz]
      const out = [], m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), ee = new THREE.Euler();
      for (const [geo, px, py, pz, rx, ry, rz] of list) {
        let gg = geo.index ? geo.toNonIndexed() : geo.clone();
        for (const k of Object.keys(gg.attributes)) if (k !== 'position' && k !== 'normal') gg.deleteAttribute(k);
        ee.set(rx || 0, ry || 0, rz || 0); qq.setFromEuler(ee);
        m4.compose(new THREE.Vector3(px || 0, py || 0, pz || 0), qq, new THREE.Vector3(1, 1, 1));
        gg.applyMatrix4(m4);
        out.push(gg);
      }
      return MU.mergeGeometries(out, false);
    }
    function tyreGeo(r, width) {                // lathe: bead -> sidewall -> rolled shoulder -> tread
      const k = r.toFixed(3) + '|' + width.toFixed(3);
      let g = tyres.get(k);
      if (g) return g;
      const hw = width / 2, sh = Math.min(hw * 0.55, r * 0.2), inner = r * 0.3;
      const pts = [new THREE.Vector2(inner, -hw), new THREE.Vector2(r * 0.9, -hw)];
      for (let i = 1; i <= 3; i++) {            // rounded shoulder, near side
        const a = (i / 4) * Math.PI / 2;
        pts.push(new THREE.Vector2(r * 0.9 + r * 0.1 * Math.sin(a), -hw + sh * (1 - Math.cos(a))));
      }
      pts.push(new THREE.Vector2(r, -hw + sh), new THREE.Vector2(r, hw - sh));
      for (let i = 3; i >= 1; i--) {            // and the far side
        const a = (i / 4) * Math.PI / 2;
        pts.push(new THREE.Vector2(r * 0.9 + r * 0.1 * Math.sin(a), hw - sh * (1 - Math.cos(a))));
      }
      pts.push(new THREE.Vector2(r * 0.9, hw), new THREE.Vector2(inner, hw));
      g = new THREE.LatheGeometry(pts, SEG);
      tyres.set(k, g);
      return g;
    }
    function rimGeo(r, width, wIdx) {
      const k = r.toFixed(3) + '|' + width.toFixed(3) + '|' + wIdx;
      let g = rims.get(k);
      if (g) return g;
      const hr = HUBR[wIdx] ?? 0.55;
      const spokes = wIdx === 3 ? 0 : wIdx === 1 ? 6 : wIdx === 2 ? 8 : 5;
      const parts = [[new THREE.CylinderGeometry(r * hr * 0.3, r * hr * 0.3, width + 0.03, 14), 0, 0, 0]];
      parts.push([new THREE.TorusGeometry(r * hr, r * 0.06, 5, SEG), 0, width / 2 - 0.03, 0, Math.PI / 2]);
      parts.push([new THREE.TorusGeometry(r * hr, r * 0.06, 5, SEG), 0, -width / 2 + 0.03, 0, Math.PI / 2]);
      for (let i = 0; i < spokes; i++) {
        const a = (i / spokes) * Math.PI * 2;
        const sp = new THREE.BoxGeometry(r * hr * 1.0, 0.045, r * 0.07);
        sp.translate(r * hr * 0.52, 0, 0);
        parts.push([sp, 0, width / 2 - 0.045, 0, 0, -a, 0]);
        parts.push([sp.clone(), 0, -width / 2 + 0.045, 0, 0, -a, 0]);
      }
      if (wIdx === 3) parts.push([new THREE.CylinderGeometry(r * hr, r * hr, width * 0.6, 16), 0, 0, 0]);
      g = merge(parts);
      rims.set(k, g);
      return g;
    }
    function dish(r) {
      const k = r.toFixed(3);
      let g = dishes.get(k);
      if (!g) { g = new THREE.TorusGeometry(r * 0.78, 0.04, 5, SEG); dishes.set(k, g); }
      return g;
    }
    return { HUBR, tyreGeo, rimGeo, dish };
  })();

  // ---- the override: same contract as the original buildToyCar ----
  const HUBS = (typeof HUB_COLS !== 'undefined') ? HUB_COLS : [0xc8ccd4, 0xe8e2ce, 0xc9a13b, 0x3a3e46, 0x20f6e8];
  window.buildToyCar = function (g, kit, helmetColor, headMats, tailMats) {
    const vehicle = { formula: 'f1', truck: 'monster', gt: 'coupe', muscle: 'muscle' }[kit.chassis] || kit.chassis;
    const paint = (typeof paintMat === 'function')          // Hot Wheels finish: clearcoat + rim (palette.js)
      ? paintMat(PAINTS[kit.paint % PAINTS.length])
      : toonMat(PAINTS[kit.paint % PAINTS.length]);
    const dark = toonMat(0x1c1e22);
    const glass = glassMat();
    const helmetMat = toonMat(helmetColor);
    const wIdx = (typeof kit.wheels === 'number' ? kit.wheels : 0) % HUBS.length;
    const hub = wIdx === 4
      ? toonMat(0x20f6e8, { emissive: 0x20f6e8, emissiveIntensity: 1.2 })
      : toonMat(HUBS[wIdx]);
    const M = { paint, dark, glass };
    const wheels = [];

    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      m.castShadow = true;
      g.add(m);
      return m;
    };
    const lamp = (kind, x, y, z, w = 0.24, h = 0.12) => {
      const mat = kind === 'head'
        ? toonMat(0x2a2820, { emissive: 0xfff3d8, emissiveIntensity: 0 })
        : toonMat(0x33120f, { emissive: 0xff2218, emissiveIntensity: 0 });
      (kind === 'head' ? headMats : tailMats).push(mat);
      add(new RBox(w, h, 0.07, 2, Math.min(0.028, h * 0.36, w * 0.36)), mat, x, y, z);
    };
    // ---- THE FACE — every marque gets eyes (always-on DRLs, unlit-bright day and night)
    // and a mouth. Eyes sit NEXT TO the night lamps, never over them (beams must stay visible).
    const EYE = 0xf2f8ff, EYE_WARM = 0xffeec4, PUPIL = 0x10141c;
    const chromeM = new THREE.MeshStandardMaterial({ color: 0xdfe6ee, metalness: 1.0, roughness: 0.16, envMapIntensity: 1.5 });
    const glowM = (c) => new THREE.MeshBasicMaterial({ color: c });
    const eye = (x, y, z, r, c) => add(new THREE.CircleGeometry(r, 12), glowM(c || EYE), x, y, z);
    const pupil = (x, y, z, r) => add(new THREE.CircleGeometry(r, 10), glowM(PUPIL), x, y, z);
    const squint = (x, y, z, w, h, tilt) => add(new THREE.BoxGeometry(w, h, 0.03), glowM(EYE), x, y, z, 0, 0, tilt);
    const tooth = (x, y, z, w, h) => add(new RBox(w, h, 0.055, 2, Math.min(0.02, h * 0.35, w * 0.35)), chromeM, x, y, z);
    // wheel STYLES are visible now: hub size/color per style + deep-dish ring
    // 0 sport silver · 1 classic big cream · 2 gold deep-dish · 3 steelies · 4 neon
    const HUBR = WHEEL.HUBR;
    const { tyreGeo, rimGeo } = WHEEL;
    // the lathe profile doubles back at the top bead, so that annulus winds inward and
    // gets culled — you could see the fender through the wheel. One double-sided clone.
    let _tyreMat = null;
    const tyreMat = () => _tyreMat || (_tyreMat = Object.assign(dark.clone(), { side: THREE.DoubleSide }));
    const wheel = (x, z, front, r = 0.45, width = 0.44) => {
      const wg = new THREE.Group();
      const w = new THREE.Mesh(tyreGeo(r, width), tyreMat());
      w.rotation.z = Math.PI / 2; w.castShadow = true;
      wg.add(w);
      // NOTE: the rim hangs off the GROUP, not off the tyre. The tyre is already turned
      // z+90°, so parenting here (as the old cylinder did) turned the rim a second time
      // and stood it on edge — invisible on a symmetric cylinder, very visible once the
      // rim has spokes.
      const hb = new THREE.Mesh(rimGeo(r, width, wIdx), hub);
      hb.rotation.z = Math.PI / 2;
      hb.castShadow = true;
      wg.add(hb);
      if (wIdx === 2) {                                            // deep-dish: cream outer ring
        const ring = new THREE.Mesh(WHEEL.dish(r), toonMat(0xf4ecdd));
        ring.rotation.y = Math.PI / 2;
        wg.add(ring);
      }
      wg.position.set(x, r, z);
      wg.userData.front = !!front;
      g.add(wg); wheels.push(wg);
      return wg;
    };
    const rider = (z, lean) => {
      add(new THREE.BoxGeometry(0.5, 0.6, 0.42), dark, 0, 0.62, z, lean || 0);
      add(new THREE.SphereGeometry(0.28, 10, 8), helmetMat, 0, 1.0, z + (lean ? 0.18 : 0));
    };

    // ---- DECALS, finally real: canvas plates stuck on the body like stickers ----
    const num = kit.num || ((kit.paint * 37 + 13) % 89) + 1;
    function decalTex(kind) {
      const cv = document.createElement('canvas');
      cv.width = 256; cv.height = 128;
      const c = cv.getContext('2d');
      if (kind === 'number') {
        c.fillStyle = '#f4ecdd'; c.beginPath(); c.arc(128, 64, 56, 0, 7); c.fill();
        c.lineWidth = 7; c.strokeStyle = '#1c1e22'; c.stroke();
        c.fillStyle = '#1c1e22'; c.font = '900 64px "Archivo Black", sans-serif';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(num, 128, 68);
      } else if (kind === 'stripes') {
        c.fillStyle = '#f4ecdd';
        c.fillRect(88, 0, 32, 128); c.fillRect(136, 0, 32, 128);
      } else if (kind === 'flames') {
        c.fillStyle = '#ff8c1a';
        for (let i = 0; i < 5; i++) {
          c.beginPath();
          c.moveTo(20 + i * 46, 118); c.lineTo(43 + i * 46, 10 + (i % 2) * 26); c.lineTo(66 + i * 46, 118);
          c.closePath(); c.fill();
        }
        c.fillStyle = '#ffd23e';
        for (let i = 0; i < 5; i++) {
          c.beginPath();
          c.moveTo(32 + i * 46, 118); c.lineTo(43 + i * 46, 52 + (i % 2) * 20); c.lineTo(54 + i * 46, 118);
          c.closePath(); c.fill();
        }
      } else if (kind === 'checker') {
        for (let x = 0; x < 8; x++) for (let y = 0; y < 4; y++) {
          c.fillStyle = (x + y) % 2 ? '#1c1e22' : '#f4ecdd';
          c.fillRect(x * 32, y * 32, 32, 32);
        }
      } else return null;
      const tx = new THREE.CanvasTexture(cv);
      tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
      return tx;
    }
    function plate(tex, w, h, x, y, z, face) {          // face: 'left'|'right'|'up'
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.position.set(x, y, z);
      if (face === 'right') m.rotation.y = Math.PI / 2;
      else if (face === 'left') m.rotation.y = -Math.PI / 2;
      else if (face === 'up') { m.rotation.x = -Math.PI / 2; m.rotation.z = Math.PI; m.rotation.z = 0; }
      g.add(m);
      return m;
    }
    function applyDecals(vehId) {
      const kind = kit.decal && kit.decal !== 'none' ? kit.decal : null;
      if (!kind) return;
      const tex = decalTex(kind === 'stripes' || kind === 'checker' ? kind : 'number');
      const art = decalTex(kind);                        // flames/stripes/checker art for the roof/hood
      if (!tex && !art) return;
      const D = {
        coupe:   { side: [0.966, 0.72, 0.1, 1.15, 0.42], top: [0, 1.415, -0.42, 1.15, 0.9] },
        muscle:  { side: [1.015, 0.72, 0.2, 1.3, 0.46], top: [0, 1.462, -0.55, 1.15, 1.0] },
        rally:   { side: [0.965, 0.78, 0.15, 1.1, 0.5], top: [0, 1.588, -0.2, 1.2, 1.05] },
        monster: { side: [0.92, 2.06, -0.32, 0.95, 0.42], top: [0, 2.19, 1.05, 1.35, 1.15] },
        kart:    { top: [0, 0.55, -0.18, 0.55, 0.5] },
        f1:      { side: [0.37, 0.56, 0.75, 0.55, 0.34], top: [0, 0.72, 1.5, 0.5, 0.7] },
        bike:    { side: [0.21, 0.95, 0.28, 0.42, 0.26] },
        monoposto: { side: [1.12, 0.55, -0.2, 0.9, 0.32], top: [0, 0.76, 1.3, 0.44, 0.8] },
        endurance: { side: [1.03, 0.62, 0.3, 1.2, 0.38], top: [0, 1.26, -0.32, 1.0, 0.8] },
        barrel:    { side: [0.6, 0.82, -0.1, 0.6, 0.45] },
        longframe: { side: [0.63, 0.52, 0.6, 1.2, 0.28], top: [0, 0.63, 0.7, 0.6, 1.3] },
        sofa:      { side: [1.1, 0.9, 0, 0.8, 0.4], top: [0, 0.83, 0.05, 0.8, 0.8] },
      }[vehId];
      if (!D) return;
      if (D.side && tex) {
        plate(tex, D.side[3], D.side[4], D.side[0], D.side[1], D.side[2], 'right');
        plate(tex, D.side[3], D.side[4], -D.side[0], D.side[1], D.side[2], 'left');
      }
      if (D.top && art) plate(art, D.top[3], D.top[4], D.top[0], D.top[1], D.top[2], 'up');
    }

    if (vehicle === 'coupe') {                // Enginos GT: the big rectangle, sculpted
      weld(g, M, [
        ['c', 'dark', 0, 0.3, 0, 1.76, 0.18, 4.06],                // inset rocker (panel line)
        ['c', 'paint', 0, 0.58, 0, 1.9, 0.48, 4.2],                // THE rectangle
        ['w', 'paint', 0, 0.92, 1.4, 1.9, 0.2, 1.55],              // hood: super subtle slope
        ['c', 'paint', 0, 0.88, 2.02, 1.9, 0.12, 0.4],             // nose cap
        ['c', 'dark', 0, 1.0, -0.3, 1.5, 0.32, 1.8],               // cabin core behind the glass
        ['w', 'glass', 0, 1.18, 0.5, 1.6, 0.42, 0.95],             // raked windshield
        ['c', 'paint', 0, 1.28, -0.42, 1.64, 0.26, 1.0],           // roof
        ['q', 'paint', 0, 1.18, -1.2, 1.64, 0.46, 0.78],        // THE curve: seat-hump fastback
        ['q', 'paint', 0, 0.84, -1.78, 1.9, 0.3, 0.5],          // curve step down the tail
        ['c', 'dark', 0, 0.98, -2.02, 1.68, 0.07, 0.34],           // ducktail blade
        ['a', 'paint', -0.95, 0.46, 1.4, 0.5, 1.12, 1.12],         // wheel wells, all four
        ['a', 'paint', 0.95, 0.46, 1.4, 0.5, 1.12, 1.12],
        ['a', 'paint', -0.95, 0.48, -1.4, 0.54, 1.16, 1.16],
        ['a', 'paint', 0.95, 0.48, -1.4, 0.54, 1.16, 1.16],
      ]);
      lamp('head', -0.58, 0.7, 2.24); lamp('head', 0.58, 0.7, 2.24);
      // BRAND FACE (Enginos = BMW DNA): twin kidney grilles + twin-element LED squints
      tooth(-0.21, 0.6, 2.22, 0.4, 0.3); tooth(0.21, 0.6, 2.22, 0.4, 0.3);          // chrome kidney frames
      add(new THREE.BoxGeometry(0.34, 0.24, 0.05), dark, -0.21, 0.6, 2.25);          // kidney insets
      add(new THREE.BoxGeometry(0.34, 0.24, 0.05), dark, 0.21, 0.6, 2.25);
      squint(-0.55, 0.85, 2.245, 0.4, 0.05, -0.08); squint(0.55, 0.85, 2.245, 0.4, 0.05, 0.08);
      squint(-0.52, 0.78, 2.245, 0.32, 0.04, -0.08); squint(0.52, 0.78, 2.245, 0.32, 0.04, 0.08);
      lamp('tail', -0.6, 0.72, -2.17, 0.42, 0.12); lamp('tail', 0.6, 0.72, -2.17, 0.42, 0.12);
      wheel(-0.95, 1.4, 1, 0.46, 0.42); wheel(0.95, 1.4, 1, 0.46, 0.42);
      wheel(-0.95, -1.4, 0, 0.48, 0.46); wheel(0.95, -1.4, 0, 0.48, 0.46);

    } else if (vehicle === 'muscle') {        // Houndsborough Iron: long hood, upright cab
      weld(g, M, [
        ['c', 'dark', 0, 0.28, 0.1, 1.86, 0.18, 4.5],
        ['c', 'paint', 0, 0.58, 0.1, 2.0, 0.52, 4.6],              // long low body
        ['w', 'paint', 0, 0.94, 1.35, 2.0, 0.18, 1.8],             // subtle hood slope
        ['c', 'dark', 0, 1.04, 1.2, 0.9, 0.14, 0.7],               // scoop ON the slope
        ['c', 'dark', 0, 1.02, -0.5, 1.5, 0.34, 1.5],              // cabin core
        ['w', 'glass', 0, 1.22, 0.32, 1.56, 0.44, 0.75],           // windshield
        ['c', 'paint', 0, 1.3, -0.55, 1.6, 0.3, 1.1],              // roof
        ['w', 'paint', 0, 1.2, -1.35, 1.6, 0.44, 0.75, 2],         // rear glassline wedge (flipped)
        ['c', 'paint', 0, 0.9, -1.9, 2.0, 0.28, 0.7],              // trunk
        ['c', 'dark', 0, 1.02, -2.2, 1.9, 0.08, 0.3],              // ducktail
        ['c', 'dark', 0, 0.42, 2.35, 2.05, 0.2, 0.3],              // bumpers
        ['c', 'dark', 0, 0.42, -2.3, 2.05, 0.2, 0.3],
        ['a', 'paint', -1.02, 0.5, 1.5, 0.54, 1.2, 1.2],
        ['a', 'paint', 1.02, 0.5, 1.5, 0.54, 1.2, 1.2],
        ['a', 'paint', -1.02, 0.54, -1.5, 0.6, 1.28, 1.28],
        ['a', 'paint', 1.02, 0.54, -1.5, 0.6, 1.28, 1.28],
      ]);
      lamp('head', -0.62, 0.66, 2.42); lamp('head', 0.62, 0.66, 2.42);
      // BRAND FACE (Houndsborough = Cadillac DNA): vertical LED blades + chrome-framed slab grille
      squint(-0.88, 0.78, 2.43, 0.055, 0.5, 0); squint(0.88, 0.78, 2.43, 0.055, 0.5, 0);   // corner blades
      tooth(0, 0.72, 2.42, 1.34, 0.5);                                               // chrome frame
      add(new THREE.BoxGeometry(1.22, 0.4, 0.05), dark, 0, 0.72, 2.46);              // the slab grille
      tooth(0, 0.72, 2.49, 1.0, 0.045);                                              // one chrome crossbar
      lamp('tail', -0.65, 0.7, -2.37, 0.5, 0.12); lamp('tail', 0.65, 0.7, -2.37, 0.5, 0.12);
      wheel(-1.02, 1.5, 1, 0.5, 0.46); wheel(1.02, 1.5, 1, 0.5, 0.46);
      wheel(-1.02, -1.5, 0, 0.54, 0.52); wheel(1.02, -1.5, 0, 0.54, 0.52);

    } else if (vehicle === 'rally') {         // Heiligen Strada: box-flare hatch
      weld(g, M, [
        ['c', 'paint', 0, 0.6, 0, 1.9, 0.68, 4.0],                 // tall body
        ['w', 'paint', 0, 1.06, 1.55, 1.9, 0.24, 0.9],             // stubby hood slope
        ['c', 'dark', 0, 1.1, -0.15, 1.52, 0.4, 1.85],             // cabin core
        ['w', 'glass', 0, 1.32, 0.68, 1.58, 0.44, 0.72],           // windshield
        ['c', 'paint', 0, 1.42, -0.2, 1.66, 0.32, 1.15],           // roof
        ['c', 'dark', 0, 1.62, 0.15, 0.5, 0.14, 0.42],             // roof scoop
        ['q', 'paint', 0, 1.32, -0.98, 1.66, 0.42, 0.58],       // hatch curve
        ['c', 'dark', 0, 1.46, -0.95, 1.5, 0.08, 0.45],            // roof spoiler blade
        ['c', 'paint', -0.94, 1.12, -1.98, 0.1, 0.4, 0.5],         // spoiler struts
        ['c', 'paint', 0.94, 1.12, -1.98, 0.1, 0.4, 0.5],
        ['c', 'dark', 0, 1.28, -2.0, 2.0, 0.1, 0.5],               // big rear wing
        ['c', 'dark', 0, 0.5, 2.05, 1.8, 0.24, 0.3],               // bash bar
        ['a', 'dark', -1.0, 0.52, 1.45, 0.62, 1.28, 1.28],         // BOXY dark flares (rally!)
        ['a', 'dark', 1.0, 0.52, 1.45, 0.62, 1.28, 1.28],
        ['a', 'dark', -1.0, 0.52, -1.45, 0.62, 1.28, 1.28],
        ['a', 'dark', 1.0, 0.52, -1.45, 0.62, 1.28, 1.28],
      ]);
      lamp('head', -0.55, 0.86, 2.02); lamp('head', 0.55, 0.86, 2.02);
      lamp('head', -0.2, 1.2, 1.98, 0.18, 0.14); lamp('head', 0.2, 1.2, 1.98, 0.18, 0.14);   // pod lights
      // BRAND FACE (Heiligen = Subaru DNA): hex grille, hawk-eye lamps, hood scoop
      add(new THREE.BoxGeometry(0.9, 0.26, 0.05), dark, 0, 0.62, 2.02);              // hex-ish center grille
      tooth(0, 0.77, 2.02, 0.94, 0.04);                                              // chrome brow bar
      squint(-0.55, 0.92, 2.02, 0.34, 0.06, -0.22); squint(0.55, 0.92, 2.02, 0.34, 0.06, 0.22); // hawk eyes
      add(new THREE.BoxGeometry(0.5, 0.12, 0.55), dark, 0, 1.24, 1.55);              // THE hood scoop
      lamp('tail', -0.6, 0.9, -2.02); lamp('tail', 0.6, 0.9, -2.02);
      wheel(-1.0, 1.45, 1, 0.52, 0.5); wheel(1.0, 1.45, 1, 0.52, 0.5);
      wheel(-1.0, -1.45, 0, 0.52, 0.5); wheel(1.0, -1.45, 0, 0.52, 0.5);

    } else if (vehicle === 'bike') {          // Perro Moto: the dog, properly drawn this time
      weld(g, M, [
        ['c', 'paint', 0, 0.66, -0.2, 0.3, 0.32, 1.6],             // frame spine
        ['q', 'paint', 0, 0.95, 0.28, 0.4, 0.32, 0.72, 2],         // THE tank curve (bigger, obvious)
        ['c', 'dark', 0, 0.46, -0.15, 0.38, 0.34, 0.9],            // engine block
        ['c', 'dark', 0, 0.86, -0.6, 0.38, 0.1, 0.7],              // seat pad
        ['w', 'paint', 0, 1.0, -1.02, 0.36, 0.3, 0.65, 2],         // tail up-kick wedge
        ['w', 'paint', 0, 0.8, 0.95, 0.46, 0.4, 0.6],              // front fairing slope
        ['w', 'glass', 0, 1.1, 0.78, 0.3, 0.28, 0.35],             // screen
      ]);
      add(new THREE.TorusGeometry(0.57, 0.06, 6, 12, Math.PI), paint, 0, 0.5, 1.25, 0, Math.PI / 2);   // round front fender
      add(new THREE.TorusGeometry(0.57, 0.06, 6, 12, Math.PI), paint, 0, 0.5, -1.25, 0, Math.PI / 2);  // rear hugger
      for (const sx of [-1, 1]) {
        add(new THREE.CylinderGeometry(0.045, 0.045, 0.8, 6), dark, sx * 0.14, 0.88, 1.02, 0.42);   // raked fork legs
        add(new THREE.BoxGeometry(0.06, 0.07, 0.75), dark, sx * 0.13, 0.5, -0.85);                  // swingarm
      }
      add(new THREE.BoxGeometry(0.66, 0.05, 0.07), dark, 0, 1.2, 0.7);                              // handlebar
      add(new THREE.CylinderGeometry(0.05, 0.075, 0.8, 6), dark, 0.2, 0.82, -1.0, 1.15);            // upswept megaphone
      add(new THREE.BoxGeometry(0.42, 0.6, 0.44), dark, 0, 1.06, -0.32, -0.55);                     // tucked torso
      add(new THREE.SphereGeometry(0.27, 10, 8), helmetMat, 0, 1.34, 0.1);
      add(new THREE.BoxGeometry(0.14, 0.46, 0.14), dark, -0.27, 0.98, 0.4, 0, 0, 0.6);              // arms to the bars
      add(new THREE.BoxGeometry(0.14, 0.46, 0.14), dark, 0.27, 0.98, 0.4, 0, 0, -0.6);
      add(new THREE.BoxGeometry(0.13, 0.4, 0.3), dark, -0.25, 0.62, -0.4, 0.3);                     // legs gripping the tank
      add(new THREE.BoxGeometry(0.13, 0.4, 0.3), dark, 0.25, 0.62, -0.4, 0.3);
      // FACE: the cyclops — one big round eye out front where the fender can't hide it
      eye(0, 1.0, 1.315, 0.105);
      lamp('head', 0, 0.84, 1.28, 0.18, 0.16); lamp('tail', 0, 1.04, -1.34, 0.16, 0.1);
      wheel(0, 1.25, 1, 0.5, 0.22);
      wheel(0, -1.25, 0, 0.5, 0.26);

    } else if (vehicle === 'monster') {       // Norte Titan: slab frame, wedge cab, curve nose
      weld(g, M, [
        ['c', 'dark', 0, 1.4, 0, 2.0, 0.5, 3.4],                   // frame
        ['c', 'paint', 0, 1.88, 1.05, 2.0, 0.6, 1.5],              // hood block
        ['q', 'paint', 0, 1.88, 1.75, 2.0, 0.6, 0.4, 2],              // curve nose
        ['c', 'dark', 0, 2.1, -0.3, 1.62, 0.5, 1.35],              // cab core
        ['w', 'glass', 0, 2.34, 0.42, 1.7, 0.5, 0.62],             // windshield wedge
        ['c', 'paint', 0, 2.42, -0.35, 1.8, 0.4, 1.2],             // cab roof
        ['w', 'paint', 0, 2.3, -1.1, 1.8, 0.42, 0.5, 2],           // cab rear wedge
        ['c', 'paint', 0, 1.78, -1.65, 2.0, 0.7, 1.0],             // bed
        ['c', 'dark', 0, 2.0, -1.65, 1.5, 0.24, 0.6],              // cargo hump
        ['c', 'dark', 0, 1.55, 1.95, 2.1, 0.3, 0.3],               // bull bar
      ]);
      add(new THREE.BoxGeometry(0.5, 0.2, 0.5), dark, 0, 2.72, 0.4);
      for (const lx of [-0.5, 0, 0.5]) add(new THREE.SphereGeometry(0.14, 8, 6), toonMat(0xfff2b0), lx, 2.88, 0.4);
      lamp('head', -0.6, 1.95, 1.98); lamp('head', 0.6, 1.95, 1.98);
      // BRAND FACE (Norte = Mustang GT3 DNA, the rebrand reaches the old truck): tri-bar lamps + big framed grille
      for (const sx of [-1, 1]) for (let b = 0; b < 3; b++)
        squint(sx * (0.52 + b * 0.1), 1.95, 2.03, 0.055, 0.2, 0);                    // tri-bar verticals
      tooth(0, 1.66, 2.0, 1.44, 0.42);                                              // chrome frame
      add(new THREE.BoxGeometry(1.3, 0.32, 0.05), dark, 0, 1.66, 2.04);              // the big grille
      lamp('tail', -0.7, 1.65, -2.18); lamp('tail', 0.7, 1.65, -2.18);
      wheel(-1.15, 1.35, 1, 0.95, 0.8); wheel(1.15, 1.35, 1, 0.95, 0.8);
      wheel(-1.15, -1.35, 0, 0.95, 0.8); wheel(1.15, -1.35, 0, 0.95, 0.8);

    } else if (vehicle === 'kart') {          // Granada Sprint: plank + subtle nose
      weld(g, M, [
        ['c', 'paint', 0, 0.2, 0, 1.15, 0.16, 2.5],                // plank
        ['w', 'paint', 0, 0.34, 1.05, 1.0, 0.14, 0.55],            // subtle nose wedge
        ['c', 'dark', 0, 0.22, 1.35, 1.25, 0.12, 0.5],             // front bumper
        ['c', 'paint', 0, 0.45, -0.2, 0.9, 0.5, 0.7],              // seat box
        ['q', 'paint', 0, 0.72, -0.5, 0.8, 0.28, 0.32],         // seat-back curve (the hump!)
        ['c', 'dark', 0.5, 0.42, -1.05, 0.5, 0.4, 0.55],           // engine
        ['q', 'dark', -0.42, 0.4, -1.05, 0.44, 0.3, 0.32],         // airbox curve
      ]);
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), dark, 0, 0.62, 0.75, Math.PI / 3);
      add(new THREE.TorusGeometry(0.22, 0.04, 6, 10), dark, 0, 0.78, 0.95, Math.PI / 2.4);
      // BRAND FACE (Granada = McLaren DNA): little swoosh-hook LEDs on the nose
      squint(-0.26, 0.44, 1.365, 0.17, 0.045, -0.45); squint(0.26, 0.44, 1.365, 0.17, 0.045, 0.45);
      squint(-0.33, 0.38, 1.365, 0.1, 0.04, -1.15); squint(0.33, 0.38, 1.365, 0.1, 0.04, 1.15);
      rider(-0.1);
      wheel(-0.72, 0.95, 1, 0.34, 0.3); wheel(0.72, 0.95, 1, 0.34, 0.3);
      wheel(-0.78, -0.95, 0, 0.4, 0.42); wheel(0.78, -0.95, 0, 0.4, 0.42);

    } else if (vehicle === 'monoposto') {     // F1 Monoposto: the pinnacle — halo, fin, sculpted pods
      weld(g, M, [
        ['c', 'dark', 0, 0.3, -0.2, 1.66, 0.14, 3.3],              // floor plank
        ['c', 'paint', 0, 0.48, -0.2, 0.66, 0.32, 3.2],            // monocoque spine
        ['w', 'paint', 0, 0.64, 1.35, 0.56, 0.3, 1.9],             // LONG nose droop
        ['c', 'paint', 0, 0.46, 2.42, 0.42, 0.2, 0.9],             // nose tip
        ['c', 'dark', 0, 0.28, 2.85, 2.1, 0.07, 0.6],              // front wing main
        ['w', 'dark', 0, 0.38, 2.6, 2.04, 0.1, 0.32, 2],           // wing flap rise
        ['c', 'dark', -1.02, 0.44, 2.85, 0.07, 0.3, 0.62],         // FW endplates
        ['c', 'dark', 1.02, 0.44, 2.85, 0.07, 0.3, 0.62],
        ['q', 'paint', -0.78, 0.62, 0.6, 0.5, 0.34, 0.5, 2],       // pod inlet curves
        ['q', 'paint', 0.78, 0.62, 0.6, 0.5, 0.34, 0.5, 2],
        ['c', 'paint', -0.82, 0.5, -0.4, 0.58, 0.4, 1.9],          // sidepods
        ['c', 'paint', 0.82, 0.5, -0.4, 0.58, 0.4, 1.9],
        ['w', 'paint', -0.82, 0.76, -0.95, 0.58, 0.14, 1.0, 2],    // pod-top downwash ramps
        ['w', 'paint', 0.82, 0.76, -0.95, 0.58, 0.14, 1.0, 2],
        ['c', 'dark', 0, 0.68, 0.45, 0.64, 0.26, 0.8],             // cockpit surround
        ['c', 'dark', 0, 1.04, -0.35, 0.3, 0.2, 0.4],              // airbox over the head
        ['w', 'paint', 0, 0.84, -1.05, 0.5, 0.44, 1.7, 2],         // engine cover taper
        ['c', 'paint', 0, 1.08, -1.35, 0.06, 0.42, 1.1],           // SHARK FIN
        ['c', 'dark', 0, 1.12, -2.05, 1.72, 0.08, 0.5],            // rear wing
        ['c', 'dark', -0.82, 0.86, -2.05, 0.07, 0.55, 0.55],       // RW endplates
        ['c', 'dark', 0.82, 0.86, -2.05, 0.07, 0.55, 0.55],
        ['w', 'dark', 0, 0.34, -1.85, 1.5, 0.22, 0.5],             // diffuser kick
      ]);
      add(new THREE.TorusGeometry(0.33, 0.045, 6, 14, Math.PI), dark, 0, 0.84, 0.32);        // THE HALO
      add(new THREE.CylinderGeometry(0.035, 0.05, 0.34, 6), dark, 0, 0.84, 0.52, 0.5);       // halo pillar, raked
      add(new THREE.SphereGeometry(0.27, 10, 8), helmetMat, 0, 0.8, 0.28);
      lamp('tail', 0, 0.92, -2.32, 0.16, 0.22);                                              // rain light
      wheel(-1.0, 1.5, 1, 0.44, 0.4); wheel(1.0, 1.5, 1, 0.44, 0.4);
      wheel(-1.04, -1.45, 0, 0.47, 0.46); wheel(1.04, -1.45, 0, 0.47, 0.46);

    } else if (vehicle === 'endurance') {     // Heiligen Endurance Frame: October's night racer
      weld(g, M, [
        ['c', 'dark', 0, 0.28, 0, 1.9, 0.16, 4.3],                 // splitter floor
        ['c', 'paint', 0, 0.54, 0.1, 1.95, 0.42, 4.4],             // wide low hull
        ['w', 'paint', 0, 0.86, 1.45, 1.95, 0.2, 1.6],             // LONG nose slope
        ['c', 'paint', 0, 0.8, 2.25, 1.95, 0.14, 0.35],            // nose band
        ['w', 'glass', 0, 1.06, 0.55, 1.0, 0.34, 0.75],            // canopy windshield (narrow bubble)
        ['c', 'dark', 0, 1.1, -0.1, 0.96, 0.3, 0.7],               // canopy core
        ['q', 'paint', 0, 1.08, -0.55, 1.0, 0.34, 0.6],            // canopy fastback curve
        ['w', 'paint', 0, 0.9, -1.5, 1.9, 0.24, 1.3, 2],           // long tail taper
        ['c', 'paint', 0, 1.0, -1.2, 0.07, 0.5, 1.6],              // SHARK FIN down the tail
        ['c', 'dark', 0, 1.16, -2.0, 1.95, 0.08, 0.45],            // rear wing
        ['c', 'dark', -0.94, 0.94, -2.0, 0.07, 0.5, 0.5],          // endplates
        ['c', 'dark', 0.94, 0.94, -2.0, 0.07, 0.5, 0.5],
        ['w', 'dark', 0, 0.34, -1.95, 1.7, 0.2, 0.45],             // diffuser
        ['a', 'paint', -1.0, 0.5, 1.45, 0.54, 1.2, 1.2],           // full fenders
        ['a', 'paint', 1.0, 0.5, 1.45, 0.54, 1.2, 1.2],
        ['a', 'paint', -1.0, 0.52, -1.45, 0.56, 1.24, 1.24],
        ['a', 'paint', 1.0, 0.52, -1.45, 0.56, 1.24, 1.24],
      ]);
      // the endurance signature: SIX headlamps for the October night
      lamp('head', -0.62, 0.84, 2.32, 0.3, 0.14); lamp('head', 0.62, 0.84, 2.32, 0.3, 0.14);
      lamp('head', -0.32, 0.88, 2.36, 0.16, 0.16); lamp('head', 0.32, 0.88, 2.36, 0.16, 0.16);
      lamp('head', -0.28, 1.24, 0.24, 0.14, 0.1); lamp('head', 0.28, 1.24, 0.24, 0.14, 0.1); // canopy brow pods
      // BRAND FACE (Heiligen endurance): hex family grille under the nose band, lamps stay the star
      add(new THREE.BoxGeometry(0.8, 0.18, 0.05), dark, 0, 0.6, 2.44);
      tooth(0, 0.71, 2.44, 0.84, 0.035);
      lamp('tail', -0.8, 0.86, -2.2, 0.3, 0.1); lamp('tail', 0.8, 0.86, -2.2, 0.3, 0.1);
      wheel(-1.0, 1.45, 1, 0.48, 0.44); wheel(1.0, 1.45, 1, 0.48, 0.44);
      wheel(-1.0, -1.45, 0, 0.5, 0.48); wheel(1.0, -1.45, 0, 0.5, 0.48);

    } else if (vehicle === 'barrel') {        // Barrel Kart: it's a barrel
      weld(g, M, [
        ['c', 'paint', 0, 0.2, 0.15, 1.1, 0.16, 2.3],              // kart plank
        ['w', 'paint', 0, 0.34, 1.2, 0.95, 0.14, 0.5],             // nose wedge
        ['c', 'dark', 0, 0.24, 1.5, 1.2, 0.12, 0.4],               // bumper
        ['c', 'dark', 0.48, 0.44, -0.95, 0.46, 0.38, 0.5],         // engine
        ['q', 'dark', -0.4, 0.42, -0.95, 0.4, 0.28, 0.3],          // airbox curve
      ]);
      add(new THREE.CylinderGeometry(0.58, 0.52, 1.05, 14), paint, 0, 0.8, -0.1);            // THE BARREL
      add(new THREE.TorusGeometry(0.575, 0.05, 6, 16), dark, 0, 0.5, -0.1, Math.PI / 2);     // hoops
      add(new THREE.TorusGeometry(0.59, 0.05, 6, 16), dark, 0, 1.08, -0.1, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.06, 0.06, 0.24, 8), dark, 0, 0.62, 0.52, Math.PI / 2); // the spigot
      add(new THREE.SphereGeometry(0.27, 10, 8), helmetMat, 0, 1.46, -0.1);                  // pilot down in the cask
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 6), dark, 0, 0.66, 0.68, Math.PI / 3); // steering column
      add(new THREE.TorusGeometry(0.2, 0.04, 6, 10), dark, 0, 0.82, 0.84, Math.PI / 2.4);
      lamp('head', 0, 0.4, 1.66, 0.2, 0.1);
      lamp('tail', 0, 0.5, -1.14, 0.2, 0.1);
      wheel(-0.7, 0.95, 1, 0.34, 0.3); wheel(0.7, 0.95, 1, 0.34, 0.3);
      wheel(-0.74, -0.85, 0, 0.4, 0.42); wheel(0.74, -0.85, 0, 0.4, 0.42);

    } else if (vehicle === 'longframe') {     // Twin-Engine Longframe: why
      weld(g, M, [
        ['c', 'dark', 0, 0.3, 0, 0.84, 0.2, 5.4],                  // THE frame — absurdly long
        ['c', 'paint', 0, 0.48, 0.15, 0.74, 0.28, 4.6],            // body strip
        ['w', 'paint', 0, 0.64, 2.25, 0.6, 0.18, 0.9],             // nose wedge
        ['c', 'dark', 0, 0.82, 1.45, 0.6, 0.44, 0.85],             // ENGINE ONE (front)
        ['q', 'dark', 0, 1.12, 1.45, 0.4, 0.24, 0.32, 2],          // scoop one
        ['w', 'glass', 0, 0.8, 0.4, 0.5, 0.26, 0.5],               // tiny screen
        ['q', 'paint', 0, 0.8, -0.5, 0.5, 0.3, 0.5],               // headrest curve
        ['c', 'dark', 0, 0.84, -1.3, 0.62, 0.48, 0.9],             // ENGINE TWO (behind the driver)
        ['q', 'dark', 0, 1.16, -1.3, 0.42, 0.26, 0.34, 2],         // scoop two
        ['c', 'dark', 0, 0.66, -2.5, 0.4, 0.3, 0.4],               // chute box
        ['c', 'dark', 0, 1.3, -2.2, 1.5, 0.07, 0.4],               // rear wing on tall struts
        ['c', 'dark', -0.6, 1.05, -2.2, 0.07, 0.45, 0.4],
        ['c', 'dark', 0.6, 1.05, -2.2, 0.07, 0.45, 0.4],
      ]);
      for (const sx of [-1, 1]) {                                   // zoomie stacks on BOTH engines
        add(new THREE.CylinderGeometry(0.045, 0.045, 0.4, 6), dark, sx * 0.36, 1.08, 1.25, 0, 0, sx * 0.5);
        add(new THREE.CylinderGeometry(0.045, 0.045, 0.4, 6), dark, sx * 0.38, 1.12, -1.5, 0, 0, sx * 0.5);
      }
      add(new THREE.SphereGeometry(0.27, 10, 8), helmetMat, 0, 0.94, 0.05); // driver squeezed between engines
      add(new THREE.BoxGeometry(0.06, 0.05, 0.9), dark, -0.2, 0.24, -3.0);  // wheelie bar
      add(new THREE.BoxGeometry(0.06, 0.05, 0.9), dark, 0.2, 0.24, -3.0);
      add(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 8), dark, 0, 0.14, -3.42, 0, 0, Math.PI / 2);
      lamp('head', -0.26, 0.52, 2.72, 0.18, 0.1); lamp('head', 0.26, 0.52, 2.72, 0.18, 0.1);
      lamp('tail', -0.26, 0.58, -2.72, 0.2, 0.1); lamp('tail', 0.26, 0.58, -2.72, 0.2, 0.1);
      wheel(-0.72, 2.3, 1, 0.34, 0.22); wheel(0.72, 2.3, 1, 0.34, 0.22);    // skinny fronts way out there
      wheel(-0.86, -2.05, 0, 0.6, 0.62); wheel(0.86, -2.05, 0, 0.6, 0.62);  // the meats

    } else if (vehicle === 'sofa') {          // The Sofa: comfort-first engineering
      weld(g, M, [
        ['c', 'dark', 0, 0.3, 0, 1.62, 0.24, 2.3],                 // go-frame under the couch
        ['c', 'paint', 0, 0.52, 0.3, 1.66, 0.34, 1.5],             // seat base
        ['c', 'paint', -0.42, 0.72, 0.05, 0.76, 0.2, 0.9],         // cushions (two, with the gap)
        ['c', 'paint', 0.42, 0.72, 0.05, 0.76, 0.2, 0.9],
        ['q', 'paint', -0.42, 0.72, 0.55, 0.76, 0.22, 0.5, 2],     // cushion front rolls
        ['q', 'paint', 0.42, 0.72, 0.55, 0.76, 0.22, 0.5, 2],
        ['c', 'paint', 0, 1.0, -0.65, 1.66, 0.75, 0.45],           // backrest
        ['q', 'paint', 0, 1.42, -0.62, 1.66, 0.26, 0.4],           // backrest top roll
        ['c', 'paint', -0.94, 0.85, 0, 0.3, 0.5, 1.5],             // armrests
        ['c', 'paint', 0.94, 0.85, 0, 0.3, 0.5, 1.5],
        ['q', 'paint', -0.94, 1.14, 0.6, 0.3, 0.18, 0.3, 2],       // armrest front rolls
        ['q', 'paint', 0.94, 1.14, 0.6, 0.3, 0.18, 0.3, 2],
        ['c', 'dark', 0, 0.62, -1.12, 1.0, 0.5, 0.5],              // engine strapped to the back
        ['c', 'dark', 0, 0.34, 0.95, 1.5, 0.14, 0.3],              // front step bumper
      ]);
      add(new THREE.CylinderGeometry(0.045, 0.045, 0.45, 6), dark, 0.35, 1.0, -1.3, Math.PI / 6);  // exhaust pipe
      add(new THREE.BoxGeometry(0.3, 0.05, 0.16), dark, -0.94, 1.13, 0.1);                         // TV remote on the armrest
      add(new THREE.CylinderGeometry(0.07, 0.05, 0.12, 8), toonMat(0xf4ecdd), 0.94, 1.17, 0.05);   // the mug
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), dark, 0, 0.75, 0.95, Math.PI / 3.2);     // steering column bolted on
      add(new THREE.TorusGeometry(0.19, 0.035, 6, 10), dark, 0, 0.92, 1.08, Math.PI / 2.5);
      add(new THREE.BoxGeometry(0.5, 0.55, 0.4), dark, 0, 1.0, -0.32);                             // couch-potato torso, leaned back
      add(new THREE.SphereGeometry(0.28, 10, 8), helmetMat, 0, 1.42, -0.28);
      lamp('head', -0.5, 0.42, 1.12, 0.16, 0.12); lamp('head', 0.5, 0.42, 1.12, 0.16, 0.12);       // taped-on flashlights
      lamp('tail', -0.6, 0.48, -1.38, 0.18, 0.1); lamp('tail', 0.6, 0.48, -1.38, 0.18, 0.1);
      wheel(-0.85, 0.85, 1, 0.32, 0.26); wheel(0.85, 0.85, 1, 0.32, 0.26);
      wheel(-0.85, -0.85, 0, 0.36, 0.3); wheel(0.85, -0.85, 0, 0.36, 0.3);

    } else if (vehicle === 'berlina') {       // Enginos Berlina M: the sports sedan (BMW M3 bones)
      weld(g, M, [
        ['c', 'dark', 0, 0.3, 0, 1.8, 0.18, 4.2],
        ['c', 'paint', 0, 0.58, 0, 1.92, 0.48, 4.4],
        ['w', 'paint', 0, 0.92, 1.5, 1.92, 0.18, 1.4],
        ['c', 'dark', 0, 1.0, -0.1, 1.5, 0.34, 2.0],
        ['w', 'glass', 0, 1.2, 0.78, 1.6, 0.4, 0.8],
        ['c', 'paint', 0, 1.3, -0.15, 1.62, 0.24, 1.5],
        ['w', 'paint', 0, 1.2, -1.05, 1.6, 0.4, 0.7, 2],
        ['c', 'paint', 0, 0.88, -1.85, 1.92, 0.26, 0.7],
        ['c', 'dark', 0, 1.03, -2.12, 1.6, 0.06, 0.25],
        ['a', 'paint', -0.96, 0.46, 1.45, 0.5, 1.12, 1.12],
        ['a', 'paint', 0.96, 0.46, 1.45, 0.5, 1.12, 1.12],
        ['a', 'paint', -0.96, 0.48, -1.45, 0.54, 1.16, 1.16],
        ['a', 'paint', 0.96, 0.48, -1.45, 0.54, 1.16, 1.16],
      ]);
      tooth(-0.2, 0.62, 2.19, 0.36, 0.28); tooth(0.2, 0.62, 2.19, 0.36, 0.28);
      add(new THREE.BoxGeometry(0.3, 0.22, 0.05), dark, -0.2, 0.62, 2.22);
      add(new THREE.BoxGeometry(0.3, 0.22, 0.05), dark, 0.2, 0.62, 2.22);
      squint(-0.56, 0.84, 2.215, 0.38, 0.05, -0.08); squint(0.56, 0.84, 2.215, 0.38, 0.05, 0.08);
      squint(-0.53, 0.77, 2.215, 0.3, 0.04, -0.08); squint(0.53, 0.77, 2.215, 0.3, 0.04, 0.08);
      lamp('head', -0.56, 0.7, 2.2); lamp('head', 0.56, 0.7, 2.2);
      lamp('tail', -0.6, 0.74, -2.19, 0.44, 0.1); lamp('tail', 0.6, 0.74, -2.19, 0.44, 0.1);
      wheel(-0.96, 1.45, 1, 0.46, 0.42); wheel(0.96, 1.45, 1, 0.46, 0.42);
      wheel(-0.96, -1.45, 0, 0.48, 0.46); wheel(0.96, -1.45, 0, 0.48, 0.46);

    } else if (vehicle === 'bavaria') {       // Enginos Bavaria GT: the autobahn liner
      weld(g, M, [
        ['c', 'dark', 0, 0.3, 0, 1.9, 0.18, 4.6],
        ['c', 'paint', 0, 0.56, 0, 2.05, 0.46, 4.8],
        ['w', 'paint', 0, 0.9, 1.65, 2.05, 0.18, 1.7],
        ['c', 'dark', 0, 0.96, -0.35, 1.6, 0.32, 2.0],
        ['w', 'glass', 0, 1.14, 0.55, 1.7, 0.4, 0.9],
        ['c', 'paint', 0, 1.24, -0.4, 1.72, 0.22, 1.4],
        ['q', 'paint', 0, 1.14, -1.15, 1.72, 0.42, 0.75],
        ['q', 'paint', 0, 0.82, -1.95, 2.05, 0.28, 0.5],
        ['c', 'dark', 0, 0.98, -2.25, 1.7, 0.06, 0.3],
        ['a', 'paint', -1.02, 0.46, 1.55, 0.52, 1.14, 1.14],
        ['a', 'paint', 1.02, 0.46, 1.55, 0.52, 1.14, 1.14],
        ['a', 'paint', -1.02, 0.5, -1.55, 0.56, 1.2, 1.2],
        ['a', 'paint', 1.02, 0.5, -1.55, 0.56, 1.2, 1.2],
      ]);
      tooth(-0.24, 0.58, 2.39, 0.44, 0.32); tooth(0.24, 0.58, 2.39, 0.44, 0.32);
      add(new THREE.BoxGeometry(0.38, 0.26, 0.05), dark, -0.24, 0.58, 2.42);
      add(new THREE.BoxGeometry(0.38, 0.26, 0.05), dark, 0.24, 0.58, 2.42);
      squint(-0.64, 0.8, 2.415, 0.42, 0.05, -0.06); squint(0.64, 0.8, 2.415, 0.42, 0.05, 0.06);
      lamp('head', -0.64, 0.68, 2.4); lamp('head', 0.64, 0.68, 2.4);
      lamp('tail', -0.66, 0.7, -2.39, 0.46, 0.1); lamp('tail', 0.66, 0.7, -2.39, 0.46, 0.1);
      wheel(-1.02, 1.55, 1, 0.48, 0.44); wheel(1.02, 1.55, 1, 0.48, 0.44);
      wheel(-1.02, -1.55, 0, 0.5, 0.48); wheel(1.02, -1.55, 0, 0.5, 0.48);

    } else if (vehicle === 'piccola') {       // Enginos Piccola 02: the classic shoebox
      weld(g, M, [
        ['c', 'paint', 0, 0.56, 0, 1.7, 0.44, 3.6],
        ['c', 'dark', 0, 0.98, -0.1, 1.4, 0.3, 1.7],
        ['w', 'glass', 0, 1.14, 0.62, 1.5, 0.36, 0.6],
        ['c', 'paint', 0, 1.24, -0.12, 1.54, 0.22, 1.2],
        ['w', 'paint', 0, 1.14, -0.85, 1.5, 0.36, 0.55, 2],
        ['c', 'paint', 0, 0.86, 1.55, 1.7, 0.16, 0.5],
        ['a', 'paint', -0.86, 0.44, 1.2, 0.46, 1.06, 1.06],
        ['a', 'paint', 0.86, 0.44, 1.2, 0.46, 1.06, 1.06],
        ['a', 'paint', -0.86, 0.44, -1.2, 0.48, 1.08, 1.08],
        ['a', 'paint', 0.86, 0.44, -1.2, 0.48, 1.08, 1.08],
      ]);
      tooth(0, 0.44, 1.82, 1.75, 0.09); tooth(0, 0.44, -1.82, 1.75, 0.09);           // chrome bumpers
      tooth(-0.13, 0.68, 1.81, 0.2, 0.18); tooth(0.13, 0.68, 1.81, 0.2, 0.18);       // baby kidneys
      add(new THREE.BoxGeometry(0.15, 0.13, 0.05), dark, -0.13, 0.68, 1.84);
      add(new THREE.BoxGeometry(0.15, 0.13, 0.05), dark, 0.13, 0.68, 1.84);
      eye(-0.55, 0.7, 1.82, 0.11); eye(0.55, 0.7, 1.82, 0.11);                       // classic round lamps
      lamp('head', -0.55, 0.7, 1.8, 0.2, 0.2); lamp('head', 0.55, 0.7, 1.8, 0.2, 0.2);
      lamp('tail', -0.55, 0.68, -1.81, 0.3, 0.1); lamp('tail', 0.55, 0.68, -1.81, 0.3, 0.1);
      wheel(-0.86, 1.2, 1, 0.42, 0.36); wheel(0.86, 1.2, 1, 0.42, 0.36);
      wheel(-0.86, -1.2, 0, 0.42, 0.38); wheel(0.86, -1.2, 0, 0.42, 0.38);

    } else if (vehicle === 'duke') {          // Houndsborough Duke: the land yacht
      weld(g, M, [
        ['c', 'dark', 0, 0.28, 0, 1.95, 0.16, 4.8],
        ['c', 'paint', 0, 0.56, 0, 2.1, 0.44, 5.0],
        ['c', 'paint', 0, 0.86, 1.3, 2.05, 0.18, 2.0],
        ['c', 'dark', 0, 0.96, -0.55, 1.6, 0.32, 1.7],
        ['w', 'glass', 0, 1.14, 0.3, 1.7, 0.4, 0.75],
        ['c', 'paint', 0, 1.24, -0.6, 1.74, 0.24, 1.3],
        ['w', 'paint', 0, 1.14, -1.35, 1.7, 0.4, 0.6, 2],
        ['c', 'paint', 0, 0.86, -2.0, 2.05, 0.22, 0.9],
        ['c', 'paint', -0.92, 0.98, -2.35, 0.18, 0.22, 0.3],   // tail fins
        ['c', 'paint', 0.92, 0.98, -2.35, 0.18, 0.22, 0.3],
        ['a', 'paint', -1.04, 0.46, 1.6, 0.5, 1.1, 1.1],
        ['a', 'paint', 1.04, 0.46, 1.6, 0.5, 1.1, 1.1],
        ['a', 'paint', -1.04, 0.46, -1.6, 0.52, 1.12, 1.12],
        ['a', 'paint', 1.04, 0.46, -1.6, 0.52, 1.12, 1.12],
      ]);
      tooth(0, 0.42, 2.52, 2.1, 0.12); tooth(0, 0.42, -2.52, 2.1, 0.12);             // chrome bumpers
      squint(-0.94, 0.74, 2.5, 0.055, 0.44, 0); squint(0.94, 0.74, 2.5, 0.055, 0.44, 0);
      tooth(0, 0.68, 2.49, 1.5, 0.4);
      add(new THREE.BoxGeometry(1.38, 0.32, 0.05), dark, 0, 0.68, 2.53);
      tooth(0, 0.68, 2.56, 1.2, 0.04);
      lamp('head', -0.62, 0.68, 2.51, 0.26, 0.1); lamp('head', 0.62, 0.68, 2.51, 0.26, 0.1);
      lamp('tail', -0.92, 0.92, -2.51, 0.1, 0.24); lamp('tail', 0.92, 0.92, -2.51, 0.1, 0.24);
      wheel(-1.04, 1.6, 1, 0.46, 0.4); wheel(1.04, 1.6, 1, 0.46, 0.4);
      wheel(-1.04, -1.6, 0, 0.46, 0.42); wheel(1.04, -1.6, 0, 0.46, 0.42);

    } else if (vehicle === 'chief') {         // Houndsborough Chief: the executive fortress
      weld(g, M, [
        ['c', 'dark', 0, 0.34, 0, 1.95, 0.24, 4.4],
        ['c', 'paint', 0, 0.72, 0, 2.05, 0.6, 4.6],
        ['c', 'paint', 0, 1.06, 1.5, 2.05, 0.2, 1.4],
        ['c', 'dark', 0, 1.35, -0.35, 1.7, 0.55, 3.3],
        ['w', 'glass', 0, 1.52, 1.15, 1.78, 0.42, 0.6],
        ['c', 'paint', 0, 1.72, -0.4, 1.82, 0.24, 3.1],
        ['c', 'dark', -0.96, 0.44, 0.15, 0.14, 0.1, 2.6],      // running boards
        ['c', 'dark', 0.96, 0.44, 0.15, 0.14, 0.1, 2.6],
        ['c', 'dark', 0, 1.9, -0.3, 1.4, 0.06, 2.6],           // roof rack
        ['a', 'paint', -1.0, 0.52, 1.5, 0.56, 1.22, 1.22],
        ['a', 'paint', 1.0, 0.52, 1.5, 0.56, 1.22, 1.22],
        ['a', 'paint', -1.0, 0.52, -1.5, 0.56, 1.22, 1.22],
        ['a', 'paint', 1.0, 0.52, -1.5, 0.56, 1.22, 1.22],
      ]);
      squint(-0.9, 0.95, 2.31, 0.06, 0.6, 0); squint(0.9, 0.95, 2.31, 0.06, 0.6, 0);
      tooth(0, 0.92, 2.3, 1.5, 0.55);
      add(new THREE.BoxGeometry(1.36, 0.45, 0.05), dark, 0, 0.92, 2.34);
      tooth(0, 0.92, 2.37, 1.2, 0.05);
      lamp('head', -0.6, 1.18, 2.32, 0.3, 0.1); lamp('head', 0.6, 1.18, 2.32, 0.3, 0.1);
      lamp('tail', -0.9, 1.0, -2.31, 0.1, 0.4); lamp('tail', 0.9, 1.0, -2.31, 0.1, 0.4);
      wheel(-1.0, 1.5, 1, 0.54, 0.5); wheel(1.0, 1.5, 1, 0.54, 0.5);
      wheel(-1.0, -1.5, 0, 0.54, 0.5); wheel(1.0, -1.5, 0, 0.54, 0.5);

    } else if (vehicle === 'sturm') {         // Heiligen Sturm: the winged rally sedan
      weld(g, M, [
        ['c', 'dark', 0, 0.3, 0, 1.82, 0.18, 4.1],
        ['c', 'paint', 0, 0.58, 0, 1.94, 0.5, 4.3],
        ['w', 'paint', 0, 0.94, 1.45, 1.94, 0.18, 1.35],
        ['c', 'dark', 0, 1.28, 1.35, 0.52, 0.13, 0.55],        // THE hood scoop
        ['c', 'dark', 0, 1.0, -0.1, 1.52, 0.34, 1.9],
        ['w', 'glass', 0, 1.2, 0.72, 1.6, 0.4, 0.75],
        ['c', 'paint', 0, 1.3, -0.15, 1.64, 0.24, 1.45],
        ['w', 'paint', 0, 1.2, -1.0, 1.6, 0.4, 0.65, 2],
        ['c', 'paint', 0, 0.9, -1.8, 1.94, 0.26, 0.7],
        ['c', 'paint', -0.8, 1.12, -1.95, 0.1, 0.35, 0.4],     // wing struts
        ['c', 'paint', 0.8, 1.12, -1.95, 0.1, 0.35, 0.4],
        ['c', 'dark', 0, 1.34, -1.98, 1.9, 0.09, 0.45],        // THE wing
        ['a', 'dark', -0.95, 0.48, 1.42, 0.54, 1.18, 1.18],
        ['a', 'dark', 0.95, 0.48, 1.42, 0.54, 1.18, 1.18],
        ['a', 'dark', -0.95, 0.48, -1.42, 0.54, 1.18, 1.18],
        ['a', 'dark', 0.95, 0.48, -1.42, 0.54, 1.18, 1.18],
      ]);
      add(new THREE.BoxGeometry(0.86, 0.26, 0.05), dark, 0, 0.6, 2.16);
      tooth(0, 0.76, 2.16, 0.9, 0.04);
      squint(-0.56, 0.9, 2.16, 0.34, 0.06, -0.22); squint(0.56, 0.9, 2.16, 0.34, 0.06, 0.22);
      lamp('head', -0.56, 0.78, 2.15); lamp('head', 0.56, 0.78, 2.15);
      lamp('tail', -0.6, 0.9, -2.16, 0.4, 0.1); lamp('tail', 0.6, 0.9, -2.16, 0.4, 0.1);
      wheel(-0.95, 1.42, 1, 0.48, 0.44); wheel(0.95, 1.42, 1, 0.48, 0.44);
      wheel(-0.95, -1.42, 0, 0.48, 0.46); wheel(0.95, -1.42, 0, 0.48, 0.46);

    } else if (vehicle === 'wald') {          // Heiligen Wald: the lifted forest wagon
      weld(g, M, [
        ['c', 'dark', 0, 0.4, 0, 1.9, 0.26, 4.3],              // tall cladding
        ['c', 'paint', 0, 0.72, 0, 1.94, 0.44, 4.5],
        ['w', 'paint', 0, 1.04, 1.55, 1.94, 0.18, 1.3],
        ['c', 'dark', 0, 1.14, -0.35, 1.56, 0.36, 2.9],
        ['w', 'glass', 0, 1.34, 1.0, 1.62, 0.4, 0.7],
        ['c', 'paint', 0, 1.44, -0.45, 1.66, 0.22, 2.9],       // wagon roof, all the way back
        ['c', 'dark', 0, 1.6, -0.4, 1.3, 0.06, 2.5],           // rails
        ['a', 'dark', -0.96, 0.56, 1.45, 0.58, 1.24, 1.24],
        ['a', 'dark', 0.96, 0.56, 1.45, 0.58, 1.24, 1.24],
        ['a', 'dark', -0.96, 0.56, -1.45, 0.58, 1.24, 1.24],
        ['a', 'dark', 0.96, 0.56, -1.45, 0.58, 1.24, 1.24],
      ]);
      add(new THREE.BoxGeometry(0.84, 0.24, 0.05), dark, 0, 0.74, 2.26);
      tooth(0, 0.89, 2.26, 0.88, 0.04);
      squint(-0.56, 1.02, 2.26, 0.32, 0.06, -0.2); squint(0.56, 1.02, 2.26, 0.32, 0.06, 0.2);
      lamp('head', -0.56, 0.9, 2.25); lamp('head', 0.56, 0.9, 2.25);
      lamp('tail', -0.6, 1.0, -2.26, 0.4, 0.1); lamp('tail', 0.6, 1.0, -2.26, 0.4, 0.1);
      wheel(-0.96, 1.45, 1, 0.52, 0.46); wheel(0.96, 1.45, 1, 0.52, 0.46);
      wheel(-0.96, -1.45, 0, 0.52, 0.48); wheel(0.96, -1.45, 0, 0.52, 0.48);

    } else if (vehicle === 'stallion') {      // Norte Stallion GT3: the rebrand, full send
      weld(g, M, [
        ['c', 'dark', 0, 0.26, 0.4, 2.1, 0.14, 3.9],
        ['c', 'dark', 0, 0.3, 2.35, 2.2, 0.08, 0.5],           // splitter lip
        ['c', 'paint', 0, 0.56, 0.1, 2.0, 0.46, 4.5],
        ['w', 'paint', 0, 0.9, 1.45, 2.0, 0.18, 1.6],
        ['c', 'dark', 0, 1.0, -0.35, 1.55, 0.34, 1.8],
        ['w', 'glass', 0, 1.2, 0.45, 1.62, 0.42, 0.75],
        ['c', 'paint', 0, 1.28, -0.4, 1.66, 0.24, 1.2],
        ['q', 'paint', 0, 1.18, -1.15, 1.66, 0.42, 0.7],
        ['c', 'paint', 0, 0.86, -1.85, 2.0, 0.26, 0.7],
        ['c', 'paint', -0.65, 1.42, -1.85, 0.09, 0.5, 0.3],    // swan-neck struts
        ['c', 'paint', 0.65, 1.42, -1.85, 0.09, 0.5, 0.3],
        ['c', 'dark', 0, 1.62, -1.95, 2.1, 0.08, 0.55],        // THE wing
        ['c', 'dark', -1.04, 1.36, -1.95, 0.07, 0.45, 0.55],
        ['c', 'dark', 1.04, 1.36, -1.95, 0.07, 0.45, 0.55],
        ['a', 'paint', -1.06, 0.48, 1.45, 0.56, 1.3, 1.3],     // GT3 box flares
        ['a', 'paint', 1.06, 0.48, 1.45, 0.56, 1.3, 1.3],
        ['a', 'paint', -1.06, 0.5, -1.45, 0.6, 1.34, 1.34],
        ['a', 'paint', 1.06, 0.5, -1.45, 0.6, 1.34, 1.34],
      ]);
      for (const sx of [-1, 1]) for (let b = 0; b < 3; b++)
        squint(sx * (0.46 + b * 0.11), 0.78, 2.36, 0.06, 0.2, 0);                    // tri-bar lamps
      add(new THREE.BoxGeometry(1.3, 0.26, 0.05), dark, 0, 0.5, 2.36);
      lamp('head', -0.58, 0.78, 2.34, 0.34, 0.22); lamp('head', 0.58, 0.78, 2.34, 0.34, 0.22);
      lamp('tail', -0.7, 0.86, -2.21, 0.4, 0.12); lamp('tail', 0.7, 0.86, -2.21, 0.4, 0.12);
      wheel(-1.06, 1.45, 1, 0.5, 0.5); wheel(1.06, 1.45, 1, 0.5, 0.5);
      wheel(-1.06, -1.45, 0, 0.52, 0.54); wheel(1.06, -1.45, 0, 0.52, 0.54);

    } else if (vehicle === 'potro') {         // Norte Potro: the street fastback
      weld(g, M, [
        ['c', 'dark', 0, 0.3, 0.1, 1.86, 0.18, 4.4],
        ['c', 'paint', 0, 0.58, 0.1, 1.98, 0.5, 4.6],
        ['w', 'paint', 0, 0.94, 1.4, 1.98, 0.18, 1.7],
        ['c', 'dark', 0, 1.0, -0.4, 1.52, 0.34, 1.6],
        ['w', 'glass', 0, 1.2, 0.4, 1.58, 0.42, 0.72],
        ['c', 'paint', 0, 1.28, -0.45, 1.62, 0.24, 1.1],
        ['q', 'paint', 0, 1.14, -1.3, 1.62, 0.44, 0.95],       // the long fastback
        ['c', 'dark', 0, 0.98, -2.22, 1.7, 0.07, 0.3],
        ['a', 'paint', -0.98, 0.48, 1.45, 0.52, 1.16, 1.16],
        ['a', 'paint', 0.98, 0.48, 1.45, 0.52, 1.16, 1.16],
        ['a', 'paint', -0.98, 0.5, -1.45, 0.56, 1.22, 1.22],
        ['a', 'paint', 0.98, 0.5, -1.45, 0.56, 1.22, 1.22],
      ]);
      for (const sx of [-1, 1]) for (let b = 0; b < 3; b++)
        squint(sx * (0.48 + b * 0.1), 0.74, 2.41, 0.055, 0.17, 0);
      add(new THREE.BoxGeometry(1.2, 0.24, 0.05), dark, 0, 0.5, 2.41);
      lamp('head', -0.58, 0.74, 2.39, 0.32, 0.2); lamp('head', 0.58, 0.74, 2.39, 0.32, 0.2);
      lamp('tail', -0.62, 0.8, -2.37, 0.44, 0.12); lamp('tail', 0.62, 0.8, -2.37, 0.44, 0.12);
      wheel(-0.98, 1.45, 1, 0.48, 0.44); wheel(0.98, 1.45, 1, 0.48, 0.44);
      wheel(-0.98, -1.45, 0, 0.5, 0.5); wheel(0.98, -1.45, 0, 0.5, 0.5);

    } else if (vehicle === 'garra') {         // Granada Garra: the mid-engine claw
      weld(g, M, [
        ['c', 'dark', 0, 0.26, 0, 1.9, 0.14, 4.2],
        ['c', 'paint', 0, 0.5, 0.3, 1.9, 0.36, 3.9],
        ['w', 'paint', 0, 0.74, 1.5, 1.85, 0.16, 1.3],         // low shark nose
        ['c', 'dark', 0, 0.82, 0.45, 1.3, 0.3, 1.5],           // cab forward
        ['w', 'glass', 0, 0.96, 1.05, 1.4, 0.34, 0.7],
        ['q', 'paint', 0, 0.92, -0.25, 1.44, 0.34, 0.85],      // teardrop roofline
        ['c', 'dark', -0.88, 0.62, -0.6, 0.22, 0.28, 0.9],     // side intakes
        ['c', 'dark', 0.88, 0.62, -0.6, 0.22, 0.28, 0.9],
        ['w', 'paint', 0, 0.68, -1.45, 1.9, 0.24, 1.0, 2],     // engine deck taper
        ['c', 'dark', 0, 0.4, -2.0, 1.7, 0.2, 0.35],           // diffuser
        ['a', 'paint', -0.96, 0.44, 1.4, 0.5, 1.14, 1.14],
        ['a', 'paint', 0.96, 0.44, 1.4, 0.5, 1.14, 1.14],
        ['a', 'paint', -0.96, 0.46, -1.35, 0.54, 1.2, 1.2],
        ['a', 'paint', 0.96, 0.46, -1.35, 0.54, 1.2, 1.2],
      ]);
      squint(-0.52, 0.64, 2.09, 0.24, 0.05, -0.5); squint(0.52, 0.64, 2.09, 0.24, 0.05, 0.5);
      squint(-0.62, 0.53, 2.09, 0.14, 0.045, -1.1); squint(0.62, 0.53, 2.09, 0.14, 0.045, 1.1);
      add(new THREE.BoxGeometry(0.7, 0.14, 0.05), dark, 0, 0.42, 2.1);
      lamp('head', -0.52, 0.56, 2.07, 0.26, 0.12); lamp('head', 0.52, 0.56, 2.07, 0.26, 0.12);
      lamp('tail', -0.6, 0.72, -2.12, 0.34, 0.1); lamp('tail', 0.6, 0.72, -2.12, 0.34, 0.1);
      wheel(-0.96, 1.4, 1, 0.46, 0.42); wheel(0.96, 1.4, 1, 0.46, 0.42);
      wheel(-0.96, -1.35, 0, 0.48, 0.48); wheel(0.96, -1.35, 0, 0.48, 0.48);

    } else if (vehicle === 'flecha') {        // Granada Flecha: the arrow — hyper GT, endless tail
      weld(g, M, [
        ['c', 'dark', 0, 0.26, -0.2, 1.8, 0.14, 4.9],
        ['c', 'paint', 0, 0.5, 0.5, 1.85, 0.36, 3.6],
        ['w', 'paint', 0, 0.74, 1.75, 1.8, 0.16, 1.4],
        ['c', 'dark', 0, 0.84, 0.7, 1.1, 0.3, 1.4],            // slim center canopy
        ['w', 'glass', 0, 0.98, 1.3, 1.16, 0.32, 0.65],
        ['q', 'paint', 0, 0.94, 0.05, 1.2, 0.34, 0.9],
        ['w', 'paint', 0, 0.6, -1.5, 1.85, 0.3, 2.4, 2],       // the LONG tail taper
        ['c', 'dark', 0, 0.36, -2.6, 1.4, 0.14, 0.3],
        ['a', 'paint', -0.9, 0.44, 1.55, 0.5, 1.12, 1.12],
        ['a', 'paint', 0.9, 0.44, 1.55, 0.5, 1.12, 1.12],
        ['a', 'paint', -0.9, 0.46, -1.1, 0.54, 1.18, 1.18],
        ['a', 'paint', 0.9, 0.46, -1.1, 0.54, 1.18, 1.18],
      ]);
      squint(-0.48, 0.66, 2.44, 0.22, 0.05, -0.5); squint(0.48, 0.66, 2.44, 0.22, 0.05, 0.5);
      squint(-0.58, 0.55, 2.44, 0.13, 0.04, -1.1); squint(0.58, 0.55, 2.44, 0.13, 0.04, 1.1);
      add(new THREE.BoxGeometry(0.6, 0.12, 0.05), dark, 0, 0.44, 2.45);
      lamp('head', -0.48, 0.58, 2.42, 0.24, 0.1); lamp('head', 0.48, 0.58, 2.42, 0.24, 0.1);
      lamp('tail', 0, 0.56, -2.72, 0.5, 0.08);
      wheel(-0.9, 1.55, 1, 0.44, 0.4); wheel(0.9, 1.55, 1, 0.44, 0.4);
      wheel(-0.9, -1.1, 0, 0.48, 0.46); wheel(0.9, -1.1, 0, 0.48, 0.46);

    } else if (vehicle === 'anvil') {         // Braewick Anvil: the fast box
      weld(g, M, [
        ['c', 'dark', 0, 0.3, 0, 1.88, 0.18, 4.3],
        ['c', 'paint', 0, 0.58, 0, 1.98, 0.48, 4.5],
        ['w', 'paint', 0, 0.94, 1.5, 1.98, 0.16, 1.3],
        ['c', 'dark', 0, 1.02, -0.3, 1.56, 0.34, 2.7],
        ['w', 'glass', 0, 1.22, 0.95, 1.64, 0.38, 0.68],
        ['c', 'paint', 0, 1.3, -0.4, 1.68, 0.22, 2.7],         // wagon roof
        ['c', 'dark', 0, 1.46, -0.35, 1.3, 0.05, 2.3],
        ['w', 'paint', 0, 1.16, -1.85, 1.68, 0.36, 0.4, 2],    // chopped tail
        ['a', 'paint', -1.0, 0.48, 1.42, 0.56, 1.24, 1.24],    // quattro blisters
        ['a', 'paint', 1.0, 0.48, 1.42, 0.56, 1.24, 1.24],
        ['a', 'paint', -1.0, 0.5, -1.42, 0.58, 1.26, 1.26],
        ['a', 'paint', 1.0, 0.5, -1.42, 0.58, 1.26, 1.26],
      ]);
      add(new THREE.BoxGeometry(0.72, 0.42, 0.05), dark, 0, 0.62, 2.26);             // single-frame grille
      tooth(0, 0.62, 2.24, 0.78, 0.46);
      squint(-0.62, 0.88, 2.26, 0.4, 0.045, 0); squint(0.62, 0.88, 2.26, 0.4, 0.045, 0);  // matrix strips
      lamp('head', -0.62, 0.8, 2.25); lamp('head', 0.62, 0.8, 2.25);
      lamp('tail', -0.62, 0.88, -2.26, 0.42, 0.1); lamp('tail', 0.62, 0.88, -2.26, 0.42, 0.1);
      wheel(-1.0, 1.42, 1, 0.48, 0.46); wheel(1.0, 1.42, 1, 0.48, 0.46);
      wheel(-1.0, -1.42, 0, 0.48, 0.48); wheel(1.0, -1.42, 0, 0.48, 0.48);

    } else if (vehicle === 'torr') {          // Braewick Torr: the mid-engine monolith
      weld(g, M, [
        ['c', 'dark', 0, 0.26, 0, 1.92, 0.14, 4.1],
        ['c', 'paint', 0, 0.52, 0.2, 1.96, 0.4, 3.9],
        ['w', 'paint', 0, 0.78, 1.4, 1.9, 0.16, 1.2],
        ['c', 'dark', 0, 0.88, 0.3, 1.4, 0.32, 1.6],
        ['w', 'glass', 0, 1.04, 0.95, 1.48, 0.36, 0.65],
        ['q', 'paint', 0, 0.98, -0.35, 1.5, 0.34, 0.8],
        ['c', 'dark', -0.93, 0.7, -0.5, 0.12, 0.34, 1.1],      // THE sideblades
        ['c', 'dark', 0.93, 0.7, -0.5, 0.12, 0.34, 1.1],
        ['w', 'paint', 0, 0.72, -1.5, 1.96, 0.26, 0.9, 2],
        ['c', 'dark', 0, 0.4, -1.98, 1.75, 0.2, 0.35],
        ['a', 'paint', -0.98, 0.46, 1.35, 0.52, 1.18, 1.18],
        ['a', 'paint', 0.98, 0.46, 1.35, 0.52, 1.18, 1.18],
        ['a', 'paint', -0.98, 0.48, -1.35, 0.56, 1.22, 1.22],
        ['a', 'paint', 0.98, 0.48, -1.35, 0.56, 1.22, 1.22],
      ]);
      add(new THREE.BoxGeometry(0.78, 0.34, 0.05), dark, 0, 0.56, 2.06);
      tooth(0, 0.56, 2.04, 0.84, 0.38);
      squint(-0.58, 0.8, 2.06, 0.36, 0.045, -0.06); squint(0.58, 0.8, 2.06, 0.36, 0.045, 0.06);
      lamp('head', -0.58, 0.72, 2.05); lamp('head', 0.58, 0.72, 2.05);
      lamp('tail', -0.58, 0.76, -2.08, 0.4, 0.1); lamp('tail', 0.58, 0.76, -2.08, 0.4, 0.1);
      wheel(-0.98, 1.35, 1, 0.46, 0.44); wheel(0.98, 1.35, 1, 0.46, 0.44);
      wheel(-0.98, -1.35, 0, 0.48, 0.5); wheel(0.98, -1.35, 0, 0.48, 0.5);

    } else if (vehicle === 'tamsau') {        // Đồi Tám-Sáu: the drift shoebox, pop-ups included
      weld(g, M, [
        ['c', 'dark', 0, 0.28, 0, 1.72, 0.16, 3.8],
        ['c', 'paint', 0, 0.54, 0, 1.82, 0.42, 4.0],
        ['w', 'paint', 0, 0.84, 1.35, 1.82, 0.16, 1.3],        // wedge hood
        ['c', 'paint', -0.5, 0.94, 1.15, 0.34, 0.08, 0.3],     // POP-UPS, up
        ['c', 'paint', 0.5, 0.94, 1.15, 0.34, 0.08, 0.3],
        ['c', 'dark', 0, 0.96, -0.3, 1.46, 0.32, 1.8],
        ['w', 'glass', 0, 1.14, 0.55, 1.52, 0.36, 0.62],
        ['c', 'paint', 0, 1.22, -0.35, 1.56, 0.22, 1.25],
        ['w', 'paint', 0, 1.12, -1.15, 1.52, 0.36, 0.6, 2],
        ['c', 'paint', 0, 0.82, -1.75, 1.82, 0.22, 0.5],
        ['c', 'dark', 0, 0.94, -1.99, 1.5, 0.06, 0.22],
        ['c', 'dark', 0, 0.36, 2.02, 1.85, 0.14, 0.2],         // chin lip
        ['a', 'paint', -0.88, 0.44, 1.25, 0.48, 1.1, 1.1],
        ['a', 'paint', 0.88, 0.44, 1.25, 0.48, 1.1, 1.1],
        ['a', 'paint', -0.88, 0.44, -1.25, 0.5, 1.12, 1.12],
        ['a', 'paint', 0.88, 0.44, -1.25, 0.5, 1.12, 1.12],
      ]);
      lamp('head', -0.5, 0.96, 1.32, 0.3, 0.08); lamp('head', 0.5, 0.96, 1.32, 0.3, 0.08); // in the pop-ups
      add(new THREE.BoxGeometry(1.1, 0.14, 0.05), dark, 0, 0.56, 2.01);              // trapezoid mouth
      lamp('tail', -0.55, 0.8, -2.01, 0.38, 0.1); lamp('tail', 0.55, 0.8, -2.01, 0.38, 0.1);
      wheel(-0.88, 1.25, 1, 0.42, 0.38); wheel(0.88, 1.25, 1, 0.42, 0.38);
      wheel(-0.88, -1.25, 0, 0.44, 0.42); wheel(0.88, -1.25, 0, 0.44, 0.42);

    } else if (vehicle === 'trau') {          // Đồi Trâu: the buffalo — indestructible pickup
      weld(g, M, [
        ['c', 'dark', 0, 0.4, 0, 1.9, 0.28, 4.5],
        ['c', 'paint', 0, 0.74, 0.9, 1.95, 0.5, 2.7],          // cab-forward body
        ['w', 'paint', 0, 1.08, 1.7, 1.95, 0.18, 1.0],
        ['c', 'dark', 0, 1.2, 0.55, 1.6, 0.4, 1.3],
        ['w', 'glass', 0, 1.42, 1.15, 1.66, 0.4, 0.55],
        ['c', 'paint', 0, 1.52, 0.45, 1.7, 0.22, 1.15],
        ['c', 'paint', 0, 0.62, -1.35, 1.95, 0.34, 1.8],       // the bed
        ['c', 'paint', -0.85, 0.9, -1.35, 0.16, 0.24, 1.8],    // bed walls
        ['c', 'paint', 0.85, 0.9, -1.35, 0.16, 0.24, 1.8],
        ['c', 'paint', 0, 0.9, -2.18, 1.7, 0.24, 0.14],        // tailgate
        ['c', 'dark', 0, 0.52, 2.32, 2.0, 0.24, 0.24],         // bull bumper
        ['a', 'dark', -0.98, 0.54, 1.45, 0.6, 1.26, 1.26],
        ['a', 'dark', 0.98, 0.54, 1.45, 0.6, 1.26, 1.26],
        ['a', 'dark', -0.98, 0.54, -1.45, 0.6, 1.26, 1.26],
        ['a', 'dark', 0.98, 0.54, -1.45, 0.6, 1.26, 1.26],
      ]);
      add(new THREE.BoxGeometry(1.1, 0.3, 0.05), dark, 0, 0.98, 2.26);               // trapezoid grille
      tooth(0, 0.98, 2.29, 0.9, 0.05);
      lamp('head', -0.68, 0.98, 2.26, 0.28, 0.16); lamp('head', 0.68, 0.98, 2.26, 0.28, 0.16);
      lamp('tail', -0.72, 0.92, -2.26, 0.24, 0.16); lamp('tail', 0.72, 0.92, -2.26, 0.24, 0.16);
      wheel(-0.98, 1.45, 1, 0.54, 0.48); wheel(0.98, 1.45, 1, 0.54, 0.48);
      wheel(-0.98, -1.45, 0, 0.54, 0.5); wheel(0.98, -1.45, 0, 0.54, 0.5);

    } else if (vehicle === 'tahti') {         // Hilja Tähti: the star — silence at 300
      weld(g, M, [
        ['c', 'dark', 0, 0.3, 0, 1.95, 0.18, 4.7],
        ['c', 'paint', 0, 0.58, 0, 2.05, 0.48, 4.9],
        ['w', 'paint', 0, 0.94, 1.7, 2.05, 0.16, 1.5],
        ['c', 'dark', 0, 1.0, -0.15, 1.62, 0.34, 2.3],
        ['w', 'glass', 0, 1.2, 0.95, 1.7, 0.4, 0.85],
        ['q', 'paint', 0, 1.18, 0.3, 1.74, 0.34, 0.6, 2],      // soft cabin front
        ['c', 'paint', 0, 1.32, -0.35, 1.74, 0.22, 1.4],
        ['q', 'paint', 0, 1.2, -1.25, 1.74, 0.4, 0.7],
        ['c', 'paint', 0, 0.88, -2.05, 2.05, 0.26, 0.8],
        ['a', 'paint', -1.02, 0.46, 1.55, 0.52, 1.14, 1.14],
        ['a', 'paint', 1.02, 0.46, 1.55, 0.52, 1.14, 1.14],
        ['a', 'paint', -1.02, 0.48, -1.55, 0.54, 1.18, 1.18],
        ['a', 'paint', 1.02, 0.48, -1.55, 0.54, 1.18, 1.18],
      ]);
      add(new THREE.BoxGeometry(1.0, 0.34, 0.05), dark, 0, 0.66, 2.45);              // the louver grille
      tooth(0, 0.58, 2.48, 0.9, 0.035); tooth(0, 0.66, 2.48, 0.9, 0.035); tooth(0, 0.74, 2.48, 0.9, 0.035);
      tooth(0, 0.66, 2.45, 1.06, 0.38);
      squint(-0.66, 0.8, 2.45, 0.34, 0.05, -0.1); squint(0.66, 0.8, 2.45, 0.34, 0.05, 0.1);
      lamp('head', -0.66, 0.72, 2.44, 0.3, 0.12); lamp('head', 0.66, 0.72, 2.44, 0.3, 0.12);
      lamp('tail', -0.68, 0.76, -2.44, 0.44, 0.1); lamp('tail', 0.68, 0.76, -2.44, 0.44, 0.1);
      wheel(-1.02, 1.55, 1, 0.48, 0.42); wheel(1.02, 1.55, 1, 0.48, 0.42);
      wheel(-1.02, -1.55, 0, 0.48, 0.44); wheel(1.02, -1.55, 0, 0.48, 0.44);

    } else if (vehicle === 'lumi') {          // Hilja Lumi: the snow box — geometry refuses to age
      weld(g, M, [
        ['c', 'dark', 0, 0.42, 0, 1.9, 0.3, 4.1],
        ['c', 'paint', 0, 0.82, 0, 1.94, 0.55, 4.3],
        ['c', 'dark', 0, 1.32, -0.2, 1.72, 0.5, 3.1],
        ['c', 'glass', 0, 1.44, 1.32, 1.78, 0.34, 0.1],        // FLAT upright windshield
        ['c', 'paint', 0, 1.62, -0.2, 1.86, 0.18, 3.3],
        ['c', 'paint', 0, 1.06, 1.9, 1.94, 0.3, 0.5],          // flat nose
        ['c', 'dark', -0.9, 0.56, 0.1, 0.14, 0.1, 2.8],
        ['c', 'dark', 0.9, 0.56, 0.1, 0.14, 0.1, 2.8],
        ['a', 'dark', -0.96, 0.56, 1.4, 0.6, 1.24, 1.24],
        ['a', 'dark', 0.96, 0.56, 1.4, 0.6, 1.24, 1.24],
        ['a', 'dark', -0.96, 0.56, -1.4, 0.6, 1.24, 1.24],
        ['a', 'dark', 0.96, 0.56, -1.4, 0.6, 1.24, 1.24],
      ]);
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.14, 12), dark, 0, 1.05, -2.2, Math.PI / 2);  // tail spare
      add(new THREE.BoxGeometry(0.9, 0.22, 0.05), dark, 0, 1.06, 2.16);
      tooth(0, 1.06, 2.19, 0.96, 0.04);
      add(new THREE.BoxGeometry(0.26, 0.26, 0.05), dark, -0.62, 1.14, 2.16);         // square bezels…
      add(new THREE.BoxGeometry(0.26, 0.26, 0.05), dark, 0.62, 1.14, 2.16);
      eye(-0.62, 1.14, 2.19, 0.095); eye(0.62, 1.14, 2.19, 0.095);                   // …round lamps in them
      lamp('head', -0.62, 1.14, 2.17, 0.2, 0.2); lamp('head', 0.62, 1.14, 2.17, 0.2, 0.2);
      lamp('tail', -0.7, 0.98, -2.16, 0.22, 0.16); lamp('tail', 0.7, 0.98, -2.16, 0.22, 0.16);
      wheel(-0.96, 1.4, 1, 0.54, 0.48); wheel(0.96, 1.4, 1, 0.54, 0.48);
      wheel(-0.96, -1.4, 0, 0.54, 0.48); wheel(0.96, -1.4, 0, 0.54, 0.48);

    } else if (vehicle === 'siipi') {         // Hilja Siipi: the wing — chrome-era grand tourer
      weld(g, M, [
        ['c', 'paint', 0, 0.54, 0, 1.85, 0.42, 4.3],
        ['q', 'paint', 0, 0.76, 1.55, 1.85, 0.3, 0.6, 2],      // rounded hood nose
        ['w', 'paint', 0, 0.78, 0.9, 1.85, 0.2, 1.1],
        ['c', 'dark', 0, 0.96, -0.25, 1.42, 0.3, 1.6],
        ['w', 'glass', 0, 1.12, 0.5, 1.5, 0.34, 0.6],
        ['q', 'paint', 0, 1.08, -0.4, 1.54, 0.34, 0.95],       // dome roof curve
        ['q', 'paint', 0, 0.74, -1.7, 1.85, 0.28, 0.55],       // round tail
        ['a', 'paint', -0.9, 0.44, 1.35, 0.5, 1.12, 1.12],
        ['a', 'paint', 0.9, 0.44, 1.35, 0.5, 1.12, 1.12],
        ['a', 'paint', -0.9, 0.44, -1.35, 0.52, 1.14, 1.14],
        ['a', 'paint', 0.9, 0.44, -1.35, 0.52, 1.14, 1.14],
      ]);
      add(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 8), chromeM, -0.75, 0.42, -0.1, Math.PI / 2, 0, Math.PI / 2); // side pipes
      add(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 8), chromeM, 0.75, 0.42, -0.1, Math.PI / 2, 0, Math.PI / 2);
      tooth(0, 0.66, 2.09, 1.2, 0.3);                                                // the wide chrome mouth
      add(new THREE.BoxGeometry(1.08, 0.22, 0.05), dark, 0, 0.66, 2.12);
      tooth(0, 0.66, 2.15, 0.14, 0.14);                                              // center medallion
      eye(-0.6, 0.72, 2.1, 0.105); eye(0.6, 0.72, 2.1, 0.105);
      lamp('head', -0.6, 0.72, 2.08, 0.2, 0.2); lamp('head', 0.6, 0.72, 2.08, 0.2, 0.2);
      lamp('tail', -0.55, 0.66, -2.09, 0.28, 0.1); lamp('tail', 0.55, 0.66, -2.09, 0.28, 0.1);
      wheel(-0.9, 1.35, 1, 0.44, 0.38); wheel(0.9, 1.35, 1, 0.44, 0.38);
      wheel(-0.9, -1.35, 0, 0.44, 0.4); wheel(0.9, -1.35, 0, 0.44, 0.4);

    } else if (vehicle === 'babanh') {        // Đồi Ba Bánh: three wheels, zero fear
      weld(g, M, [
        ['c', 'paint', 0, 0.5, -0.3, 1.15, 0.5, 1.9],          // cab
        ['w', 'paint', 0, 0.86, 0.75, 1.05, 0.22, 0.8],        // nose slope
        ['c', 'paint', 0, 1.18, -0.45, 1.2, 0.14, 1.5],        // canopy roof
        ['c', 'dark', -0.54, 0.92, -0.45, 0.08, 0.4, 1.4],     // canopy posts
        ['c', 'dark', 0.54, 0.92, -0.45, 0.08, 0.4, 1.4],
        ['w', 'glass', 0, 0.98, 0.42, 1.05, 0.3, 0.45],
        ['c', 'dark', 0, 0.42, -1.3, 1.15, 0.34, 0.5],         // tail box
      ]);
      add(new THREE.BoxGeometry(0.66, 0.16, 0.05), dark, 0, 0.62, 1.17);
      eye(0, 0.84, 1.18, 0.1);                                                       // one honest lamp
      lamp('head', 0, 0.84, 1.16, 0.18, 0.18);
      lamp('tail', -0.4, 0.5, -1.56, 0.16, 0.12); lamp('tail', 0.4, 0.5, -1.56, 0.16, 0.12);
      rider(-0.35);
      wheel(0, 1.05, 1, 0.36, 0.24);                                                 // THE front wheel
      wheel(-0.62, -1.05, 0, 0.4, 0.3); wheel(0.62, -1.05, 0, 0.4, 0.3);

    } else if (vehicle === 'shopkart') {      // Shopping Kart: straight from the Granada lot
      weld(g, M, [
        ['c', 'dark', 0, 0.32, 0, 1.0, 0.1, 2.0],              // chassis rails
        ['c', 'paint', 0, 0.62, 0.1, 1.06, 0.08, 1.5],         // basket floor
        ['c', 'paint', -0.52, 0.92, 0.1, 0.06, 0.55, 1.5],     // basket walls
        ['c', 'paint', 0.52, 0.92, 0.1, 0.06, 0.55, 1.5],
        ['w', 'paint', 0, 0.92, 0.92, 1.02, 0.55, 0.14],       // sloped front wall
        ['c', 'paint', 0, 0.92, -0.68, 1.02, 0.55, 0.06],      // back wall
        ['c', 'dark', 0, 0.44, -0.75, 0.8, 0.3, 0.5],          // engine slung under the back
      ]);
      tooth(0, 1.32, -0.85, 1.1, 0.06);                                              // THE handle
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), dark, -0.5, 1.18, -0.8, 0.5);
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), dark, 0.5, 1.18, -0.8, 0.5);
      rider(0.05);
      lamp('head', 0, 0.66, 0.99, 0.16, 0.1);
      lamp('tail', 0, 0.56, -1.02, 0.16, 0.1);
      wheel(-0.5, 0.75, 1, 0.2, 0.14); wheel(0.5, 0.75, 1, 0.2, 0.14);               // casters
      wheel(-0.5, -0.75, 0, 0.2, 0.14); wheel(0.5, -0.75, 0, 0.2, 0.14);

    } else {                                  // 'f1' — Enginos Volante F: the classic — cigar, airbox, fat slicks
      weld(g, M, [
        ['c', 'paint', 0, 0.46, 0.3, 0.72, 0.44, 2.9],             // cigar core
        ['q', 'paint', 0, 0.5, 1.7, 0.7, 0.36, 0.6, 2],            // rounded nose drop
        ['w', 'paint', 0, 0.74, 0.9, 0.66, 0.22, 1.3],             // scuttle slope to the cockpit
        ['c', 'dark', 0, 0.3, 2.35, 1.55, 0.07, 0.5],              // low front wing
        ['c', 'dark', 0, 0.7, 0.35, 0.6, 0.26, 0.7],               // cockpit surround
        ['q', 'paint', 0, 0.86, -0.25, 0.5, 0.34, 0.5],            // headrest fairing curve
        ['c', 'dark', 0, 1.1, -0.45, 0.34, 0.44, 0.44],            // TALL airbox
        ['w', 'dark', 0, 1.36, -0.45, 0.3, 0.14, 0.4, 2],          // airbox lip
        ['c', 'dark', 0, 0.56, -1.25, 0.78, 0.44, 1.1],            // exposed engine block
        ['c', 'paint', 0, 0.4, -1.2, 1.3, 0.16, 0.9],              // side fairings over the exhausts
        ['c', 'dark', 0, 1.2, -1.95, 1.62, 0.08, 0.5],             // rear wing up on struts
        ['c', 'dark', 0, 0.86, -1.95, 0.08, 0.6, 0.4],             // center strut
        ['c', 'dark', -0.78, 0.96, -1.95, 0.07, 0.42, 0.5],        // endplates
        ['c', 'dark', 0.78, 0.96, -1.95, 0.07, 0.42, 0.5],
      ]);
      for (const sx of [-1, 1]) {                                   // the open-wheel skeleton
        add(new THREE.CylinderGeometry(0.05, 0.08, 0.9, 6), dark, sx * 0.42, 0.42, -1.75, Math.PI / 2);  // exhaust megaphones
        add(new THREE.BoxGeometry(0.05, 0.05, 1.0), dark, sx * 0.55, 0.48, 1.45, 0, sx * 0.55);          // front suspension arms
        add(new THREE.BoxGeometry(0.06, 0.05, 0.9), dark, sx * 0.6, 0.5, -1.3, 0, sx * -0.5);            // rear arms
      }
      add(new THREE.SphereGeometry(0.29, 10, 8), helmetMat, 0, 0.88, 0.3);
      add(new THREE.BoxGeometry(0.4, 0.06, 0.2), dark, 0, 0.72, 0.62);     // dash + tiny wheel
      lamp('tail', 0, 0.82, -2.2, 0.18, 0.18);
      wheel(-0.95, 1.5, 1, 0.4, 0.28); wheel(0.95, 1.5, 1, 0.4, 0.28);     // skinny fronts
      wheel(-1.02, -1.35, 0, 0.52, 0.56); wheel(1.02, -1.35, 0, 0.52, 0.56); // FAT rear slicks
    }
    applyDecals(vehicle);
    return wheels;
  };
})();
